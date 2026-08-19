import { LIMITS } from '../../constants.js';
import { HttpError, notFound } from '../../shared/errors.js';
import { TripPlan } from '../../schemas/trip.schema.js';
import { parseOrThrow } from '../../shared/validate.js';
import { logger, now, since } from '../../shared/logger.js';
import { computeBudget, budgetVerdict, tierOf } from '../budget/budget.service.js';
import { buildGraph, segmentLabel } from '../graph/graph.builder.js';
import { getTransportOptions, localHop } from '../transport/transport.service.js';
import { resolveLocation } from '../places/geocode.service.js';
import { searchStays, searchAttractions } from '../places/places.service.js';
import { assertGenerationQuota, createTrip, appendVersion } from '../trip/trip.service.js';
import { buildSkeleton } from './planner.skeleton.js';
import { selectPlan, researchHiddenGems } from './planner.select.js';
import { freshGemsFor, ingestGems } from '../rag/rag.service.js';
import { placeDeduper, normalizePlaceName } from '../../shared/placeName.js';
import { paceForDay, trimToPace } from './dayPace.js';
import {
  newId, toSegment, toAccommodation, toActivity, rehop, buildLegs, nightsPerDestination,
  destinationsOf, dayAssignments, legDates, segId, stayId, dayIdOf, actIdOf,
} from './planner.assemble.js';

const log = logger('planner');

const withComputed = (draft, input) => ({
  ...draft,
  budget: computeBudget(draft, input),
  graph: buildGraph(draft, input),
});

/**
 * Trims a shortlist for storage. Provider results carry no `id` — the provider
 * interface returns everything *but* the id — so stamp one here, or the plan
 * fails validation on the way to the database.
 */
const keep = (list, parentId) =>
  list.slice(0, LIMITS.storedAlternatives).map(({ alternatives, ...rest }, i) => ({
    ...rest,
    id: rest.id ?? `${parentId}-alt-${i + 1}`,
  }));

const source = (id, url, sourceType, entityRef) => ({
  id,
  url,
  sourceType,
  entityRef,
  timestamp: new Date().toISOString(),
});

/* ------------------------------------------------------------------ *
 * Fully AI + Semi: a deterministic parallel pipeline
 * ------------------------------------------------------------------ */

/**
 * The model used to drive this as a 20-turn tool loop — one inference per API
 * call, all serial. Now code does the fetching (all of it at once) and the
 * model makes a single selection call over compact summaries.
 */
