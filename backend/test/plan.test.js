// The things the model is never allowed to compute: money, layout, and now
// what a dropdown swap does to both.
import test from 'node:test';
import assert from 'node:assert/strict';
import { computeBudget, budgetVerdict } from '../src/modules/budget/budget.service.js';
import { buildGraph } from '../src/modules/graph/graph.builder.js';
import { GRAPH_LAYOUT } from '../src/constants.js';
import {
  buildLegs, splitNights, dayAssignments, legDates, daysPerDestination, nightsPerDestination,
  segId, stayId, dayIdOf,
} from '../src/modules/planner/planner.assemble.js';
import { runsOn } from '../src/modules/transport/railradar.provider.js';
import { buildSkeleton } from '../src/modules/planner/planner.skeleton.js';
import { applyMutation } from '../src/modules/planner/planner.mutations.js';
import { normalizePlaceName, placeDeduper } from '../src/shared/placeName.js';
import { paceForDay, trimToPace } from '../src/modules/planner/dayPace.js';
import { refitPlan, budgetBands } from '../src/modules/budget/budget.refit.js';
import { cleanExtraction } from '../src/modules/planner/planner.extract.js';
import { cityTierOf, estimateNightlyRate } from '../src/modules/hotels/estimate.js';

const input = {
  origin: 'Delhi',
  primaryDestination: 'Jaipur',
  additionalDestinations: [],
  durationDays: 2,
  direction: 'round',
  travellerCount: 2,
  budgetTotal: 10000,
  interests: [],
  accommodationPreference: 'any',
  preferredTransport: 'any',
  planningMode: 'semi',
};

const seg = (id, from, to, fare, extra = {}) => ({
  id, fromPlace: from, toPlace: to, mode: 'train', provider: 'railradar', service: '12958 Express',
  distanceKm: 280, durationMinutes: 300, fare, fareType: 'estimate', class: 'SL', stops: null,
  source: 'railradar_api', timestamp: 't', ...extra,
});

const act = (id, name, ticketCost, hopFare = null) => ({
  id, name, category: 'attraction', placeId: null, plannedStart: null, durationMinutes: 90,
  ticketCost, costType: 'estimate', isHiddenGem: false, notes: null, source: 'google_places', timestamp: 't',
  localTransportFromPrev: hopFare == null ? null
    : { mode: 'auto', distanceKm: 5, durationMinutes: 15, estimatedFare: hopFare, fareType: 'estimate' },
});

const draft = () => ({
  segments: [seg('s1', 'Delhi', 'Jaipur', 500), seg('s2', 'Jaipur', 'Delhi', 500)],
  stays: [{
    id: 'st1', destination: 'Jaipur', name: 'Hotel Pink', type: 'hotel', placeId: null,
    rating: 4.3, reviewCount: 900, pricePerNight: 2000, priceType: 'estimate', nights: 2,
    distanceToKeyPlacesKm: null, source: 'google_places', timestamp: 't',
  }],
  days: [
    { id: 'd1', dayNumber: 1, destination: 'Jaipur', activities: [act('a1', 'Amber Fort', 100), act('a2', 'Hawa Mahal', 0, 150)] },
    { id: 'd2', dayNumber: 2, destination: 'Jaipur', activities: [act('a3', 'City Palace', 50)] },
  ],
  sources: [],
});

test('budget multiplies per-head costs by travellers and shares the rest', () => {
  const b = computeBudget(draft(), input);
  assert.equal(b.intercityTransport, 2000); // (500 + 500) x 2 travellers
  assert.equal(b.accommodation, 4000);      // 2000/night x 2 nights x 1 room
  assert.equal(b.food, 2000);               // 500 x 2 days x 2 travellers
  assert.equal(b.activities, 300);          // (100 + 0 + 50) x 2
  assert.equal(b.localTransport, 150);      // one shared auto, not per head
  assert.equal(b.misc, 676);                // 8% of 8450
  assert.equal(b.total, 9126);
  assert.equal(b.currency, 'INR');
});

test('budget verdict compares against the stated cap', () => {
  const b = computeBudget(draft(), input);
  assert.deepEqual(budgetVerdict(b, input), { withinBudget: true, cap: 10000, overBy: 0 });
  assert.equal(budgetVerdict(b, { ...input, budgetTotal: 5000 }).overBy, 4126);
  assert.equal(budgetVerdict(b, { ...input, budgetTotal: null }).cap, null);
});

