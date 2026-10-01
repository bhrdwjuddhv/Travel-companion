// Single source of truth for the client. Every colour, type size, radius,
// shadow and spacing value in the app is defined here and nowhere else:
// shared/theme.js publishes them as CSS custom properties, index.css builds
// the component recipes out of those properties, and the canvas reads the same
// objects directly. No component hardcodes a hex.
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

export const OWNER_KEY_STORAGE = 'travel-ai:ownerKey';

/* ------------------------------------------------------------------ *
 * Palette
 *
 * Monochrome by design: black page, glass panels lit by a hairline, and
 * white as the only "accent" — a primary action is white, everything else
 * is a level of transparency. Colour is reserved for the canvas, where the
 * hue of a node is information rather than decoration.
 * ------------------------------------------------------------------ */

/** Node hues. Muted enough to sit on black, distinct enough to read as types. */
const DATA = {
  origin: '#E6EDF3',
  destination: '#7FC4E8',
  stay: '#B49BE8',
  day: '#E0B472',
  activity: '#E29A86',
  gem: '#E8CE7F',
};

export const PALETTE = {
  dark: {
    bg: '#000000',
    bgAlt: '#070708',
    // The glass stack: a barely-there fill that the hairline and the blur do
    // the actual work on.
    surface: 'rgba(255, 255, 255, 0.04)',
    surfaceRaised: 'rgba(255, 255, 255, 0.07)',
    surfaceHover: 'rgba(255, 255, 255, 0.10)',
    glass: 'rgba(255, 255, 255, 0.01)',
    glassHighlight: 'rgba(255, 255, 255, 0.10)',
    border: 'rgba(255, 255, 255, 0.10)',
    borderStrong: 'rgba(255, 255, 255, 0.25)',
    ink: '#FFFFFF',
    inkMuted: 'rgba(255, 255, 255, 0.72)',
    inkDim: 'rgba(255, 255, 255, 0.55)',
    accent: '#FFFFFF',
    accentText: '#FFFFFF',
    accentInk: '#000000',
    accentSoft: 'rgba(255, 255, 255, 0.10)',
    accentEdge: 'rgba(255, 255, 255, 0.30)',
    accentGlow: '0 0 32px 4px rgba(255, 255, 255, 0.20)',
    // Status keeps a hue, because "over budget" must not read as "white".
    warn: '#E0B472',
    warnSoft: 'rgba(224, 180, 114, 0.14)',
    danger: '#E29A86',
    // Panels over the backdrop video.
    scrim: 'rgba(0, 0, 0, 0.45)',
    scrimStrong: 'rgba(0, 0, 0, 0.62)',
    onMedia: '#FFFFFF',
    onMediaMuted: 'rgba(255, 255, 255, 0.60)',
    // The canvas paints itself, so it needs its own named surfaces.
    canvasBg: '#050506',
    canvasDots: 'rgba(255, 255, 255, 0.07)',
    canvasEdge: 'rgba(255, 255, 255, 0.35)',
    nodeBg: 'rgba(20, 20, 22, 0.92)',
    nodeBorder: 'rgba(255, 255, 255, 0.12)',
    badgeBg: 'rgba(10, 10, 12, 0.92)',
    shadowCard: '0 1px 1px rgba(255, 255, 255, 0.07) inset, 0 20px 50px -30px rgba(0, 0, 0, 0.9)',
    shadowRaised: '0 1px 1px rgba(255, 255, 255, 0.12) inset, 0 30px 70px -30px rgba(0, 0, 0, 1)',
  },
  /**
   * The reference ships dark only. Light keeps its mechanics and inverts the
   * material: paper instead of glass, ink instead of white, the same hairline
   * doing the same job from the other side.
   */
  light: {
    bg: '#FFFFFF',
    bgAlt: '#F6F6F7',
    surface: 'rgba(10, 10, 12, 0.03)',
    surfaceRaised: 'rgba(10, 10, 12, 0.05)',
    surfaceHover: 'rgba(10, 10, 12, 0.07)',
    glass: 'rgba(255, 255, 255, 0.55)',
    glassHighlight: 'rgba(10, 10, 12, 0.08)',
    border: 'rgba(10, 10, 12, 0.12)',
    borderStrong: 'rgba(10, 10, 12, 0.30)',
    ink: '#0A0A0C',
    inkMuted: 'rgba(10, 10, 12, 0.70)',
    inkDim: 'rgba(10, 10, 12, 0.55)',
    accent: '#0A0A0C',
    accentText: '#0A0A0C',
    accentInk: '#FFFFFF',
    accentSoft: 'rgba(10, 10, 12, 0.07)',
    accentEdge: 'rgba(10, 10, 12, 0.35)',
    accentGlow: '0 10px 30px -12px rgba(10, 10, 12, 0.45)',
    warn: '#9A6514',
    warnSoft: 'rgba(154, 101, 20, 0.12)',
    danger: '#B4442C',
    // Light keeps the footage and frosts it, so dark ink reads over it.
    scrim: 'rgba(246, 246, 247, 0.74)',
    scrimStrong: 'rgba(246, 246, 247, 0.88)',
    onMedia: '#FFFFFF',
    onMediaMuted: 'rgba(255, 255, 255, 0.60)',
    canvasBg: '#F6F6F7',
    canvasDots: 'rgba(10, 10, 12, 0.10)',
    canvasEdge: 'rgba(10, 10, 12, 0.35)',
    nodeBg: '#FFFFFF',
    nodeBorder: 'rgba(10, 10, 12, 0.12)',
    badgeBg: 'rgba(255, 255, 255, 0.94)',
    shadowCard: '0 1px 2px rgba(10, 10, 12, 0.05), 0 16px 40px -28px rgba(10, 10, 12, 0.4)',
    shadowRaised: '0 2px 4px rgba(10, 10, 12, 0.06), 0 30px 60px -30px rgba(10, 10, 12, 0.45)',
  },
};

