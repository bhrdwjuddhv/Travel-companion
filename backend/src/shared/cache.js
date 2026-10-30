import { elapsedMs, now, since } from './logger.js';
import { captureSpan } from '../config/posthog.js';

// ponytail: in-process Map, swappable for Redis behind this one function.
// Fine for one instance; the day you run two, replace the body.
const store = new Map();

/**
 * Memoises an async call by key for `ttlHours`. The in-flight promise is what's
 * stored, so ten concurrent callers for the same key make one external request.
 *
 * Logged three ways so the dev trace doesn't lie about where time went:
 *   HIT  — already resolved and still fresh, no wait
 *   JOIN — attached to a call someone else started, waited for it
 *   MISS — this caller made the request
 */
export async function cached(log, provider, key, ttlHours, fn) {
  const began = now();
  const entry = store.get(key);

  // The same three outcomes the log reports, reported to the trace: a HIT that
  // cost nothing and a MISS that cost a round trip should not look alike when
  // you are working out where a slow generation went.
  const span = (state) =>
    captureSpan({ name: provider, ms: elapsedMs(began), properties: { cache: state, $ai_span_type: 'provider' } });

  if (entry && Date.now() < entry.expires) {
    const state = entry.settled ? 'HIT' : 'JOIN';
    const value = await entry.value;
    log.info(`${provider} ${state} ${since(began)}`);
    span(state);
    return value;
  }

  const fresh = { value: fn(), expires: Date.now() + ttlHours * 3600_000, settled: false };
  store.set(key, fresh);

  try {
    const resolved = await fresh.value;
    fresh.settled = true;
    log.info(`${provider} MISS ${since(began)}`);
    span('MISS');
    return resolved;
  } catch (e) {
    store.delete(key); // never cache a failure
    span('ERROR');
    throw e;
  }
}

export const clearCache = () => store.clear();
