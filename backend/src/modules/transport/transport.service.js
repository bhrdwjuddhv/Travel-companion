import { PROVIDERS, MODE_BY_DISTANCE } from '../../constants.js';
import { logger } from '../../shared/logger.js';
import * as railradar from './railradar.provider.js';
import * as googleEstimator from './googleEstimator.provider.js';
import { computeRoute } from './googleEstimator.provider.js';

const log = logger('transport');

/**
 * Every provider exports `getOptions({from,to,mode,maxFare})` and returns
 * RouteSegment-shaped objects (minus `id`). That's the whole interface.
 */
const REGISTRY = { railradar, google_estimator: googleEstimator };

const MODES_TO_TRY = { any: ['train', 'bus', 'car'], train: ['train'], bus: ['bus'], flight: ['flight'], car: ['car'] };

const norm = (v, lo, hi) => (hi === lo ? 0 : (v - lo) / (hi - lo));

/**
 * No stated preference: let the distance decide which providers are even worth
 * calling. Flying 200km or driving 1,500km are both answers nobody wants, and
 * skipping the pointless providers cuts the request count too.
 *
 * The route lookup is cached, so the providers that follow reuse it for free.
 */
async function modesByDistance(from, to) {
  try {
    const { distanceKm } = await computeRoute(from, to, 'car');
    const modes =
      distanceKm <= MODE_BY_DISTANCE.shortMaxKm ? ['car', 'bus', 'train']
      : distanceKm <= MODE_BY_DISTANCE.mediumMaxKm ? ['train', 'bus']
      : ['train', 'flight'];
    log.info(`${from}->${to} is ${distanceKm}km, trying ${modes.join('/')}`);
    return modes;
  } catch (e) {
    log.warn(`distance unknown for ${from}->${to}, trying everything: ${e.message}`);
    return MODES_TO_TRY.any;
  }
}

/**
 * Gathers options across modes *in parallel* and ranks them on price, time and
 * the user's stated preference. A provider that fails or times out is skipped,
 * not fatal (§14).
 */
export async function getTransportOptions({ from, to, mode = 'any', preference = 'any', maxFare = null, date = null, classes = undefined }) {
  const modes = mode === 'any' || !MODES_TO_TRY[mode] ? await modesByDistance(from, to) : MODES_TO_TRY[mode];

  const settled = await Promise.allSettled(
    modes.map((m) => REGISTRY[PROVIDERS[m]].getOptions({ from, to, mode: m, maxFare, date, classes }))
  );

  const failures = [];
  settled.forEach((r, i) => {
    if (r.status === 'rejected') {
      failures.push(`${modes[i]}: ${r.reason.message}`);
      log.warn(`${modes[i]} unavailable for ${from}->${to}, skipping: ${r.reason.message}`);
    }
  });

  let options = settled.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));

  if (!options.length) {
    // Last resort: an explicitly-marked estimate beats no plan at all. Never
    // fall back *as a train* — the estimator has no train data, and a made-up
    // train is worse than an honest bus estimate.
    const fallbackMode = mode === 'any' || mode === 'train' ? 'bus' : mode;
    log.warn(`no ${mode} for ${from}->${to}, falling back to a ${fallbackMode} estimate`);
    options = await googleEstimator.getOptions({ from, to, mode: fallbackMode });
  }

  const fares = options.map((o) => o.fare);
  const times = options.map((o) => o.durationMinutes);
  const [fLo, fHi] = [Math.min(...fares), Math.max(...fares)];
  const [tLo, tHi] = [Math.min(...times), Math.max(...times)];

  const ranked = options
    .map((o) => ({
      ...o,
      _score: 0.45 * norm(o.fare, fLo, fHi) + 0.35 * norm(o.durationMinutes, tLo, tHi) - (o.mode === preference ? 0.2 : 0),
    }))
    .sort((a, b) => a._score - b._score)
    .map(({ _score, ...o }) => o);

  return { pick: ranked[0], alternatives: ranked.slice(1, 6), failures };
}

export const localHop = googleEstimator.localHop;