/**
 * Inter carries every heading at weight 400 — the reference gets its presence
 * from size and tight tracking, never from bold. Barlow runs the body text.
 */
export const TYPE = {
  fontFamily: "'Barlow', ui-sans-serif, system-ui, -apple-system, sans-serif",
  displayFamily: "'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif",
  display: 'clamp(40px, 5.4vw, 72px)',
  displayWeight: '400',
  displayTracking: '-0.02em',
  displayLeading: '1.1',
  h1: 'clamp(32px, 4.6vw, 60px)',
  h2: 'clamp(28px, 3.4vw, 46px)',
  h3: '18px',
  bodyLg: '17px',
  body: '15px',
  small: '13px',
  micro: '11px',
  // The reference's one repeated texture: 11px, widely tracked, muted.
  labelTracking: '0.14em',
  proseLeading: '1.65',
};

export const RADIUS = {
  pill: '999px',
  xl: '1.5rem',
  lg: '1rem',
  md: '0.75rem',
  sm: '0.5rem',
};

export const SPACE = {
  sectionY: 'clamp(5rem, 9vw, 8rem)',
  gutter: 'clamp(1.5rem, 4vw, 2.5rem)',
  maxWidth: '82rem',
  prose: '560px',
};

/** Long, soft easings. No bounce, no elastic. */
export const MOTION = {
  fast: '200ms',
  base: '500ms',
  slow: '700ms',
  ease: 'cubic-bezier(0.16, 1, 0.3, 1)',
  revealY: '24px',
  staggerMs: 50,
};

/** The fixed backdrop: one looping clip, blurred, under a scrim. */
export const BACKDROP = {
  video: '/Red_bus_driving_mountain_road_video.mp4',
  // The clip is bright, so the text rides on its own darker pane rather than
  // relying on the page-wide scrim. Raise for more contrast, lower for more
  // footage. The text colour never changes.
  textPaneTint: 'rgba(6, 9, 15, 0.52)',
  textPaneTintStrong: 'rgba(6, 9, 15, 0.62)',
  textPaneBlurPx: 10,
  blurPx: 6,
  // A touch over 1 so the mouse parallax never exposes an edge.
  scale: 1.08,
  parallaxPx: 20,
  parallaxEase: 0.06,
  pageMinHeightVh: 100,
};

/** Default theme; the user's choice is remembered in localStorage. */
export const COLOR_MODE = 'system';
export const COLOR_MODE_STORAGE = 'travel-ai:colorMode';

/** Canvas colours per theme — the custom renderer reads these directly. */
export const CANVAS_THEME = {
  light: {
    background: PALETTE.light.canvasBg,
    dots: PALETTE.light.canvasDots,
    edge: PALETTE.light.canvasEdge,
    edgeTransport: PALETTE.light.ink,
    nodeBg: PALETTE.light.nodeBg,
    nodeBorder: PALETTE.light.nodeBorder,
    text: PALETTE.light.ink,
    textMuted: PALETTE.light.inkDim,
    badgeBg: PALETTE.light.badgeBg,
  },
  dark: {
    background: PALETTE.dark.canvasBg,
    dots: PALETTE.dark.canvasDots,
    edge: PALETTE.dark.canvasEdge,
    edgeTransport: PALETTE.dark.ink,
    nodeBg: PALETTE.dark.nodeBg,
    nodeBorder: PALETTE.dark.nodeBorder,
    text: PALETTE.dark.ink,
    textMuted: PALETTE.dark.inkDim,
    badgeBg: PALETTE.dark.badgeBg,
  },
};

