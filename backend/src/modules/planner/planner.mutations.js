// Deterministic plan edits. A dropdown pick needs no model, so these are plain
// functions; the chat agent will call the same ones as tools later.
import { LIMITS } from '../../constants.js';
import { HttpError, badRequest, notFound } from '../../shared/errors.js';
import { TripPlan } from '../../schemas/trip.schema.js';
import { parseOrThrow } from '../../shared/validate.js';
import { getTransportOptions } from '../transport/transport.service.js';
import { searchStays, searchAttractions } from '../places/places.service.js';
import { computeBudget } from '../budget/budget.service.js';
import { buildGraph } from '../graph/graph.builder.js';
import { newId, toAccommodation, toActivity, rehop } from './planner.assemble.js';

// Provider results have no id of their own; stamp one so the stored plan
// validates and Semi-mode dropdowns can address each option.
const keep = (list, parentId) =>
  (list ?? []).slice(0, LIMITS.storedAlternatives).map(({ alternatives, ...rest }, i) => ({
    ...rest,
    id: rest.id ?? `${parentId}-alt-${i + 1}`,
  }));

const findDayOf = (plan, activityId) => {
  for (const day of plan.days) {
    const index = day.activities.findIndex((a) => a.id === activityId);
    if (index !== -1) return { day, index };
  }
  throw notFound(`Activity ${activityId} not found`);
};

const findDay = (plan, dayId) => {
  const day = plan.days.find((d) => d.id === dayId);
  if (!day) throw notFound(`Day ${dayId} not found`);
  return day;
};

async function replace_transport_segment(plan, _input, { segmentId, alternativeIndex = null, constraints = {} }) {
  const i = plan.segments.findIndex((s) => s.id === segmentId);
  if (i === -1) throw notFound(`Segment ${segmentId} not found`);
  const old = plan.segments[i];

  let picked;
  let alternatives;
  if (alternativeIndex != null) {
    picked = old.alternatives?.[alternativeIndex];
    if (!picked) throw badRequest(`Segment ${segmentId} has no alternative ${alternativeIndex}`);
    // The option being replaced stays on the list, so the swap is reversible.
    alternatives = [old, ...old.alternatives.filter((_, k) => k !== alternativeIndex)];
  } else {
    const result = await getTransportOptions({
      from: old.fromPlace,
      to: old.toPlace,
      mode: constraints.mode ?? 'any',
      preference: constraints.preference ?? 'any',
      maxFare: constraints.maxFare ?? null,
    });
    picked = result.pick;
    alternatives = result.alternatives;
  }

  // Keep the id so graph edges and any references stay valid.
  plan.segments[i] = { ...picked, id: old.id, alternatives: keep(alternatives, old.id) };
  return plan;
}

async function replace_accommodation(plan, input, { stayId, alternativeIndex = null, constraints = {} }) {
  const i = plan.stays.findIndex((s) => s.id === stayId);
  if (i === -1) throw notFound(`Stay ${stayId} not found`);
  const old = plan.stays[i];

  let candidate;
  let alternatives;
  if (alternativeIndex != null) {
    candidate = old.alternatives?.[alternativeIndex];
    if (!candidate) throw badRequest(`Stay ${stayId} has no alternative ${alternativeIndex}`);
    alternatives = [old, ...old.alternatives.filter((_, k) => k !== alternativeIndex)];
  } else {
    const found = await searchStays(old.destination, {
      preference: constraints.type ?? input.accommodationPreference ?? 'any',
      maxPricePerNight: constraints.maxPricePerNight ?? null,
    });
    if (!found.length) throw new HttpError(422, `No other stays found in ${old.destination}`);
    [candidate, ...alternatives] = found;
  }

  plan.stays[i] = {
    ...toAccommodation(candidate, { id: old.id, destination: old.destination, nights: old.nights }),
    alternatives: keep(alternatives, old.id),
  };
  return plan;
}

async function add_activity(plan, input, { dayId, query = null, placeId = null }) {
  const day = findDay(plan, dayId);
  const candidates = await searchAttractions(day.destination, { interests: query ? [query] : input.interests });
  const candidate = placeId ? candidates.find((c) => c.placeId === placeId) : candidates[0];
  if (!candidate) throw new HttpError(422, `Nothing found for "${query ?? placeId}" in ${day.destination}`);

  day.activities.push(toActivity(candidate, { id: newId('act') }));
  await rehop(day, day.activities.length - 1);
  return plan;
}

async function remove_activity(plan, _input, { activityId }) {
  const { day, index } = findDayOf(plan, activityId);
  day.activities.splice(index, 1);
  await rehop(day, index); // the next activity now travels from a different place
  return plan;
}

async function move_activity(plan, _input, { activityId, toDayId, toTime = null }) {
  const { day: from, index } = findDayOf(plan, activityId);
  const to = findDay(plan, toDayId);
  const [activity] = from.activities.splice(index, 1);

  if (toTime) activity.plannedStart = toTime;
  to.activities.push(activity);

  await rehop(from, index);
  await rehop(to, to.activities.length - 1);
  return plan;
}

export const MUTATIONS = {
  replace_transport_segment,
  replace_accommodation,
  add_activity,
  remove_activity,
  move_activity,
};

/**
 * Runs one mutation and recomputes everything downstream of it. The mutation
 * touches its target; budget and layout are always rebuilt by code.
 */
export async function applyMutation({ plan, input, tool, args }) {
  const mutate = MUTATIONS[tool];
  if (!mutate) throw badRequest(`Unknown mutation "${tool}"`);

  const draft = await mutate(structuredClone(plan), input, args ?? {});
  const next = { ...draft, budget: computeBudget(draft, input), graph: buildGraph(draft, input) };

  // A broken mutation must never reach the database.
  return parseOrThrow(TripPlan, next, 'mutated plan');
}
