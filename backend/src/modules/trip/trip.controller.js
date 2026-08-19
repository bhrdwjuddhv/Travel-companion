import { z } from 'zod';
import { parseOrThrow } from '../../shared/validate.js';
import { applyMutation } from '../planner/planner.mutations.js';
import { budgetVerdict } from '../budget/budget.service.js';
import { getTrip, listTrips, appendVersion, saveLayout } from './trip.service.js';

export const show = async (req, res) => res.json(await getTrip(req.params.id, req.ownerKey));
export const index = async (req, res) => res.json(await listTrips(req.ownerKey));

const Point = z.object({ x: z.number(), y: z.number() });
const LayoutBody = z.object({ layout: z.record(z.string(), Point) });

/** PUT /api/trips/:id/layout — where the user dragged things to. */
export async function layout(req, res) {
  const body = parseOrThrow(LayoutBody, req.body, 'layout');
  res.json(await saveLayout(req.params.id, req.ownerKey, body.layout));
}

const MutateBody = z.object({
  expectedVersion: z.number().int().min(1),
  tool: z.string().min(1),
  args: z.record(z.string(), z.any()).default({}),
});

/**
 * POST /api/trips/:id/mutate — one deterministic edit, one new version.
 * The client's copy of the plan is never trusted for the write; the saved
 * version is read fresh and the expected version guards the update.
 */
export async function mutate(req, res) {
  const body = parseOrThrow(MutateBody, req.body, 'mutation');
  const trip = await getTrip(req.params.id, req.ownerKey);

  const plan = await applyMutation({ plan: trip.plan, input: trip.input, tool: body.tool, args: body.args });

  try {
    const saved = await appendVersion({
      tripId: trip.tripId,
      ownerKey: req.ownerKey,
      expectedVersion: body.expectedVersion,
      plan,
    });
    res.json({ ...saved, input: trip.input, plan, budgetVerdict: budgetVerdict(plan.budget, trip.input) });
  } catch (e) {
    // Someone else edited first — hand back current state so the client re-tries
    // against it rather than overwriting their change.
    if (e.status === 409) return res.status(409).json({ error: e.message, current: e.current });
    throw e;
  }
}
