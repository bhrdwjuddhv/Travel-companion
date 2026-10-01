import { useEffect, useMemo, useState } from 'react';
import { MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ExternalLink } from 'lucide-react';
import { MAP } from '../../constants';
import { mapsUrl } from '../../shared/maps';
import { markerColour, tripPoints } from './tripPoints';

const money = (n) => `₹${Number(n).toLocaleString('en-IN')}`;
const fmtMins = (m) => (m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ''}` : `${m}m`);

const LEGEND = [
  ['origin', 'Start and finish'],
  ['stay', 'Where you sleep'],
  ['activity', 'Things to do'],
  ['gem', 'Hidden gem'],
];

/** A numbered pin, drawn as HTML so it can carry the visit order. */
const pinFor = (point, size) =>
  L.divIcon({
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<span style="
      display:grid;place-items:center;
      width:${size}px;height:${size}px;border-radius:999px;
      background:${markerColour(point.type)};color:#0A0A0C;
      font:600 ${Math.round(size * 0.42)}px/1 Inter,sans-serif;
      box-shadow:0 0 0 2px rgba(0,0,0,0.45), 0 2px 8px rgba(0,0,0,0.5);
    ">${point.order}</span>`,
  });

/** Keeps the viewport on whatever is currently being shown. */
function FitBounds({ points }) {
  const map = useMap();
  useEffect(() => {
    if (!points.length) return;
    const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng]));
    if (points.length === 1) map.setView([points[0].lat, points[0].lng], MAP.fitMaxZoom, { animate: true });
    else map.fitBounds(bounds, { padding: MAP.fitPadding, maxZoom: MAP.fitMaxZoom, animate: true });
  }, [points, map]);
  return null;
}

export default function MapView({ trip }) {
  const { plan, input } = trip;
  const [dayId, setDayId] = useState('all');

  const { points, legs } = useMemo(() => tripPoints(plan, input), [plan, input]);

  const shown = useMemo(() => {
    if (dayId === 'all') return { points, legs };
    const kept = points.filter((p) => p.dayId === dayId);
    const keys = new Set(kept.map((p) => p.key));
    return { points: kept, legs: legs.filter((l) => keys.has(l.from.key) && keys.has(l.to.key)) };
  }, [points, legs, dayId]);

  if (!points.length) {
    return (
      <div className="grid h-full place-items-center bg-[var(--c-bg)] p-8 text-center">
        <p className="ui-prose text-[length:var(--type-body)]">
          This plan has no stored coordinates, so there is nothing to map yet. Trips generated from now on carry
          them — regenerate this one to see it here.
        </p>
      </div>
    );
  }

  return (
    <div className="relative flex h-full flex-col bg-[var(--c-bg)]">
      <div className="flex flex-wrap items-center gap-2 px-4 py-3 sm:px-5">
        <button
          type="button"
          aria-pressed={dayId === 'all'}
          onClick={() => setDayId('all')}
          className="ui-pill"
        >
          Whole trip
        </button>
        {plan.days.map((d) => (
          <button
            key={d.id}
            type="button"
            aria-pressed={dayId === d.id}
            onClick={() => setDayId(d.id)}
            className="ui-pill"
          >
            Day {d.dayNumber}
          </button>
        ))}
      </div>

      <div className="relative min-h-0 flex-1">
        <MapContainer
          center={MAP.fallbackCenter}
          zoom={MAP.fallbackZoom}
          scrollWheelZoom
          className="h-full w-full"
          style={{ background: 'var(--c-bg-alt)' }}
        >
          <TileLayer url={MAP.tileUrl} attribution={MAP.attribution} maxZoom={MAP.maxZoom} />
          <FitBounds points={shown.points} />

          {shown.legs.map((leg) => (
            <Polyline
              key={leg.key}
              positions={[
                [leg.from.lat, leg.from.lng],
                [leg.to.lat, leg.to.lng],
              ]}
              pathOptions={{
                color: leg.kind === 'intercity' ? MAP.colors.lineIntercity : MAP.colors.line,
                weight: MAP.lineWidth,
                opacity: 0.9,
                dashArray: leg.kind === 'straight' ? MAP.lineDash : undefined,
              }}
            >
              <Tooltip sticky>
                <LegTip leg={leg} />
              </Tooltip>
            </Polyline>
          ))}

          {shown.points.map((p) => (
            <Marker
              key={p.key}
              position={[p.lat, p.lng]}
              icon={pinFor(p, dayId === 'all' ? MAP.markerSizeSmall : MAP.markerSize)}
              title={p.name}
            >
              <Tooltip direction="top" offset={[0, -12]}>
                <PlaceTip point={p} />
              </Tooltip>
            </Marker>
          ))}
        </MapContainer>

        <ul className="pointer-events-none absolute bottom-4 left-4 z-[400] flex list-none flex-col gap-1.5 rounded-[var(--r-md)] bg-[var(--c-bg-alt)]/90 p-3 text-[length:var(--type-micro)] shadow-lg backdrop-blur-sm">
          {LEGEND.map(([type, label]) => (
            <li key={type} className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: markerColour(type) }} />
              {label}
            </li>
          ))}
          <li className="mt-1 opacity-70">Numbers follow the order you visit them.</li>
        </ul>
      </div>
    </div>
  );
}

/** Leaflet tooltips are plain DOM, so these stay simple and self-contained. */
function PlaceTip({ point }) {
  const facts = [
    point.plannedStart,
    point.rating != null ? `${point.rating}★` : null,
    point.price != null ? `${money(point.price)}${point.priceType === 'estimate' ? ' est' : ''}` : null,
    point.nights ? `${point.nights} night${point.nights > 1 ? 's' : ''}` : null,
  ].filter(Boolean);

  return (
    <span className="block max-w-[220px]">
      <strong className="block text-[13px]">
        {point.order}. {point.name}
      </strong>
      <span className="block text-[11px] opacity-75">{point.subtitle}</span>
      {facts.length > 0 && <span className="mt-1 block text-[11px]">{facts.join(' · ')}</span>}
      {point.notes && <span className="mt-1 block text-[11px] opacity-75">{point.notes}</span>}
      <a
        href={mapsUrl({ name: point.name, placeId: point.placeId, destination: point.destination })}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-1.5 inline-flex items-center gap-1 text-[11px] underline"
      >
        Open in Google Maps
        <ExternalLink size={10} />
      </a>
    </span>
  );
}

function LegTip({ leg }) {
  const how =
    leg.kind === 'straight'
      ? 'straight-line distance'
      : [leg.mode, leg.service].filter(Boolean).join(' · ');

  return (
    <span className="block max-w-[220px]">
      <strong className="block text-[13px]">
        {leg.from.name} → {leg.to.name}
      </strong>
      <span className="mt-0.5 block text-[11px]">
        {leg.distanceKm} km{leg.minutes ? ` · ${fmtMins(leg.minutes)}` : ''}
      </span>
      <span className="block text-[11px] opacity-75">
        {how}
        {leg.fare != null ? ` · ${money(leg.fare)} est` : ''}
      </span>
    </span>
  );
}
