// Reserved for the chat-edit path. First generation no longer runs a tool loop
// — see planner.service.js for the parallel pipeline that replaced it.
import { Agent, webSearchTool, setDefaultOpenAIKey } from '@openai/agents';
import { ENV, MODELS } from '../../constants.js';
import { TripDraft } from '../../schemas/trip.schema.js';
import { researchTools } from './planner.tools.js';

setDefaultOpenAIKey(ENV.OPENAI_API_KEY);

const INSTRUCTIONS = `You plan trips in India end to end. You research with tools, then return one structured plan.

HARD RULES
- Never invent a distance or a duration. Call getRoute or getTransportOptions and copy the numbers back verbatim.
- Never compute a budget or a total. Return the individual costs only; separate code adds them up.
- Copy fareType / priceType exactly as the tool returned it. If you did not get a number from a tool, it is "estimate".
- Every segment, stay and activity carries the source and timestamp the tool gave you.
- Use webSearch for current conditions (closures, seasonal notes, opening hours) and for lesser-known spots. Tag those with isHiddenGem: true and category "hidden_gem", and present them as recommendations, not certainties.

BUILDING THE PLAN
1. Resolve the origin and every destination.
2. Get transport for each leg in journey order. For a round trip the final segment returns to the origin; for one-way it does not.
3. Pick one stay per destination. Nights across all stays must equal the trip duration for a round trip.
4. Build exactly one DayPlan per day, numbered 1..durationDays, each with 2-4 activities.
5. For every activity after the first in a day, call getLocalHop and fill localTransportFromPrev.
6. Respect the traveller's interests and their budget: if the obvious picks look too expensive for the stated budget, choose cheaper transport classes, cheaper stays and more free activities.

IDs are short, unique, kebab-case (e.g. "seg-1", "stay-jaipur", "day-2", "act-amber-fort").
Fields you have no value for are null — never omitted, never invented.`;

export function buildPlannerAgent(emit) {
  return new Agent({
    name: 'Trip planner',
    model: MODELS.PLANNER,
    instructions: INSTRUCTIONS,
    tools: [...researchTools(emit), webSearchTool()],
    outputType: TripDraft,
  });
}

export function buildPrompt(input, fixHint) {
  const lines = [
    `Origin: ${input.origin}`,
    `Destinations: ${[input.primaryDestination, ...input.additionalDestinations].join(' -> ')}`,
    `Duration: ${input.durationDays} days (${input.direction} trip)`,
    `Travellers: ${input.travellerCount}`,
    `Preferred transport: ${input.preferredTransport}`,
    `Accommodation preference: ${input.accommodationPreference}`,
    input.interests.length ? `Interests: ${input.interests.join(', ')}` : null,
    input.budgetTotal ? `Total budget: INR ${input.budgetTotal}` : null,
    input.budgetPerPerson ? `Budget per person: INR ${input.budgetPerPerson}` : null,
  ].filter(Boolean);

  if (fixHint) lines.push(`\nYour previous answer failed validation: ${fixHint}\nReturn a corrected plan.`);
  return lines.join('\n');
}