test('graph lays out the spine and hangs stay/days/activities off it', () => {
  const { nodes, edges } = buildGraph(draft(), input);
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));

  assert.deepEqual(nodes.filter((n) => n.position.y === 0).map((n) => n.id), ['origin', 'dest:Jaipur', 'return']);
  assert.equal(byId['origin'].position.x, 0);
  assert.equal(byId['dest:Jaipur'].position.x, GRAPH_LAYOUT.spineX);
  assert.equal(byId['stay:st1'].position.x, GRAPH_LAYOUT.spineX);
  assert.equal(byId['day:d1'].data.id, 'd1'); // Semi mode needs the day id back

  // Two day rows under the same destination must not overlap.
  assert.notEqual(byId['day:d1'].position.y, byId['day:d2'].position.y);
  assert.equal(byId['activity:a1'].position.y, byId['day:d1'].position.y);

  assert.equal(edges.filter((e) => e.type === 'transport').length, 2);
  assert.equal(edges.find((e) => e.target === 'activity:a2').type, 'local');
  assert.equal(edges.find((e) => e.target === 'activity:a1').type, 'flow');
  assert.equal(nodes.length, 9);
});

test('journey legs follow the stops, and close the loop only on a round trip', () => {
  assert.deepEqual(buildLegs(input), [
    { from: 'Delhi', to: 'Jaipur' },
    { from: 'Jaipur', to: 'Delhi' },
  ]);
  assert.deepEqual(buildLegs({ ...input, direction: 'oneway' }), [{ from: 'Delhi', to: 'Jaipur' }]);
  assert.deepEqual(
    buildLegs({ ...input, additionalDestinations: ['Udaipur'], direction: 'oneway' }).map((l) => l.to),
    ['Jaipur', 'Udaipur']
  );
});

test('nights split evenly, earlier stops taking the remainder', () => {
  assert.deepEqual(splitNights(5, ['A', 'B']), [{ destination: 'A', nights: 3 }, { destination: 'B', nights: 2 }]);
  assert.deepEqual(splitNights(4, ['A', 'B']).map((s) => s.nights), [2, 2]);
  assert.deepEqual(splitNights(7, ['A', 'B', 'C']).map((s) => s.nights), [3, 2, 2]);
});

test('swapping a segment re-prices the trip and keeps the old option available', async () => {
  const cheaper = seg('ignored', 'Delhi', 'Jaipur', 200, { mode: 'bus', service: null, class: null, provider: 'google_estimator' });
  const base = draft();
  base.segments[0] = { ...base.segments[0], alternatives: [cheaper] };
  const plan = { ...base, budget: computeBudget(base, input), graph: buildGraph(base, input) };

  const next = await applyMutation({
    plan,
    input,
    tool: 'replace_transport_segment',
    args: { segmentId: 's1', alternativeIndex: 0 },
  });

  const swapped = next.segments[0];
  assert.equal(swapped.id, 's1', 'id survives so graph edges stay valid');
  assert.equal(swapped.mode, 'bus');
  assert.equal(swapped.fare, 200);
  // (200 + 500) x 2 travellers — recomputed, not carried over.
  assert.equal(next.budget.intercityTransport, 1400);
  assert.ok(next.budget.total < plan.budget.total);
  // The option we replaced is now the alternative, so the swap is reversible.
  assert.equal(swapped.alternatives.length, 1);
  assert.equal(swapped.alternatives[0].fare, 500);
  // Untouched parts stay untouched.
  assert.equal(next.segments[1].fare, 500);
  assert.equal(next.days.length, 2);
});

