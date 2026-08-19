import { Agent, run, tool, InputGuardrailTripwireTriggered } from '@openai/agents';
import { z } from 'zod';
import { MODELS, TIMEOUTS_MS } from '../../constants.js';
import { logger, now, since } from '../../shared/logger.js';
import { HttpError } from '../../shared/errors.js';
import { travelScopeGuardrail } from '../../guardrails/guardrails.js';
import { applyMutation } from '../planner/planner.mutations.js';
import { getTrip, appendVersion } from '../trip/trip.service.js';

const log = logger('chat');

const money = (n) => `₹${Number(n).toLocaleString('en-IN')}`;

/**
 * Labels each alternative CHEAPER or PRICIER than what is currently chosen.
 * Without this a small model happily "makes it cheaper" by picking a dearer
 * option — the numbers alone weren't enough.
 */
const alternativeList = (alternatives, cost, current, describe) =>
  (alternatives ?? [])
    .map((a, k) => `${k}=${describe(a)} [${cost(a) < current ? 'CHEAPER' : cost(a) > current ? 'PRICIER' : 'SAME'}]`)
    .join(', ') || 'none';

/**
 * A compact view of the plan. The agent needs enough to choose a mutation and
 * its arguments, not the whole document.
 */
function planSummary(plan) {
  return [
    'SEGMENTS:',
    ...plan.segments.map(
      (s) =>
        `  ${s.id}: ${s.fromPlace}->${s.toPlace} ${s.mode}${s.class ? `/${s.class}` : ''} ${money(s.fare)} NOW` +
        ` | alternatives: ${alternativeList(s.alternatives, (a) => a.fare, s.fare, (a) => `${a.mode}${a.class ? '/' + a.class : ''} ${money(a.fare)}`)}`
    ),
    'STAYS:',
    ...plan.stays.map(
      (s) =>
        `  ${s.id}: ${s.name} in ${s.destination} ${money(s.pricePerNight)}/night NOW x${s.nights}` +
        ` | alternatives: ${alternativeList(s.alternatives, (a) => a.pricePerNight, s.pricePerNight, (a) => `${a.name} ${money(a.pricePerNight)}`)}`
    ),
    'DAYS:',
    ...plan.days.map(
      (d) => `  ${d.id}: day ${d.dayNumber} in ${d.destination} (${d.pace ?? 'full'}) — ${d.activities.map((a) => `${a.id}:${a.name}`).join(', ') || 'empty'}`
    ),
    `BUDGET: ${money(plan.budget.total)} total`,
  ].join('\n');
}

const EditResult = z.object({
  summary: z.string().describe('One line, past tense, describing what changed — or why nothing did'),
  changed: z.boolean().describe('false for questions and anything you chose not to act on'),
});

const INSTRUCTIONS = `You edit an existing trip plan on the traveller's behalf.

You have one job per message: work out whether the traveller is ASKING something or TELLING you to
change something.

- A question ("is this doable under 20k?", "why is day 3 empty?") is answered in the summary with
  changed:false. Never call a tool for a question.
- A change ("make the return cheaper", "drop the fort", "move this to day 2") calls exactly one
  mutation tool, then reports it.

Rules:
- Use the ids exactly as given in the plan summary.
- Prefer an alternativeIndex when the plan already lists a suitable alternative — it is instant and
  costs nothing. Only use constraints when nothing stored fits.
- Each alternative is marked CHEAPER or PRICIER than the current pick. If asked for something
  cheaper and every alternative is PRICIER, say so with changed:false. Never swap to a pricier
  option and call it cheaper — the opposite of what was asked is worse than no change.
- Change the one thing asked for. Never rebuild the trip because one leg was wrong.
- You never compute prices or totals. The tools recalculate everything.`;