export async function generateTrip({ input, ownerKey, emit }) {
  const pipeline = log.start(
    'pipeline',
    `${input.origin}->${destinationsOf(input).join('/')} ${input.durationDays}d ${input.travellerCount}p mode=${input.planningMode}`
  );
  await assertGenerationQuota(ownerKey);

  const send = (event, data) => {
    log.info(`sse ${event}${data.target ? ` ${data.target}` : ''}${data.status ? ` ${data.status}` : ''}`);
    emit(event, data);
  };

  const legs = buildLegs(input);
  const destinations = destinationsOf(input);
  const assignments = dayAssignments(input);
  const nightsPlan = nightsPerDestination(input);
  const dates = legDates(input);
  const tier = tierOf(input);
  log.info(`budget tier: ${tier.label}${input.budgetTotal ? ` (hard cap ₹${input.budgetTotal})` : ''}`);

  // ---- 1. Skeleton first, so the graph renders before any network call ----
  const skeletonPlan = withComputed(buildSkeleton(input), input);
  send('skeleton', { plan: skeletonPlan, status: 'pending' });
  send('progress', { step: 'resolving', label: 'Sketching the route' });

  const edgeOf = (id) => skeletonPlan.graph.edges.find((e) => e.type === 'transport' && e.data?.id === id)?.id;

  // ---- 2. Fan out every deterministic lookup at once ----
  const stage = log.start('fanout', `${legs.length} legs, ${destinations.length} destinations`);
  send('progress', { step: 'researching_transport', label: 'Researching routes, stays and places' });

  const transportByLeg = [];
  const staysByDest = {};
  const attractionsByDest = {};

  const transportJobs = legs.map((leg, i) =>
    getTransportOptions({
      from: leg.from,
      to: leg.to,
      mode: input.preferredTransport,
      preference: input.preferredTransport,
      date: dates[i],
      classes: tier.trainClasses,
    }).then(
      ({ pick, alternatives }) => {
        transportByLeg[i] = [pick, ...alternatives];
        // Provisional best pick lands on the edge immediately; the selection
        // step may revise it in the full snapshot later.
        const segment = { ...toSegment(pick, segId(i), dates[i]), alternatives: keep(alternatives, segId(i)) };
        send('patch', { target: edgeOf(segId(i)), status: 'ready', label: segmentLabel(segment), data: segment });
      },
      (e) => {
        transportByLeg[i] = [];
        log.warn(`leg ${i} (${leg.from}->${leg.to}) found nothing: ${e.message}`);
      }
    )
  );

  const stayJobs = nightsPlan.map(({ destination, nights }, i) =>
    searchStays(destination, { preference: input.accommodationPreference, preferPriceUpTo: tier.maxPricePerNight }).then(
      (found) => {
        staysByDest[destination] = found;
        if (!found.length) return;
        send('patch', {
          target: `stay:${stayId(i)}`,
          status: 'ready',
          label: found[0].name,
          data: toAccommodation(found[0], { id: stayId(i), destination, nights }),
        });
      },
      (e) => {
        staysByDest[destination] = [];
        log.warn(`no stays for ${destination}: ${e.message}`);
      }
    )
  );

  const attractionJobs = destinations.map((destination) =>
    searchAttractions(destination, { interests: input.interests }).then(
      (found) => {
        attractionsByDest[destination] = found;
      },
      (e) => {
        attractionsByDest[destination] = [];
        log.warn(`no attractions for ${destination}: ${e.message}`);
      }
    )
  );

  // Geocoding is only for disambiguation here, so a failure is not fatal.
  const geocodeJob = Promise.allSettled([input.origin, ...destinations].map((p) => resolveLocation(p)));

  // The slowest thing in the pipeline runs alongside all of it, not after.
  log.info('▶ hidden gems (background)');
  const gemsJob = gatherHiddenGems(destinations, input.interests).catch((e) => {
    log.warn(`hidden gems unavailable: ${e.message}`);
    return [];
  });

  await Promise.all([...transportJobs, ...stayJobs, ...attractionJobs, geocodeJob]);
  stage.done();

  if (legs.some((_, i) => !transportByLeg[i]?.length)) {
    throw new HttpError(502, 'Could not find transport for every leg of this trip.');
  }

  // ---- 3. One structured LLM call: pick options, sequence days ----
  const select = log.start('select (LLM)');
  const selection = await selectPlan({ input, legs, transportByLeg, staysByDest, attractionsByDest, dayAssignments: assignments, tier });
  select.done();

  // ---- 4. Assemble deterministically from the model's choices ----
  const assemble = log.start('assemble');
  const draft = await assembleDraft({ input, legs, transportByLeg, staysByDest, attractionsByDest, assignments, nightsPlan, selection, dates });
  assemble.done();

  const budgetStage = log.start('budget');
  // Code built this, but validate before it reaches the database anyway.
  const plan = parseOrThrow(TripPlan, withComputed(draft, input), 'plan');
  budgetStage.done();

  send('patch', { target: 'plan', status: 'ready', data: plan });
  send('patch', { target: 'budget', status: 'ready', data: plan.budget });

  const saveStage = log.start('save');
  send('progress', { step: 'saving', label: 'Saving your plan' });
  const saved = await createTrip({ ownerKey, input, plan });
  saveStage.done();

  send('done', { ...saved, input, plan, budgetVerdict: budgetVerdict(plan.budget, input) });
  pipeline.done(`total`);

  // ---- 5. Gems patch in whenever they land, after the plan is usable ----
  await patchHiddenGems({ tripId: saved.tripId, ownerKey, input, plan, version: saved.versionNumber, gemsJob, send });

  return saved;
}

/**
 * Qdrant first, web search only for what's missing or stale. A city researched
 * last week costs nothing to reuse, and web search is the slow tail here.
 */
async function gatherHiddenGems(destinations, interests) {
  const known = await Promise.all(destinations.map((city) => freshGemsFor(city)));
  const reused = known.filter(Boolean).flat();
  const missing = destinations.filter((_, i) => !known[i]);

  if (!missing.length) {
    log.info(`hidden gems: reused ${reused.length} from cache, no research needed`);
    return reused;
  }

  const found = await researchHiddenGems({ destinations: missing, interests });
  await ingestGems(found);
  log.info(`hidden gems: reused ${reused.length}, researched ${found.length}`);
  return [...reused, ...found];
}

