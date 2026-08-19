import { useMemo, useState } from 'react';
import { ReactFlow, Background, Controls, MiniMap } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { nodeTypes } from './nodes/index.js';
import TripEdge from './edges/TripEdge.jsx';
import { FEATURES, GRAPH_VIEW, NODE_COLORS, THEME } from '../../constants';
import { useColorMode } from '../../shared/theme';

const EDGE_COLOR = { transport: '#0ea5e9', local: '#a1a1aa', flow: '#a1a1aa' };
const edgeTypes = { trip: TripEdge };

const fmtMins = (m) => (m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ''}` : `${m}m`);
const money = (n) => `₹${Number(n).toLocaleString('en-IN')}`;

const segLabel = (s) => `${s.mode}${s.class ? ` ${s.class}` : ''} · ${money(s.fare)} · ${fmtMins(s.durationMinutes)}`;
const stayLabel = (s) => `${s.name} · ${money(s.pricePerNight)}/night`;
const prettyDate = (iso) =>
  iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' }) : null;

/** Rank of each distinct x/y, so growth delay needs no layout constants. */
const rankMap = (values) => {
  const sorted = [...new Set(values)].sort((a, b) => a - b);
  return new Map(sorted.map((v, i) => [v, i]));
};

/**
 * `semi` enables on-diagram controls, `onEdit` opens the edit context for one
 * element, `onLayoutChange` receives dragged positions. All optional — omit
 * them and the graph is read-only.
 */
export default function TripGraph({ plan, semi = null, onEdit = null, onLayoutChange = null }) {
  const colorMode = useColorMode();
  const [collapsedDays, setCollapsedDays] = useState(() => new Set());

  const toggleDay = (dayNodeId) =>
    setCollapsedDays((prev) => {
      const next = new Set(prev);
      next.has(dayNodeId) ? next.delete(dayNodeId) : next.add(dayNodeId);
      return next;
    });

  const { nodes, edges } = useMemo(() => {
    const cols = rankMap(plan.graph.nodes.map((n) => n.position.x));
    const rows = rankMap(plan.graph.nodes.map((n) => n.position.y));

    // Which segment arrives at which place node — that's what a dropdown swaps.
    const inbound = new Map(plan.graph.edges.filter((e) => e.type === 'transport').map((e) => [e.target, e.data]));
    const days = plan.days.map((d) => ({ id: d.id, dayNumber: d.dayNumber }));
    const activityCounts = Object.fromEntries(plan.days.map((d) => [`day:${d.id}`, d.activities.length]));

    // An activity belongs to whichever day node sits on its row.
    const dayOfActivity = new Map();
    for (const day of plan.days) {
      for (const a of day.activities) dayOfActivity.set(`activity:${a.id}`, `day:${day.id}`);
    }

    const builtNodes = plan.graph.nodes.map((n) => {
      const growDelayMs =
        cols.get(n.position.x) * FEATURES.nodeGrowMsPerColumn + rows.get(n.position.y) * FEATURES.nodeGrowMsPerRow;

      const data = { ...n.data, label: n.label, kind: n.type, growDelayMs };
      if (onEdit) data.onEdit = () => onEdit({ elementType: 'node', id: n.id, nodeType: n.type, data: n.data });

      if (n.type === 'destination' || n.type === 'return') {
        const seg = inbound.get(n.id);
        if (seg && !seg.pending) {
          data.arrivalMeta = [seg.mode, prettyDate(seg.date)].filter(Boolean).join(' · ');
        }
        if (semi && seg?.alternatives?.length) {
          data.segmentControl = {
            alternatives: seg.alternatives.map((a, i) => ({ id: `${seg.id}-${i}`, label: segLabel(a) })),
            onPick: (i) => semi.onReplaceSegment(seg.id, i),
          };
        }
      }

      if (n.type === 'stay' && semi && n.data.alternatives?.length) {
        data.stayControl = {
          alternatives: n.data.alternatives.map((a, i) => ({ id: a.placeId ?? i, label: stayLabel(a) })),
          onPick: (i) => semi.onReplaceStay(n.data.id, i),
        };
      }

      if (n.type === 'day') {
        data.dateLabel = prettyDate(n.data.date);
        data.activityCount = activityCounts[n.id] ?? 0;
        data.collapsed = collapsedDays.has(n.id);
        data.onToggleCollapse = () => toggleDay(n.id);
        if (semi) data.dayControl = { onAdd: (query) => semi.onAddActivity(n.data.id, query) };
      }

      if (n.type === 'activity' && semi) {
        data.activityControl = {
          days,
          onRemove: () => semi.onRemoveActivity(n.data.id),
          onMoveTo: (dayId) => semi.onMoveActivity(n.data.id, dayId),
        };
      }

      // A collapsed day hides its activities rather than deleting them.
      const hidden = n.type === 'activity' && collapsedDays.has(dayOfActivity.get(n.id));
      return { ...n, data, hidden, draggable: true };
    });

    const builtEdges = plan.graph.edges.map((e) => {
      const isOrigin = e.source === 'origin';
      const stroke = isOrigin ? THEME.originGreen : EDGE_COLOR[e.type];
      const hidden = collapsedDays.has(dayOfActivity.get(e.target)) || collapsedDays.has(dayOfActivity.get(e.source));

      return {
        ...e,
        type: 'trip',
        animated: e.type === 'transport',
        hidden,
        label: e.label ?? undefined,
        style: { stroke, strokeWidth: e.type === 'transport' ? 2 : 1, ...(e.type === 'local' && { strokeDasharray: '4 4' }) },
        data: { kind: e.type, ...e.data },
      };
    });

    return { nodes: builtNodes, edges: builtEdges };
  }, [plan, semi, onEdit, collapsedDays]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      colorMode={colorMode}
      fitView
      fitViewOptions={GRAPH_VIEW.fitViewOptions}
      minZoom={GRAPH_VIEW.minZoom}
      maxZoom={GRAPH_VIEW.maxZoom}
      nodesDraggable
      nodesConnectable={false}
      onNodeDragStop={(_e, node) => onLayoutChange?.(node.id, node.position)}
    >
      <Background gap={26} size={1} />
      <Controls showInteractive={false} />
      <MiniMap
        pannable
        zoomable
        // Default minimap nodes are a few pixels wide at this zoom — bump the
        // stroke so the shape of the trip is actually readable.
        nodeColor={(n) => NODE_COLORS[n.type] ?? '#71717a'}
        nodeStrokeColor={(n) => NODE_COLORS[n.type] ?? '#71717a'}
        nodeStrokeWidth={GRAPH_VIEW.minimapStrokeWidth}
        style={GRAPH_VIEW.minimapSize}
        className="!hidden sm:!block"
      />
    </ReactFlow>
  );
}
