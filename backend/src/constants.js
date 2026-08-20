// Single source of truth for the whole server.
// Nothing else in this codebase reads process.env or hardcodes a model /
// rate / TTL / limit — everything imports from here.
import 'dotenv/config';

export const ENV = {
  PORT: process.env.PORT || 4000,
  CLIENT_ORIGIN: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  MONGODB_URI: process.env.MONGODB_URI,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  GOOGLE_MAPS_API_KEY: process.env.GOOGLE_MAPS_API_KEY,
  RAILRADAR_API_KEY: process.env.RAILRADAR_API_KEY,
  QDRANT_URL: process.env.QDRANT_URL,
  QDRANT_API_KEY: process.env.QDRANT_API_KEY,
};

// RAILRADAR_API_KEY stays optional: without it, trains fall back to the
// estimator instead of the boot failing.
export const REQUIRED_ENV = ['MONGODB_URI', 'OPENAI_API_KEY', 'GOOGLE_MAPS_API_KEY'];

const missing = REQUIRED_ENV.filter((k) => !ENV[k]);
if (missing.length) {
  throw new Error(`Missing required env vars: ${missing.join(', ')} (see backend/.env.example)`);
}

// All model IDs in ONE place — change the model here, everywhere updates.
export const MODELS = {
  PLANNER: process.env.OPENAI_MODEL || 'gpt-4',
  // Selection/sequencing is judgment over a short shortlist — a small model is
  // plenty, and it's the difference between ~2s and ~20s.
  PLANNER_FAST: process.env.OPENAI_MODEL_FAST || 'gpt-4o-mini',
  EMBEDDING: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
  GUARDRAIL: process.env.OPENAI_GUARDRAIL_MODEL || 'gpt-4',
};

// Which provider handles each transport mode. Flip to real providers when approved.
export const PROVIDERS = {
  train: 'railradar',         // live
  bus: 'google_estimator',    // MVP fallback
  flight: 'google_estimator', // MVP fallback (Amadeus later)
  car: 'google_estimator',
};

// Freshness time-to-live per data type (hours). Stale -> re-research.
export const TTL_HOURS = {
  attraction: 24 * 30, // evergreen
  stay: 24 * 3,
  fare: 6,
  hours: 24,           // opening hours
  event: 12,
  hiddenGem: 24 * 14,  // how long a city's gems stay fresh in Qdrant
};

// Seed local-fare estimator. Owner tunes per city. All in INR.
export const FARE_RATES = {
  default: {
    auto: { base: 30, perKm: 15 },
    cab: { base: 50, perKm: 18, minimum: 100 },
    bus: { flat: 20 },
    walkMaxKm: 1.5,
  },
  // city overrides, e.g. Jaipur: { auto: { base: 25, perKm: 13 } }
};

// Intercity estimates for modes without a live provider (per km, INR).
export const INTERCITY_RATES = {
  bus: { base: 50, perKm: 1.6 },
  car: { base: 0, perKm: 14 },
  flight: { base: 1800, perKm: 4.5, minimum: 2500 },
};

// Nightly stay price by Google Places priceLevel (INR). Places gives a band,
// not a rate — so every stay price is an "estimate", never "quoted".
export const STAY_RATES = {
  PRICE_LEVEL_FREE: 0,
  PRICE_LEVEL_INEXPENSIVE: 1200,
  PRICE_LEVEL_MODERATE: 2600,
  PRICE_LEVEL_EXPENSIVE: 5500,
  PRICE_LEVEL_VERY_EXPENSIVE: 9500,
  default: 2200,
};

// Indian Railways is fare-slabbed by class; per-km rates are a rough seed.
// ponytail: RailRadar has GET /v1/trains/{number}/fare — wire it (and switch
// fareType to "quoted") once the owner confirms its query params.
export const TRAIN_FARE_PER_KM = { SL: 0.55, '3A': 1.5, '2A': 2.1, '1A': 3.6, base: 30 };

