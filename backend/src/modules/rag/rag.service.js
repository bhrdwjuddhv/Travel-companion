import { randomUUID } from 'node:crypto';
import { qdrant } from '../../config/qdrant.js';
import { ENV, MODELS, QDRANT, TTL_HOURS, TIMEOUTS_MS } from '../../constants.js';
import { fetchJson } from '../../shared/fetchJson.js';
import { logger } from '../../shared/logger.js';

const log = logger('rag');

/**
 * Retrieval here is a metadata filter on the city, which needs no vector at
 * all. We still embed on ingest: the collection requires a vector, and it is
 * what makes "somewhere quiet with old architecture" searchable later.
 */
async function embed(text) {
  const body = await fetchJson('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    timeoutMs: TIMEOUTS_MS.llm,
    label: 'Embeddings API',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ENV.OPENAI_API_KEY}` },
    body: JSON.stringify({ model: MODELS.EMBEDDING, input: text }),
  });
  return body.data[0].embedding;
}

const cutoff = () => Date.now() - TTL_HOURS.hiddenGem * 3600_000;

/**
 * Gems already known for a city, if they're still fresh. Returns null when the
 * city is missing or stale, which is the caller's cue to go research it.
 */
export async function freshGemsFor(city) {
  if (!qdrant) return null;
  try {
    const { points } = await qdrant.scroll(QDRANT.collection, {
      limit: 20,
      with_payload: true,
      with_vector: false,
      filter: {
        must: [
          { key: 'destination', match: { value: city } },
          { key: 'dataType', match: { value: 'hidden_gem' } },
          { key: 'timestampMs', range: { gte: cutoff() } },
        ],
      },
    });

    if (!points?.length) {
      log.info(`${city} MISS (no fresh gems)`);
      return null;
    }
    log.info(`${city} HIT (${points.length} gems)`);
    return points.map((p) => ({
      destination: p.payload.destination,
      name: p.payload.name,
      note: p.payload.note,
      url: p.payload.url ?? null,
    }));
  } catch (e) {
    // Qdrant being down must never stop a trip being planned.
    log.warn(`lookup failed for ${city}, researching instead: ${e.message}`);
    return null;
  }
}

/** Stores freshly-researched gems, keyed by city, with the time they were found. */
export async function ingestGems(gems) {
  if (!qdrant || !gems.length) return 0;
  try {
    const timestampMs = Date.now();
    const points = await Promise.all(
      gems.map(async (gem) => ({
        id: randomUUID(),
        vector: await embed(`${gem.name}, ${gem.destination}. ${gem.note}`),
        payload: {
          destination: gem.destination,
          dataType: 'hidden_gem',
          name: gem.name,
          note: gem.note,
          url: gem.url ?? null,
          source: gem.url ?? 'web_search',
          timestampMs,
          timestamp: new Date(timestampMs).toISOString(),
        },
      }))
    );

    await qdrant.upsert(QDRANT.collection, { wait: false, points });
    log.info(`ingested ${points.length} gems`);
    return points.length;
  } catch (e) {
    log.warn(`ingest failed, gems used but not stored: ${e.message}`);
    return 0;
  }
}
