import { ENV, STAY_RATES, TTL_HOURS, TIMEOUTS_MS } from '../../constants.js';
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
  'places.primaryTypeDisplayName',
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

// Ranking signal: quality weighted by how much evidence backs it.
const score = (p) => (p.rating ?? 0) * Math.log10((p.userRatingCount ?? 0) + 10);

export async function searchStays(destination, { preference = 'any', maxPricePerNight = null, preferPriceUpTo = null, limit = 6 } = {}) {
  const kind = preference === 'any' ? 'hotels' : `${preference}s`;
  const places = await searchText(`${kind} to stay in ${destination}`, { limit: limit * 2, ttlHours: TTL_HOURS.stay });
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
      // Places returns a price *band*, not a rate — hence always an estimate.
      pricePerNight: STAY_RATES[p.priceLevel] ?? STAY_RATES.default,
      priceType: 'estimate',
      source: 'google_places',
      timestamp,
    }))
    // A numeric budget is a hard cap; a tier only *prefers* its band, so a
    // budget tier in an expensive city still returns somewhere to sleep.
    .filter((s) => maxPricePerNight == null || s.pricePerNight <= maxPricePerNight)
    .sort((a, b) => {
      if (preferPriceUpTo != null) {
        const inBand = (s) => (s.pricePerNight <= preferPriceUpTo ? 0 : 1);
        if (inBand(a) !== inBand(b)) return inBand(a) - inBand(b);
      }
      return score(b) - score(a);
    })
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
    address: p.formattedAddress ?? null,
    rating: p.rating ?? null,
    reviewCount: p.userRatingCount ?? null,
    lat: p.location?.latitude ?? null,
    lng: p.location?.longitude ?? null,
    source: 'google_places',
    timestamp,
  }));
}
