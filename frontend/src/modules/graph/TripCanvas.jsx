import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Maximize2, Minus, Plus } from 'lucide-react';
import { CANVAS, CANVAS_THEME, NODE_COLORS, THEME } from '../../constants';
import { useColorMode } from '../../shared/theme';
import TripNode from './nodes/TripNode.jsx';

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Anchor points: edges leave a card's right edge and arrive at its left. */
const anchors = (from, to) => ({
  x1: from.position.x + CANVAS.nodeWidth,
  y1: from.position.y + CANVAS.nodeHeight / 2,
  x2: to.position.x,
  y2: to.position.y + CANVAS.nodeHeight / 2,
});

/** A horizontal cubic — reads as a flow without the corners of an orthogonal path. */
function edgePath(from, to) {
  const { x1, y1, x2, y2 } = anchors(from, to);
  const bend = Math.max(40, Math.abs(x2 - x1) * 0.4);
  return `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`;
}

/**
 * A small purpose-built canvas: HTML cards for nodes, one SVG layer behind them
 * for edges. Both live in the same transformed container, so a dragged node and
 * its edges can never drift apart.
 */
export default function TripCanvas({ plan, semi = null, onEdit = null, onLayoutChange = null }) {
  const mode = useColorMode();
  const palette = CANVAS_THEME[mode] ?? CANVAS_THEME.dark;

  const viewportRef = useRef(null);
  const [view, setView] = useState({ x: 0, y: 0, zoom: 1 });
  const [dragged, setDragged] = useState({});     // nodeId -> {x, y} while dragging
  const [collapsedDays, setCollapsedDays] = useState(() => new Set());
  const [panning, setPanning] = useState(false);
  const fitted = useRef(false);

  const pan = useRef(null);   // {startX, startY, originX, originY}
  const nodeDrag = useRef(null);

  // Positions come from the deterministic layout, overridden by any drag.
  const nodes = useMemo(
    () => plan.graph.nodes.map((n) => (dragged[n.id] ? { ...n, position: dragged[n.id] } : n)),
    [plan, dragged]
  );

  const byId = useMemo(() => Object.fromEntries(nodes.map((n) => [n.id, n])), [nodes]);

  const hiddenNodes = useMemo(() => {
    const dayOf = new Map();
    for (const day of plan.days) {
      for (const a of day.activities) dayOf.set(`activity:${a.id}`, `day:${day.id}`);
    }
    return { dayOf, isHidden: (id) => collapsedDays.has(dayOf.get(id)) };
  }, [plan, collapsedDays]);

  const visibleNodes = nodes.filter((n) => !hiddenNodes.isHidden(n.id));
  const visibleEdges = plan.graph.edges.filter(
    (e) => byId[e.source] && byId[e.target] && !hiddenNodes.isHidden(e.target) && !hiddenNodes.isHidden(e.source)
  );

  /** Frames the whole trip in the viewport — the canvas must open readable. */
  const fit = useCallback(() => {
    const el = viewportRef.current;
    if (!el || !nodes.length) return;
    const xs = nodes.map((n) => n.position.x);
    const ys = nodes.map((n) => n.position.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const width = Math.max(...xs) + CANVAS.nodeWidth - minX;
    const height = Math.max(...ys) + CANVAS.nodeHeight - minY;

    const pad = 1 - CANVAS.fitPadding;
    const zoom = clamp(
      Math.min((el.clientWidth * pad) / width, (el.clientHeight * pad) / height),
      CANVAS.minZoom,
      CANVAS.fitMaxZoom
    );
    setView({
      zoom,
      x: (el.clientWidth - width * zoom) / 2 - minX * zoom,
      y: (el.clientHeight - height * zoom) / 2 - minY * zoom,
    });
  }, [nodes]);

  // Fit once the first real plan is on screen, not on every patch.
  useLayoutEffect(() => {
    if (fitted.current || !plan.graph.nodes.length) return;
    fitted.current = true;
    fit();
  }, [plan, fit]);

  const zoomBy = (factor) =>
    setView((v) => {
      const el = viewportRef.current;
      const zoom = clamp(v.zoom * factor, CANVAS.minZoom, CANVAS.maxZoom);
      if (!el) return { ...v, zoom };
      // Keep the centre of the viewport fixed while zooming.
      const cx = el.clientWidth / 2;
      const cy = el.clientHeight / 2;
      return { zoom, x: cx - ((cx - v.x) / v.zoom) * zoom, y: cy - ((cy - v.y) / v.zoom) * zoom };
    });

  // Wheel and pinch zoom around the pointer, so the thing under the cursor stays put.
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onWheel = (e) => {
      e.preventDefault();
      setView((v) => {
        const zoom = clamp(v.zoom * Math.exp(-e.deltaY * CANVAS.zoomStep), CANVAS.minZoom, CANVAS.maxZoom);
        const rect = el.getBoundingClientRect();
        const px = e.clientX - rect.left;
        const py = e.clientY - rect.top;
        return { zoom, x: px - ((px - v.x) / v.zoom) * zoom, y: py - ((py - v.y) / v.zoom) * zoom };
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  /* ---- pointer events cover mouse, pen and touch in one path ---- */

  const onPointerDownCanvas = (e) => {
    if (e.target.closest('[data-node]')) return; // node drag handles its own
    e.currentTarget.setPointerCapture(e.pointerId);
    pan.current = { startX: e.clientX, startY: e.clientY, originX: view.x, originY: view.y };
    setPanning(true);
  };

  const startNodeDrag = (nodeId) => (e) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const node = byId[nodeId];
    nodeDrag.current = {
      nodeId,
      startX: e.clientX,
      startY: e.clientY,
      originX: node.position.x,
      originY: node.position.y,
      moved: false,
    };
  };

  const onPointerMove = (e) => {
    if (nodeDrag.current) {
      const d = nodeDrag.current;
      const dx = (e.clientX - d.startX) / view.zoom;
      const dy = (e.clientY - d.startY) / view.zoom;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) d.moved = true;
      setDragged((prev) => ({ ...prev, [d.nodeId]: { x: d.originX + dx, y: d.originY + dy } }));
      return;
    }
    if (pan.current) {
      const p = pan.current;
      setView((v) => ({ ...v, x: p.originX + (e.clientX - p.startX), y: p.originY + (e.clientY - p.startY) }));
    }
  };

  const onPointerUp = () => {
    const d = nodeDrag.current;
    // Only persist a real move — a click that wobbled two pixels isn't one.
    if (d?.moved) onLayoutChange?.(d.nodeId, dragged[d.nodeId] ?? byId[d.nodeId].position);
    nodeDrag.current = null;
    pan.current = null;
    setPanning(false);
  };

  const toggleDay = (dayNodeId) =>
    setCollapsedDays((prev) => {
      const next = new Set(prev);
      next.has(dayNodeId) ? next.delete(dayNodeId) : next.add(dayNodeId);
      return next;
    });

  const activityCounts = useMemo(
    () => Object.fromEntries(plan.days.map((d) => [`day:${d.id}`, d.activities.length])),
    [plan]
  );

  const inbound = useMemo(
    () => new Map(plan.graph.edges.filter((e) => e.type === 'transport').map((e) => [e.target, e.data])),
    [plan]
  );

  return (
    <div
      ref={viewportRef}
      onPointerDown={onPointerDownCanvas}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      className="relative h-full w-full touch-none overflow-hidden"
      style={{
        background: palette.background,
        backgroundImage: `radial-gradient(${palette.dots} 1px, transparent 1px)`,
        backgroundSize: `${CANVAS.dotGrid * view.zoom}px ${CANVAS.dotGrid * view.zoom}px`,
        backgroundPosition: `${view.x}px ${view.y}px`,
        cursor: panning ? 'grabbing' : 'grab',
      }}
    >
      <div
        className="absolute left-0 top-0 origin-top-left"
        style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})` }}
      >
        {/* Edges sit behind the cards, in the same transformed space. */}
        <svg className="pointer-events-none absolute overflow-visible" style={{ width: 1, height: 1 }}>
          {visibleEdges.map((e) => {
            const transport = e.type === 'transport';
            const fromOrigin = e.source === 'origin';
            return (
              <path
                key={e.id}
                d={edgePath(byId[e.source], byId[e.target])}
                fill="none"
                stroke={fromOrigin ? THEME.originGreen : transport ? palette.edgeTransport : palette.edge}
                strokeWidth={transport ? 2 : 1.25}
                strokeDasharray={e.type === 'local' ? '5 5' : undefined}
                strokeLinecap="round"
                opacity={transport ? 0.95 : 0.55}
              />
            );
          })}
        </svg>

        {/* Edge labels ride above the lines but below the cards. */}
        {visibleEdges.map((e) => {
          if (!e.label) return null;
          const { x1, y1, x2, y2 } = anchors(byId[e.source], byId[e.target]);
          return (
            <span
              key={`label-${e.id}`}
              className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium"
              style={{
                left: (x1 + x2) / 2,
                top: (y1 + y2) / 2,
                background: palette.badgeBg,
                borderColor: e.type === 'transport' ? palette.edgeTransport : palette.nodeBorder,
                color: palette.text,
              }}
            >
              {e.label}
            </span>
          );
        })}

        {visibleNodes.map((n) => (
          <TripNode
            key={n.id}
            node={n}
            palette={palette}
            accent={NODE_COLORS[n.type] ?? palette.edge}
            semi={semi}
            inboundSegment={inbound.get(n.id)}
            days={plan.days}
            activityCount={activityCounts[n.id] ?? 0}
            collapsed={collapsedDays.has(n.id)}
            onToggleCollapse={() => toggleDay(n.id)}
            onEdit={onEdit}
            onPointerDown={startNodeDrag(n.id)}
          />
        ))}
      </div>

      <div className="absolute bottom-4 right-4 flex flex-col overflow-hidden rounded-lg border shadow-sm"
           style={{ borderColor: palette.nodeBorder, background: palette.nodeBg }}>
        <CanvasButton onClick={() => zoomBy(1.2)} title="Zoom in" palette={palette}><Plus size={14} /></CanvasButton>
        <CanvasButton onClick={() => zoomBy(1 / 1.2)} title="Zoom out" palette={palette}><Minus size={14} /></CanvasButton>
        <CanvasButton onClick={fit} title="Fit to screen" palette={palette}><Maximize2 size={14} /></CanvasButton>
      </div>
    </div>
  );
}

const CanvasButton = ({ onClick, title, palette, children }) => (
  <button
    onClick={onClick}
    title={title}
    onPointerDown={(e) => e.stopPropagation()}
    className="grid h-9 w-9 place-items-center border-b transition last:border-b-0 hover:opacity-70"
    style={{ borderColor: palette.nodeBorder, color: palette.textMuted }}
  >
    {children}
  </button>
);
