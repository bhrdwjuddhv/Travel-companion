import { QdrantClient } from '@qdrant/js-client-rest';
import { ENV, QDRANT } from '../constants.js';

export const qdrant = ENV.QDRANT_URL
  ? new QdrantClient({ url: ENV.QDRANT_URL, apiKey: ENV.QDRANT_API_KEY })
  : null;

// Non-fatal: Qdrant is only needed from M3 on.
export async function ensureCollection() {
  if (!qdrant) return 'disabled';
  const { collections } = await qdrant.getCollections();
  if (collections.some((c) => c.name === QDRANT.collection)) return 'ok';
  await qdrant.createCollection(QDRANT.collection, {
    vectors: { size: QDRANT.vectorSize, distance: QDRANT.distance },
  });
  return 'created';
}
