import { CANVAS } from '../../constants';

const SPINE_TYPES = ['origin', 'destination', 'return'];

/**
 * Lays the trip out as a journey across the top and one track per day beneath
 * it:
 *
 *   origin ──▶ Jaipur ──▶ Udaipur ──▶ home        (the intercity journey)
 *                │           │
 *              stay        stay                   (sleeping, under its city)
 *
 *   Day 1 ──▶ fort ──▶ bazaar ──▶ cafe            (one row per day, left to right)
 *   Day 2 ──▶ lake ──▶ palace
 *
 * Days do not hang off their destination, which is what produced the branching
 * tree and the crossing connectors; each day names its own city on the card
 * instead. A day's row only grows to the right and rows never share a y, so no
 * two cards can collide.
 */
export function layoutGraph(graph) {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const position = new Map();

  const childrenOf = new Map();
  for (const e of graph.edges) {
    if (e.type === 'transport') continue;
    if (!childrenOf.has(e.source)) childrenOf.set(e.source, []);
    childrenOf.get(e.source).push(e.target);
  }

  /* ---- the journey, left to right across the top ---- */
  const spine = [];
  const seen = new Set();
  const start = graph.nodes.find((n) => n.type === 'origin');
  if (start) {
    spine.push(start.id);
    seen.add(start.id);
  }
  for (const e of graph.edges.filter((x) => x.type === 'transport')) {
    if (!byId.has(e.target) || seen.has(e.target)) continue;
    spine.push(e.target);
    seen.add(e.target);
  }
  for (const n of graph.nodes) {
    if (SPINE_TYPES.includes(n.type) && !seen.has(n.id)) {
      spine.push(n.id);
      seen.add(n.id);
    }
  }

  spine.forEach((id, column) => {
    const x = column * CANVAS.columnGap;
    position.set(id, { x, y: 0 });
    // The stay sits directly under the city it belongs to.
    for (const childId of childrenOf.get(id) ?? []) {
      if (byId.get(childId)?.type === 'stay') position.set(childId, { x, y: CANVAS.spineGap });
    }
  });

  /* ---- one row per day, activities running right ---- */
  const days = graph.nodes.filter((n) => n.type === 'day');
  const dayStep = CANVAS.nodeWidth + CANVAS.activityGap;

  days.forEach((day, row) => {
    const y = CANVAS.daysTop + row * CANVAS.dayRowGap;
    position.set(day.id, { x: 0, y });

    // The activity chain for this day: day -> a1 -> a2 -> …
    let cursor = day.id;
    let column = 1;
    const guard = new Set([day.id]);
    for (;;) {
      const next = (childrenOf.get(cursor) ?? []).find(
        (id) => byId.get(id)?.type === 'activity' && !guard.has(id)
      );
      if (!next) break;
      guard.add(next);
      position.set(next, { x: column * dayStep, y });
      cursor = next;
      column += 1;
    }
  });

  // Anything the walk never reached still has to be visible somewhere.
  let orphan = 0;
  const nodes = graph.nodes.map((n) => {
    const at = position.get(n.id) ?? {
      x: 0,
      y: CANVAS.daysTop + (days.length + orphan++) * CANVAS.dayRowGap,
    };
    return { ...n, position: at };
  });

  /**
   * A city-to-day connector would have to cut across every row to reach the
   * left column, which is the branching this layout exists to remove. The day
   * card carries its destination, so the line is redundant.
   */
  const edges = graph.edges.filter(
    (e) => !(byId.get(e.target)?.type === 'day' && SPINE_TYPES.includes(byId.get(e.source)?.type))
  );

  return { nodes, edges };
}

/**
 * How an edge is drawn between two laid-out nodes: straight where they share a
 * row or a column, a single right angle where they don't. No curves, so two
 * connectors crossing stays legible.
 */
export function edgeGeometry(from, to) {
  const { nodeWidth: w, nodeHeight: h } = CANVAS;
  const sameRow = Math.abs(from.position.y - to.position.y) < 1;
  const sameColumn = Math.abs(from.position.x - to.position.x) < 1;

  if (sameRow) {
    const y = from.position.y + h / 2;
    const x1 = from.position.x + w;
    const x2 = to.position.x;
    return { d: `M ${x1} ${y} L ${x2} ${y}`, mid: { x: (x1 + x2) / 2, y } };
  }

  const x1 = from.position.x + w / 2;
  const y1 = from.position.y + h;
  if (sameColumn) {
    const y2 = to.position.y;
    return { d: `M ${x1} ${y1} L ${x1} ${y2}`, mid: { x: x1, y: (y1 + y2) / 2 } };
  }

  // Down out of the parent, then across into the child's left edge.
  const y2 = to.position.y + h / 2;
  const x2 = to.position.x;
  return { d: `M ${x1} ${y1} L ${x1} ${y2} L ${x2} ${y2}`, mid: { x: (x1 + x2) / 2, y: y2 } };
}

/** The bounding box of a laid-out graph, used to frame it on open. */
export function bounds(nodes) {
  const xs = nodes.map((n) => n.position.x);
  const ys = nodes.map((n) => n.position.y);
  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    width: Math.max(...xs) + CANVAS.nodeWidth - Math.min(...xs),
    height: Math.max(...ys) + CANVAS.nodeHeight - Math.min(...ys),
  };
}
