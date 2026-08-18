import { ENV, TTL_HOURS, TRAIN_FARE_PER_KM, TIMEOUTS_MS } from '../../constants.js';
import { fetchJson } from '../../shared/fetchJson.js';
import { cached } from '../../shared/cache.js';
import { logger } from '../../shared/logger.js';
import { computeRoute } from './googleEstimator.provider.js';

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

const CLASS_PREF = ['3A', 'SL', '2A'];

export async function getOptions({ from, to, maxFare = null }) {
  const [fromCode, toCode] = await Promise.all([stationCode(from), stationCode(to)]);
  if (!fromCode || !toCode) return [];

  // Trains and the road distance behind the fare estimate can be fetched together.
  const [body, route] = await Promise.all([
    get(`/legacy/trains/between?from=${fromCode}&to=${toCode}`, TTL_HOURS.fare),
    computeRoute(from, to, 'train'),
  ]);

  const trains = body.data?.trains ?? [];
  if (!trains.length) return [];

  const { distanceKm } = route;
  const timestamp = new Date().toISOString();

  return trains
    .slice(0, 8)
    .flatMap((t) => {
      const minutes = travelMinutes(t.journeySegment?.travelTime);
      return CLASS_PREF.map((cls) => ({
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
        source: 'railradar_api',
        timestamp,
      }));
    })
    .filter((o) => o.durationMinutes > 0 && (maxFare == null || o.fare <= maxFare));
}
