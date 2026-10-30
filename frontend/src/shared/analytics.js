import posthog from 'posthog-js';
import { ANALYTICS } from '../constants';
import { ownerKey } from './api';

/**
 * Product analytics. Optional in exactly the way the backend's is: with no key
 * the SDK is never initialised and every call here is a no-op, so a developer
 * without a PostHog project runs the app unchanged.
 *
 * The distinct id is the same anonymous owner key the API is called with, so a
 * person's clicks, their trips and the LLM traces behind them all land on one
 * profile without ever asking them who they are.
 */
export function initAnalytics() {
  if (!ANALYTICS.key) return;

  posthog.init(ANALYTICS.key, {
    api_host: ANALYTICS.host,
    // The app is a single page: 'history_change' captures a $pageview on every
    // React Router navigation, which a plain pageview-on-load would miss.
    capture_pageview: 'history_change',
    capture_exceptions: true,
    person_profiles: 'identified_only',
  });

  posthog.identify(ownerKey());
}

/** One product event. Safe to call whether or not analytics is switched on. */
export function track(event, properties = {}) {
  if (!ANALYTICS.key) return;
  posthog.capture(event, properties);
}
