import { HttpError } from './errors.js';

/**
 * JSON fetch with a hard per-call ceiling. Node's global fetch already pools
 * keep-alive connections, so there's no client to re-instantiate per request.
 */
export async function fetchJson(url, { timeoutMs, label, ...options } = {}) {
  try {
    const res = await fetch(url, { ...options, signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) {
      // Provider errors are multi-line JSON; flatten so log lines stay one line.
      const detail = (await res.text()).replace(/\s+/g, ' ').trim().slice(0, 200);
      throw new HttpError(502, `${label} failed: ${res.status} ${detail}`);
    }
    return res.json();
  } catch (e) {
    if (e.name === 'TimeoutError' || e.name === 'AbortError') {
      throw new HttpError(504, `${label} timed out after ${timeoutMs}ms`);
    }
    throw e;
  }
}