test('skeleton ids match the ids the finished plan will use', () => {
  // This is what makes SSE patching work: the node ids emitted at t=0 must be
  // the same ones the assembled plan produces.
  const multi = { ...input, additionalDestinations: ['Udaipur'], durationDays: 4 };
  const skeleton = buildSkeleton(multi);

  assert.deepEqual(skeleton.segments.map((s) => s.id), [segId(0), segId(1), segId(2)]);
  assert.deepEqual(skeleton.stays.map((s) => s.id), [stayId(0), stayId(1)]);
  assert.deepEqual(skeleton.days.map((d) => d.id), [1, 2, 3, 4].map(dayIdOf));
  assert.deepEqual(
    skeleton.days.map((d) => d.destination),
    dayAssignments(multi).map((d) => d.destination)
  );

  // Placeholders must not read as real numbers.
  assert.ok(skeleton.segments.every((s) => s.pending && s.fare === 0));
  const { edges, nodes } = buildGraph(skeleton, multi);
  assert.match(edges.find((e) => e.data?.id === segId(0)).label, /finding fares/);
  assert.ok(nodes.find((n) => n.id === `stay:${stayId(0)}`));
  assert.equal(nodes.find((n) => n.id === `day:${dayIdOf(1)}`).data.pending, true);
});

test('an unknown mutation is refused', async () => {
  const base = draft();
  const plan = { ...base, budget: computeBudget(base, input), graph: buildGraph(base, input) };
  await assert.rejects(() => applyMutation({ plan, input, tool: 'drop_everything', args: {} }), /Unknown mutation/);
});

test('run-day parsing accepts every shape RailRadar uses, and errs toward showing the train', () => {
  const monday = '2026-08-24'; // a Monday
  assert.equal(runsOn(['Mon', 'Wed', 'Fri'], monday), true);
  assert.equal(runsOn(['Tue', 'Thu'], monday), false);
  assert.equal(runsOn(['monday', 'sunday'], monday), true);

  // 7 flags, Monday first.
  assert.equal(runsOn([1, 0, 0, 0, 0, 0, 0], monday), true);
  assert.equal(runsOn([0, 1, 1, 1, 1, 1, 1], monday), false);

  // Unknown or missing shapes must not silently drop every train.
  assert.equal(runsOn(undefined, monday), true);
  assert.equal(runsOn([], monday), true);
  assert.equal(runsOn([{ weird: true }], monday), true);
  assert.equal(runsOn(['Tue'], null), true, 'no date means no filtering');
});

test('leg dates advance with the trip and the return is pinned to the end date', () => {
  const dated = { ...input, startDate: '2026-09-01', endDate: '2026-09-04', durationDays: 4 };
  // Round trip, single destination: out on day one, back on the last day.
  assert.deepEqual(legDates(dated), ['2026-09-01', '2026-09-04']);

  const multi = {
    ...dated,
    additionalDestinations: ['Udaipur'],
    endDate: '2026-09-06',
    durationDays: 6,
  };
  const legs = legDates(multi);
  assert.equal(legs[0], '2026-09-01', 'first leg leaves on the start date');
  assert.ok(legs[1] > legs[0], 'the hop between cities comes after time spent in the first');
  assert.equal(legs.at(-1), '2026-09-06', 'the return is the end date');

  // Days are consecutive from the start date.
  assert.deepEqual(dayAssignments(dated).map((d) => d.date), ['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04']);
});

test('you are not charged for a night you spend travelling home', () => {
  const dated = { ...input, startDate: '2026-09-01', endDate: '2026-09-04', durationDays: 4 };
  assert.equal(daysPerDestination(dated)[0].nights, 4, 'four days at the destination');
  assert.equal(nightsPerDestination(dated)[0].nights, 3, 'but only three nights booked');
});

test('place names lose search cruft but keep real names intact', () => {
  assert.equal(normalizePlaceName('Mehrangarh Fort Review'), 'Mehrangarh Fort');
  assert.equal(normalizePlaceName('Mehrangarh Fort - Reviews'), 'Mehrangarh Fort');
  assert.equal(normalizePlaceName('Hawa Mahal | Tripadvisor'), 'Hawa Mahal');
  assert.equal(normalizePlaceName('Things to do in Jaipur: City Palace'), 'City Palace');
  // Real names that merely look suspicious must survive untouched.
  assert.equal(normalizePlaceName('Sheesh Mahal, Amber Fort'), 'Sheesh Mahal, Amber Fort');
  assert.equal(normalizePlaceName('Jal Mahal'), 'Jal Mahal');
  assert.equal(normalizePlaceName('Rao Jodha Desert Rock Park'), 'Rao Jodha Desert Rock Park');
});