/** The five deterministic mutations, exposed to the agent as tools. */
function mutationTools(state) {
  const apply = (toolName) => async (args) => {
    try {
      state.plan = await applyMutation({ plan: state.plan, input: state.input, tool: toolName, args });
      state.applied.push({ tool: toolName, args });
      return { ok: true, budgetTotal: state.plan.budget.total };
    } catch (e) {
      // Hand the failure back so the agent can explain or try another way.
      return { ok: false, error: e.message };
    }
  };

  return [
    tool({
      name: 'replace_transport_segment',
      description: 'Swap one leg of the journey. Use alternativeIndex from the plan summary when possible.',
      parameters: z.object({
        segmentId: z.string(),
        alternativeIndex: z.number().nullable(),
        constraints: z
          .object({
            mode: z.enum(['train', 'bus', 'flight', 'car', 'any']).nullable(),
            maxFare: z.number().nullable(),
            preference: z.enum(['train', 'bus', 'flight', 'car', 'any']).nullable(),
          })
          .nullable(),
      }),
      execute: apply('replace_transport_segment'),
    }),
    tool({
      name: 'replace_accommodation',
      description: 'Swap where they stay in one destination.',
      parameters: z.object({
        stayId: z.string(),
        alternativeIndex: z.number().nullable(),
        constraints: z
          .object({
            type: z.enum(['hotel', 'hostel', 'homestay', 'budget', 'any']).nullable(),
            maxPricePerNight: z.number().nullable(),
          })
          .nullable(),
      }),
      execute: apply('replace_accommodation'),
    }),
    tool({
      name: 'add_activity',
      description: 'Add a place to a day. Give a search query describing it.',
      parameters: z.object({ dayId: z.string(), query: z.string() }),
      execute: apply('add_activity'),
    }),
    tool({
      name: 'remove_activity',
      description: 'Drop one activity from the itinerary.',
      parameters: z.object({ activityId: z.string() }),
      execute: apply('remove_activity'),
    }),
    tool({
      name: 'move_activity',
      description: 'Move an activity to a different day, optionally at a given time.',
      parameters: z.object({ activityId: z.string(), toDayId: z.string(), toTime: z.string().nullable() }),
      execute: apply('move_activity'),
    }),
  ];
}

const timeout = (ms) =>
  new Promise((_, reject) => setTimeout(() => reject(new HttpError(504, `Edit timed out after ${ms}ms`)), ms));

/**
 * One chat turn. The saved version is read fresh here — the client's copy is
 * never trusted for a write — and only a real change writes a new version.
 */
export async function editByChat({ tripId, ownerKey, message, editContext }) {
  const began = now();
  const trip = await getTrip(tripId, ownerKey);
  if (!trip.plan) throw new HttpError(409, 'This trip has no plan to edit yet.');

  const state = { plan: trip.plan, input: trip.input, applied: [] };

  const agent = new Agent({
    name: 'Trip editor',
    model: MODELS.PLANNER_FAST,
    instructions: INSTRUCTIONS,
    tools: mutationTools(state),
    inputGuardrails: [travelScopeGuardrail],
    outputType: EditResult,
  });

  const prompt = [
    editContext
      ? `The traveller is pointing at ${editContext.nodeType ?? editContext.elementType} "${editContext.id}".`
      : 'No specific element is selected.',
    editContext?.data ? `Its current state: ${JSON.stringify(editContext.data).slice(0, 600)}` : null,
    '',
    planSummary(trip.plan),
    '',
    `Traveller says: ${message}`,
  ]
    .filter(Boolean)
    .join('\n');

  let result;
  try {
    result = await Promise.race([run(agent, prompt), timeout(TIMEOUTS_MS.llm)]);
  } catch (e) {
    if (e instanceof InputGuardrailTripwireTriggered) {
      throw new HttpError(400, "I can only help with this trip — try asking about the route, stays, days or budget.");
    }
    throw e;
  }

  const out = EditResult.parse(result.finalOutput);

  // A question changes nothing, so it must not create a version.
  if (!state.applied.length) {
    log.info(`answered in ${since(began)} (no mutation)`);
    return { changed: false, summary: out.summary, versionNumber: trip.versionNumber, plan: trip.plan };
  }

  const saved = await appendVersion({
    tripId,
    ownerKey,
    expectedVersion: trip.versionNumber,
    plan: state.plan,
  });
  log.info(`applied ${state.applied.map((a) => a.tool).join(', ')} in ${since(began)}`);

  return {
    changed: true,
    summary: out.summary,
    tools: state.applied.map((a) => a.tool),
    versionNumber: saved.versionNumber,
    plan: state.plan,
  };
}
