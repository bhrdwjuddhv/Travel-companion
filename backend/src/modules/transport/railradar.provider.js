import { ENV, TTL_HOURS, TRAIN_FARE_PER_KM, TIMEOUTS_MS } from '../../constants.js';
import { fetchJson } from '../../shared/fetchJson.js';
import { cached } from '../../shared/cache.js';
import { logger } from '../../shared/logger.js';
import { computeRoute } from './googleEstimator.provider.js';
import { WEEKDAYS, weekdayOf, addDays } from '../../shared/dates.js';
import { HttpError } from '../../shared/errors.js';

const log = logger('transport');
const BASE = 'https://api.railradar.in/v1';

const get = (path, ttlHours) =>
  cached(log, 'railradar', `rr:${path}`, ttlHours, () =>
    fetchJson(`${BASE}${path}`, {
      timeoutMs: TIMEOUTS_MS.railradar,
      label: 'RailRadar',
      headers: { Authorization: `Bearer ${ENV.RAILRADAR_API_KEY}` },
    })
  );

async function stationCode(place) {
  const body = await get(`/lookup/search/stations?q=${encodeURIComponent(place)}&limit=5`, TTL_HOURS.attraction);
  const list = body.data?.stations ?? body.data ?? [];
  return list[0]?.code ?? null;
}

// "16:35" / "16h 35m" / "995" — RailRadar isn't consistent, so parse loosely.
function travelMinutes(raw) {
  if (typeof raw === 'number') return raw;
  const s = String(raw ?? '');
  const hm = s.match(/(\d+)\s*[h:]\s*(\d+)/);
  if (hm) return Number(hm[1]) * 60 + Number(hm[2]);
  const n = Number(s.replace(/\D/g, ''));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

const DEFAULT_CLASSES = ['3A', 'SL', '2A'];

/** "22:40", "22:40:00" or "2026-09-01T22:40:00Z" -> "22:40". */
export function clockTime(raw) {
  const m = String(raw ?? '').match(/(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const hh = Number(m[1]);
  return hh >= 0 && hh <= 23 ? `${String(hh).padStart(2, '0')}:${m[2]}` : null;
}

/**
 * RailRadar reports run days inconsistently — names, abbreviations, or a 7-slot
 * flag array. Parse all three, and when the shape is unrecognised assume the
 * train runs: dropping every option on a parsing guess is far worse than
 * showing one that turns out not to run.
 */
export function runsOn(runDays, date) {
  if (!date || !Array.isArray(runDays) || !runDays.length) return true;
  const want = WEEKDAYS[weekdayOf(date)];

  if (runDays.every((d) => typeof d === 'boolean' || d === 0 || d === 1)) {
    if (runDays.length !== 7) return true;
    // A 7-slot flag array is Monday-first in Indian Railways listings.
    const mondayFirst = [...WEEKDAYS.slice(1), WEEKDAYS[0]];
    return Boolean(runDays[mondayFirst.indexOf(want)]);
  }

  const named = runDays.filter((d) => typeof d === 'string').map((d) => d.slice(0, 3).toLowerCase());
  return named.length ? named.includes(want) : true;
}

/** The soonest day within a week that any of these trains runs. */
function nextRunningDate(trains, date, within = 7) {
  if (!date) return null;
  for (let i = 1; i <= within; i += 1) {
    const candidate = addDays(date, i);
    if (trains.some((t) => runsOn(t.runDays, candidate))) return candidate;
  }
  return null;
}

export async function getOptions({ from, to, maxFare = null, date = null, classes = DEFAULT_CLASSES }) {
  const [fromCode, toCode] = await Promise.all([stationCode(from), stationCode(to)]);
  if (!fromCode || !toCode) return [];

  // Trains and the road distance behind the fare estimate can be fetched together.
  const [body, route] = await Promise.all([
    get(`/legacy/trains/between?from=${fromCode}&to=${toCode}`, TTL_HOURS.fare),
    computeRoute(from, to, 'train'),
  ]);

  const allTrains = body.data?.trains ?? [];
  if (!allTrains.length) return [];

  // Only trains that actually run on the travel date.
  const trains = allTrains.filter((t) => runsOn(t.runDays, date));
  if (!trains.length) {
    // Say when one *does* run rather than reporting a blank.
    const next = nextRunningDate(allTrains, date);
    const when = next ? ` The next one runs on ${next}.` : '';
    log.warn(`no train ${from}->${to} on ${date}.${when}`);
    throw new HttpError(422, `No train runs ${from} to ${to} on ${date}.${when}`);
  }

  const { distanceKm } = route;
  const timestamp = new Date().toISOString();

  return trains
    .slice(0, 8)
    .flatMap((t) => {
      const minutes = travelMinutes(t.journeySegment?.travelTime);
      return classes.map((cls) => ({
        fromPlace: from,
        toPlace: to,
        mode: 'train',
        provider: 'railradar',
        service: `${t.number} ${t.name}`,
        distanceKm,
        durationMinutes: minutes,
        // Schedule is quoted from RailRadar; the fare is ours, so: estimate.
        fare: Math.round(TRAIN_FARE_PER_KM.base + TRAIN_FARE_PER_KM[cls] * distanceKm),
        fareType: 'estimate',
        class: cls,
        stops: t.journeySegment?.stops ?? null,
        // The clock is what decides whether the arrival day is a sightseeing
        // day at all, so carry it through rather than only the duration.
        departureTime: clockTime(t.journeySegment?.departureTime),
        arrivalTime: clockTime(t.journeySegment?.arrivalTime),
        source: 'railradar_api',
        timestamp,
      }));
    })
    .filter((o) => o.durationMinutes > 0 && (maxFare == null || o.fare <= maxFare));
}
