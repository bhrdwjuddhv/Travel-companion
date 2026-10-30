import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

/**
 * Who and what is in flight, carried implicitly down the call stack.
 *
 * Most of a trip's wall-clock time is spent in places the Agents SDK cannot
 * see: Google Places, Routes, RailRadar and Qdrant are called directly by the
 * pipeline, not as agent tools. Those calls happen several layers below the
 * code that knows which generation they belong to, and threading a trace id
 * and an owner key through every provider signature to tell them would be a
 * lot of noise for two pieces of metadata — so they ride in async context.
 *
 * The owner key lives here too because per-run trace metadata proved not to
 * survive everywhere: a background agent run that joins an existing trace
 * arrived with no metadata at all, and its events were attributed to the trace
 * id instead of the traveller. Context is the one source both the processor
 * and the span emitter can always read.
 */
const store = new AsyncLocalStorage();

const hex = (bytes) => randomUUID().replace(/-/g, '').slice(0, bytes * 2);

/** Ids shaped like the Agents SDK's own, so both land in the same trace tree. */
export const newTraceId = () => `trace_${hex(16)}`;
export const newSpanId = () => `span_${hex(12)}`;

/** Runs `fn` with this generation's trace id and traveller as ambient context. */
export const withTrace = ({ traceId, ownerKey = null }, fn) => store.run({ traceId, ownerKey }, fn);

/** The generation in flight, or null outside one (a mutation, a chat edit). */
export const currentTraceId = () => store.getStore()?.traceId ?? null;

/** The traveller the generation in flight belongs to, if there is one. */
export const currentOwnerKey = () => store.getStore()?.ownerKey ?? null;