/** Turns the model's id picks into real Trip JSON. Every number comes from a provider. */
async function assembleDraft({ input, legs, transportByLeg, staysByDest, attractionsByDest, assignments, nightsPlan, selection, dates }) {
  const indexOf = (optionId) => {
    const n = Number(String(optionId).slice(String(optionId).lastIndexOf('-') + 1).replace(/[^0-9]/g, ''));
    return Number.isInteger(n) ? n : 0;
  };
  const tailIndex = (optionId) => {
    const n = Number(String(optionId).slice(String(optionId).lastIndexOf(':') + 1));
    return Number.isInteger(n) ? n : 0;
  };

  // Transport
  const segments = legs.map((_, i) => {
    const options = transportByLeg[i];
    const chosen = selection.legs.find((l) => l.legIndex === i);
    const picked = options[chosen ? indexOf(chosen.optionId) : 0] ?? options[0];
    return {
      ...toSegment(picked, segId(i), dates[i]),
      alternatives: keep(options.filter((o) => o !== picked), segId(i)),
    };
  });

  // Stays — a destination with no options simply gets no stay node.
  const stays = nightsPlan.flatMap(({ destination, nights }, i) => {
    const options = staysByDest[destination] ?? [];
    if (!options.length) return [];
    const chosen = selection.stays.find((s) => s.destination === destination);
    const picked = options[chosen ? tailIndex(chosen.optionId) : 0] ?? options[0];
    return [
      {
        ...toAccommodation(picked, { id: stayId(i), destination, nights }),
        alternatives: keep(options.filter((o) => o !== picked).map((c) => toAccommodation(c, { id: newId('stay'), destination, nights })), stayId(i)),
      },
    ];
  });

  // Days. Google Places returns "Mehrangarh Fort", "Mehrangarh Fort Way" and
  // "Mehrangarh Fort Review" as separate POIs, so near-duplicate names are
  // rejected, not just repeated ids.
  const dedupe = placeDeduper();
  const usedPlaceIds = new Set();
  const days = assignments.map(({ dayNumber, destination, date }) => {
    const pool = attractionsByDest[destination] ?? [];
    const chosen = selection.days.find((d) => d.dayNumber === dayNumber);
    const picks = (chosen?.activityIds ?? [])
      .map((id) => pool[tailIndex(id)])
      .filter((c) => c && dedupe.accept(c) && (usedPlaceIds.add(c.placeId), true));

    // The trains touching this day decide how much of it is actually free.
    const shape = paceForDay({ date, destination, segments });
    const activities = trimToPace(
      picks.map((c, k) => toActivity(c, { id: actIdOf(dayNumber, k) })),
      shape
    );

    return {
      id: dayIdOf(dayNumber),
      dayNumber,
      destination,
      date,
      pace: shape.pace,
      anchorNote: shape.anchorNote,
      activities,
    };
  });

  // Every local hop at once, rather than one per model turn.
  await Promise.all(days.flatMap((day) => day.activities.map((_, k) => rehop(day, k))));

  const sources = [
    source(newId('src'), 'https://places.googleapis.com/v1/places:searchText', 'places', 'stays+attractions'),
    source(newId('src'), 'https://routes.googleapis.com/directions/v2:computeRoutes', 'api', 'distances+durations'),
    ...(segments.some((s) => s.provider === 'railradar')
      ? [source(newId('src'), 'https://api.railradar.in/v1', 'api', 'train schedules')]
      : []),
  ];

  // Everything researched but not used, kept so budget sliders can re-fit the
  // trip later without another provider call.
  const optionPool = { activitiesByDestination: {} };
  for (const [destination, list] of Object.entries(attractionsByDest)) {
    optionPool.activitiesByDestination[destination] = list
      .filter((c) => !usedPlaceIds.has(c.placeId))
      .slice(0, LIMITS.storedAlternatives * 2)
      .map((c, k) => toActivity(c, { id: `pool-${destination}-${k + 1}` }));
  }

  return { segments, stays, days, sources, pool: optionPool };
}

/**
 * Turns a web-search gem into a real place: Google Places gives the canonical
 * name, a placeId (so the Maps link lands on the place, not a text search) and
 * confirms it exists at all. Unresolvable gems keep their cleaned-up name.
 */
