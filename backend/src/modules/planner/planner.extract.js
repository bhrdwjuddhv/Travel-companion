// The hero prompt bar: one sentence in, pre-filled form fields out. Pure text
// extraction — no provider calls, no plan, no database. The user still reviews
// every field and presses Continue, so a wrong guess costs nothing.
import { Agent, run, InputGuardrailTripwireTriggered } from '@openai/agents';
import { MODELS, TIMEOUTS_MS, LIMITS } from '../../constants.js';
import { TripExtraction } from '../../schemas/trip.schema.js';
import { travelScopeGuardrail } from '../../guardrails/guardrails.js';
import { isIsoDate, daysBetween } from '../../shared/dates.js';
import { HttpError } from '../../shared/errors.js';
import { logger, now, since } from '../../shared/logger.js';

const log = logger('extract');

const INSTRUCTIONS = `You read one sentence describing a trip in India and pull out the fields a planning form asks for.

Rules:
- Extract only what the sentence actually says. Everything else is null. Guessing is worse than leaving a
  field blank, because a blank field is one the traveller will fill in themselves.
- Dates are absolute YYYY-MM-DD. Resolve relative wording ("next weekend", "end of this month",
  "first week of March") against the date you are given. If only a length is stated ("4 days") with no
  hint of when, leave both dates null — do not invent a departure.
- travellerCount counts people, so "me and my girlfriend" is 2 and "solo" is 1.
- budgetTier: "budget" for cheap/backpacker/shoestring, "premium" for luxury/heritage/splurge,
  "balanced" for comfortable or mid-range. Leave null when the sentence says nothing about money.
- budgetTotal only when a rupee figure for the whole trip is stated. "under 10k" is 10000.
- interests are short lowercase nouns: forts, street food, trekking, cafes, temples.
- specialRequests catches real constraints that are not a field of their own (vegetarian food, no night
  travel, wheelchair access). Never put the whole sentence here.
- The first city named is usually the origin ("from Delhi"), the destination is where they are going.`;

/**
 * Validation is deliberately forgiving: a field that fails is dropped, not
 * fatal. The form is the last word, and it validates the whole thing on submit
 * exactly as it always did.
 */
export function cleanExtraction(raw) {
  const date = (d) => (typeof d === 'string' && isIsoDate(d) ? d : null);
  const text = (s) => (typeof s === 'string' && s.trim() ? s.trim() : null);
  const list = (a) => (Array.isArray(a) ? a.map(text).filter(Boolean) : []);

  const startDate = date(raw.startDate);
  let endDate = date(raw.endDate);

  // A range the form would reject is worse than no range at all.
  if (startDate && endDate) {
    const days = daysBetween(startDate, endDate) + 1;
    if (days < 1 || days > LIMITS.maxDays) endDate = null;
  }

  return {
    origin: text(raw.origin),
    primaryDestination: text(raw.primaryDestination),
    additionalDestinations: list(raw.additionalDestinations).slice(0, LIMITS.maxDestinations - 1),
    startDate,
    endDate,
    direction: raw.direction ?? null,
    budgetTotal: Number.isFinite(raw.budgetTotal) && raw.budgetTotal > 0 ? Math.round(raw.budgetTotal) : null,
    budgetTier: raw.budgetTier ?? null,
    preferredTransport: raw.preferredTransport ?? null,
    travellerCount: Number.isInteger(raw.travellerCount) && raw.travellerCount > 0 ? raw.travellerCount : null,
    interests: list(raw.interests),
    accommodationPreference: raw.accommodationPreference ?? null,
    specialRequests: text(raw.specialRequests)?.slice(0, 500) ?? null,
  };
}

const timeout = (ms) =>
  new Promise((_, reject) => setTimeout(() => reject(new HttpError(504, `Reading that took too long`)), ms));

export async function extractTripFields(text, today = new Date().toISOString().slice(0, 10)) {
  const began = now();

  const agent = new Agent({
    name: 'Trip prompt reader',
    model: MODELS.PLANNER_FAST,
    instructions: INSTRUCTIONS,
    inputGuardrails: [travelScopeGuardrail],
    outputType: TripExtraction,
  });

  let result;
  try {
    result = await Promise.race([run(agent, `Today is ${today}.\n\nTraveller says: ${text}`), timeout(TIMEOUTS_MS.llm)]);
  } catch (e) {
    if (e instanceof InputGuardrailTripwireTriggered) {
      throw new HttpError(400, 'Tell me about a trip — where from, where to, when, and who with.');
    }
    throw e;
  }

  const fields = cleanExtraction(TripExtraction.parse(result.finalOutput));
  const found = Object.entries(fields).filter(([, v]) => (Array.isArray(v) ? v.length : v != null));
  log.info(`read ${found.length} field(s) in ${since(began)}: ${found.map(([k]) => k).join(', ') || 'none'}`);

  return { fields };
}
