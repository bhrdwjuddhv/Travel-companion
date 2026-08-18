import { useMemo } from 'react';
import { ReactFlow, Background, Controls, MiniMap } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { nodeTypes } from './nodes/index.js';
import { FEATURES, THEME } from '../../constants';

const EDGE_STYLE = {
  transport: { stroke: '#38bdf8', strokeWidth: 2 },
  local: { stroke: '#a3a3a3', strokeWidth: 1, strokeDasharray: '4 4' },
  flow: { stroke: '#404040', strokeWidth: 1 },
};

const fmtMins = (m) => (m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ''}` : `${m}m`);
const money = (n) => `₹${Number(n).toLocaleString('en-IN')}`;

const segLabel = (s) => `${s.mode}${s.class ? ` ${s.class}` : ''} · ${money(s.fare)} · ${fmtMins(s.durationMinutes)}`;
const stayLabel = (s) => `${s.name} · ${money(s.pricePerNight)}/night`;

/** Rank of each distinct x/y, so growth delay needs no layout constants. */
const rankMap = (values) => {
  const sorted = [...new Set(values)].sort((a, b) => a - b);
  return new Map(sorted.map((v, i) => [v, i]));
};

/**
 * `semi` (optional) enables the on-diagram controls. Pass the mutation
 * callbacks; omit it and the graph is read-only.
 */
export default function TripGraph({ plan, semi = null }) {
  const nodes = useMemo(() => {
    const cols = rankMap(plan.graph.nodes.map((n) => n.position.x));
    const rows = rankMap(plan.graph.nodes.map((n) => n.position.y));

    // Which segment arrives at which place node — that's what a dropdown swaps.
    const inbound = new Map(
      plan.graph.edges.filter((e) => e.type === 'transport').map((e) => [e.target, e.data])
    );
    const days = plan.days.map((d) => ({ id: d.id, dayNumber: d.dayNumber }));

    return plan.graph.nodes.map((n) => {
      const growDelayMs =
        cols.get(n.position.x) * FEATURES.nodeGrowMsPerColumn + rows.get(n.position.y) * FEATURES.nodeGrowMsPerRow;

      const data = { ...n.data, label: n.label, kind: n.type, growDelayMs };
      if (!semi) return { ...n, data };

      if (n.type === 'destination' || n.type === 'return') {
        const seg = inbound.get(n.id);
        if (seg?.alternatives?.length) {
          data.segmentControl = {
            currentLabel: segLabel(seg),
            alternatives: seg.alternatives.map((a, i) => ({ id: `${seg.id}-${i}`, label: segLabel(a) })),
            onPick: (i) => semi.onReplaceSegment(seg.id, i),
          };
        }
      }

      if (n.type === 'stay' && n.data.alternatives?.length) {
        data.stayControl = {
          alternatives: n.data.alternatives.map((a, i) => ({ id: a.placeId ?? i, label: stayLabel(a) })),
          onPick: (i) => semi.onReplaceStay(n.data.id, i),
        };
      }

      if (n.type === 'day') {
        data.dayControl = { onAdd: (query) => semi.onAddActivity(n.data.id ?? n.id.replace('day:', ''), query) };
      }

      if (n.type === 'activity') {
        const activityId = n.data.id;
        data.activityControl = {
          days,
          onRemove: () => semi.onRemoveActivity(activityId),
          onMoveTo: (dayId) => semi.onMoveActivity(activityId, dayId),
        };
      }

      return { ...n, data };
    });
  }, [plan, semi]);

  const edges = useMemo(
    () =>
      plan.graph.edges.map((e) => ({
        ...e,
        type: 'smoothstep',
        animated: e.type === 'transport',
        label: e.label ?? undefined,
        // The first hop leaves the green origin, so it's green too.
        style: e.source === 'origin' ? { ...EDGE_STYLE[e.type], stroke: THEME.originGreen } : EDGE_STYLE[e.type],
        labelStyle: { fill: '#d4d4d4', fontSize: 11 },
        labelBgStyle: { fill: '#0a0a0a' },
        data: { kind: e.type, ...e.data },
      })),
    [plan]
  );

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      fitView
      minZoom={0.12}
      className="bg-neutral-950"
    >
      <Background color={THEME.graph.backgroundDots} gap={24} />
      <Controls />
      <MiniMap pannable maskColor={THEME.graph.minimapMask} nodeColor={THEME.graph.minimapNode} />
    </ReactFlow>
  );
}
