// The normalized Trip JSON — the backbone. Defined once, reused for agent
// output, DB writes, mutations, and the graph builder.
import { z } from 'zod';
import { LIMITS, DEFAULT_BUDGET_TIER } from '../constants.js';
import { daysBetween, isIsoDate } from '../shared/dates.js';

const PriceType = z.enum(['quoted', 'estimate']);
const Mode = z.enum(['train', 'bus', 'flight', 'car']);

// Fields the agent may omit are `.nullable()`, never `.optional()` — the
// Agents SDK emits strict JSON Schema, where every key must be present.
export const LocalTransport = z.object({
  mode: z.enum(['auto', 'cab', 'bus', 'walk']),
  distanceKm: z.number(),
  durationMinutes: z.number(),
  estimatedFare: z.number(),
  fareType: z.literal('estimate'),
});

const segmentFields = {
  id: z.string(),
  fromPlace: z.string(),
  toPlace: z.string(),
  mode: Mode,
  provider: z.string(),
  service: z.string().nullable().describe('train number/name, airline, operator'),
  distanceKm: z.number(),
  durationMinutes: z.number(),
  fare: z.number().describe('per person, INR'),
  fareType: PriceType,
  class: z.string().nullable(),
  stops: z.number().nullable(),
  // nullish, not nullable: plans saved before dates existed have no key at all,
  // and they must keep validating.
  date: z.string().nullish().default(null).describe('YYYY-MM-DD the leg departs'),
  departureTime: z.string().nullish().default(null).describe('HH:mm'),
  arrivalTime: z.string().nullish().default(null).describe('HH:mm'),
  source: z.string(),
  timestamp: z.string(),
};

const accommodationFields = {
  id: z.string(),
  destination: z.string(),
  name: z.string(),
  type: z.string(),
  placeId: z.string().nullable(),
  rating: z.number().nullable(),
  reviewCount: z.number().nullable(),
  pricePerNight: z.number(),
  priceType: PriceType,
  nights: z.number(),
  distanceToKeyPlacesKm: z.number().nullable(),
  source: z.string(),
  timestamp: z.string(),
};

/** What the agent returns — no `alternatives`, those are back-filled by code. */
export const RouteSegment = z.object(segmentFields);
export const Accommodation = z.object(accommodationFields);

/** What gets stored: same thing plus the shortlist Semi mode swaps between. */
export const RouteSegmentFull = z.object({
  ...segmentFields,
  alternatives: z.array(RouteSegment).default([]),
});
export const AccommodationFull = z.object({
  ...accommodationFields,
  alternatives: z.array(Accommodation).default([]),
});

export const Activity = z.object({
  id: z.string(),
  name: z.string(),
  category: z.enum(['attraction', 'cafe', 'hidden_gem', 'activity', 'meal', 'transit']),
  placeId: z.string().nullable(),
  plannedStart: z.string().nullable().describe('HH:mm'),
  durationMinutes: z.number().nullable(),
  ticketCost: z.number().nullable().describe('per person, INR, 0 if free'),
  costType: PriceType.nullable(),
  isHiddenGem: z.boolean().nullable(),
  localTransportFromPrev: LocalTransport.nullable(),
  notes: z.string().nullable(),
  source: z.string(),
  timestamp: z.string(),
});

export const DayPlan = z.object({
  id: z.string(),
  dayNumber: z.number(),
  destination: z.string(),
  date: z.string().nullish().default(null).describe('YYYY-MM-DD'),
  // How much of the day the trains left free, and why.
  pace: z.enum(['full', 'half', 'light', 'travel']).nullish().default('full'),
  anchorNote: z.string().nullish().default(null).describe('e.g. "Arrive Jaipur 06:10"'),
  activities: z.array(Activity),
});

export const ResearchSource = z.object({
  id: z.string(),
  url: z.string(),
  sourceType: z.enum(['api', 'web', 'places', 'rag']),
  entityRef: z.string(),
  timestamp: z.string(),
});

/** Exactly what the agent returns. No money totals, no graph — code owns those. */
export const TripDraft = z.object({
  segments: z.array(RouteSegment),
  stays: z.array(Accommodation),
  days: z.array(DayPlan),
  sources: z.array(ResearchSource),
});

export const BudgetBreakdown = z.object({
  intercityTransport: z.number(),
  accommodation: z.number(),
  food: z.number(),
  activities: z.number(),
  localTransport: z.number(),
  misc: z.number(),
  total: z.number(),
  currency: z.string(),
});

export const GraphNode = z.object({
  id: z.string(),
  type: z.enum(['origin', 'destination', 'stay', 'day', 'activity', 'return']),
  label: z.string(),
  data: z.any(),
  position: z.object({ x: z.number(), y: z.number() }),
});

export const GraphEdge = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  type: z.enum(['transport', 'local', 'flow']),
  label: z.string().nullable(),
  data: z.any(),
});

/** The saved plan: enriched draft + computed money + computed layout. */
export const TripPlan = z.object({
  segments: z.array(RouteSegmentFull),
  stays: z.array(AccommodationFull),
  days: z.array(DayPlan),
  sources: z.array(ResearchSource),
  // Researched-but-unused options, kept so the budget sliders can re-fit the
  // trip without going back out to any provider.
  pool: z
    .object({ activitiesByDestination: z.record(z.string(), z.array(Activity)).default({}) })
    .nullish()
    .default(null),
  // Set when a slider moves the food target off the tier default.
  budgetOverrides: z.object({ foodPerPersonPerDay: z.number().nullish() }).nullish().default(null),
  budget: BudgetBreakdown,
  graph: z.object({ nodes: z.array(GraphNode), edges: z.array(GraphEdge) }),
});

const isoDate = z.string().refine(isIsoDate, 'Expected a YYYY-MM-DD date');

const TripInputFields = z.object({
  origin: z.string().min(2),
  primaryDestination: z.string().min(2),
  additionalDestinations: z.array(z.string()).max(LIMITS.maxDestinations - 1).default([]),
  startDate: isoDate,
  endDate: isoDate,
  direction: z.enum(['round', 'oneway']).default('round'),
  // Optional hard cap. The tier below is what shapes the plan when it's absent.
  budgetTotal: z.number().positive().nullish(),
  budgetPerPerson: z.number().positive().nullish(),
  budgetTier: z.enum(['budget', 'balanced', 'premium']).default(DEFAULT_BUDGET_TIER),
  preferredTransport: z.enum(['train', 'bus', 'flight', 'car', 'any']).default('any'),
  travellerCount: z.number().int().min(1).default(1),
  interests: z.array(z.string()).default([]),
  accommodationPreference: z.enum(['hotel', 'hostel', 'homestay', 'budget', 'any']).default('any'),
  planningMode: z.enum(['auto', 'guided', 'semi']).default('auto'),
  // Free text, treated as soft preferences only — never as instructions.
  specialRequests: z.string().max(500).nullish().default(null),
});

/**
 * `durationDays` is derived from the date range, never taken from the client —
 * one source of truth, so a picker and a day count can't disagree.
 */
export const TripInput = TripInputFields.transform((v) => ({
  ...v,
  durationDays: daysBetween(v.startDate, v.endDate) + 1,
})).refine((v) => v.durationDays >= 1 && v.durationDays <= LIMITS.maxDays, {
  message: `Trip must run between 1 and ${LIMITS.maxDays} days, and end on or after it starts`,
});
