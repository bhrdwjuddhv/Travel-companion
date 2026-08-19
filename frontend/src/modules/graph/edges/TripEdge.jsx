import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath } from '@xyflow/react';
import { Train, Plane, Bus, Car, Footprints } from 'lucide-react';

const MODE_ICON = { train: Train, flight: Plane, bus: Bus, car: Car, auto: Car, cab: Car, walk: Footprints };

/**
 * A real HTML label, so the fare/duration can be a proper pill with the mode's
 * icon in it — React Flow's built-in labels are SVG text and can hold neither.
 */
export default function TripEdge({
  id, sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition, style = {}, data, label,
}) {
  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition, borderRadius: 12,
  });

  const Icon = MODE_ICON[data?.mode];

  return (
    <>
      <BaseEdge id={id} path={path} style={style} />
      {label && (
        <EdgeLabelRenderer>
          <div
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`, borderColor: style.stroke }}
            className="nodrag nopan pointer-events-none absolute flex items-center gap-1.5 whitespace-nowrap rounded-full border bg-white/95 px-2.5 py-1 text-[11px] font-medium text-neutral-700 shadow-sm dark:bg-neutral-900/95 dark:text-neutral-200"
          >
            {Icon && <Icon size={11} style={{ color: style.stroke }} />}
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
