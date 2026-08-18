import { tool } from '@openai/agents';
import { z } from 'zod';
import { resolveLocation } from '../places/geocode.service.js';
import { searchStays, searchAttractions } from '../places/places.service.js';
import { getTransportOptions, localHop } from '../transport/transport.service.js';
import { computeRoute } from '../transport/googleEstimator.provider.js';

// A failed lookup is information, not a crash — the agent routes around it (§14).
const safe = (fn) => async (args) => {
  try {
    return await fn(args);
  } catch (e) {
    return { error: e.message };
  }
};

/** Read-only research tools, wired to emit SSE progress as they run. */
export function researchTools(emit) {
  const step = (id, label) => emit('progress', { step: id, label });

  return [
    tool({
      name: 'resolveLocation',
      description: 'Resolve an ambiguous place name to its canonical name and coordinates.',
      parameters: z.object({ query: z.string() }),
      execute: safe(({ query }) => {
        step('resolving', `Resolving ${query}…`);
        return resolveLocation(query);
      }),
    }),

    tool({
      name: 'getRoute',
      description: 'Real distance in km and duration in minutes between two places. Always use this — never estimate distances yourself.',
      parameters: z.object({
        from: z.string(),
        to: z.string(),
        mode: z.enum(['train', 'bus', 'flight', 'car', 'auto', 'cab', 'walk']),
      }),
      execute: safe(({ from, to, mode }) => computeRoute(from, to, mode)),
    }),

    tool({
      name: 'getTransportOptions',
      description: 'Ranked intercity transport options with real fares/schedules where a provider has them. Returns pick + alternatives.',
      parameters: z.object({
        from: z.string(),
        to: z.string(),
        mode: z.enum(['train', 'bus', 'flight', 'car', 'any']),
        preference: z.enum(['train', 'bus', 'flight', 'car', 'any']),
        maxFare: z.number().nullable(),
      }),
      execute: safe((args) => {
        step('researching_transport', `Finding transport ${args.from} → ${args.to}…`);
        return getTransportOptions(args);
      }),
    }),

    tool({
      name: 'searchStays',
      description: 'Candidate places to stay in a destination, ranked by rating and review volume.',
      parameters: z.object({
        destination: z.string(),
        preference: z.enum(['hotel', 'hostel', 'homestay', 'budget', 'any']),
        maxPricePerNight: z.number().nullable(),
      }),
      execute: safe(({ destination, ...opts }) => {
        step('researching_stays', `Looking for stays in ${destination}…`);
        return searchStays(destination, opts);
      }),
    }),

    tool({
      name: 'searchAttractions',
      description: 'Attractions and things to do in a destination, optionally filtered by interests.',
      parameters: z.object({ destination: z.string(), interests: z.array(z.string()) }),
      execute: safe(({ destination, interests }) => {
        step('researching_places', `Finding things to do in ${destination}…`);
        return searchAttractions(destination, { interests });
      }),
    }),

    tool({
      name: 'getLocalHop',
      description: 'Local transport between two places in the same city: mode, distance, duration and estimated fare.',
      parameters: z.object({ from: z.string(), to: z.string(), city: z.string() }),
      execute: safe((args) => localHop(args)),
    }),
  ];
}