async function resolveGem(gem) {
  try {
    const [match] = await searchAttractions(gem.destination, { interests: [gem.name], limit: 1 });
    if (match) return { ...match, isHiddenGem: true, source: gem.url ?? match.source };
  } catch (e) {
    log.warn(`could not resolve "${gem.name}" via Places: ${e.message}`);
  }
  return {
    name: normalizePlaceName(gem.name),
    category: 'hidden_gem',
    placeId: null,
    isHiddenGem: true,
    source: gem.url ?? 'web_search',
    timestamp: new Date().toISOString(),
  };
}

/** Appends whatever the background web research found as a new version. */
async function patchHiddenGems({ tripId, ownerKey, input, plan, version, gemsJob, send }) {
  const began = now();
  const gems = await gemsJob;
  if (!gems.length) {
    log.info(`✓ hidden gems (${since(began)}) none found`);
    return;
  }

  const draft = structuredClone(plan);

  // Seed the deduper with what's already planned, so a gem the itinerary
  // already covers doesn't get added a second time under a different name.
  const dedupe = placeDeduper();
  for (const day of draft.days) for (const a of day.activities) dedupe.accept(a);

  const resolved = await Promise.all(gems.map(resolveGem));
  let added = 0;

  for (const [i, place] of resolved.entries()) {
    const day = draft.days.find((d) => d.destination === gems[i].destination);
    if (!day || !dedupe.accept(place)) continue;

    const activity = toActivity(place, { id: actIdOf(day.dayNumber, day.activities.length) });
    activity.category = 'hidden_gem';
    activity.isHiddenGem = true;
    activity.notes = gems[i].note;
    day.activities.push(activity);

    if (gems[i].url) draft.sources.push(source(newId('src'), gems[i].url, 'web', place.name));
    added += 1;
  }

  if (!added) {
    log.info(`✓ hidden gems (${since(began)}) all ${gems.length} already covered`);
    return;
  }

  // ponytail: no local hop computed for a gem — it is appended to the end of a
  // day, and a wrong fare is worse than none.
  const next = withComputed({ segments: draft.segments, stays: draft.stays, days: draft.days, sources: draft.sources }, input);

  try {
    const saved = await appendVersion({ tripId, ownerKey, expectedVersion: version, plan: next });
    send('patch', { target: 'plan', status: 'gems', data: next, versionNumber: saved.versionNumber });
    send('patch', { target: 'budget', status: 'gems', data: next.budget });
    log.info(`✓ hidden gems (${since(began)}) patched ${added} of ${gems.length}`);
  } catch (e) {
    // The user edited while we were searching — their version wins.
    log.warn(`hidden gems not applied: ${e.message}`);
  }
}

/* ------------------------------------------------------------------ *
 * Stepwise: a paused, resumable run
 * ------------------------------------------------------------------ */

// ponytail: in-process registry, so a paused run lives on one server only.
// Move to Redis pub/sub the day you run more than one instance.
const pending = new Map(); // decisionId -> { resolve, reject, tripId }

/**
 * Called by POST /api/planning/:tripId/decision to resume a paused run.
 * A duplicate or stale decisionId finds nothing pending and is refused, so a
 * double-click can't advance the run twice.
 */
export function submitDecision({ tripId, decisionId, choiceId }) {
  const entry = pending.get(decisionId);
  if (!entry || entry.tripId !== tripId) {
    log.warn(`ignoring stale decision ${decisionId} for trip ${tripId}`);
    throw notFound('That decision is no longer open');
  }
  pending.delete(decisionId);
  entry.resolve(choiceId);
}

/** Client hung up — don't leave the run waiting forever. */
export function cancelDecisions(tripId) {
  for (const [id, entry] of pending) {
    if (entry.tripId === tripId) {
      pending.delete(id);
      entry.reject(new HttpError(499, 'Planning cancelled'));
    }
  }
}

/**
 * Emits a decision and blocks until POST /decision resolves it. Only one
 * decision per trip is ever open, so a stale or duplicate id can't resume.
 */
function ask(emit, tripId, payload) {
  const decisionId = newId('dec');

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(decisionId);
      reject(new HttpError(408, 'Timed out waiting for your choice'));
    }, LIMITS.decisionTimeoutMinutes * 60_000);

    pending.set(decisionId, {
      tripId,
      stage: payload.stage,
      resolve: (v) => {
        clearTimeout(timer);
        log.info(`▶ resume after ${payload.stage} → chose ${v}`);
        resolve(v);
      },
      reject: (e) => {
        clearTimeout(timer);
        reject(e);
      },
    });

    log.info(`⏸ decision_required ${payload.stage} ${payload.legOrTarget} (${payload.options.length} options)`);
    emit('decision_required', { ...payload, decisionId });
  });
}

