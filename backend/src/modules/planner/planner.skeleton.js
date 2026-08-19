import {
  buildLegs, nightsPerDestination, dayAssignments, legDates, segId, stayId, dayIdOf,
} from './planner.assemble.js';

const PENDING = { source: 'pending', timestamp: new Date(0).toISOString(), pending: true };

/**
 * A plan shaped entirely from the input, with placeholders where the research
 * will land. Costs nothing to build, so the graph can render in the first
 * moments and fill in as SSE patches arrive.
 */
export function buildSkeleton(input) {
  const legs = buildLegs(input);
  const dates = legDates(input);

  return {
    segments: legs.map((leg, i) => ({
      id: segId(i),
      fromPlace: leg.from,
      toPlace: leg.to,
      mode: input.preferredTransport === 'any' ? 'train' : input.preferredTransport,
      provider: 'pending',
      service: null,
      distanceKm: 0,
      durationMinutes: 0,
      fare: 0,
      fareType: 'estimate',
      class: null,
      stops: null,
      date: dates[i] ?? null,
      alternatives: [],
      ...PENDING,
    })),

    stays: nightsPerDestination(input).map(({ destination, nights }, i) => ({
      id: stayId(i),
      destination,
      name: 'Finding a place to stay…',
      type: input.accommodationPreference,
      placeId: null,
      rating: null,
      reviewCount: null,
      pricePerNight: 0,
      priceType: 'estimate',
      nights,
      distanceToKeyPlacesKm: null,
      alternatives: [],
      ...PENDING,
    })),

    days: dayAssignments(input).map(({ dayNumber, destination, date }) => ({
      id: dayIdOf(dayNumber),
      dayNumber,
      destination,
      date,
      activities: [],
      pending: true,
    })),

    sources: [],
  };
}
