// Analytics and LLM observability. Entirely optional: with no POSTHOG_KEY the
// client is null, every helper here no-ops, and the app behaves exactly as it
// did before PostHog existed.
import { PostHog } from 'posthog-node';
import { PostHogTracingProcessor } from '@posthog/ai/openai-agents';
import { addTraceProcessor, Runner } from '@openai/agents';
import { ENV } from '../constants.js';
import { logger } from '../shared/logger.js';
import { currentOwnerKey, currentTraceId, newSpanId } from '../shared/trace.js';

const log = logger('posthog');

export const posthog = ENV.POSTHOG_KEY
  ? new PostHog(ENV.POSTHOG_KEY, { host: ENV.POSTHOG_HOST, flushAt: 20, flushInterval: 5000 })
  : null;

export const posthogEnabled = Boolean(posthog);

if (posthog) {
  // The SDK never throws into application code; this is the only way to see
  // that telemetry is failing.
  posthog.on('error', (e) => log.warn(`posthog: ${e?.message ?? e}`));

  /**
   * LLM observability. The processor implements the Agents SDK's own
   * TracingProcessor interface, so every agent run, tool call, guardrail and
   * generation is captured — model, latency and token usage included — without
   * wrapping or proxying the OpenAI client.
   *
   * The distinct id is read off each trace's metadata, which runTraced() below
   * sets to the owner key the browser sent, so LLM traces line up with the
   * frontend's events for the same person.
   */
  addTraceProcessor(
    new PostHogTracingProcessor({
      client: posthog,
      // Metadata first, then async context: a background run that joins an
      // existing trace arrives without metadata, and without this fallback its
      // events get attributed to the trace id rather than to the traveller.
      distinctId: (trace) => trace?.metadata?.posthog_distinct_id ?? currentOwnerKey() ?? null,
      privacyMode: ENV.POSTHOG_PRIVACY_MODE,
      onError: (e, context) => log.warn(`posthog tracing (${context}): ${e?.message ?? e}`),
    })
  );

  log.info(`enabled -> ${ENV.POSTHOG_HOST}${ENV.POSTHOG_PRIVACY_MODE ? ' (privacy mode: no prompt content)' : ''}`);
}

/**
 * Runs an agent with the trace attributed to a person and a workflow.
 *
 * `run()` from the Agents SDK takes no tracing config, so attribution needs a
 * Runner of its own. This is a drop-in for it: same arguments, same promise,
 * and with PostHog switched off it is just a Runner with a name on it.
 */
export function runTraced(agent, input, { workflowName, ownerKey = null, groupId = null } = {}) {
  // Joining the generation's trace puts the model calls and the provider calls
  // on one timeline, instead of in two unrelated traces.
  const traceId = currentTraceId();
  const runner = new Runner({
    workflowName,
    ...(traceId ? { traceId } : {}),
    ...(groupId ? { groupId } : {}),
    ...(ownerKey ? { traceMetadata: { posthog_distinct_id: ownerKey } } : {}),
  });
  return runner.run(agent, input);
}

/**
 * Records a non-LLM step — a provider call, a database read — as a span on the
 * generation's trace, so AI Observability shows where the time actually went
 * rather than only the part a model was involved in.
 *
 * Outside a generation there is no trace to hang it on, so it does nothing.
 */
export function captureSpan({ name, ms, ownerKey = null, properties = {} }) {
  const traceId = currentTraceId();
  if (!posthog || !traceId) return;
  try {
    posthog.capture({
      // A provider call deep in the pipeline has no idea whose trip it is;
      // the context does.
      distinctId: ownerKey ?? currentOwnerKey() ?? 'anonymous',
      event: '$ai_span',
      properties: {
        $ai_trace_id: traceId,
        $ai_span_id: newSpanId(),
        $ai_span_name: name,
        $ai_latency: ms / 1000, // PostHog reads latency in seconds
        $ai_provider: 'travel-ai',
        ...properties,
      },
    });
  } catch (e) {
    log.warn(`span "${name}" failed: ${e.message}`);
  }
}

/**
 * An embedding call. These go straight to the OpenAI REST API rather than
 * through the Agents SDK, so the tracing processor never sees them — without
 * this, the vector store's cost and latency are invisible.
 */
export function captureEmbedding({ model, ms, tokens = null, count = 1, ownerKey = null }) {
  if (!posthog) return;
  try {
    posthog.capture({
      distinctId: ownerKey ?? currentOwnerKey() ?? 'anonymous',
      event: '$ai_embedding',
      properties: {
        ...(currentTraceId() ? { $ai_trace_id: currentTraceId() } : {}),
        $ai_span_id: newSpanId(),
        $ai_span_name: 'embedding',
        $ai_model: model,
        $ai_provider: 'openai',
        $ai_latency: ms / 1000,
        ...(tokens != null ? { $ai_input_tokens: tokens } : {}),
        embedding_count: count,
      },
    });
  } catch (e) {
    log.warn(`embedding capture failed: ${e.message}`);
  }
}

/**
 * A step that silently did something lesser than it was asked to — the model
 * timed out and deterministic picks were used, a provider went missing, a
 * guardrail stopped a message. These are the events that explain a bad trip
 * after the fact, and none of them is an exception.
 */
export function captureDegradation(reason, { ownerKey = null, ...properties } = {}) {
  const distinctId = ownerKey ?? currentOwnerKey();
  if (!posthog || !distinctId) return;
  try {
    posthog.capture({
      distinctId,
      event: 'ai degraded',
      properties: { reason, ...(currentTraceId() ? { $ai_trace_id: currentTraceId() } : {}), ...properties },
    });
  } catch (e) {
    log.warn(`degradation capture failed: ${e.message}`);
  }
}

/** Fire-and-forget product event. Never awaited, never fatal. */
export function capture(ownerKey, event, properties = {}) {
  if (!posthog || !ownerKey) return;
  try {
    posthog.capture({ distinctId: ownerKey, event, properties });
  } catch (e) {
    log.warn(`capture "${event}" failed: ${e.message}`);
  }
}

/**
 * Reports a server fault to error tracking, attributed to whoever hit it.
 * Called only for 5xx: posthog-node's own express handler captures every error
 * it is handed, which would bury real faults under validation 400s.
 */
export function captureServerError(error, req) {
  if (!posthog) return;
  try {
    posthog.captureException(error, req?.ownerKey ?? undefined, {
      $request_path: req?.originalUrl,
      $request_method: req?.method,
    });
  } catch (e) {
    log.warn(`captureException failed: ${e.message}`);
  }
}

/** Flushes queued events on the way out, so a deploy doesn't lose the tail. */
export async function shutdownPosthog() {
  if (!posthog) return;
  try {
    await posthog.shutdown();
  } catch (e) {
    log.warn(`shutdown: ${e.message}`);
  }
}
