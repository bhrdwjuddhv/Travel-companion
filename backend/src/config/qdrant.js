import { QdrantClient } from '@qdrant/js-client-rest';
import { ENV, QDRANT } from '../constants.js';

export const qdrant = ENV.QDRANT_URL
  ? new QdrantClient({ url: ENV.QDRANT_URL, apiKey: ENV.QDRANT_API_KEY })
  : null;

/**
 * Qdrant refuses a filtered search on a field it has no payload index for, and
 * freshGemsFor filters on all three of these. Without them every lookup fails,
 * which the code treats as a cache miss — so gems were written on every
 * generation and never once read back, and each trip paid for a fresh web
 * search it already had the answer to.
 *
 * Creating an index that already exists is a no-op, so this is safe to run on
 * every boot.
 */
const FILTERED_FIELDS = {
  destination: 'keyword',
  dataType: 'keyword',
  timestampMs: 'integer',
};

async function ensureIndexes() {
  await Promise.all(
    Object.entries(FILTERED_FIELDS).map(([field_name, field_schema]) =>
      qdrant.createPayloadIndex(QDRANT.collection, { field_name, field_schema, wait: true })
    )
  );
}

// Non-fatal: Qdrant is only needed from M3 on.
export async function ensureCollection() {
  if (!qdrant) return 'disabled';
  const { collections } = await qdrant.getCollections();
  if (collections.some((c) => c.name === QDRANT.collection)) {
    await ensureIndexes();
    return 'ok';
  }
  await qdrant.createCollection(QDRANT.collection, {
    vectors: { size: QDRANT.vectorSize, distance: QDRANT.distance },
  });
  await ensureIndexes();
  return 'created';
}
