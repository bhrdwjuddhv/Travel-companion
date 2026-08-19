import { useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import {
  MapPin, Flag, BedDouble, Calendar, Camera, Utensils, Star, Coffee,
  ExternalLink, Pencil, Plus, ChevronDown, ChevronRight, X,
} from 'lucide-react';
import { NODE_COLORS, THEME } from '../../../constants';
import { openInMaps } from '../../../shared/maps';

const money = (n) => `₹${Number(n).toLocaleString('en-IN')}`;

const ACTIVITY_ICON = { cafe: Coffee, meal: Utensils, hidden_gem: Star, transit: MapPin };

const Estimate = ({ type }) =>
  type === 'estimate' ? <span className="ml-1 text-[10px] uppercase opacity-50">est</span> : null;

/**
 * One card shape for every node type: an accent rail, an icon, a title, and a
 * single line of meta. Controls only appear on hover so the graph reads calm.
 */
function Card({ kind, accent, Icon, title, meta, children, onOpenMaps, onEdit, onAdd, footer }) {
  const [hover, setHover] = useState(false);
  const color = accent ?? NODE_COLORS[kind] ?? '#71717a';

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="node-grow group relative w-56 overflow-hidden rounded-xl border border-neutral-200/60 bg-white/90 shadow-sm backdrop-blur transition-shadow hover:shadow-lg dark:border-neutral-800 dark:bg-neutral-900/90"
      style={{ borderLeft: `3px solid ${color}` }}
    >
      <Handle type="target" position={Position.Left} className="!h-1.5 !w-1.5 !border-0 !bg-neutral-400" />

      <div className="flex items-start gap-2.5 px-3 py-2.5">
        <Icon size={16} strokeWidth={2} style={{ color }} className="mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium text-neutral-900 dark:text-neutral-100" title={title}>
            {title}
          </p>
          {meta && <p className="mt-0.5 truncate text-[11px] text-neutral-500 dark:text-neutral-400">{meta}</p>}
          {children}
        </div>
      </div>

      {footer}

      {/* Two distinct affordances: open the place, or edit this element. */}
      <div
        className={`absolute right-1.5 top-1.5 flex gap-1 transition-opacity ${hover ? 'opacity-100' : 'opacity-0'}`}
      >
        {onOpenMaps && (
          <IconButton title="Open in Google Maps" onClick={onOpenMaps}>
            <ExternalLink size={12} />
          </IconButton>
        )}
        {onAdd && (
          <IconButton title="Add to this day" onClick={onAdd}>
            <Plus size={12} />
          </IconButton>
        )}
        {onEdit && (
          <IconButton title="Edit with AI" onClick={onEdit}>
            <Pencil size={12} />
          </IconButton>
        )}
      </div>

      <Handle type="source" position={Position.Right} className="!h-1.5 !w-1.5 !border-0 !bg-neutral-400" />
    </div>
  );
}

const IconButton = ({ title, onClick, children }) => (
  <button
    title={title}
    onClick={(e) => {
      e.stopPropagation();
      onClick(e);
    }}
    className="grid h-5 w-5 place-items-center rounded border border-neutral-300 bg-white/95 text-neutral-600 hover:text-neutral-900 dark:border-neutral-700 dark:bg-neutral-800/95 dark:text-neutral-300 dark:hover:text-white"
  >
    {children}
  </button>
);

const selectClass =
  'mt-2 w-full rounded-md border border-neutral-300 bg-white px-2 py-1 text-[11px] text-neutral-700 outline-none dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200';

const stop = (e) => e.stopPropagation();

/** Semi mode: swap the segment that arrives at this place. */
function SegmentPicker({ control }) {
  if (!control?.alternatives?.length) return null;
  return (
    <select
      className={selectClass}
      value=""
      onChange={(e) => e.target.value !== '' && control.onPick(Number(e.target.value))}
      onClick={stop}
      onMouseDown={stop}
    >
      <option value="">Change how you get here</option>
      {control.alternatives.map((a, i) => (
        <option key={a.id ?? i} value={i}>
          {a.label}
        </option>
      ))}
    </select>
  );
}

const Place = ({ data }) => (
  <Card
    kind={data.kind}
    Icon={data.kind === 'destination' ? Flag : MapPin}
    title={data.label}
    meta={data.kind === 'origin' ? 'Start' : data.kind === 'return' ? 'Home' : data.arrivalMeta}
    onEdit={data.onEdit}
  >
    <SegmentPicker control={data.segmentControl} />
  </Card>
);

