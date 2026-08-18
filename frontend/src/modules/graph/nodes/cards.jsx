import { useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { THEME } from '../../../constants';

const STYLE = {
  destination: 'border-sky-500/60 bg-sky-500/10',
  stay: 'border-violet-500/60 bg-violet-500/10',
  day: 'border-amber-500/60 bg-amber-500/10',
  activity: 'border-neutral-700 bg-neutral-900',
};

const money = (n) => `₹${Number(n).toLocaleString('en-IN')}`;

const Estimate = ({ type }) =>
  type === 'estimate' ? (
    <span className="ml-1 rounded bg-neutral-800 px-1 py-0.5 text-[10px] uppercase text-neutral-400">est</span>
  ) : null;

/** Origin and return are green — the plan's start point, same green as the CTA. */
function Card({ kind, title, children, data }) {
  const isOrigin = kind === 'origin' || kind === 'return';
  return (
    <div
      className={`node-grow min-w-44 max-w-64 rounded-xl border px-3 py-2 text-neutral-100 ${STYLE[kind] ?? ''} ${
        data.pending ? 'node-pending' : ''
      }`}
      style={{
        animationDelay: `${data.growDelayMs ?? 0}ms`,
        ...(isOrigin && {
          borderColor: THEME.originGreenEdge,
          background: THEME.originGreenDim,
          boxShadow: `0 0 24px ${THEME.originGreenDim}`,
        }),
      }}
    >
      <Handle type="target" position={Position.Left} className="!bg-neutral-600" />
      <p className="text-[10px] uppercase tracking-wide" style={{ color: isOrigin ? THEME.originGreen : '#a3a3a3' }}>
        {kind}
      </p>
      <p className="truncate text-sm font-medium" title={title}>
        {title}
      </p>
      {children}
      <Handle type="source" position={Position.Right} className="!bg-neutral-600" />
    </div>
  );
}

const selectClass =
  'mt-2 w-full rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1 text-xs text-neutral-200 outline-none';

/** Semi mode: swap the segment that arrives at this place. */
function SegmentPicker({ control }) {
  if (!control?.alternatives?.length) return null;
  return (
    <label className="block">
      <span className="mt-2 block text-[10px] uppercase tracking-wide text-neutral-500">Getting here</span>
      <select
        className={selectClass}
        value=""
        onChange={(e) => e.target.value !== '' && control.onPick(Number(e.target.value))}
        onClick={(e) => e.stopPropagation()}
      >
        <option value="">{control.currentLabel}</option>
        {control.alternatives.map((a, i) => (
          <option key={a.id ?? i} value={i}>
            {a.label}
          </option>
        ))}
      </select>
    </label>
  );
}

const Place = ({ data }) => (
  <Card kind={data.kind} title={data.label} data={data}>
    <SegmentPicker control={data.segmentControl} />
  </Card>
);

const Stay = ({ data }) => (
  <Card kind="stay" title={data.label} data={data}>
    <p className="mt-1 text-xs text-neutral-400">
      {data.pending ? (
        `${data.nights} night${data.nights === 1 ? '' : 's'} · searching…`
      ) : (
        <>
          {money(data.pricePerNight)}/night <Estimate type={data.priceType} /> · {data.nights}n
        </>
      )}
    </p>
    {data.rating != null && <p className="text-xs text-neutral-500">{data.rating}★ ({data.reviewCount ?? 0})</p>}
    {data.stayControl?.alternatives?.length > 0 && (
      <select
        className={selectClass}
        value=""
        onChange={(e) => e.target.value !== '' && data.stayControl.onPick(Number(e.target.value))}
        onClick={(e) => e.stopPropagation()}
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
  const control = data.dayControl;

  return (
    <Card kind="day" title={data.label} data={data}>
      <p className="mt-1 text-xs text-neutral-400">
        {data.destination}
        {data.pending && ' · planning…'}
      </p>
      {control && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!query.trim()) return;
            control.onAdd(query.trim());
            setQuery('');
          }}
          className="mt-2 flex gap-1"
        >
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="add a place..."
            className="min-w-0 flex-1 rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1 text-xs outline-none"
          />
          <button
            className="rounded-md px-2 py-1 text-xs font-semibold text-neutral-950"
            style={{ background: THEME.originGreen }}
          >
            +
          </button>
        </form>
      )}
    </Card>
  );
}

const ActivityNode = ({ data }) => (
  <Card kind="activity" title={data.label} data={data}>
    <p className="mt-1 text-xs text-neutral-400">
      {data.plannedStart ? `${data.plannedStart} · ` : ''}
      {data.ticketCost ? money(data.ticketCost) : 'free'}
      <Estimate type={data.costType} />
    </p>
    {data.isHiddenGem && <p className="text-xs text-amber-400">hidden gem</p>}
    {data.activityControl && (
      <div className="mt-2 flex items-center gap-1">
        <select
          className="min-w-0 flex-1 rounded-md border border-neutral-700 bg-neutral-950 px-1.5 py-1 text-xs text-neutral-200 outline-none"
          value=""
          onChange={(e) => e.target.value && data.activityControl.onMoveTo(e.target.value)}
          onClick={(e) => e.stopPropagation()}
        >
          <option value="">Move to...</option>
          {data.activityControl.days.map((d) => (
            <option key={d.id} value={d.id}>
              Day {d.dayNumber}
            </option>
          ))}
        </select>
        <button
          onClick={data.activityControl.onRemove}
          title="Remove"
          className="rounded-md border border-neutral-700 px-2 py-1 text-xs text-neutral-400 hover:text-neutral-100"
        >
          ×
        </button>
      </div>
    )}
  </Card>
);

export { Place, Stay, Day, ActivityNode };