test('near-duplicate places are rejected, distinct ones are not', () => {
  const d = placeDeduper();
  assert.equal(d.accept({ name: 'Mehrangarh Fort', placeId: 'a' }), true);
  // All of these are the same fort wearing a different Places listing.
  assert.equal(d.accept({ name: 'Mehrangarh Fort Review', placeId: 'b' }), false);
  assert.equal(d.accept({ name: 'Mehrangarh Fort Way', placeId: 'c' }), false);
  assert.equal(d.accept({ name: 'Mehrangarh Fort Sunrise Point', placeId: 'd' }), false);
  assert.equal(d.accept({ name: 'Mehrangarh Fort', placeId: 'a' }), false, 'same id twice');
  // Genuinely different places still get through.
  assert.equal(d.accept({ name: 'Jaswant Thada', placeId: 'e' }), true);
  assert.equal(d.accept({ name: 'Toorji Ka Jhalra', placeId: 'f' }), true);
});

test('a round trip always closes the loop back to the origin', () => {
  const multi = { ...input, additionalDestinations: ['Udaipur'] };
  const legs = buildLegs(multi);
  assert.equal(legs.at(-1).to, multi.origin, 'last leg heads home');

  // And the graph gives that leg a return node, not another destination.
  const d = draft();
  d.segments = [seg('s1', 'Delhi', 'Jaipur', 500), seg('s2', 'Jaipur', 'Udaipur', 300), seg('s3', 'Udaipur', 'Delhi', 700)];
  const { nodes, edges } = buildGraph(d, multi);
  const spine = nodes.filter((n) => n.position.y === 0);
  assert.deepEqual(spine.map((n) => n.id), ['origin', 'dest:Jaipur', 'dest:Udaipur', 'return']);
  assert.equal(spine.at(-1).label, 'Delhi');
  assert.equal(edges.filter((e) => e.type === 'transport').length, 3);
  assert.ok(edges.some((e) => e.target === 'return'), 'the return leg is drawn');

  // One-way must NOT invent a return node.
  const oneWay = { ...multi, direction: 'oneway' };
  const d2 = draft();
  d2.segments = [seg('s1', 'Delhi', 'Jaipur', 500), seg('s2', 'Jaipur', 'Udaipur', 300)];
  assert.ok(!buildGraph(d2, oneWay).nodes.some((n) => n.type === 'return'));
});

test('budget tier drives food cost, and a numeric total still caps it', () => {
  const cheap = computeBudget(draft(), { ...input, budgetTier: 'budget' });
  const posh = computeBudget(draft(), { ...input, budgetTier: 'premium' });
  assert.equal(cheap.food, 350 * 2 * 2);
  assert.equal(posh.food, 900 * 2 * 2);
  assert.ok(posh.total > cheap.total);
  // An unset tier behaves like 'balanced'.
  assert.equal(computeBudget(draft(), { ...input, budgetTier: undefined }).food, 500 * 2 * 2);
  // The cap is independent of tier.
  assert.equal(budgetVerdict(posh, { ...input, budgetTotal: null }).cap, null);
  assert.equal(budgetVerdict(posh, { ...input, budgetTotal: 1000 }).withinBudget, false);
});

test('train times decide how much of a day is left', () => {
  const day = '2026-09-01';
  const at = (segments) => paceForDay({ date: day, destination: 'Jaipur', segments });
  const arrive = (t) => [{ id: 's1', date: day, fromPlace: 'Delhi', toPlace: 'Jaipur', arrivalTime: t }];
  const depart = (t) => [{ id: 's1', date: day, fromPlace: 'Jaipur', toPlace: 'Delhi', departureTime: t }];

  assert.equal(at(arrive('06:10')).pace, 'full');
  assert.equal(at(arrive('13:30')).pace, 'half');
  assert.equal(at(arrive('22:40')).pace, 'travel');

  // The reported bug: a return train leaving mid-morning leaves no day to fill.
  assert.equal(at(depart('10:00')).pace, 'light');
  // ...but a night train does.
  assert.equal(at(depart('23:15')).pace, 'full');
  // Mid-afternoon leaves half a day.
  assert.equal(at(depart('16:00')).pace, 'half');

  // The anchor explains why the day looks the way it does.
  assert.match(at(arrive('22:40')).anchorNote, /Arrive Jaipur 22:40/);
  assert.match(at(depart('10:00')).anchorNote, /Depart Jaipur 10:00/);
  // No clock from the provider must not silently empty the day.
  assert.equal(at(arrive(null)).pace, 'full');
});