const money = (n) => `₹${Number(n).toLocaleString('en-IN')}`;
const fmtMins = (m) => (m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ''}` : `${m}m`);

// 'auto' means "you pick" — index 0 is already the best-scored option.
const chosenIndex = (choiceId, count) => {
  if (choiceId === 'auto') return 0;
  const i = Number(String(choiceId).replace('opt-', ''));
  return Number.isInteger(i) && i >= 0 && i < count ? i : 0;
};

const transportOption = (o, i) => ({
  id: `opt-${i}`,
  title: `${o.mode}${o.service ? ` · ${o.service}` : ''}`,
  subtitle: o.class ? `Class ${o.class}` : `${o.provider.replace('_', ' ')}`,
  badge: o.fareType,
  facts: [
    { label: 'Fare', value: money(o.fare) },
    { label: 'Time', value: fmtMins(o.durationMinutes) },
    { label: 'Distance', value: `${o.distanceKm} km` },
  ],
});

const stayOption = (c, i) => ({
  id: `opt-${i}`,
  title: c.name,
  subtitle: c.type,
  badge: c.priceType,
  facts: [
    { label: 'Per night', value: money(c.pricePerNight) },
    { label: 'Rating', value: c.rating != null ? `${c.rating}★ (${c.reviewCount ?? 0})` : 'n/a' },
  ],
});

const bundleOption = (bundle, i) => ({
  id: `opt-${i}`,
  title: bundle[0]?.name ?? 'Free day',
  subtitle: bundle.length > 1 ? `plus ${bundle.slice(1).map((c) => c.name).join(', ')}` : 'one stop',
  badge: null,
  facts: [
    { label: 'Stops', value: String(bundle.length) },
    { label: 'Top rated', value: `${Math.max(...bundle.map((c) => c.rating ?? 0)).toFixed(1)}★` },
  ],
});

const chunk = (list, size) =>
  Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, i * size + size));

/**
 * Stepwise mode. The shortlists come from the same providers; the user is the
 * decision maker, so no agent loop is needed — which also means the run can
 * pause on an open SSE stream without a stalled model.
 */
export async function generateGuided({ input, ownerKey, emit }) {
  const pipeline = log.start('pipeline (stepwise)', `${input.origin} ${input.durationDays}d`);
  await assertGenerationQuota(ownerKey);

  const legs = buildLegs(input);
  const nightsPlan = nightsPerDestination(input);
  const guidedDates = legDates(input);
  const total = legs.length + nightsPlan.length + input.durationDays;
  let done = 0;

  const send = (event, data) => {
    log.info(`sse ${event}${data.stage ? ` ${data.stage}` : ''}${data.step ? ` ${data.step}` : ''}`);
    emit(event, data);
  };

  const draft = { segments: [], stays: [], days: [], sources: [] };
  const { tripId } = await createTrip({ ownerKey, input, plan: withComputed(draft, input) });
  let version = 1;
  send('trip_created', { tripId });

  // The route shape goes up before the first question — the user is about to be
  // asked about a leg, so they should be able to see it.
  send('skeleton', { plan: withComputed(buildSkeleton(input), input), status: 'pending' });

  // Every decision lands as its own version, so a partial plan is never lost.
  const commit = async () => {
    const plan = withComputed(draft, input);
    ({ versionNumber: version } = await appendVersion({ tripId, ownerKey, expectedVersion: version, plan }));
    send('plan_partial', { plan, versionNumber: version, progress: { done, total } });
  };

  try {
    // 1. Transport, leg by leg.
    for (const [legIndex, leg] of legs.entries()) {
      const t = log.start('stepwise transport', `${leg.from}->${leg.to}`);
      send('progress', { step: 'researching_transport', label: `Transport from ${leg.from} to ${leg.to}` });
      const { pick, alternatives } = await getTransportOptions({
        from: leg.from,
        to: leg.to,
        mode: input.preferredTransport,
        preference: input.preferredTransport,
        date: guidedDates[legIndex],
      });
      t.done();
      const options = [pick, ...alternatives].filter(Boolean).slice(0, LIMITS.decisionOptions);

      // Nothing to choose between means no route at all — say so rather than
      // asking the user to pick from an empty list.
      if (!options.length) {
        throw new HttpError(
          422,
          `No way to get from ${leg.from} to ${leg.to} was found. Try a different transport mode or destination.`
        );
      }

      const choice = await ask(send, tripId, {
        stage: 'transport',
        stageLabel: 'Transport',
        legOrTarget: `${leg.from}->${leg.to}`,
        prompt: `How do you want to get from ${leg.from} to ${leg.to}?`,
        options: options.map(transportOption),
        progress: { done, total },
      });

      const i = chosenIndex(choice, options.length);
      draft.segments.push({
        ...toSegment(options[i], segId(legIndex), guidedDates[legIndex]),
        alternatives: keep(options.filter((_, k) => k !== i), segId(legIndex)),
      });
      done += 1;
      await commit();
    }

    // 2. One stay per destination.
    for (const [destIndex, { destination, nights }] of nightsPlan.entries()) {
      const t = log.start('stepwise stays', destination);
      send('progress', { step: 'researching_stays', label: `Places to stay in ${destination}` });
      const found = await searchStays(destination, { preference: input.accommodationPreference }).catch((e) => {
        log.warn(`stay search failed for ${destination}: ${e.message}`);
        return [];
      });
      t.done();
      const options = found.slice(0, LIMITS.decisionOptions);

      // No stays found: offer to carry on without one rather than dead-ending.
      const choice = await ask(send, tripId, {
        stage: 'stay',
        stageLabel: 'Where to stay',
        legOrTarget: destination,
        prompt: options.length
          ? `Where should you stay in ${destination}?`
          : `No stays came back for ${destination}. Continue without one and add it later?`,
        options: options.length
          ? options.map(stayOption)
          : [{ id: 'opt-0', title: 'Continue without a stay', subtitle: destination, badge: null, facts: [] }],
        progress: { done, total },
      });

      if (options.length) {
        const i = chosenIndex(choice, options.length);
        draft.stays.push({
          ...toAccommodation(options[i], { id: stayId(destIndex), destination, nights }),
          alternatives: keep(
            options.filter((_, k) => k !== i).map((c) => toAccommodation(c, { id: newId('stay'), destination, nights }))
          ),
        });
      }
      done += 1;
      await commit();
    }

    // 3. Each day, chosen from bundles of nearby-rated stops.
    let dayNumber = 0;
    for (const { destination, nights } of nightsPlan) {
      const t = log.start('stepwise attractions', destination);
      send('progress', { step: 'researching_places', label: `Things to do in ${destination}` });
      const candidates = await searchAttractions(destination, { interests: input.interests }).catch((e) => {
        log.warn(`attraction search failed for ${destination}: ${e.message}`);
        return [];
      });
      t.done();
      const bundles = chunk(candidates, 3);

      for (let d = 0; d < nights; d += 1) {
        dayNumber += 1;
        const options = bundles.slice(0, LIMITS.decisionOptions);

        const choice = await ask(send, tripId, {
          stage: 'day',
          stageLabel: `Day ${dayNumber} · ${destination}`,
          legOrTarget: `day ${dayNumber} in ${destination}`,
          prompt: options.length
            ? `What should day ${dayNumber} in ${destination} look like?`
            : `Nothing came back for ${destination}. Leave day ${dayNumber} open?`,
          options: options.length
            ? options.map(bundleOption)
            : [{ id: 'opt-0', title: 'Leave the day open', subtitle: destination, badge: null, facts: [] }],
          progress: { done, total },
        });

        const i = chosenIndex(choice, Math.max(options.length, 1));
        const day = {
          id: dayIdOf(dayNumber),
          dayNumber,
          destination,
          activities: (options[i] ?? []).map((c, k) => toActivity(c, { id: actIdOf(dayNumber, k) })),
        };
        await Promise.all(day.activities.map((_, k) => rehop(day, k)));
        draft.days.push(day);

        if (options.length) bundles.splice(i, 1); // don't offer the same day twice
        done += 1;
        await commit();
      }
    }

    send('progress', { step: 'calculating_budget', label: 'Adding up the budget' });
    send('progress', { step: 'saving', label: 'Saving your plan' });
    const plan = withComputed(draft, input);
    ({ versionNumber: version } = await appendVersion({ tripId, ownerKey, expectedVersion: version, plan }));

    send('done', { tripId, versionNumber: version, input, plan, budgetVerdict: budgetVerdict(plan.budget, input) });
    pipeline.done();
    return { tripId, versionNumber: version };
  } finally {
    cancelDecisions(tripId);
  }
}

export const runPlanning = (args) =>
  args.input.planningMode === 'guided' ? generateGuided(args) : generateTrip(args);