/**
 * How generous the trip should be, when no exact number is given. A numeric
 * budgetTotal, if supplied, still acts as a hard cap on top of the tier.
 */
export const BUDGET_TIERS = {
  budget: {
    label: 'Budget-friendly',
    blurb: 'Cheap beds, sleeper class, mostly free sights.',
    maxPricePerNight: 1800,
    trainClasses: ['SL', '3A'],
    paidActivitiesPerDay: 1,
    foodPerPersonPerDay: 350,
  },
  balanced: {
    label: 'Comfortable',
    blurb: 'Decent hotels, AC class, a paid sight or two a day.',
    maxPricePerNight: 4000,
    trainClasses: ['3A', '2A'],
    paidActivitiesPerDay: 2,
    foodPerPersonPerDay: 500,
  },
  premium: {
    label: 'Premium',
    blurb: 'Heritage stays, the good class, book what you like.',
    maxPricePerNight: 12000,
    trainClasses: ['2A', '1A'],
    paidActivitiesPerDay: 3,
    foodPerPersonPerDay: 900,
  },
};

export const DEFAULT_BUDGET_TIER = 'balanced';

export const BUDGET_DEFAULTS = {
  foodPerPersonPerDay: 500, // INR
  miscBufferPct: 0.08,      // 8% buffer
  travellersPerRoom: 2,
  travellersPerVehicle: 3, // autos/cabs are shared, so local fares aren't per-head
  currency: 'INR',
};

export const LIMITS = {
  generationsPerOwnerPerDay: 15,
  maxDestinations: 6,
  maxDays: 21,
  chatEditsPerMinute: 10,
  decisionTimeoutMinutes: 15, // how long a paused Stepwise run waits for a choice
  decisionOptions: 4,         // shortlist size shown per decision
  storedAlternatives: 5,      // alternatives kept on each segment/stay for Semi mode
};

/**
 * How a train's clock shapes the day it lands on. A 22:40 arrival is not a
 * sightseeing day no matter what the itinerary says.
 */
export const DAY_RULES = {
  arriveFullDayBefore: '11:00',   // in by then: a normal day
  arriveTravelOnlyAfter: '19:00', // in after then: check in, maybe dinner
  departLightDayBefore: '13:00',  // leaving before then: little time for anything
  departNightAfter: '20:00',      // a night train: the whole day is still yours
  // How many activities each shape of day can hold.
  maxActivities: { full: 4, half: 2, light: 1, travel: 0 },
  // A late arrival still allows something to eat near the hotel.
  lateArrivalAllowsDinner: true,
};

// Deterministic graph layout, in pixels. Widen these if nodes ever crowd.
export const GRAPH_LAYOUT = {
  spineX: 1250,   // gap between places on the main journey line
  stayY: 220,     // stay sits just below its destination
  dayY0: 440,     // first day row
  dayGap: 340,    // between day rows at the same destination
  activityX0: 330, // first activity, right of its day
  activityGap: 270,
};

// When the traveller states no preference, distance decides which providers are
// worth calling at all. Thresholds in km, tune per market.
export const MODE_BY_DISTANCE = {
  shortMaxKm: 350,   // car, bus, train are all sensible
  mediumMaxKm: 900,  // train and bus
  // beyond mediumMaxKm: train and flight
};

// Per-call ceilings. On timeout the pipeline falls back to an estimate and
// keeps going — one slow provider must never stall a whole generation.
export const TIMEOUTS_MS = {
  geocode: 4000,
  routes: 6000,
  places: 6000,
  railradar: 6000,
  llm: 45000,
  webSearch: 25000,
};

export const LOG = {
  // Step-by-step timing trace in dev; silent in production.
  verbose: process.env.LOG_VERBOSE
    ? process.env.LOG_VERBOSE === 'true'
    : process.env.NODE_ENV !== 'production',
};

export const QDRANT = {
  collection: 'destination_knowledge',
  vectorSize: 1536, // must match MODELS.EMBEDDING output
  distance: 'Cosine',
};
