import { useState } from 'react';
import {
  BedDouble, Calendar, Camera, ChevronDown, ChevronRight, Coffee, ExternalLink,
  Flag, MapPin, Pencil, Plus, Star, Utensils, X,
} from 'lucide-react';
import { CANVAS, NODE_COLORS } from '../../../constants';
import { openInMaps } from '../../../shared/maps';

const money = (n) => `₹${Number(n).toLocaleString('en-IN')}`;
const fmtMins = (m) => (m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ''}` : `${m}m`);
const ACTIVITY_ICON = { cafe: Coffee, meal: Utensils, hidden_gem: Star };

const segLabel = (s) => `${s.mode}${s.class ? ` ${s.class}` : ''} · ${money(s.fare)} · ${fmtMins(s.durationMinutes)}`;
const stayLabel = (s) => `${s.name} · ${money(s.pricePerNight)}/night`;
const prettyDate = (iso) =>
  iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' }) : null;

const PACE_NOTE = { travel: 'travel day', light: 'leaving early', half: 'half day' };

/** Everything a node shows: one icon, one title, one meta line. */
function describe(node, inboundSegment) {
  const d = node.data ?? {};
  switch (node.type) {
    case 'origin':
      return { Icon: MapPin, title: node.label, meta: 'Start' };
    case 'return':
      return { Icon: MapPin, title: node.label, meta: 'Home' };
    case 'destination':
      return {
        Icon: Flag,
        title: node.label,
        meta: inboundSegment && !inboundSegment.pending
          ? [inboundSegment.mode, inboundSegment.arrivalTime, prettyDate(inboundSegment.date)].filter(Boolean).join(' · ')
          : 'arriving',
      };
    case 'stay':
      return {
        Icon: BedDouble,
        title: node.label,
        meta: d.pending
          ? 'finding rooms…'
          : [`${money(d.pricePerNight)}/night${d.priceType === 'estimate' ? ' est' : ''}`, `${d.nights}n`, d.rating ? `${d.rating}★` : null]
              .filter(Boolean)
              .join(' · '),
        place: { name: d.name, placeId: d.placeId, destination: d.destination },
      };
    case 'day':
      return {
        Icon: Calendar,
        title: node.label,
        meta: [prettyDate(d.date), d.destination, PACE_NOTE[d.pace]].filter(Boolean).join(' · '),
        detail: d.anchorNote,
      };
    default:
      return {
        Icon: d.isHiddenGem ? Star : (ACTIVITY_ICON[d.category] ?? Camera),
        title: node.label,
        meta: [d.plannedStart, d.ticketCost ? money(d.ticketCost) : 'free', d.isHiddenGem ? 'hidden gem' : null]
          .filter(Boolean)
          .join(' · '),
        detail: d.notes,
        place: { name: d.name, placeId: d.placeId, destination: d.destination },
      };
  }
}

export default function TripNode({
  node, palette, accent, semi, inboundSegment, days, activityCount, collapsed, onToggleCollapse, onEdit, onPointerDown,
}) {
  const [hover, setHover] = useState(false);
  const [open, setOpen] = useState(false);
  const { Icon, title, meta, detail, place } = describe(node, inboundSegment);

  const isOrigin = node.type === 'origin' || node.type === 'return';
  const colour = node.data?.isHiddenGem ? NODE_COLORS.hidden_gem : accent;
  const stop = (e) => e.stopPropagation();

  // Semi mode adds dropdowns; the pencil opens chat. Both exist everywhere.
  const segmentAlternatives = semi && inboundSegment?.alternatives?.length ? inboundSegment.alternatives : null;
  const stayAlternatives = semi && node.type === 'stay' && node.data?.alternatives?.length ? node.data.alternatives : null;

  return (
    <div
      data-node
      onPointerDown={onPointerDown}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="node-grow absolute cursor-grab select-none rounded-xl border shadow-sm transition-shadow hover:shadow-md active:cursor-grabbing"
      style={{
        left: node.position.x,
        top: node.position.y,
        width: CANVAS.nodeWidth,
        minHeight: CANVAS.nodeHeight,
        background: palette.nodeBg,
        borderColor: isOrigin ? colour : palette.nodeBorder,
        borderLeft: `3px solid ${colour}`,
        animationDelay: `${node.data?.growDelayMs ?? 0}ms`,
      }}
    >
      <div className="flex items-start gap-2.5 px-3 py-2.5">
        <Icon size={16} strokeWidth={2} style={{ color: colour }} className="mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium" style={{ color: palette.text }} title={title}>
            {title}
          </p>
          {meta && (
            <p className="mt-0.5 truncate text-[11px]" style={{ color: palette.textMuted }}>
              {meta}
            </p>
          )}
        </div>
      </div>

      {/* Detail is opt-in, so the resting card stays one line of meta. */}
      {open && (detail || segmentAlternatives || stayAlternatives) && (
        <div className="border-t px-3 py-2" style={{ borderColor: palette.nodeBorder }} onPointerDown={stop}>
          {detail && <p className="text-[11px]" style={{ color: palette.textMuted }}>{detail}</p>}

          {segmentAlternatives && (
            <Picker
              palette={palette}
              placeholder="Change how you get here"
              options={segmentAlternatives.map(segLabel)}
              onPick={(i) => semi.onReplaceSegment(inboundSegment.id, i)}
            />
          )}
          {stayAlternatives && (
            <Picker
              palette={palette}
              placeholder="Swap this stay"
              options={stayAlternatives.map(stayLabel)}
              onPick={(i) => semi.onReplaceStay(node.data.id, i)}
            />
          )}

          {semi && node.type === 'activity' && (
            <div className="mt-2 flex items-center gap-1">
              <Picker
                palette={palette}
                placeholder="Move to…"
                options={days.map((d) => `Day ${d.dayNumber}`)}
                onPick={(i) => semi.onMoveActivity(node.data.id, days[i].id)}
              />
              <button
                onClick={() => semi.onRemoveActivity(node.data.id)}
                title="Remove"
                className="mt-2 grid h-7 w-7 shrink-0 place-items-center rounded-md border"
                style={{ borderColor: palette.nodeBorder, color: palette.textMuted }}
              >
                <X size={12} />
              </button>
            </div>
          )}
        </div>
      )}

      {node.type === 'day' && activityCount > 0 && (
        <button
          onPointerDown={stop}
          onClick={onToggleCollapse}
          className="flex w-full items-center gap-1 border-t px-3 py-1.5 text-[11px] transition hover:opacity-70"
          style={{ borderColor: palette.nodeBorder, color: palette.textMuted }}
        >
          {collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
          {collapsed ? `Show ${activityCount} stops` : 'Hide stops'}
        </button>
      )}

      {/* Two separate affordances: open the place, or edit it. */}
      <div
        className="absolute right-1.5 top-1.5 flex gap-1 transition-opacity"
        style={{ opacity: hover || open ? 1 : 0 }}
        onPointerDown={stop}
      >
        {place?.name && (
          <IconButton palette={palette} title="Open in Google Maps" onClick={() => openInMaps(place)}>
            <ExternalLink size={12} />
          </IconButton>
        )}
        {(detail || segmentAlternatives || stayAlternatives || (semi && node.type === 'activity')) && (
          <IconButton palette={palette} title={open ? 'Less' : 'More'} onClick={() => setOpen((v) => !v)}>
            {open ? <ChevronDown size={12} /> : <Plus size={12} />}
          </IconButton>
        )}
        {onEdit && (
          <IconButton
            palette={palette}
            title="Edit with AI"
            onClick={() => onEdit({ elementType: 'node', id: node.id, nodeType: node.type, data: node.data, label: node.label })}
          >
            <Pencil size={12} />
          </IconButton>
        )}
      </div>
    </div>
  );
}

const IconButton = ({ palette, title, onClick, children }) => (
  <button
    title={title}
    onClick={(e) => {
      e.stopPropagation();
      onClick();
    }}
    className="grid h-5 w-5 place-items-center rounded border transition hover:opacity-70"
    style={{ borderColor: palette.nodeBorder, background: palette.nodeBg, color: palette.textMuted }}
  >
    {children}
  </button>
);

const Picker = ({ palette, placeholder, options, onPick }) => (
  <select
    value=""
    onChange={(e) => e.target.value !== '' && onPick(Number(e.target.value))}
    onPointerDown={(e) => e.stopPropagation()}
    className="mt-2 w-full rounded-md border px-2 py-1 text-[11px] outline-none"
    style={{ borderColor: palette.nodeBorder, background: palette.nodeBg, color: palette.text }}
  >
    <option value="">{placeholder}</option>
    {options.map((label, i) => (
      <option key={label + i} value={i}>
        {label}
      </option>
    ))}
  </select>
);
