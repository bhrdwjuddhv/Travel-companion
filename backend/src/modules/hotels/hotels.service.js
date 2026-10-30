// Where a stay comes from, and what it costs.
//
// Discovery is Google Places. Pricing is the estimate model in estimate.js,
// because Places has no nightly rate to give. This file is the seam: a
// provider that quotes real rates slots in here and nothing else changes.
import { HOTEL_ESTIMATE, PROVIDERS } from '../../constants.js';
import { logger, now, since } from '../../shared/logger.js';
import { searchStays as searchStaysOnPlaces } from '../places/places.service.js';
import { estimateNightlyRate, explainEstimate } from './estimate.js';

const log = logger('hotels');

/**
 * How well a stay fits what was asked for. Budget first on purpose: a
 * beautiful hotel that busts the cap is the failure this scoring exists to
 * prevent.
 */
function score(stay, { tier, capPerNight }) {
  const perNight = stay.pricePerNight;
  let value = 0;

  if (capPerNight != null && perNight > capPerNight) value -= 1000;
  if (tier?.maxPricePerNight != null) {
    value += perNight <= tier.maxPricePerNight ? 60 : -40;
    // Inside the band, nearer the top usually means a better room.
    value += (1 - Math.abs(tier.maxPricePerNight - perNight) / tier.maxPricePerNight) * 15;
  }
  // Quality, weighted by how much evidence backs it.
  value += (stay.rating ?? 0) * Math.log10((stay.reviewCount ?? 0) + 10) * 6;

  return value;
}

/**
 * Keeps the best stay plus a spread around it.
 *
 * The budget sliders and the Semi dropdowns are only useful if the
 * alternatives differ in price, so the cheapest and the dearest survivors are
 * kept deliberately rather than taking the top N by score, which would hand
 * back five hotels at nearly the same rate.
 */
function withSpread(ranked, limit) {
  if (ranked.length <= limit) return ranked;

  const [best, ...rest] = ranked;
  const byPrice = [...rest].sort((a, b) => a.pricePerNight - b.pricePerNight);
  const picks = [best];

  const cheapest = byPrice[0];
  const dearest = byPrice[byPrice.length - 1];
  for (const option of [cheapest, dearest]) {
    if (option && !picks.includes(option)) picks.push(option);
  }
  for (const option of rest) {
    if (picks.length >= limit) break;
    if (!picks.includes(option)) picks.push(option);
  }
  return picks.slice(0, limit);
}

/**
 * Stays for one destination, best first.
 *
 * Same contract the Places search had, so the planner, the Stepwise flow and
 * replace_accommodation all call it unchanged.
 */
export async function findStays(
  destination,
  { preference = 'any', maxPricePerNight = null, preferPriceUpTo = null, nights = 1, rooms = 1, tier = null, limit = 6 } = {}
) {
  const began = now();

  const candidates = await searchStaysOnPlaces(destination, {
    preference,
    hint: tier ? HOTEL_ESTIMATE.searchHint[tier.id] ?? null : null,
    // Pricing happens after this call now, so the search itself must not
    // filter on a price it does not yet know.
    limit: Math.max(limit * 2, 10),
  });

  if (!candidates.length) {
    log.warn(`no stays found in ${destination}`);
    return [];
  }

  const priced = candidates.map((candidate) => {
    const { pricePerNight, basis } = estimateNightlyRate(candidate, { destination, preference });
    return {
      ...candidate,
      pricePerNight,
      priceType: 'estimate',
      priceBasis: explainEstimate(basis),
      priceClass: basis.class,
    };
  });

  const capPerNight = maxPricePerNight ?? preferPriceUpTo ?? null;
  const ranked = priced.sort((a, b) => score(b, { tier, capPerNight }) - score(a, { tier, capPerNight }));
  const picks = withSpread(ranked, limit);

  const prices = picks.map((p) => p.pricePerNight);
  log.info(
    `${PROVIDERS.hotel} ${destination} ${since(began)} -> ${picks.length} stays ` +
      `₹${Math.min(...prices)}–₹${Math.max(...prices)}/night, top: ${picks[0].name} (${picks[0].priceClass})`
  );
  return picks;
}