const Stay = ({ data }) => (
  <Card
    kind="stay"
    Icon={BedDouble}
    title={data.label}
    meta={
      data.pending ? (
        'finding rooms…'
      ) : (
        <>
          {money(data.pricePerNight)}/night
          <Estimate type={data.priceType} /> · {data.nights}n
          {data.rating != null && ` · ${data.rating}★`}
        </>
      )
    }
    onOpenMaps={data.pending ? null : () => openInMaps({ name: data.name, placeId: data.placeId, destination: data.destination })}
    onEdit={data.onEdit}
  >
    {data.stayControl?.alternatives?.length > 0 && (
      <select
        className={selectClass}
        value=""
        onChange={(e) => e.target.value !== '' && data.stayControl.onPick(Number(e.target.value))}
        onClick={stop}
        onMouseDown={stop}
      >
        <option value="">Swap this stay</option>
        {data.stayControl.alternatives.map((a, i) => (
          <option key={a.id ?? i} value={i}>
            {a.label}
          </option>
        ))}
      </select>
    )}
  </Card>
);

function Day({ data }) {
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const control = data.dayControl;
  const Chevron = data.collapsed ? ChevronRight : ChevronDown;

  return (
    <Card
      kind="day"
      Icon={Calendar}
      title={data.label}
      meta={[data.dateLabel, data.destination].filter(Boolean).join(' · ')}
      onAdd={control ? () => setAdding((v) => !v) : null}
      onEdit={data.onEdit}
      footer={
        data.activityCount > 0 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              data.onToggleCollapse?.();
            }}
            className="flex w-full items-center gap-1 border-t border-neutral-200 px-3 py-1.5 text-[11px] text-neutral-500 hover:text-neutral-800 dark:border-neutral-800 dark:hover:text-neutral-200"
          >
            <Chevron size={12} />
            {data.collapsed ? `Show ${data.activityCount} stops` : 'Hide stops'}
          </button>
        )
      }
    >
      {adding && control && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!query.trim()) return;
            control.onAdd(query.trim());
            setQuery('');
            setAdding(false);
          }}
          className="mt-2 flex gap-1"
          onClick={stop}
        >
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="add a place…"
            className="min-w-0 flex-1 rounded-md border border-neutral-300 bg-white px-2 py-1 text-[11px] outline-none dark:border-neutral-700 dark:bg-neutral-950"
          />
          <button className="rounded-md px-2 text-[11px] font-semibold text-neutral-950" style={{ background: THEME.originGreen }}>
            Add
          </button>
        </form>
      )}
    </Card>
  );
}

function ActivityNode({ data }) {
  const Icon = data.isHiddenGem ? Star : (ACTIVITY_ICON[data.category] ?? Camera);
  const accent = data.isHiddenGem ? NODE_COLORS.hidden_gem : NODE_COLORS.activity;

  return (
    <Card
      kind="activity"
      accent={accent}
      Icon={Icon}
      title={data.label}
      meta={
        <>
          {data.plannedStart ? `${data.plannedStart} · ` : ''}
          {data.ticketCost ? money(data.ticketCost) : 'free'}
          <Estimate type={data.costType} />
          {data.isHiddenGem && ' · hidden gem'}
        </>
      }
      onOpenMaps={() => openInMaps({ name: data.name, placeId: data.placeId, destination: data.destination })}
      onEdit={data.onEdit}
    >
      {data.activityControl && (
        <div className="mt-2 flex items-center gap-1" onClick={stop}>
          <select
            className="min-w-0 flex-1 rounded-md border border-neutral-300 bg-white px-1.5 py-1 text-[11px] dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200"
            value=""
            onChange={(e) => e.target.value && data.activityControl.onMoveTo(e.target.value)}
            onMouseDown={stop}
          >
            <option value="">Move to…</option>
            {data.activityControl.days.map((d) => (
              <option key={d.id} value={d.id}>
                Day {d.dayNumber}
              </option>
            ))}
          </select>
          <button
            onClick={data.activityControl.onRemove}
            title="Remove"
            className="grid h-6 w-6 place-items-center rounded-md border border-neutral-300 text-neutral-500 hover:text-red-500 dark:border-neutral-700"
          >
            <X size={12} />
          </button>
        </div>
      )}
    </Card>
  );
}

export { Place, Stay, Day, ActivityNode };