/** One hue per node type. The only colour in an otherwise monochrome app. */
export const NODE_COLORS = {
  origin: DATA.origin,
  return: DATA.origin,
  destination: DATA.destination,
  stay: DATA.stay,
  day: DATA.day,
  activity: DATA.activity,
  hidden_gem: DATA.gem,
};

export const MAPS = {
  // Place id makes the link land on the exact place rather than a text search.
  searchUrl: 'https://www.google.com/maps/search/?api=1',
};

export const EXPORT = {
  pixelRatio: 2,
  pdfFilename: '{trip}-itinerary.pdf',
  icsFilename: '{trip}.ics',
  backgroundColor: PALETTE.dark.bgAlt,
  // Each PDF page is sized to its own day card, so a packed day gets a taller
  // page instead of being squeezed onto A4.
  pdfPageUnit: 'px',
};

/**
 * The custom canvas. Positions are computed on the client from these numbers
 * (see modules/graph/layout.js), so the diagram is the same shape for every
 * plan ever saved, and nothing can be dragged out of place.
 */
export const CANVAS = {
  nodeWidth: 296,
  nodeHeight: 96,
  // One column per place on the journey. Wide enough that a column's indented
  // activities can never reach the next column.
  columnGap: 560,
  // How far below the place node its stay and days begin.
  spineGap: 190,
  // One row per card inside a column.
  rowGap: 124,
  // Activities step in under their day, so the day owns them visually.
  indent: 56,
  minZoom: 0.3,
  maxZoom: 2,
  zoomStep: 0.0015,   // wheel delta -> zoom
  fitPadding: 0.1,    // share of the viewport left as margin when fitting
  fitMaxZoom: 1,      // never open zoomed *in* past natural size
  // ...and never open so far out that the labels stop being readable. A big
  // trip opens partly off-screen instead, which pans.
  fitMinZoom: 0.62,
  dotGrid: 30,
  arrowSize: 7,
  edgeWidth: 1.5,
  edgeWidthTransport: 2.25,
  type: {
    title: '15px',
    meta: '13px',
    detail: '12px',
    badge: '12px',
  },
};

/**
 * Map view. OpenStreetMap tiles need no key and cost nothing; everything
 * plotted comes from coordinates already stored on the plan.
 */
export const MAP = {
  tileUrl: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  maxZoom: 18,
  // Only used when a plan has no usable coordinates at all.
  fallbackCenter: [22.9734, 78.6569],
  fallbackZoom: 5,
  fitPadding: [48, 48],
  fitMaxZoom: 13,
  markerSize: 30,       // big enough to tap on a phone
  markerSizeSmall: 24,
  lineWidth: 2.5,
  lineDash: '6 8',
  colors: {
    origin: '#E6EDF3',
    stay: '#B49BE8',
    activity: '#E29A86',
    gem: '#E8CE7F',
    line: '#8FA3BF',
    lineIntercity: '#7FC4E8',
  },
};

export const BUDGET_TIERS = [
  { id: 'budget', label: 'Budget-friendly', blurb: 'Cheap beds, sleeper class, mostly free sights.' },
  { id: 'balanced', label: 'Comfortable', blurb: 'Decent hotels, AC class, a paid sight or two a day.' },
  { id: 'premium', label: 'Premium', blurb: 'Heritage stays, the good class, book what you like.' },
];
export const DEFAULT_BUDGET_TIER = 'balanced';

export const LIMITS = {
  // No SSE event for this long (while not waiting on the user) reads as a hang,
  // so the building screen offers a retry instead of spinning forever.
  stepTimeoutMs: 45000,
  promptMaxChars: 1000,
};

