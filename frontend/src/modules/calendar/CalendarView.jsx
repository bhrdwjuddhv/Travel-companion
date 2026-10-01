import { useRef, useState } from 'react';
import { BedDouble, CalendarPlus, Camera, Coffee, ExternalLink, FileDown, Star, Train, Utensils } from 'lucide-react';
import { NODE_COLORS } from '../../constants';
import { mapsUrl } from '../../shared/maps';
import { exportIcs, exportPdf } from './exporters';

const money = (n) => `₹${Number(n).toLocaleString('en-IN')}`;
const ACTIVITY_ICON = { cafe: Coffee, meal: Utensils, hidden_gem: Star };

const prettyDate = (iso) =>
  iso
    ? new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-IN', {
        weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC',
      })
    : null;

/**
 * Day-by-day agenda, and the thing that gets exported. Deliberately icon +
 * text only: any external image would need CORS headers or the capture comes
 * out blank.
 */
export default function CalendarView({ trip }) {
  const dayRefs = useRef(new Map());
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const { plan, input } = trip;

  const tripName = `${input.origin}-${input.primaryDestination}`;
  const stayFor = (destination) => plan.stays.find((s) => s.destination === destination);
  const segmentsOn = (date) => (date ? plan.segments.filter((s) => s.date === date) : []);

  const run = async (kind, fn) => {
    setBusy(kind);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(`Could not export: ${e.message}`);
    } finally {
      setBusy(null);
    }
  };

  const orderedDayNodes = () => plan.days.map((d) => dayRefs.current.get(d.id)).filter(Boolean);

  return (
    <div className="h-full overflow-y-auto bg-[var(--c-bg)]">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
        <p
          className="text-[length:var(--type-small)]"
          style={{ color: error ? 'var(--c-danger)' : 'var(--c-ink-muted)' }}
          role={error ? 'alert' : undefined}
        >
          {error ?? 'A printable copy of the itinerary.'}
        </p>
        <div className="flex flex-wrap gap-2">
          <ExportButton
            onClick={() => run('pdf', () => exportPdf(orderedDayNodes(), tripName))}
            busy={busy === 'pdf'}
            Icon={FileDown}
            label="PDF"
            hint="One page per day"
          />
          <ExportButton
            onClick={() => run('ics', () => exportIcs(trip, tripName))}
            busy={busy === 'ics'}
            Icon={CalendarPlus}
            label="Calendar (.ics)"
            hint="Import into Google or Apple Calendar"
          />
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-3 pb-10 sm:px-6">
        <header className="border-b border-[var(--c-border)] pb-5">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
            {[input.origin, input.primaryDestination, ...(input.additionalDestinations ?? [])].join(' → ')}
          </h1>
          <p className="mt-1.5 text-[length:var(--type-body)] text-[var(--c-ink-muted)]">
            {[prettyDate(input.startDate), prettyDate(input.endDate)].filter(Boolean).join(' – ') ||
              `${input.durationDays} days`}
            {' · '}
            {input.travellerCount} traveller{input.travellerCount > 1 ? 's' : ''}
          </p>
          <p className="mt-3 text-[length:var(--type-body)]">
            <span className="text-[var(--c-ink-muted)]">Estimated total </span>
            <span className="font-semibold tabular-nums">{money(plan.budget.total)}</span>
          </p>
        </header>

        <ol className="mt-6 space-y-5">
          {plan.days.map((day) => {
            const stay = stayFor(day.destination);
            const legs = segmentsOn(day.date);

            return (
              <li
                key={day.id}
                ref={(el) => (el ? dayRefs.current.set(day.id, el) : dayRefs.current.delete(day.id))}
                className="ui-card-quiet bg-[var(--c-bg-alt)] p-4"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <h2 className="text-[length:var(--type-body)] font-semibold">
                    Day {day.dayNumber}
                    <span className="ml-2 font-normal text-[var(--c-ink-muted)]">{day.destination}</span>
                  </h2>
                  {day.date && (
                    <span className="text-[length:var(--type-small)] text-[var(--c-ink-muted)]">
                      {prettyDate(day.date)}
                    </span>
                  )}
                </div>

                {legs.map((leg) => (
                  <Row
                    key={leg.id}
                    Icon={Train}
                    color={NODE_COLORS.destination}
                    title={`${leg.fromPlace} → ${leg.toPlace}`}
                    meta={`${leg.mode}${leg.service ? ` · ${leg.service}` : ''} · ${money(leg.fare)}${
                      leg.fareType === 'estimate' ? ' est' : ''
                    }`}
                  />
                ))}

                {stay && (
                  <Row
                    Icon={BedDouble}
                    color={NODE_COLORS.stay}
                    title={stay.name}
                    meta={`${money(stay.pricePerNight)}/night${stay.priceType === 'estimate' ? ' est' : ''}`}
                    href={mapsUrl({ name: stay.name, placeId: stay.placeId, destination: stay.destination })}
                  />
                )}

                {day.activities.map((a) => {
                  const hop = a.localTransportFromPrev;
                  const Icon = a.isHiddenGem ? Star : (ACTIVITY_ICON[a.category] ?? Camera);
                  return (
                    <Row
                      key={a.id}
                      Icon={Icon}
                      color={a.isHiddenGem ? NODE_COLORS.hidden_gem : NODE_COLORS.activity}
                      title={a.name}
                      time={a.plannedStart}
                      href={mapsUrl({ name: a.name, placeId: a.placeId, destination: day.destination })}
                      meta={[
                        a.ticketCost ? `${money(a.ticketCost)}${a.costType === 'estimate' ? ' est' : ''}` : 'free',
                        hop && `${hop.mode} ${hop.distanceKm}km · ${money(hop.estimatedFare)} est`,
                        a.isHiddenGem && 'hidden gem',
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    />
                  );
                })}

                {!day.activities.length && !legs.length && (
                  <p className="mt-3 text-[length:var(--type-small)] text-[var(--c-ink-dim)]">Nothing planned yet.</p>
                )}
              </li>
            );
          })}
        </ol>

        <p className="mt-6 text-[length:var(--type-micro)] text-[var(--c-ink-muted)]">
          Fares and room rates are estimates unless a provider confirmed them.
        </p>
      </div>
    </div>
  );
}

const ExportButton = ({ onClick, busy, Icon, label, hint }) => (
  <button
    onClick={onClick}
    disabled={busy}
    title={hint}
    className="ui-btn ui-btn-ghost ui-btn-sm"
  >
    <Icon size={14} />
    {busy ? 'Exporting…' : label}
  </button>
);

/** A row is a link when the place can be found on a map, plain text otherwise. */
function Row({ Icon, color, title, meta, time, href }) {
  const body = (
    <>
      {time ? (
        <span className="w-11 shrink-0 pt-0.5 text-[length:var(--type-micro)] tabular-nums text-[var(--c-ink-muted)]">
          {time}
        </span>
      ) : (
        <span className="hidden w-11 shrink-0 sm:block" />
      )}
      <Icon size={15} style={{ color }} className="mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 text-[length:var(--type-body)]">
          <span className="break-words">{title}</span>
          {href && <ExternalLink size={11} className="shrink-0 text-[var(--c-ink-muted)]" />}
        </p>
        {meta && <p className="text-[length:var(--type-micro)] text-[var(--c-ink-muted)]">{meta}</p>}
      </div>
    </>
  );

  return href ? (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-3 flex items-start gap-2 rounded-[var(--r-sm)] px-1 py-1 transition-colors hover:bg-[var(--c-surface-hover)] sm:gap-3"
    >
      {body}
    </a>
  ) : (
    <div className="mt-3 flex items-start gap-2 sm:gap-3">{body}</div>
  );
}
