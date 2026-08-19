import { BUDGET_DEFAULTS } from '../../constants.js';
import { computeBudget, tierOf } from './budget.service.js';
import { buildGraph } from '../graph/graph.builder.js';
import { logger } from '../../shared/logger.js';
import { paceForDay, trimToPace } from '../planner/dayPace.js';
import { actIdOf, toActivity } from '../planner/planner.assemble.js';

const log = logger('budget');

const closestBy = (options, cost, target) =>
  options.reduce((best, o) => (Math.abs(cost(o) - target) < Math.abs(cost(best) - target) ? o : best), options[0]);

/**
 * Re-fits a plan to per-category targets using only what is already stored on
 * the version — the alternatives on each segment and stay, and the leftover
 * activity pool. No provider calls, no model: sliders should be instant and
 * free, and everything here is arithmetic over options we already paid for.
 *
 * Returns the new draft plus which categories could not be reached, so the
 * caller can decide whether a real re-plan is worth it.
 */
export function refitPlan({ plan, input, targets }) {
  const draft = structuredClone(plan);
  const travellers = input.travellerCount || 1;
  const rooms = Math.ceil(travellers / BUDGET_DEFAULTS.travellersPerRoom);
  const unmet = [];

  // --- Transport: pick the option per leg nearest its share of the target ---
  if (targets.intercityTransport != null && draft.segments.length) {
    const perLeg = targets.intercityTransport / travellers / draft.segments.length;
    draft.segments = draft.segments.map((seg) => {
      const options = [seg, ...(seg.alternatives ?? [])];
      const picked = closestBy(options, (o) => o.fare, perLeg);
      if (picked === seg) return seg;
      // Keep the id so graph edges stay valid, and keep the swap reversible.
      return {
        ...picked,
        id: seg.id,
        alternatives: options.filter((o) => o !== picked).map((o, i) => ({ ...o, id: o.id ?? `${seg.id}-alt-${i + 1}` })),
      };
    });
    unmetIf(unmet, 'intercityTransport', reachable(draft.segments, (s) => s.fare, travellers), targets.intercityTransport);
  }

  // --- Stays: same idea, priced per night per room ---
  if (targets.accommodation != null && draft.stays.length) {
    const totalNights = draft.stays.reduce((n, s) => n + s.nights, 0) || 1;
    const perNight = targets.accommodation / rooms / totalNights;
    draft.stays = draft.stays.map((stay) => {
      const options = [stay, ...(stay.alternatives ?? [])];
      const picked = closestBy(options, (o) => o.pricePerNight, perNight);
      if (picked === stay) return stay;
      return {
        ...picked,
        id: stay.id,
        destination: stay.destination,
        nights: stay.nights,
        alternatives: options.filter((o) => o !== picked).map((o, i) => ({ ...o, id: o.id ?? `${stay.id}-alt-${i + 1}` })),
      };
    });
  }

  // --- Food is a rate, so the target sets it directly ---
  if (targets.food != null) {
    const perPersonPerDay = Math.max(0, Math.round(targets.food / travellers / (input.durationDays || 1)));
    draft.budgetOverrides = { ...(draft.budgetOverrides ?? {}), foodPerPersonPerDay: perPersonPerDay };
  }

  // --- Activities: add from the pool or trim, respecting each day's pace ---
  if (targets.activityCount != null) {
    const pool = draft.pool?.activitiesByDestination ?? {};
    const used = new Set(draft.days.flatMap((d) => d.activities.map((a) => a.placeId ?? a.name)));

    draft.days = draft.days.map((day) => {
      const shape = paceForDay({ date: day.date, destination: day.destination, segments: draft.segments });
      const want = Math.min(targets.activityCount, shape.maxActivities);
      let activities = day.activities.slice(0, want);

      // Top up from what was researched but never used.
      if (activities.length < want) {
        for (const candidate of pool[day.destination] ?? []) {
          if (activities.length >= want) break;
          const key = candidate.placeId ?? candidate.name;
          if (used.has(key)) continue;
          used.add(key);
          activities.push(
            toActivity(candidate, { id: actIdOf(day.dayNumber, activities.length) })
          );
        }
      }
      if (activities.length < want) unmet.push('activities');

      // A new activity has no measured hop; leaving it null beats inventing one.
      activities = trimToPace(activities, shape).map((a, i) => (i === 0 ? { ...a, localTransportFromPrev: null } : a));
      return { ...day, activities };
    });
  }

  const next = { ...draft, budget: computeBudget(draft, input), graph: buildGraph(draft, input) };
  const missed = [...new Set(unmet)];
  log.info(`refit: ${Object.keys(targets).join(', ')}${missed.length ? ` | unmet: ${missed.join(', ')}` : ''}`);
  return { plan: next, unmet: missed };
}

const reachable = (items, cost, multiplier) => items.reduce((n, i) => n + cost(i), 0) * multiplier;

// Only report a category as unmet when the stored options can't get near it.
function unmetIf(unmet, category, achieved, target) {
  if (target > 0 && Math.abs(achieved - target) / target > 0.25) unmet.push(category);
}

/**
 * Slider bands, derived from what this trip could actually cost given the
 * options on the version. Not a guess: the floor is every cheapest option, the
 * ceiling every priciest.
 */
export function budgetBands(plan, input) {
  const travellers = input.travellerCount || 1;
  const rooms = Math.ceil(travellers / BUDGET_DEFAULTS.travellersPerRoom);
  const days = input.durationDays || 1;
  const tier = tierOf(input);

  const spread = (items, cost) => {
    const rows = items.map((item) => [item, ...(item.alternatives ?? [])].map(cost));
    return {
      min: rows.reduce((n, r) => n + Math.min(...r), 0),
      max: rows.reduce((n, r) => n + Math.max(...r), 0),
    };
  };

  const transport = spread(plan.segments, (s) => s.fare);
  const stays = spread(plan.stays, (s) => s.pricePerNight * s.nights);
  const poolSize = Object.values(plan.pool?.activitiesByDestination ?? {}).reduce((n, l) => n + l.length, 0);

  return {
    intercityTransport: { min: Math.round(transport.min * travellers), max: Math.round(transport.max * travellers) },
    accommodation: { min: Math.round(stays.min * rooms), max: Math.round(stays.max * rooms) },
    food: {
      min: Math.round(tier.foodPerPersonPerDay * 0.4 * days * travellers),
      max: Math.round(tier.foodPerPersonPerDay * 2.5 * days * travellers),
    },
    // Activities are traded in whole stops, not rupees — Places gives no ticket
    // price, so the lever that actually exists is how many you do per day.
    activityCount: { min: 0, max: Math.max(4, Math.min(poolSize, 6)) },
  };
}
