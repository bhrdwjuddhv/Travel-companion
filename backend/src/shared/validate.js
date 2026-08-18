import { HttpError } from './errors.js';

export function parseOrThrow(schema, data, what = 'payload') {
  const r = schema.safeParse(data);
  if (!r.success) throw new HttpError(400, `Invalid ${what}: ${formatIssues(r.error)}`);
  return r.data;
}

export const formatIssues = (err) =>
  err.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ');

/**
 * Runs `fn`, validates its result, and retries once with the validation error
 * fed back so the model can correct itself.
 */
export async function withValidationRetry(schema, fn) {
  const first = schema.safeParse(await fn(null));
  if (first.success) return first.data;
  const second = schema.safeParse(await fn(formatIssues(first.error)));
  if (second.success) return second.data;
  throw new HttpError(422, `Planner returned invalid output: ${formatIssues(second.error)}`);
}