test('activities are trimmed to what the trains leave room for', () => {
  const four = [act('a1', 'Fort', 0), act('a2', 'Palace', 0), act('a3', 'Lake', 0), act('a4', 'Bazaar', 0)];

  assert.equal(trimToPace(four, { maxActivities: 4, allowsDinnerOnly: false }).length, 4);
  assert.equal(trimToPace(four, { maxActivities: 2, allowsDinnerOnly: false }).length, 2);
  assert.equal(trimToPace(four, { maxActivities: 0, allowsDinnerOnly: false }).length, 0);

  // A late arrival keeps nothing but somewhere to eat.
  const withMeal = [...four, { ...act('a5', 'Dinner spot', 0), category: 'meal' }];
  const kept = trimToPace(withMeal, { maxActivities: 0, allowsDinnerOnly: true });
  assert.equal(kept.length, 1);
  assert.equal(kept[0].name, 'Dinner spot');
  assert.equal(kept[0].plannedStart, '20:30');
});

test('budget refit trades stored options without any new lookups', () => {
  const cheapLeg = seg('x', 'Delhi', 'Jaipur', 150, { mode: 'bus', class: null, service: null });
  const base = draft();
  base.segments = base.segments.map((s) => ({ ...s, alternatives: [cheapLeg] }));
  base.stays = base.stays.map((s) => ({
    ...s,
    alternatives: [{ ...s, id: 'st1-alt-1', name: 'Cheap Lodge', pricePerNight: 800 }],
  }));
  const plan = { ...base, budget: computeBudget(base, input), graph: buildGraph(base, input) };

  // Aim well below what the current picks cost.
  const { plan: cheaper } = refitPlan({ plan, input, targets: { intercityTransport: 600, accommodation: 1600, food: 800 } });

  assert.equal(cheaper.segments[0].fare, 150, 'took the cheaper leg from storage');
  assert.equal(cheaper.stays[0].name, 'Cheap Lodge');
  assert.equal(cheaper.segments[0].id, 's1', 'ids survive so the graph still matches');
  assert.equal(cheaper.budget.food, 800, 'food target becomes the rate');
  assert.ok(cheaper.budget.total < plan.budget.total);
  // The swap stays reversible.
  assert.ok(cheaper.segments[0].alternatives.some((a) => a.fare === 500));
});

test('budget bands span what the stored options can actually reach', () => {
  const base = draft();
  base.segments = base.segments.map((s) => ({ ...s, alternatives: [seg('x', 'a', 'b', 100)] }));
  const plan = { ...base, budget: computeBudget(base, input), graph: buildGraph(base, input), pool: null };
  const bands = budgetBands(plan, input);

  // 2 travellers, cheapest legs 100+100, dearest 500+500.
  assert.equal(bands.intercityTransport.min, 400);
  assert.equal(bands.intercityTransport.max, 2000);
  assert.ok(bands.food.min < bands.food.max);
  assert.equal(bands.activityCount.min, 0);
});

test('the prompt reader keeps only what is usable, and blanks the rest', () => {
  const clean = cleanExtraction({
    origin: '  Delhi ',
    primaryDestination: null,
    additionalDestinations: ['Jaipur', '  ', null],
    startDate: '2026-03-01',
    endDate: 'next friday',      // not a date: dropped, not guessed
    direction: null,
    budgetTotal: -5,             // nonsense figure: dropped
    budgetTier: 'budget',
    preferredTransport: null,
    travellerCount: 0,           // nobody is travelling: dropped
    interests: ['forts', 'cafes'],
    accommodationPreference: null,
    specialRequests: 'vegetarian food',
  });

  assert.equal(clean.origin, 'Delhi');
  assert.equal(clean.primaryDestination, null);
  assert.deepEqual(clean.additionalDestinations, ['Jaipur']);
  assert.equal(clean.startDate, '2026-03-01');
  assert.equal(clean.endDate, null);
  assert.equal(clean.budgetTotal, null);
  assert.equal(clean.travellerCount, null);
  assert.deepEqual(clean.interests, ['forts', 'cafes']);

  // A range longer than the planner allows is no range at all.
  const tooLong = cleanExtraction({ startDate: '2026-03-01', endDate: '2026-09-01', additionalDestinations: [], interests: [] });
  assert.equal(tooLong.startDate, '2026-03-01');
  assert.equal(tooLong.endDate, null);
});

