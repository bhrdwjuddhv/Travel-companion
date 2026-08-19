import { BUDGET_DEFAULTS, BUDGET_TIERS, DEFAULT_BUDGET_TIER } from '../../constants.js';

export const tierOf = (input) => BUDGET_TIERS[input?.budgetTier] ?? BUDGET_TIERS[DEFAULT_BUDGET_TIER];

/** The food slider overrides the tier's rate; otherwise the tier decides. */
export const foodRate = (draft, input) =>
  draft?.budgetOverrides?.foodPerPersonPerDay ?? tierOf(input).foodPerPersonPerDay;

const sum = (arr, f) => arr.reduce((n, x) => n + (f(x) || 0), 0);
const allActivities = (days) => days.flatMap((d) => d.activities);

/**
 * The only place money is added up. The agent never returns a total — it
 * returns items, and this turns items into rupees.
 */
export function computeBudget(draft, input) {
  const { travellerCount: travellers, durationDays } = input;
  const rooms = Math.ceil(travellers / BUDGET_DEFAULTS.travellersPerRoom);
  const vehicles = Math.ceil(travellers / BUDGET_DEFAULTS.travellersPerVehicle);
  const activities = allActivities(draft.days);

  const lines = {
    intercityTransport: sum(draft.segments, (s) => s.fare) * travellers,
    accommodation: sum(draft.stays, (s) => s.pricePerNight * s.nights) * rooms,
    food: foodRate(draft, input) * durationDays * travellers,
    activities: sum(activities, (a) => a.ticketCost) * travellers,
    localTransport: sum(activities, (a) => a.localTransportFromPrev?.estimatedFare) * vehicles,
  };

  const subtotal = Object.values(lines).reduce((a, b) => a + b, 0);
  const misc = subtotal * BUDGET_DEFAULTS.miscBufferPct;

  const rounded = Object.fromEntries(Object.entries(lines).map(([k, v]) => [k, Math.round(v)]));
  return {
    ...rounded,
    misc: Math.round(misc),
    total: Math.round(subtotal + misc),
    currency: BUDGET_DEFAULTS.currency,
  };
}

/** What the agent is told when the plan busts the budget — it proposes cuts, not numbers. */
export function budgetVerdict(budget, input) {
  const cap = input.budgetTotal ?? (input.budgetPerPerson ? input.budgetPerPerson * input.travellerCount : null);
  if (cap == null) return { withinBudget: true, cap: null, overBy: 0 };
  return { withinBudget: budget.total <= cap, cap, overBy: Math.max(0, budget.total - cap) };
}
