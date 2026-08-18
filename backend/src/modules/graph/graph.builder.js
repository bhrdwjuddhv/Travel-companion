// Deterministic layout: a left-to-right spine of places, with each
// destination's stay / days / activities hanging beneath it.
const SPINE_X = 900;
const STAY_Y = 200;
const DAY_Y0 = 380;
const DAY_GAP = 260;
const ACT_X0 = 300;
const ACT_GAP = 250;

const node = (id, type, label, data, x, y) => ({ id, type, label, data, position: { x, y } });
const edge = (source, target, type, label = null, data = null) => ({
  id: `e:${source}->${target}`,
  source,
  target,
  type,
  label,
  data,
});

/** Trip JSON -> React Flow nodes/edges. The model never sees a coordinate. */
export function buildGraph(draft, input) {
  const nodes = [];
  const edges = [];

  // Spine: origin, then each place the segments arrive at.
  const spine = [{ id: 'origin', type: 'origin', label: input.origin, place: input.origin }];
  draft.segments.forEach((s, i) => {
    const last = i === draft.segments.length - 1;
    const isReturn = last && input.direction === 'round' && s.toPlace === input.origin;
    spine.push({
      id: isReturn ? 'return' : `dest:${s.toPlace}`,
      type: isReturn ? 'return' : 'destination',
      label: s.toPlace,
      place: s.toPlace,
    });
  });

  spine.forEach((p, i) => {
    nodes.push(node(p.id, p.type, p.label, { place: p.place }, i * SPINE_X, 0));
    if (i > 0) {
      const seg = draft.segments[i - 1];
      edges.push(edge(spine[i - 1].id, p.id, 'transport', segmentLabel(seg), seg));
    }
  });

  const xOf = (place) => {
    const i = spine.findIndex((p) => p.type === 'destination' && p.place === place);
    return (i === -1 ? 1 : i) * SPINE_X;
  };
  const idOf = (place) => spine.find((p) => p.type === 'destination' && p.place === place)?.id ?? 'origin';

  for (const stay of draft.stays) {
    const id = `stay:${stay.id}`;
    nodes.push(node(id, 'stay', stay.name, stay, xOf(stay.destination), STAY_Y));
    edges.push(edge(idOf(stay.destination), id, 'flow', stayLabel(stay)));
  }

  // Day rows are numbered per destination so multi-city trips don't stack up.
  const rowByDest = {};
  for (const day of draft.days) {
    const row = (rowByDest[day.destination] = (rowByDest[day.destination] ?? -1) + 1);
    const x = xOf(day.destination);
    const y = DAY_Y0 + row * DAY_GAP;
    const dayId = `day:${day.id}`;
    nodes.push(
      node(
        dayId,
        'day',
        `Day ${day.dayNumber}`,
        { id: day.id, dayNumber: day.dayNumber, destination: day.destination, pending: day.pending ?? false },
        x,
        y
      )
    );
    edges.push(edge(idOf(day.destination), dayId, 'flow'));

    day.activities.forEach((a, j) => {
      const actId = `activity:${a.id}`;
      nodes.push(node(actId, 'activity', a.name, a, x + ACT_X0 + j * ACT_GAP, y));
      const prev = j === 0 ? dayId : `activity:${day.activities[j - 1].id}`;
      const hop = a.localTransportFromPrev;
      edges.push(
        hop
          ? edge(prev, actId, 'local', `${hop.mode} · ₹${hop.estimatedFare} · ${fmtMins(hop.durationMinutes)}`, hop)
          : edge(prev, actId, 'flow')
      );
    });
  }

  return { nodes, edges };
}

const fmtMins = (m) => (m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ''}` : `${m}m`);

/** Same reason as segmentLabel: a placeholder must not read as a real rate. */
export const stayLabel = (stay) =>
  stay.pending ? `${stay.nights}n · finding rooms…` : `${stay.nights}n · ₹${stay.pricePerNight}/night`;

/** Skeleton segments have no numbers yet — don't show them as ₹0. */
export const segmentLabel = (seg) =>
  seg.pending ? `${seg.mode} · finding fares…` : `${seg.mode} · ₹${seg.fare} · ${fmtMins(seg.durationMinutes)}`;
