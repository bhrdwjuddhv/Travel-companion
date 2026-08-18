import { now, since } from './logger.js';

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

  if (entry && Date.now() < entry.expires) {
    const state = entry.settled ? 'HIT' : 'JOIN';
    const value = await entry.value;
    log.info(`${provider} ${state} ${since(began)}`);
    return value;
  }

  const fresh = { value: fn(), expires: Date.now() + ttlHours * 3600_000, settled: false };
  store.set(key, fresh);

  try {
    const resolved = await fresh.value;
    fresh.settled = true;
    log.info(`${provider} MISS ${since(began)}`);
    return resolved;
  } catch (e) {
    store.delete(key); // never cache a failure
    throw e;
  }
}

export const clearCache = () => store.clear();
