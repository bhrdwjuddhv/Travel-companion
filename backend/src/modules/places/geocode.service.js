import { ENV, TTL_HOURS, TIMEOUTS_MS } from '../../constants.js';
import { HttpError } from '../../shared/errors.js';
import { fetchJson } from '../../shared/fetchJson.js';
import { cached } from '../../shared/cache.js';
import { logger } from '../../shared/logger.js';

const log = logger('places');
const URL_BASE = 'https://maps.googleapis.com/maps/api/geocode/json';

/** Resolves an ambiguous place name to a canonical name + coordinates. */
export function resolveLocation(query) {
  return cached(log, 'geocode', `geocode:${query.toLowerCase()}`, TTL_HOURS.attraction, async () => {
    const body = await fetchJson(
      `${URL_BASE}?address=${encodeURIComponent(query)}&key=${ENV.GOOGLE_MAPS_API_KEY}`,
      { timeoutMs: TIMEOUTS_MS.geocode, label: 'Geocoding API' }
    );
    if (body.status !== 'OK' || !body.results?.length) {
      throw new HttpError(422, `Could not resolve location "${query}" (${body.status})`);
    }
    const hit = body.results[0];
    return {
      query,
      name: hit.formatted_address,
      placeId: hit.place_id,
      lat: hit.geometry.location.lat,
      lng: hit.geometry.location.lng,
      source: 'google_geocoding',
      timestamp: new Date().toISOString(),
    };
  });
}
