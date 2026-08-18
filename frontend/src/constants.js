// Single source of truth for the client. Colors, copy, mode config and scroll
// tuning all live here — nothing below /modules hardcodes any of it.
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

export const OWNER_KEY_STORAGE = 'travel-ai:ownerKey';

export const THEME = {
  // The one green: CTA, page transition, and the origin node all use this so
  // "the start" is always the same colour.
  originGreen: '#22c55e',
  originGreenDim: 'rgba(34, 197, 94, 0.14)',
  originGreenEdge: 'rgba(34, 197, 94, 0.55)',
  textOnMedia: '#fafafa',
  textMutedOnMedia: '#d4d4d4',
  scrim: 'rgba(9, 9, 11, 0.74)',
  scrimStrong: 'rgba(9, 9, 11, 0.86)',

  // React Flow ships light-mode chrome. These tokens are pushed to CSS custom
  // properties by shared/theme.js, so index.css never hardcodes a colour.
  graph: {
    controlBg: '#18181b',
    controlBorder: '#3f3f46',
    controlIcon: '#e4e4e7',
    controlHoverBg: '#27272a',
    controlActiveBg: '#3f3f46',
    minimapBg: '#111113',
    minimapMask: 'rgba(0, 0, 0, 0.62)',
    minimapNode: '#3f3f46',
    backgroundDots: '#27272a',
    attribution: 'rgba(161, 161, 170, 0.55)',
    pending: '#52525b',
  },
};

// Landing scroll image sequence. Drop frames in /public/image-sequence and set
// the pattern + count here. '####' becomes the zero-padded index.
export const IMAGE_SEQUENCE = {
  path: '/image-sequence',
  filePattern: 'frame_####.webp',
  frameCount: 120,
  startIndex: 1,
  minFramesToStart: 12,   // frames decoded before the canvas starts scrubbing
  // The sequence is mapped to *whole page* scroll, so page height sets the
  // pace: taller page = slower scrub. Raise this to stretch the video out.
  pageMinHeightVh: 520,
};

export const LIMITS = {
  // No SSE event for this long (while not waiting on the user) reads as a hang,
  // so the building screen offers a retry instead of spinning forever.
  stepTimeoutMs: 45000,
};

export const FEATURES = {
  mobileTimelineFallbackWidthPx: 768,
  transitionMs: 520,        // green wipe from the CTA into /planning
  nodeGrowMsPerColumn: 220, // graph grows outward from the green origin
  nodeGrowMsPerRow: 70,
};

// SSE step key -> human label. Edit copy here, nowhere else.
export const STEP_LABELS = {
  resolving: 'Reading your trip',
  researching_transport: 'Researching transport',
  researching_stays: 'Researching places to stay',
  researching_places: 'Finding things to do',
  building_itinerary: 'Building the itinerary',
  calculating_budget: 'Adding up the budget',
  saving: 'Saving your plan',
};

export const PLANNING_MODES = [
  {
    id: 'auto',
    name: 'Fully AI',
    tagline: 'Hands off',
    description: 'The planner researches everything and hands you a finished trip.',
    bullets: ['Fastest', 'No questions asked', 'Edit anything afterwards'],
  },
  {
    id: 'guided',
    name: 'Stepwise',
    tagline: 'You decide',
    description: 'One decision at a time — transport, stays, then days. Your graph builds as you choose.',
    bullets: ['A shortlist per decision', 'Skip any choice to the AI', 'Watch the plan assemble'],
  },
  {
    id: 'semi',
    name: 'Semi',
    tagline: 'Swap on the diagram',
    description: 'Get a full draft, then change transport, stays and activities with dropdowns on the graph.',
    bullets: ['Full plan up front', 'Alternatives on every node', 'Budget recalculates instantly'],
  },
];

export const LANDING = {
  productName: 'Wayline',
  hero: {
    headline: 'Plan the whole trip in one shot.',
    sub: 'Routes, stays, days and budget — researched, priced, and laid out as a graph you can edit by chat.',
    cta: 'Plan Trip',
  },
  features: {
    title: 'Everything the plan needs, in one place',
    items: [
      { title: 'Visual trip graph', body: 'Origin to return as nodes and edges — every leg, stay, day and stop in one view.' },
      { title: 'AI chat editing', body: 'Point at any node or edge and say what to change. Only that part recalculates.' },
      { title: 'Automatic budget', body: 'Transport, stays, food, activities and local travel added up by code, not guessed by a model.' },
      { title: 'Every way to get there', body: 'Trains from live rail data, plus bus, flight and car — scored on price, time and your preference.' },
      { title: 'Hidden gems', body: 'Web research surfaces the places that never make the top-ten lists.' },
    ],
  },
  modes: {
    title: 'Three ways to plan',
    sub: 'Pick how much you want to decide. All three produce the same editable plan.',
  },
  howItWorks: {
    title: 'How it works',
    steps: [
      { title: 'Enter the trip', body: 'Where from, where to, how long, how many, and what you are into.' },
      { title: 'The AI plans it', body: 'It researches routes, stays and things to do, then prices the whole thing.' },
      { title: 'Edit it visually', body: 'Swap a train, move an activity, cut the budget — by dropdown or by chat.' },
    ],
  },
  footer: {
    headline: 'Your next trip is about four questions away.',
    cta: 'Plan Trip',
  },
};
