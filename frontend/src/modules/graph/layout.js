import { CANVAS } from '../../constants';

/**
 * Positions every node from the graph's own shape, ignoring whatever
 * coordinates the server stored. One column per place on the journey, one row
 * per card inside it, activities stepped in under their day.
 *
 * Because a column only ever grows downward, two columns can never collide —
 * which is what the old outward-growing layout could not promise once a
 * destination had more than a couple of stops.
 */
export function layoutNodes(graph) {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const flow = graph.edges.filter((e) => e.type !== 'transport');

  // Children, in the order the builder emitted them.
  const childrenOf = new Map();
  for (const e of flow) {
    if (!childrenOf.has(e.source)) childrenOf.set(e.source, []);
    childrenOf.get(e.source).push(e.target);
  }

  // The spine: origin, then wherever each transport edge lands, in order.
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
  // A node the transport chain never reached still needs a column.
  for (const n of graph.nodes) {
    if (['origin', 'destination', 'return'].includes(n.type) && !seen.has(n.id)) {
      spine.push(n.id);
      seen.add(n.id);
    }
  }

  const position = new Map();

  spine.forEach((spineId, column) => {
    const x = column * CANVAS.columnGap;
    position.set(spineId, { x, y: 0 });

    let y = CANVAS.spineGap;
    const place = (id, indent = 0) => {
      position.set(id, { x: x + indent, y });
      y += CANVAS.rowGap;
    };

    for (const childId of childrenOf.get(spineId) ?? []) {
      const child = byId.get(childId);
      if (!child) continue;
      place(childId);

      if (child.type !== 'day') continue;
      // An activity chain hangs off its day: day -> a1 -> a2 -> …
      let cursor = childId;
      const guard = new Set([childId]);
      for (;;) {
        const next = (childrenOf.get(cursor) ?? []).find((id) => byId.get(id)?.type === 'activity' && !guard.has(id));
        if (!next) break;
        guard.add(next);
        place(next, CANVAS.indent);
        cursor = next;
      }
    }
  });

  // Anything the walk missed (shouldn't happen) is parked in a last column so
  // it is visible rather than stacked at the origin.
  let orphanRow = 0;
  return graph.nodes.map((n) => {
    const at = position.get(n.id) ?? {
      x: spine.length * CANVAS.columnGap,
      y: (orphanRow++) * CANVAS.rowGap,
    };
    return { ...n, position: at };
  });
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
