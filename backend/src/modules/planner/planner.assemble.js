// Provider results -> Trip JSON shapes. Shared by the Stepwise builder and the
// mutation functions so both produce identical structures.
import { randomUUID } from 'node:crypto';
import { localHop } from '../transport/transport.service.js';
import { addDays } from '../../shared/dates.js';

export const newId = (prefix) => `${prefix}-${randomUUID().slice(0, 8)}`;

export const toSegment = (option, id, date = null) => ({
  ...option,
  id,
  date: option.date ?? date,
  departureTime: option.departureTime ?? null,
  arrivalTime: option.arrivalTime ?? null,
  alternatives: [],
});

export const toAccommodation = (candidate, { id, destination, nights }) => ({
  id,
  destination,
  name: candidate.name,
  type: candidate.type ?? 'hotel',
  placeId: candidate.placeId ?? null,
  rating: candidate.rating ?? null,
  reviewCount: candidate.reviewCount ?? null,
  pricePerNight: candidate.pricePerNight,
  priceType: candidate.priceType,
  nights,
  distanceToKeyPlacesKm: null,
  source: candidate.source,
  timestamp: candidate.timestamp,
  alternatives: [],
});

// Places' free-text type -> our fixed category enum.
const category = (text = '') =>
  /cafe|coffee|bakery/i.test(text) ? 'cafe' : /restaurant|food|dining/i.test(text) ? 'meal' : 'attraction';

export const toActivity = (candidate, { id, plannedStart = null }) => ({
  id,
  name: candidate.name,
  category: category(candidate.category),
  placeId: candidate.placeId ?? null,
  plannedStart,
  durationMinutes: 90,
  ticketCost: null, // Places has no ticket price; the budget counts it as zero
  costType: null,
  isHiddenGem: candidate.isHiddenGem ?? false,
  localTransportFromPrev: null,
  notes: null,
  source: candidate.source,
  timestamp: candidate.timestamp,
});

/**
 * Recomputes the local hop into the activity at `index`. The first activity of
 * a day has no inbound hop; everything else is measured, not guessed.
 */
export async function rehop(day, index) {
  const activity = day.activities[index];
  if (!activity) return;
  if (index === 0) {
    activity.localTransportFromPrev = null;
    return;
  }
  const prev = day.activities[index - 1];
  try {
    activity.localTransportFromPrev = await localHop({
      from: `${prev.name}, ${day.destination}`,
      to: `${activity.name}, ${day.destination}`,
      city: day.destination,
    });
  } catch {
    // A missing hop is better than a fabricated one.
    activity.localTransportFromPrev = null;
  }
}

/** Spreads the trip's days across destinations, earlier stops taking the remainder. */
export function splitNights(totalDays, destinations) {
  const base = Math.floor(totalDays / destinations.length);
  let extra = totalDays % destinations.length;
  return destinations.map((destination) => {
    const nights = base + (extra-- > 0 ? 1 : 0);
    return { destination, nights };
  });
}

export const destinationsOf = (input) => [input.primaryDestination, ...input.additionalDestinations];

// Ids are assigned by code, not the model, so the skeleton emitted at t=0 and
// the finished plan use the same node ids — that's what makes patching work.
export const segId = (i) => `seg-${i + 1}`;
export const stayId = (i) => `stay-${i + 1}`;
export const dayIdOf = (dayNumber) => `day-${dayNumber}`;
export const actIdOf = (dayNumber, k) => `act-${dayNumber}-${k + 1}`;

/** How many *days* are spent at each destination. */
export const daysPerDestination = (input) => splitNights(input.durationDays, destinationsOf(input));

/**
 * How many *nights* are booked at each destination. One fewer than the day
 * count: you travel home on the last day rather than sleeping there.
 */
export const nightsPerDestination = (input) =>
  splitNights(Math.max(input.durationDays - 1, 1), destinationsOf(input));

/** Which destination each numbered day belongs to. One definition, used twice. */
export function dayAssignments(input) {
  const out = [];
  let dayNumber = 0;
  for (const { destination, nights: days } of daysPerDestination(input)) {
    for (let i = 0; i < days; i += 1) out.push({ dayNumber: (dayNumber += 1), destination, date: null });
  }
  return out.map((d, i) => ({ ...d, date: input.startDate ? addDays(input.startDate, i) : null }));
}

/**
 * The date each leg departs — trains don't run every day, so every transport
 * lookup needs one. Legs advance by the days spent at the previous stop, and a
 * round trip's final leg is pinned to the end date.
 */
export function legDates(input) {
  const legs = buildLegs(input);
  if (!input.startDate) return legs.map(() => null);

  const perDest = daysPerDestination(input);
  const dates = [];
  let cursor = input.startDate;

  legs.forEach((_, i) => {
    dates.push(cursor);
    cursor = addDays(cursor, perDest[i]?.nights ?? 1);
  });

  if (input.direction === 'round' && input.endDate) dates[dates.length - 1] = input.endDate;
  return dates;
}

/** Journey legs in order: origin -> each destination -> back, if round trip. */
export function buildLegs(input) {
  const stops = [input.origin, input.primaryDestination, ...input.additionalDestinations];
  if (input.direction === 'round') stops.push(input.origin);
  return stops.slice(0, -1).map((from, i) => ({ from, to: stops[i + 1] }));
}
