import { ENV, TTL_HOURS, TIMEOUTS_MS } from '../../constants.js';
import { fetchJson } from '../../shared/fetchJson.js';
import { cached } from '../../shared/cache.js';
import { logger } from '../../shared/logger.js';
import { normalizePlaceName } from '../../shared/placeName.js';

const log = logger('places');
const SEARCH_URL = 'https://places.googleapis.com/v1/places:searchText';
const FIELDS = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.rating',
  'places.userRatingCount',
  'places.priceLevel',
  'places.location',
  'places.types',
  'places.primaryType',
  'places.primaryTypeDisplayName',
  'places.photos',
].join(',');

function searchText(textQuery, { limit = 10, ttlHours }) {
  return cached(log, 'places:searchText', `places:${textQuery}:${limit}`, ttlHours, async () => {
    const body = await fetchJson(SEARCH_URL, {
      method: 'POST',
      timeoutMs: TIMEOUTS_MS.places,
      label: 'Places search',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': ENV.GOOGLE_MAPS_API_KEY,
        'X-Goog-FieldMask': FIELDS,
      },
      body: JSON.stringify({ textQuery, maxResultCount: limit }),
    });
    return body.places ?? [];
  });
}

/**
 * The first photo Places offers, as a reference rather than a URL. The URL
 * needs the API key, so it is built server-side by the photo route — a key in
 * an <img src> would be a key in everyone's browser.
 */
const firstPhoto = (p) => {
  const photo = p.photos?.[0];
  if (!photo?.name) return null;
  return {
    ref: photo.name,
    attribution: photo.authorAttributions?.[0]?.displayName ?? null,
  };
};

// Ranking signal: quality weighted by how much evidence backs it.
const score = (p) => (p.rating ?? 0) * Math.log10((p.userRatingCount ?? 0) + 10);

export async function searchStays(destination, { preference = 'any', hint = null, limit = 6 } = {}) {
  const kind = preference === 'any' ? 'hotels' : `${preference}s`;
  const places = await searchText(`${hint ? `${hint} ` : ''}${kind} to stay in ${destination}`, {
    limit: limit * 2,
    ttlHours: TTL_HOURS.stay,
  });
  const timestamp = new Date().toISOString();

  return places
    .map((p) => ({
      placeId: p.id,
      name: normalizePlaceName(p.displayName?.text) || 'Unknown',
      type: p.primaryTypeDisplayName?.text ?? preference,
      address: p.formattedAddress ?? null,
      rating: p.rating ?? null,
      reviewCount: p.userRatingCount ?? null,
      lat: p.location?.latitude ?? null,
      lng: p.location?.longitude ?? null,
      // No price is set here. Places has no nightly rate and, for lodging,
      // almost never even a priceLevel — so the raw signals go up and
      // hotels/estimate.js turns them into a number.
      priceLevel: p.priceLevel ?? null,
      photo: firstPhoto(p),
      primaryType: p.primaryType ?? null,
      types: p.types ?? [],
      source: 'google_places',
      timestamp,
    }))
    // Ranked on quality only; hotels.service prices them and fits the budget.
    .sort((a, b) => score(b) - score(a))
    .slice(0, limit);
}

export async function searchAttractions(destination, { interests = [], limit = 12 } = {}) {
  const query = interests.length
    ? `${interests.join(', ')} things to do in ${destination}`
    : `top attractions in ${destination}`;
  const places = await searchText(query, { limit, ttlHours: TTL_HOURS.attraction });
  const timestamp = new Date().toISOString();

  return places.map((p) => ({
    placeId: p.id,
    name: normalizePlaceName(p.displayName?.text) || 'Unknown',
    category: p.primaryTypeDisplayName?.text ?? 'attraction',
    photo: firstPhoto(p),
    address: p.formattedAddress ?? null,
    rating: p.rating ?? null,
    reviewCount: p.userRatingCount ?? null,
    lat: p.location?.latitude ?? null,
    lng: p.location?.longitude ?? null,
    source: 'google_places',
    timestamp,
  }));
}
