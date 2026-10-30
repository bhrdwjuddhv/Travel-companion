// Turning what Google tells us about a hotel into a nightly rupee figure.
// Pure and deterministic: same inputs, same number, no model involved. Every
// value it reads lives in HOTEL_ESTIMATE.
import { HOTEL_ESTIMATE as E } from '../../constants.js';

const clamp01 = (n) => Math.min(1, Math.max(0, n));

/** metro / tier2 / touristHill, by city name. Unlisted cities get the default. */
export function cityTierOf(destination) {
  const key = String(destination ?? '').trim().toLowerCase();
  if (E.cityTier[key]) return E.cityTier[key];
  // "Leh-Ladakh", "Goa, India" and friends: match on the first known word.
  const word = key.split(/[\s,\-–]+/).find((w) => E.cityTier[w]);
  return word ? E.cityTier[word] : E.defaultCityTier;
}

/** One notch dearer, without running off the end of the scale. */
const bump = (klass) =>
  E.classOrder[Math.min(E.classOrder.indexOf(klass) + 1, E.classOrder.length - 1)] ?? klass;

/**
 * How expensive a place is, before the city is taken into account.
 *
 * Google's own price level wins when it exists. It almost never does for
 * lodging, so the real work is done by the type: a `hostel` and a
 * `resort_hotel` are not the same product, and Google does label them.
 */
export function classOf({ priceLevel = null, primaryType = null, types = [] } = {}) {
  const byLevel = priceLevel ? E.classByPriceLevel[priceLevel] : null;
  const byType = E.classByType[primaryType] ?? types.map((t) => E.classByType[t]).find(Boolean);

  let klass = byLevel ?? byType ?? E.defaultClass;
  // A hotel with a spa and a casino attached is not a mid-range hotel.
  if (!byLevel && types.some((t) => E.luxuryMarkers.includes(t))) klass = bump(klass);
  return klass;
}

/**
 * Where in its band a place sits, from 0 (floor) to 1 (ceiling).
 *
 * A high rating earns the top of the band, but only once enough people have
 * said so — a handful of five-star reviews gets pulled back toward the middle
 * rather than pricing a new guesthouse like a landmark.
 */
export function positionInBand(rating, reviewCount = 0) {
  if (rating == null) return 0.5;
  const { low, high, confidentAfterReviews, unprovenPull } = E.rating;
  const raw = clamp01((rating - low) / (high - low));
  const confidence = clamp01((reviewCount ?? 0) / confidentAfterReviews);
  const pull = unprovenPull * (1 - confidence);
  return raw * (1 - pull) + 0.5 * pull;
}

/**
 * A nightly rate in INR for one candidate.
 *
 * Returns the number plus how it was reached, so the UI can say "estimated
 * from the type and rating" rather than presenting a figure from nowhere.
 */
export function estimateNightlyRate(candidate, { destination, preference = 'any' } = {}) {
  const tier = cityTierOf(destination ?? candidate.destination);
  const klass = classOf(candidate);
  const band = (E.bands[tier] ?? E.bands[E.defaultCityTier])[klass] ?? E.bands[E.defaultCityTier][E.defaultClass];

  const position = positionInBand(candidate.rating, candidate.reviewCount);
  const multiplier = E.preferenceMultiplier[preference] ?? 1;
  const raw = (band.min + position * (band.max - band.min)) * multiplier;

  return {
    pricePerNight: Math.max(E.roundTo, Math.round(raw / E.roundTo) * E.roundTo),
    basis: { cityTier: tier, class: klass, band, position: Math.round(position * 100) / 100, multiplier },
  };
}

/** One line a person can read, for the "est." tooltip. */
export const explainEstimate = (basis) =>
  `Estimated from a ${basis.class} in a ${basis.cityTier} city, placed by rating ` +
  `(₹${basis.band.min}–₹${basis.band.max}/night band). Not a quoted rate.`;