test('a hostel in a hill town and a palace in a city do not cost the same', () => {
  const hostel = estimateNightlyRate(
    { primaryType: 'hostel', types: ['hostel', 'lodging'], rating: 4.6, reviewCount: 2827 },
    { destination: 'Manali' }
  );
  const palace = estimateNightlyRate(
    { primaryType: 'resort_hotel', types: ['resort_hotel', 'spa', 'lodging'], rating: 4.7, reviewCount: 9046 },
    { destination: 'Jaipur' }
  );
  const metroHotel = estimateNightlyRate(
    { primaryType: 'hotel', types: ['hotel', 'lodging'], rating: 4.2, reviewCount: 9608 },
    { destination: 'Mumbai' }
  );

  assert.ok(hostel.pricePerNight < metroHotel.pricePerNight, 'a hill hostel is cheaper than a metro hotel');
  assert.ok(metroHotel.pricePerNight < palace.pricePerNight, 'a metro hotel is cheaper than a palace resort');
  assert.equal(hostel.basis.cityTier, 'touristHill');
  assert.equal(palace.basis.cityTier, 'tier2');
  // resort_hotel is upscale, and a spa pushes it the last notch.
  assert.equal(palace.basis.class, 'luxury');
  assert.equal(metroHotel.basis.cityTier, 'metro');
});

test('the same city and class still differ by rating, and an unproven rating is pulled back', () => {
  const place = (rating, reviewCount) =>
    estimateNightlyRate({ primaryType: 'hotel', types: ['hotel'], rating, reviewCount }, { destination: 'Jaipur' })
      .pricePerNight;

  assert.ok(place(4.7, 5000) > place(3.5, 5000), 'a better-rated hotel costs more');

  // Five stars from nine people is not evidence; it should not price like a
  // landmark, so it sits nearer the middle than a proven 5-star does.
  assert.ok(place(5, 9) < place(5, 5000), 'an unproven rating is pulled toward the middle');
  assert.ok(place(5, 9) > place(3.0, 5000), 'but it is still better than a proven poor one');
});

test('an unknown city falls back to the default band, and stated preference discounts', () => {
  const unknown = estimateNightlyRate({ primaryType: 'hotel', rating: 4.2, reviewCount: 500 }, { destination: 'Nowheresville' });
  assert.equal(unknown.basis.cityTier, 'default');

  const asHostel = estimateNightlyRate(
    { primaryType: 'hotel', rating: 4.2, reviewCount: 500 },
    { destination: 'Jaipur', preference: 'hostel' }
  ).pricePerNight;
  const asAny = estimateNightlyRate(
    { primaryType: 'hotel', rating: 4.2, reviewCount: 500 },
    { destination: 'Jaipur', preference: 'any' }
  ).pricePerNight;
  assert.ok(asHostel < asAny, 'asking for hostels lowers the estimate');

  // Compound names still resolve: "Leh-Ladakh" is a hill destination.
  assert.equal(cityTierOf('Leh-Ladakh'), 'touristHill');
  assert.equal(cityTierOf('Goa, India'), 'tier2');
});

test("Google's own price level wins over the type when it exists", () => {
  const byType = estimateNightlyRate({ primaryType: 'hostel', rating: 4.5, reviewCount: 1000 }, { destination: 'Mumbai' });
  const byLevel = estimateNightlyRate(
    { primaryType: 'hostel', priceLevel: 'PRICE_LEVEL_VERY_EXPENSIVE', rating: 4.5, reviewCount: 1000 },
    { destination: 'Mumbai' }
  );
  assert.equal(byType.basis.class, 'hostel');
  assert.equal(byLevel.basis.class, 'luxury');
  assert.ok(byLevel.pricePerNight > byType.pricePerNight);
});