export const FEATURES = {
  mobileTimelineFallbackWidthPx: 768,
  // Below this the node canvas is painful on a phone, so Calendar opens first.
  mobileBreakpointPx: 768,
  transitionMs: 520,        // wipe from the CTA into /planning
  nodeGrowMsPerColumn: 220, // graph grows outward from the origin
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

/** Bento spans, used by every tiled section on the landing page. */
export const BENTO = {
  lg: 'col-span-2 row-span-2',
  wide: 'col-span-2 row-span-1',
  tall: 'col-span-1 row-span-2',
  sm: 'col-span-1 row-span-1',
};

export const LANDING = {
  productName: 'Wayline',
  trademark: '™',
  hero: {
    // Two lines: the first in ink, the second in muted, exactly as the
    // reference stages its headline.
    headline: ['Plan the whole trip', 'in one sentence.'],
    paragraph: {
      lead: 'Routes, stays, days and budget — researched, priced and laid out as a graph you can edit by chat. ',
      muted: 'Every fare comes from a provider, never from a model.',
    },
    assurance: 'NO SIGN-UP · NOTHING TO PAY',
  },
  /**
   * The hero prompt bar. Suggestions are the same thing the user would type,
   * so tapping one is just a faster keyboard.
   */
  prompt: {
    placeholder: 'A 5-day budget trip to Jaipur from Delhi under ₹10,000…',
    action: 'Plan with AI',
    reading: 'Reading…',
    hint: 'We fill in the form — you check it before anything is planned.',
    suggestions: [
      '5 days in Jaipur from Delhi under ₹10,000',
      'Kerala backwaters in December, no night travel',
      'Backpacking Rajasthan, forts and street food',
      'A week in Ladakh from Delhi, premium',
    ],
  },
  /**
   * Showcase tiles. `prompt` is what a tap drops into the hero bar, so a tile
   * is a faster keyboard too — it plans nothing on its own.
   */
  destinations: {
    eyebrow: 'POPULAR WITH PLANNERS',
    title: 'Where does India want to go next?',
    subtitle: 'Tap one to drop it into the bar above, then edit it like anything you typed yourself.',
    items: [
      { name: 'Jaipur', region: 'Rajasthan', tag: 'Forts', image: '/destinations/jaipur.jpg', size: 'lg',
        prompt: '4 days in Jaipur from Delhi, 2 of us, forts and street food' },
      { name: 'Goa', region: 'West coast', tag: 'Beaches', image: '/destinations/goa.webp', size: 'tall',
        prompt: '4 days in Goa from Mumbai, beaches and seafood, comfortable' },
      { name: 'Kerala', region: 'Backwaters', tag: 'Slow', image: '/destinations/kerala.webp', size: 'tall',
        prompt: '6 days in Kerala from Bangalore, backwaters and food, no night travel' },
      { name: 'Leh-Ladakh', region: 'Union territory', tag: 'Altitude', image: '/destinations/leh-ladakh.webp', size: 'wide',
        prompt: '8 days in Leh from Delhi, monasteries and high passes, premium' },
      { name: 'Varanasi', region: 'Uttar Pradesh', tag: 'Ghats', image: '/destinations/varanasi.webp', size: 'wide',
        prompt: '3 days in Varanasi from Delhi, ghats and temples, budget-friendly' },
    ],
  },
  features: {
    eyebrow: 'WHAT YOU GET',
    title: 'Everything the plan needs, in one place',
    items: [
      { title: 'A trip you can see', body: 'Origin to return as nodes and edges — every leg, stay, day and stop in one view, draggable.', size: 'lg' },
      { title: 'Edit by chat', body: 'Point at any node and say what to change. Only that part recalculates.', size: 'sm' },
      { title: 'Budget by arithmetic', body: 'Transport, stays, food and local travel added up by code, not guessed by a model.', size: 'sm' },
      { title: 'Every way to get there', body: 'Trains from live rail data, plus bus, flight and car — scored on price, time and your preference.', size: 'wide' },
      { title: 'Hidden gems', body: 'Web research surfaces the places that never make the top-ten lists.', size: 'wide' },
      { title: 'Take it with you', body: 'A day-by-day calendar, a map, a PDF, or straight into your own calendar app.', size: 'wide' },
    ],
  },
  modes: {
    eyebrow: 'HOW MUCH YOU DECIDE',
    title: 'Three ways to plan',
    subtitle: 'All three produce the same editable plan. Only the number of questions changes.',
  },
  howItWorks: {
    eyebrow: 'THE WHOLE FLOW',
    title: 'Three steps, about a minute',
    steps: [
      { title: 'Describe the trip', body: 'One sentence in the bar, or fill the form yourself.' },
      { title: 'The AI plans it', body: 'It researches routes, stays and things to do, then prices the whole thing.' },
      { title: 'Edit it visually', body: 'Swap a train, move an activity, cut the budget — by dropdown or by chat.' },
    ],
  },
  footer: {
    title: 'Your next trip is one sentence away.',
    subtitle: 'No account, no card, no booking funnel. Describe it and read the plan.',
    cta: 'Plan a trip',
    note: 'Built for travel in India. Fares and room rates are estimates, and every one says so.',
  },
};
