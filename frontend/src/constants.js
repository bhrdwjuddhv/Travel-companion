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

  // React Flow themes its own chrome from <ReactFlow colorMode>; only the
  // accent it can't know about is published to CSS.
  graph: {
    accent: '#22c55e',
    pending: '#52525b',
  },
};

/** Default theme; the user's choice is remembered in localStorage. */
export const COLOR_MODE = 'system';
export const COLOR_MODE_STORAGE = 'travel-ai:colorMode';

/** Canvas colours per theme — the custom renderer reads these directly. */
export const CANVAS_THEME = {
  light: {
    background: '#fafafa',
    dots: '#d4d4d8',
    edge: '#a1a1aa',
    edgeTransport: '#0284c7',
    nodeBg: '#ffffff',
    nodeBorder: '#e4e4e7',
    text: '#18181b',
    textMuted: '#71717a',
    badgeBg: 'rgba(255,255,255,0.95)',
  },
  dark: {
    background: '#09090b',
    dots: '#27272a',
    edge: '#52525b',
    edgeTransport: '#0ea5e9',
    nodeBg: '#18181b',
    nodeBorder: '#27272a',
    text: '#fafafa',
    textMuted: '#a1a1aa',
    badgeBg: 'rgba(24,24,27,0.95)',
  },
};

/** One calm colour per node type — accent only, never a full fill. */
export const NODE_COLORS = {
  origin: '#22c55e',      // green: the start, same as the CTA
  return: '#22c55e',
  destination: '#14b8a6', // teal
  stay: '#a78bfa',        // purple
  day: '#f59e0b',         // amber
  activity: '#fb923c',    // warm
  hidden_gem: '#fbbf24',
};

export const MAPS = {
  // Place id makes the link land on the exact place rather than a text search.
  searchUrl: 'https://www.google.com/maps/search/?api=1',
};

export const EXPORT = {
  pixelRatio: 2,
  pdfFilename: '{trip}-itinerary.pdf',
  icsFilename: '{trip}.ics',
  backgroundColor: '#09090b',
  // Each PDF page is sized to its own day card, so a packed day gets a taller
  // page instead of being squeezed onto A4.
  pdfPageUnit: 'px',
};

/** The custom canvas: sizing, zoom limits and how it frames on open. */
export const CANVAS = {
  nodeWidth: 224,
  nodeHeight: 76,
  minZoom: 0.25,
  maxZoom: 1.8,
  zoomStep: 0.0015,   // wheel delta -> zoom
  fitPadding: 0.12,   // share of the viewport left as margin when fitting
  fitMaxZoom: 1,      // never open zoomed *in* past natural size
  dotGrid: 26,
};

export const BUDGET_TIERS = [
  { id: 'budget', label: 'Budget-friendly', blurb: 'Cheap beds, sleeper class, mostly free sights.' },
  { id: 'balanced', label: 'Comfortable', blurb: 'Decent hotels, AC class, a paid sight or two a day.' },
  { id: 'premium', label: 'Premium', blurb: 'Heritage stays, the good class, book what you like.' },
];
export const DEFAULT_BUDGET_TIER = 'balanced';

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
  // Below this the node canvas is painful on a phone, so Calendar opens first.
  mobileBreakpointPx: 768,
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
