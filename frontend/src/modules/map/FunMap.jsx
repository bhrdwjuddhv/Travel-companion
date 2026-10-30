import { useEffect, useMemo, useState } from 'react';
import { MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { renderToStaticMarkup } from 'react-dom/server';
import { FUN_MAP, MAP } from '../../constants';
import { iconFor } from '../../shared/icons';
import { tripPoints } from './tripPoints';

/**
 * The same trip, drawn as a treasure hunt: sticker pins instead of numbered
 * dots, and a dashed trail between them. Exactly the same data as the plain
 * map — nothing extra is fetched.
 */

/** Which sticker a stop gets. Days cycle the set so a day reads as a run. */
const stickerFor = (point, index) => {
  if (point.type === 'origin') return FUN_MAP.originIcon;
  if (point.type === 'stay') return FUN_MAP.stayIcon;
  return FUN_MAP.pinIcons[index % FUN_MAP.pinIcons.length];
};

/** Leaflet wants markup, so the sticker is rendered to a string once per pin. */
const pinFor = (point, index) => {
  const Sticker = iconFor(stickerFor(point, index));
  const size = FUN_MAP.pinSize;
  const svg = renderToStaticMarkup(<Sticker size={size - 12} />);

  return L.divIcon({
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    html: `<span style="
      display:grid;place-items:center;width:${size}px;height:${size}px;
      filter: drop-shadow(2px 4px 4px rgba(0,0,0,0.35));
    ">${svg}</span>`,
  });
};

function FitBounds({ points }) {
  const map = useMap();
  useEffect(() => {
    if (!points.length) return;
    if (points.length === 1) map.setView([points[0].lat, points[0].lng], MAP.fitMaxZoom, { animate: true });
    else {
      map.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng])), {
        padding: MAP.fitPadding,
        maxZoom: MAP.fitMaxZoom,
        animate: true,
      });
    }
  }, [points, map]);
  return null;
}

/** Flies to whatever the itinerary last selected. */
function FocusOn({ target }) {
  const map = useMap();
  useEffect(() => {
    if (target?.lat == null) return;
    map.flyTo([target.lat, target.lng], Math.max(map.getZoom(), 14), { duration: 0.8 });
  }, [target, map]);
  return null;
}

export default function FunMap({ trip, focus = null }) {
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
      <div className="grid h-full place-items-center p-8 text-center">
        <p className="ui-prose text-[length:var(--type-body)]">
          This plan has no stored coordinates yet, so there is no trail to follow.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 px-4 py-3">
        <button type="button" aria-pressed={dayId === 'all'} onClick={() => setDayId('all')} className="clay-pill clay-pressable">
          Whole adventure
        </button>
        {plan.days.map((d) => (
          <button
            key={d.id}
            type="button"
            aria-pressed={dayId === d.id}
            onClick={() => setDayId(d.id)}
            className="clay-pill clay-pressable"
          >
            Day {d.dayNumber}
          </button>
        ))}
      </div>

      <div className="clay-map clay-sunken relative m-3 mt-0 min-h-0 flex-1 overflow-hidden">
        <MapContainer center={MAP.fallbackCenter} zoom={MAP.fallbackZoom} scrollWheelZoom className="h-full w-full">
          <TileLayer url={MAP.tileUrl} attribution={MAP.attribution} maxZoom={MAP.maxZoom} />
          <FitBounds points={shown.points} />
          <FocusOn target={focus} />

          {shown.legs.map((leg) => (
            <Polyline
              key={leg.key}
              positions={[
                [leg.from.lat, leg.from.lng],
                [leg.to.lat, leg.to.lng],
              ]}
              pathOptions={{
                color: FUN_MAP.trail.color,
                weight: FUN_MAP.trail.weight,
                opacity: FUN_MAP.trail.opacity,
                dashArray: FUN_MAP.trail.dash,
                lineCap: 'round',
              }}
            >
              <Tooltip sticky>
                {leg.distanceKm} km{leg.mode ? ` by ${leg.mode}` : ''}
              </Tooltip>
            </Polyline>
          ))}

          {shown.points.map((p, i) => (
            <Marker key={p.key} position={[p.lat, p.lng]} icon={pinFor(p, i)} title={p.name}>
              <Tooltip direction="top" offset={[0, -FUN_MAP.pinSize]}>
                <strong className="block text-[13px]">
                  {p.order}. {p.name}
                </strong>
                <span className="block text-[11px] opacity-75">{p.subtitle}</span>
              </Tooltip>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}
