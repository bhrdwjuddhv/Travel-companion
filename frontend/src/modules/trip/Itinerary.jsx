import { useEffect, useState } from 'react';
import PlacePhoto from '../../shared/PlacePhoto';
import Icon from '../../shared/Icon';
import { CATEGORY_ICON, TRANSPORT_ICON } from '../../shared/icons';
import { api } from '../../shared/api';
import { mapsUrl } from '../../shared/maps';

const money = (n) => `₹${Number(n).toLocaleString('en-IN')}`;
const fmtMins = (m) => (m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ''}` : `${m} min`);
const prettyDate = (iso) =>
  iso
    ? new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' })
    : null;

/**
 * The strip along the bottom of a card: how you get there, and how far.
 * Reads from the local hop we already measured, so it is never a guess.
 */
function TravelStrip({ mode, minutes, distanceKm, fare }) {
  const facts = [
    minutes ? `${mode === 'walk' ? 'Walk' : 'Ride'} ${fmtMins(minutes)}` : null,
    distanceKm != null ? `${distanceKm} km` : null,
    fare ? money(fare) : null,
  ].filter(Boolean);

  return (
    <div className="clay-sunken mt-3 flex items-center gap-2 px-3 py-2 text-[length:var(--type-small)]">
      <Icon name={TRANSPORT_ICON[mode] ?? 'place'} size={18} />
      <span className="flex min-w-0 items-center gap-2 text-[var(--c-ink-muted)]">
        {facts.map((f, i) => (
          <span key={f} className="truncate">
            {i > 0 && <span className="mr-2 opacity-40">|</span>}
            {f}
          </span>
        ))}
      </span>
    </div>
  );
}

/**
 * One stop. Photograph on the left under a diagonal cut, everything you'd
 * want to read on the right, and how you travel there along the bottom.
 */
function PlaceCard({ photo, icon, title, place, description, footer, onFocus, mapsHref, selected, actions, swap }) {
  return (
    <article
      className={`clay-soft clay-pressable relative overflow-hidden ${selected ? 'ring-2 ring-[var(--c-accent)]' : ''}`}
      data-active={selected ? 'true' : undefined}
    >
      <button type="button" onClick={onFocus} className="flex w-full items-stretch text-left">
        {/* The slanted edge is the card's signature; the photo sits under it. */}
        <span
          className="relative w-[38%] shrink-0 self-stretch"
          style={{ clipPath: 'polygon(0 0, 100% 0, calc(100% - 26px) 100%, 0 100%)' }}
        >
          <PlacePhoto photo={photo} alt={title} icon={icon} className="h-full min-h-[132px] w-full !rounded-none !shadow-none" />
        </span>

        <span className="min-w-0 flex-1 px-4 py-3.5">
          <span className="flex items-start justify-between gap-2">
            <span
              className="min-w-0 truncate text-[1.15rem] font-semibold leading-tight"
              style={{ fontFamily: 'var(--type-display-family)' }}
            >
              {title}
            </span>
            {actions}
            {mapsHref && (
              <a
                href={mapsHref}
                target="_blank"
                rel="noopener noreferrer"
                title="Open in Google Maps"
                onClick={(e) => e.stopPropagation()}
                className="shrink-0 opacity-60 transition-opacity hover:opacity-100"
              >
                <Icon name="place" size={17} />
              </a>
            )}
          </span>

          {place && (
            <span className="mt-0.5 block truncate text-[length:var(--type-small)] text-[var(--c-ink-muted)]">
              {place}
            </span>
          )}
          {description && (
            <span className="mt-1.5 block text-[length:var(--type-small)] leading-snug text-[var(--c-ink-dim)]">
              {description}
            </span>
          )}
          {footer}
          {swap}
        </span>
      </button>
    </article>
  );
}

/** Opens the chat with this element as its subject. */
const EditButton = ({ onEdit, context }) =>
  onEdit ? (
    <button
      type="button"
      title="Edit with AI"
      onClick={(e) => {
        e.stopPropagation();
        onEdit(context);
      }}
      className="shrink-0 opacity-60 transition-opacity hover:opacity-100"
    >
      <Icon name="edit" size={16} />
    </button>
  ) : null;

/** Semi mode's swap, without a diagram to put it on. */
const SwapSelect = ({ label, options, onPick }) =>
  options?.length ? (
    <select
      value=""
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => e.target.value !== '' && onPick(Number(e.target.value))}
      className="clay-sunken mt-2 w-full px-2.5 py-1.5 text-[length:var(--type-small)] outline-none"
    >
      <option value="">{label}</option>
      {options.map((o, i) => (
        <option key={o.id ?? i} value={i}>
          {o.label}
        </option>
      ))}
    </select>
  ) : null;

/** A milestone: where the journey starts, and where it ends. */
const Milestone = ({ icon, label, sub }) => (
  <div className="clay-soft flex items-center gap-3 p-3.5">
    <Icon name={icon} size={26} />
    <div className="min-w-0">
      <p className="truncate font-medium">{label}</p>
      {sub && <p className="truncate text-[length:var(--type-small)] text-[var(--c-ink-dim)]">{sub}</p>}
    </div>
  </div>
);

/**
 * The plan as a column you read downward, with a rail threading the stops
 * together so a day scans as one run rather than a pile of cards.
 *
 * Clicking anything calls `onFocus` with its coordinates, which is what moves
 * the map beside it.
 */
export default function Itinerary({ trip, onFocus, focused, semi = null, onEdit = null }) {
  const { plan, input } = trip;
  const [cover, setCover] = useState(null);

  // Trips saved before cover images existed have none stored, so the city's
  // photograph is fetched by name. The search behind it is cached server-side.
  useEffect(() => {
    let live = true;
    api(`/api/places/cover?q=${encodeURIComponent(input.primaryDestination)}`)
      .then((r) => live && setCover(r.photo ?? null))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [input.primaryDestination]);

  const stayFor = (destination) => plan.stays.find((s) => s.destination === destination);
  const segmentsOn = (date) => (date ? plan.segments.filter((s) => s.date === date) : []);
  const focus = (key, lat, lng, name) =>
    lat != null && lng != null ? () => onFocus?.({ key, lat, lng, name }) : undefined;

  const route = [input.origin, input.primaryDestination, ...(input.additionalDestinations ?? [])].join(' → ');
  const seenStays = new Set();

  return (
    <div className="clay flex h-full min-h-0 flex-col overflow-hidden">
      {/* The city, with the trip written over it. */}
      <header className="relative h-40 shrink-0">
        <PlacePhoto
          photo={cover}
          alt={input.primaryDestination}
          icon="explore"
          width={900}
          className="absolute inset-0 h-full w-full !rounded-none !shadow-none"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-black/10" />
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4">
          <h2 className="min-w-0 text-[1.3rem] font-semibold leading-tight text-white drop-shadow">
            <span className="block truncate">{route}</span>
            <span className="mt-0.5 block text-[length:var(--type-small)] font-normal text-white/80">
              {input.travellerCount} traveller{input.travellerCount > 1 ? 's' : ''}
              {input.startDate ? ` · from ${prettyDate(input.startDate)}` : ''}
            </span>
          </h2>
          <span className="clay-pill shrink-0 bg-white/90 py-1 text-[length:var(--type-micro)] font-semibold text-black">
            {input.durationDays} {input.durationDays === 1 ? 'day' : 'days'}
          </span>
        </div>
      </header>

      <div className="scroll-quiet min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {/* The rail runs the length of the plan; dots mark each stop. */}
        <div className="relative space-y-3 pl-6">
          <span className="absolute bottom-2 left-[7px] top-2 w-px bg-[var(--c-border-strong)]" aria-hidden="true" />

          <Rail>
            <Milestone icon="originFlag" label={input.origin} sub="Starting here" />
          </Rail>

          {plan.days.map((day, dayIndex) => {
            const stay = stayFor(day.destination);
            const legs = segmentsOn(day.date);
            const showStay = stay && !seenStays.has(stay.id) && seenStays.add(stay.id);

            return (
              <section key={day.id} className="clay-enter space-y-3" style={{ '--clay-delay': `${dayIndex * 45}ms` }}>
                {legs.map((leg) => (
                  <Rail key={leg.id}>
                    <div className="clay-sunken flex items-center gap-2 px-3 py-2 text-[length:var(--type-small)]">
                      <Icon name={TRANSPORT_ICON[leg.mode] ?? 'place'} size={18} />
                      <span className="truncate text-[var(--c-ink-muted)]">
                        {leg.fromPlace} → {leg.toPlace}
                        <span className="mx-2 opacity-40">|</span>
                        {fmtMins(leg.durationMinutes)}
                        <span className="mx-2 opacity-40">|</span>
                        {money(leg.fare)}
                      </span>
                    </div>
                  </Rail>
                ))}

                <div className="flex items-center gap-2 pt-1">
                  <h3 className="text-[1.05rem] font-semibold" style={{ fontFamily: 'var(--type-display-family)' }}>
                    Day {day.dayNumber}
                  </h3>
                  <span className="min-w-0 flex-1 truncate text-[length:var(--type-small)] text-[var(--c-ink-dim)]">
                    {[prettyDate(day.date), day.destination].filter(Boolean).join(' · ')}
                  </span>
                  {/* Placeholder on purpose: the shape of the control, before
                      it is wired. The mutation it will call already exists
                      (add_activity), so this is a handler away from working. */}
                  <button
                    type="button"
                    title={`Add your own place to day ${day.dayNumber} — not wired up yet`}
                    aria-label={`Add a place to day ${day.dayNumber} (coming soon)`}
                    className="clay-soft clay-pressable grid h-7 w-7 shrink-0 place-items-center rounded-full"
                  >
                    <Icon name="add" size={15} />
                  </button>
                </div>

                {showStay && (
                  <Rail>
                    <PlaceCard
                      photo={stay.photo}
                      icon="hotel"
                      title={stay.name}
                      place={`${stay.destination} · ${stay.nights} night${stay.nights > 1 ? 's' : ''}`}
                      description={stay.priceBasis}
                      swap={
                        semi && (
                          <SwapSelect
                            label="Swap this stay"
                            options={(stay.alternatives ?? []).map((alt) => ({
                              id: alt.id,
                              label: `${alt.name} · ${money(alt.pricePerNight)}/night`,
                            }))}
                            onPick={(i) => semi.onReplaceStay(stay.id, i)}
                          />
                        )
                      }
                      footer={
                        <span className="clay-sunken mt-3 flex items-center gap-2 px-3 py-2 text-[length:var(--type-small)]">
                          <Icon name="money" size={18} />
                          <span className="text-[var(--c-ink-muted)]">
                            {money(stay.pricePerNight)}/night
                            {stay.priceType === 'estimate' ? ' est' : ''}
                            {stay.rating != null && (
                              <>
                                <span className="mx-2 opacity-40">|</span>
                                {stay.rating}★
                              </>
                            )}
                          </span>
                        </span>
                      }
                      onFocus={focus(`stay:${stay.id}`, stay.lat, stay.lng, stay.name)}
                      mapsHref={mapsUrl({ name: stay.name, placeId: stay.placeId, destination: stay.destination })}
                      selected={focused === `stay:${stay.id}`}
                      actions={
                        <EditButton
                          onEdit={onEdit}
                          context={{ elementType: 'node', id: `stay:${stay.id}`, nodeType: 'stay', data: stay }}
                        />
                      }
                    />
                  </Rail>
                )}

                {day.activities.map((a) => {
                  const hop = a.localTransportFromPrev;
                  return (
                    <div key={a.id} className="space-y-3">
                      {hop && (
                        <TravelStrip
                          mode={hop.mode}
                          minutes={hop.durationMinutes}
                          distanceKm={hop.distanceKm}
                          fare={hop.estimatedFare}
                        />
                      )}
                      <Rail>
                      <PlaceCard
                        photo={a.photo}
                        icon={a.isHiddenGem ? 'hiddenGem' : (CATEGORY_ICON[a.category] ?? 'attraction')}
                        title={a.name}
                        place={[day.destination, a.plannedStart].filter(Boolean).join(' · ')}
                        description={a.notes}
                        footer={
                          <span className="clay-sunken mt-3 flex items-center gap-2 px-3 py-2 text-[length:var(--type-small)]">
                            <Icon name={a.isHiddenGem ? 'hiddenGem' : 'ticket'} size={18} />
                            <span className="text-[var(--c-ink-muted)]">
                              {a.ticketCost ? money(a.ticketCost) : 'Free to visit'}
                              {a.isHiddenGem && <span className="ml-2 opacity-70">hidden gem</span>}
                            </span>
                          </span>
                        }
                        onFocus={focus(`activity:${a.id}`, a.lat, a.lng, a.name)}
                        mapsHref={mapsUrl({ name: a.name, placeId: a.placeId, destination: day.destination })}
                        selected={focused === `activity:${a.id}`}
                        actions={
                          <>
                            {semi && (
                              <button
                                type="button"
                                title="Remove this stop"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  semi.onRemoveActivity(a.id);
                                }}
                                className="shrink-0 opacity-60 transition-opacity hover:opacity-100"
                              >
                                <Icon name="close" size={16} />
                              </button>
                            )}
                            <EditButton
                              onEdit={onEdit}
                              context={{ elementType: 'node', id: `activity:${a.id}`, nodeType: 'activity', data: a }}
                            />
                          </>
                        }
                        />
                      </Rail>
                    </div>
                  );
                })}

                {!day.activities.length && !legs.length && (
                  <p className="text-[length:var(--type-small)] text-[var(--c-ink-dim)]">Nothing planned yet.</p>
                )}
              </section>
            );
          })}

          {input.direction === 'round' && (
            <Rail>
              <Milestone icon="returnFlag" label={input.origin} sub="Back where you started" />
            </Rail>
          )}
        </div>
      </div>
    </div>
  );
}

/** A dot on the rail, level with whatever it introduces. */
const Rail = ({ children }) => (
  <div className="relative">
    <span
      className="absolute -left-6 top-6 h-3 w-3 rounded-full bg-[var(--c-accent)] ring-4 ring-[var(--clay-surface-raised)]"
      aria-hidden="true"
    />
    {children}
  </div>
);
