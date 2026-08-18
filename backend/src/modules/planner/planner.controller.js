import { z } from 'zod';
import { TripInput } from '../../schemas/trip.schema.js';
import { parseOrThrow } from '../../shared/validate.js';
import { sseStart } from '../../shared/sse.js';
import { runPlanning, submitDecision, cancelDecisions } from './planner.service.js';

// Retrying helps for a bad model answer, a flaky provider or a timed-out
// decision. It does not help for a bad API key or a blown quota.
const RETRYABLE = new Set([408, 422, 502, 503, 504]);

/** POST /api/planning/start — streams progress (and decisions) until `done`. */
export async function start(req, res) {
  const input = parseOrThrow(TripInput, req.body, 'trip input');
  const emit = sseStart(res);

  let tripId = null;
  const trace = (event, data) => {
    if (event === 'trip_created') tripId = data.tripId;
    emit(event, data);
  };
  // Browser closed mid-decision: release the paused run instead of leaking it.
  req.on('close', () => tripId && cancelDecisions(tripId));

  try {
    await runPlanning({ input, ownerKey: req.ownerKey, emit: trace });
  } catch (e) {
    console.error('[planning]', e.message);
    emit('failed', { message: e.message, recoverable: RETRYABLE.has(e.status ?? 500) });
  } finally {
    res.end();
  }
}

const DecisionBody = z.object({ decisionId: z.string().min(1), choiceId: z.string().min(1) });

/** POST /api/planning/:tripId/decision — resumes a paused Stepwise run. */
export async function decide(req, res) {
  const body = parseOrThrow(DecisionBody, req.body, 'decision');
  submitDecision({ tripId: req.params.tripId, ...body });
  res.json({ ok: true });
}
