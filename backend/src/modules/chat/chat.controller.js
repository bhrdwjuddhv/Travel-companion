import { z } from 'zod';
import { parseOrThrow } from '../../shared/validate.js';
import { editByChat } from './chat.service.js';
import { refitPlan, budgetBands } from '../budget/budget.refit.js';
import { getTrip, appendVersion } from '../trip/trip.service.js';
import { budgetVerdict } from '../budget/budget.service.js';

const EditBody = z.object({
  message: z.string().min(1).max(1000),
  editContext: z
    .object({
      elementType: z.string().nullish(),
      nodeType: z.string().nullish(),
      id: z.string().nullish(),
      data: z.any().nullish(),
    })
    .nullish(),
});

/** POST /api/trips/:id/chat — one edit turn, or one answered question. */
export async function chat(req, res) {
  const body = parseOrThrow(EditBody, req.body, 'message');
  const result = await editByChat({
    tripId: req.params.id,
    ownerKey: req.ownerKey,
    message: body.message,
    editContext: body.editContext ?? null,
  });
  res.json(result);
}

const RefitBody = z.object({
  targets: z.object({
    intercityTransport: z.number().nonnegative().nullish(),
    accommodation: z.number().nonnegative().nullish(),
    food: z.number().nonnegative().nullish(),
    activityCount: z.number().int().min(0).max(8).nullish(),
  }),
  expectedVersion: z.number().int().min(1),
});

/**
 * POST /api/trips/:id/refit — re-fit to slider targets from stored options
 * only. No provider calls, no model.
 */
export async function refit(req, res) {
  const body = parseOrThrow(RefitBody, req.body, 'targets');
  const trip = await getTrip(req.params.id, req.ownerKey);

  const { plan, unmet } = refitPlan({ plan: trip.plan, input: trip.input, targets: body.targets });

  try {
    const saved = await appendVersion({
      tripId: trip.tripId,
      ownerKey: req.ownerKey,
      expectedVersion: body.expectedVersion,
      plan,
    });
    res.json({
      ...saved,
      input: trip.input,
      plan,
      unmet,
      budgetVerdict: budgetVerdict(plan.budget, trip.input),
    });
  } catch (e) {
    if (e.status === 409) return res.status(409).json({ error: e.message, current: e.current });
    throw e;
  }
}

/** GET /api/trips/:id/bands — slider ranges this trip can actually reach. */
export async function bands(req, res) {
  const trip = await getTrip(req.params.id, req.ownerKey);
  res.json(budgetBands(trip.plan, trip.input));
}
