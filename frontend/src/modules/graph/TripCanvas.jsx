import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Maximize2, Minus, Plus } from 'lucide-react';
import { CANVAS, CANVAS_THEME, NODE_COLORS } from '../../constants';
import { useColorMode } from '../../shared/theme';
import TripNode from './nodes/TripNode.jsx';
import { bounds, edgeGeometry, layoutNodes } from './layout';

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/**
 * A small purpose-built canvas: HTML cards for nodes, one SVG layer behind
 * them for edges, both inside the same transformed container.
 *
 * Node positions are computed, never stored and never dragged — the diagram
 * reads the same way every time it is opened.
 */
export default function TripCanvas({ plan, semi = null, onEdit = null }) {
  const mode = useColorMode();
  const palette = CANVAS_THEME[mode] ?? CANVAS_THEME.dark;

  const viewportRef = useRef(null);
  const [view, setView] = useState({ x: 0, y: 0, zoom: 1 });
  const [collapsedDays, setCollapsedDays] = useState(() => new Set());
  const [panning, setPanning] = useState(false);
  const fitted = useRef(false);
  const pan = useRef(null);

  const nodes = useMemo(() => layoutNodes(plan.graph), [plan]);
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

  /** Frames the whole trip, but never so far out that the labels go unreadable. */
  const fit = useCallback(() => {
    const el = viewportRef.current;
    if (!el || !nodes.length) return;
    const { minX, minY, width, height } = bounds(nodes);

    const pad = 1 - CANVAS.fitPadding;
    const zoom = clamp(
      Math.min((el.clientWidth * pad) / width, (el.clientHeight * pad) / height),
      CANVAS.fitMinZoom,
      CANVAS.fitMaxZoom
    );
    setView({
      zoom,
      x: (el.clientWidth - width * zoom) / 2 - minX * zoom,
      // A trip taller than the viewport starts at the top rather than centred
      // on its middle, which would hide the origin.
      y: height * zoom > el.clientHeight ? 40 : (el.clientHeight - height * zoom) / 2 - minY * zoom,
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

  const onPointerDown = (e) => {
    // Cards are fixed in place now, so every drag on the canvas is a pan.
    if (e.target.closest('[data-interactive]')) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pan.current = { startX: e.clientX, startY: e.clientY, originX: view.x, originY: view.y };
    setPanning(true);
  };

  const onPointerMove = (e) => {
    const p = pan.current;
    if (!p) return;
    setView((v) => ({ ...v, x: p.originX + (e.clientX - p.startX), y: p.originY + (e.clientY - p.startY) }));
  };

  const onPointerUp = () => {
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
      onPointerDown={onPointerDown}
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
          <defs>
            {[
              ['arrow-transport', palette.edgeTransport],
              ['arrow-flow', palette.edge],
              ['arrow-origin', NODE_COLORS.origin],
            ].map(([id, colour]) => (
              <marker
                key={id}
                id={id}
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth={CANVAS.arrowSize}
                markerHeight={CANVAS.arrowSize}
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 9 5 L 0 9 z" fill={colour} />
              </marker>
            ))}
          </defs>

          {visibleEdges.map((e) => {
            const transport = e.type === 'transport';
            const fromOrigin = e.source === 'origin';
            const colour = fromOrigin ? NODE_COLORS.origin : transport ? palette.edgeTransport : palette.edge;
            const marker = fromOrigin ? 'arrow-origin' : transport ? 'arrow-transport' : 'arrow-flow';
            return (
              <path
                key={e.id}
                d={edgeGeometry(byId[e.source], byId[e.target]).d}
                fill="none"
                stroke={colour}
                strokeWidth={transport ? CANVAS.edgeWidthTransport : CANVAS.edgeWidth}
                strokeDasharray={e.type === 'local' ? '6 6' : undefined}
                strokeLinejoin="round"
                markerEnd={`url(#${marker})`}
                opacity={transport ? 1 : 0.7}
              />
            );
          })}
        </svg>

        {/* Edge labels ride above the lines but below the cards. */}
        {visibleEdges.map((e) => {
          if (!e.label) return null;
          const { mid } = edgeGeometry(byId[e.source], byId[e.target]);
          return (
            <span
              key={`label-${e.id}`}
              className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-[var(--r-pill)] border px-3 py-1 font-medium"
              style={{
                left: mid.x,
                top: mid.y,
                fontSize: CANVAS.type.badge,
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
          />
        ))}
      </div>

      <div
        className="absolute bottom-4 right-4 flex flex-col overflow-hidden rounded-[var(--r-md)] border shadow-sm"
        style={{ borderColor: palette.nodeBorder, background: palette.nodeBg }}
      >
        <CanvasButton onClick={() => zoomBy(1.2)} title="Zoom in" palette={palette}><Plus size={16} /></CanvasButton>
        <CanvasButton onClick={() => zoomBy(1 / 1.2)} title="Zoom out" palette={palette}><Minus size={16} /></CanvasButton>
        <CanvasButton onClick={fit} title="Fit to screen" palette={palette}><Maximize2 size={16} /></CanvasButton>
      </div>
    </div>
  );
}

const CanvasButton = ({ onClick, title, palette, children }) => (
  <button
    onClick={onClick}
    title={title}
    aria-label={title}
    data-interactive
    className="grid h-10 w-10 place-items-center border-b transition last:border-b-0 hover:opacity-70"
    style={{ borderColor: palette.nodeBorder, color: palette.textMuted }}
  >
    {children}
  </button>
);
