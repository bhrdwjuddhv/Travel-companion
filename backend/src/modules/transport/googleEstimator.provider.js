import { ENV, INTERCITY_RATES, FARE_RATES, TTL_HOURS, TIMEOUTS_MS } from '../../constants.js';
import { HttpError } from '../../shared/errors.js';
import { fetchJson } from '../../shared/fetchJson.js';
import { cached } from '../../shared/cache.js';
import { logger } from '../../shared/logger.js';

const log = logger('transport');
const ROUTES_URL = 'https://routes.googleapis.com/directions/v2:computeRoutes';

// Routes has no "fly" mode; road distance stands in as the proxy for flights.
const TRAVEL_MODE = {
  car: 'DRIVE', bus: 'DRIVE', flight: 'DRIVE', train: 'DRIVE',
  auto: 'DRIVE', cab: 'DRIVE', walk: 'WALK',
};

/** Distance + duration straight from Google. Deterministic — never modelled. */
export function computeRoute(from, to, mode = 'car') {
  const travelMode = TRAVEL_MODE[mode] ?? 'DRIVE';
  return cached(log, 'google_routes', `route:${from}|${to}|${travelMode}`, TTL_HOURS.fare, async () => {
    const body = await fetchJson(ROUTES_URL, {
      method: 'POST',
      timeoutMs: TIMEOUTS_MS.routes,
      label: 'Routes API',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': ENV.GOOGLE_MAPS_API_KEY,
        'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration',
      },
      body: JSON.stringify({ origin: { address: from }, destination: { address: to }, travelMode }),
    });

    const route = body.routes?.[0];
    if (!route) throw new HttpError(422, `No route found between "${from}" and "${to}"`);
    return {
      distanceKm: Math.round(route.distanceMeters / 100) / 10,
      durationMinutes: Math.round(parseInt(route.duration, 10) / 60),
      source: 'google_routes',
      timestamp: new Date().toISOString(),
    };
  });
}

const estimateIntercityFare = (mode, km) => {
  const r = INTERCITY_RATES[mode] ?? INTERCITY_RATES.bus;
  return Math.round(Math.max(r.minimum ?? 0, r.base + r.perKm * km));
};

// ~700km/h cruise plus 2h of airport overhead.
const estimateFlightMinutes = (km) => Math.round((km / 700) * 60 + 120);

/** Bus / flight / car: real distance from Google, fare from tunable rates. */
export async function getOptions({ from, to, mode }) {
  const route = await computeRoute(from, to, mode);
  return [
    {
      fromPlace: from,
      toPlace: to,
      mode,
      provider: 'google_estimator',
      service: null,
      distanceKm: route.distanceKm,
      durationMinutes: mode === 'flight' ? estimateFlightMinutes(route.distanceKm) : route.durationMinutes,
      fare: estimateIntercityFare(mode, route.distanceKm),
      fareType: 'estimate',
      class: null,
      stops: null,
      source: 'google_routes+rate_card',
      timestamp: route.timestamp,
    },
  ];
}

/** Local hops between activities. Always an estimate in MVP. */
export async function localHop({ from, to, city }) {
  const rates = FARE_RATES[city] ?? FARE_RATES.default;
  const route = await computeRoute(from, to, 'cab');
  const km = route.distanceKm;
  const mode = km <= rates.walkMaxKm ? 'walk' : km <= 8 ? 'auto' : 'cab';
  const fare =
    mode === 'walk' ? 0
    : mode === 'auto' ? Math.round(rates.auto.base + rates.auto.perKm * km)
    : Math.round(Math.max(rates.cab.minimum, rates.cab.base + rates.cab.perKm * km));
  return { mode, distanceKm: km, durationMinutes: route.durationMinutes, estimatedFare: fare, fareType: 'estimate' };
}
