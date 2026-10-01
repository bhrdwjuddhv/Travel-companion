import { MAP } from '../../constants';

const R_KM = 6371;
const rad = (d) => (d * Math.PI) / 180;

/** Great-circle distance, for pairs we never measured a road route for. */
export function straightLineKm(a, b) {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R_KM * Math.asin(Math.sqrt(h)) * 10) / 10;
}

const hasCoords = (o) => Number.isFinite(o?.lat) && Number.isFinite(o?.lng);

/**
 * The trip as an ordered list of places to plot. Everything here is read from
 * what generation already stored — no geocoding, no lookups.
 *
 * A destination's own coordinates come from the geocode we saved; if a plan
 * predates that (or came from Stepwise, which never geocodes), we fall back to
 * the middle of whatever we do know about that destination.
 */
export function tripPoints(plan, input) {
  const coords = plan.placeCoords ?? {};

  const centreOf = (destination) => {
    const known = [
      ...plan.stays.filter((s) => s.destination === destination && hasCoords(s)),
      ...plan.days
        .filter((d) => d.destination === destination)
        .flatMap((d) => d.activities.filter(hasCoords)),
    ];
    if (!known.length) return null;
    return {
      lat: known.reduce((n, k) => n + k.lat, 0) / known.length,
      lng: known.reduce((n, k) => n + k.lng, 0) / known.length,
    };
  };

  const placeAt = (name) => (hasCoords(coords[name]) ? coords[name] : centreOf(name));

  const points = [];
  const push = (point) => {
    if (!hasCoords(point)) return;
    points.push({ ...point, order: points.length + 1 });
  };

  const origin = placeAt(input.origin);
  if (origin) {
    push({ key: 'origin', type: 'origin', name: input.origin, subtitle: 'Where the trip starts', ...origin });
  }

  const staysSeen = new Set();
  for (const day of plan.days) {
    const stay = plan.stays.find((s) => s.destination === day.destination);
    if (stay && !staysSeen.has(stay.id)) {
      staysSeen.add(stay.id);
      const at = hasCoords(stay) ? stay : placeAt(day.destination);
      if (at) {
        push({
          key: `stay:${stay.id}`,
          type: 'stay',
          name: stay.name,
          subtitle: `Stay in ${stay.destination}`,
          destination: stay.destination,
          dayId: day.id,
          rating: stay.rating,
          price: stay.pricePerNight,
          priceType: stay.priceType,
          nights: stay.nights,
          placeId: stay.placeId,
          lat: at.lat,
          lng: at.lng,
        });
      }
    }

    for (const activity of day.activities) {
      if (!hasCoords(activity)) continue;
      push({
        key: `activity:${activity.id}`,
        type: activity.isHiddenGem ? 'gem' : 'activity',
        name: activity.name,
        subtitle: `Day ${day.dayNumber} · ${day.destination}`,
        destination: day.destination,
        dayId: day.id,
        category: activity.category,
        price: activity.ticketCost,
        priceType: activity.costType,
        plannedStart: activity.plannedStart,
        notes: activity.notes,
        placeId: activity.placeId,
        hop: activity.localTransportFromPrev,
        lat: activity.lat,
        lng: activity.lng,
      });
    }
  }

  // A round trip ends where it started; the line goes home, the marker doesn't
  // get drawn twice.
  const legs = [];
  for (let i = 1; i < points.length; i += 1) legs.push(legBetween(points[i - 1], points[i], plan));
  if (origin && input.direction === 'round' && points.length > 1) {
    legs.push({
      ...legBetween(points[points.length - 1], { ...origin, name: input.origin, type: 'origin' }, plan),
      key: 'leg:home',
      to: { ...origin, name: input.origin, type: 'origin' },
      returning: true,
    });
  }

  return { points, legs };
}

/**
 * What to say about the line between two places: the measured local hop where
 * we computed one, the intercity segment where this is that leg, and an honest
 * straight-line estimate otherwise.
 */
function legBetween(from, to, plan) {
  const base = { key: `leg:${from.key}->${to.key}`, from, to };

  if (to.hop) {
    return {
      ...base,
      mode: to.hop.mode,
      distanceKm: to.hop.distanceKm,
      minutes: to.hop.durationMinutes,
      fare: to.hop.estimatedFare,
      kind: 'local',
    };
  }

  const segment = plan.segments.find(
    (s) =>
      (s.fromPlace === from.destination || s.fromPlace === from.name) &&
      (s.toPlace === to.destination || s.toPlace === to.name)
  );
  if (segment) {
    return {
      ...base,
      mode: segment.mode,
      distanceKm: segment.distanceKm,
      minutes: segment.durationMinutes,
      fare: segment.fare,
      service: segment.service,
      kind: 'intercity',
    };
  }

  return { ...base, distanceKm: straightLineKm(from, to), kind: 'straight' };
}

export const markerColour = (type) => MAP.colors[type] ?? MAP.colors.activity;
