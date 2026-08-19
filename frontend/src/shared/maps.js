import { MAPS } from '../constants';

/**
 * A Google Maps link for a place. With a placeId the link resolves to that
 * exact place; without one it falls back to a text search scoped to the city.
 */
export function mapsUrl({ name, placeId = null, destination = null }) {
  const query = encodeURIComponent(placeId || !destination ? name : `${name}, ${destination}`);
  const place = placeId ? `&query_place_id=${encodeURIComponent(placeId)}` : '';
  return `${MAPS.searchUrl}&query=${query}${place}`;
}

export const openInMaps = (place) => window.open(mapsUrl(place), '_blank', 'noopener,noreferrer');
