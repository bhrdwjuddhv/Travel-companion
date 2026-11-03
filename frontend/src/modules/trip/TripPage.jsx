import { lazy, Suspense, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import BudgetPanel from '../budget/BudgetPanel';
import CalendarView from '../calendar/CalendarView';
import ChatPanel from '../chat/ChatPanel';
import Itinerary from './Itinerary';
import ThemeToggle from '../../shared/ThemeToggle';
import { api } from '../../shared/api';
import Icon from '../../shared/Icon';

// Leaflet is ~50kB gzipped and plenty of sessions never open a map, so both
// map views load when first asked for rather than on every page view.
const FunMap = lazy(() => import('../map/FunMap'));

export default function TripPage() {
  const { tripId } = useParams();
  const navigate = useNavigate();
  const [trip, setTrip] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null);
  const [copied, setCopied] = useState(false);
  // Nothing is phone-hostile any more: the itinerary stacks first on a narrow
  // screen and the map is usable there, so there is no mobile-only default.
  // The calendar is no longer a tab, but it is still what PDF export captures,
  // so it lives in a sheet the export button opens.
  const [exporting, setExporting] = useState(false);
  const [editContext, setEditContext] = useState(null);
  // Budget and chat share the right column; stacking them pushed the chat
  // off the bottom of the viewport entirely.
  const [pane, setPane] = useState('budget');
  // What the itinerary last pointed at, which is what the map flies to.
  const [focus, setFocus] = useState(null);

  useEffect(() => {
    api(`/api/trips/${tripId}`).then(setTrip, (e) => setError(e.message));
  }, [tripId]);

  const mutate = async (tool, args) => {
    setBusy(true);
    setNote(null);
    try {
      const next = await api(`/api/trips/${tripId}/mutate`, {
        method: 'POST',
        body: { expectedVersion: trip.versionNumber, tool, args },
      });
      setTrip({ ...trip, ...next });
    } catch (e) {
      // 409: someone edited first. Take their version rather than overwrite it.
      if (e.status === 409 && e.body?.current) {
        setTrip(e.body.current);
        setNote('This plan changed elsewhere — reloaded the latest version. Try that again.');
      } else {
        setNote(e.message);
      }
    } finally {
      setBusy(false);
    }
  };

  // Semi mode is the only one with on-diagram dropdowns.
  const semi =
    trip?.input?.planningMode === 'semi'
      ? {
          onReplaceSegment: (segmentId, alternativeIndex) =>
            mutate('replace_transport_segment', { segmentId, alternativeIndex }),
          onReplaceStay: (stayId, alternativeIndex) => mutate('replace_accommodation', { stayId, alternativeIndex }),
          onAddActivity: (dayId, query) => mutate('add_activity', { dayId, query }),
          onRemoveActivity: (activityId) => mutate('remove_activity', { activityId }),
          onMoveActivity: (activityId, toDayId) => mutate('move_activity', { activityId, toDayId }),
        }
      : null;

  if (error) return <Message>{error}</Message>;
  if (!trip) return <Message>Loading your trip…</Message>;
  if (!trip.plan) return <Message>This trip has no saved plan yet.</Message>;

  const { plan, input } = trip;

  const share = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const onFocus = (target) => setFocus(target);

  const openEdit = (context) => {
    setEditContext(context);
    setPane('chat');
  };

  return (
    <main className="flex h-[100dvh] flex-col bg-[var(--clay-surface)] text-[var(--c-ink)]">
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <h1 className="truncate text-[length:var(--type-body)] font-semibold">
            {[input.origin, input.primaryDestination, ...(input.additionalDestinations ?? [])].join(' → ')}
          </h1>
          <p className="text-[length:var(--type-small)] text-[var(--c-ink-dim)]">
            {input.startDate ? `${input.startDate} → ${input.endDate}` : `${input.durationDays} days`} ·{' '}
            {input.travellerCount} traveller{input.travellerCount > 1 ? 's' : ''} · v{trip.versionNumber} ·{' '}
            {input.planningMode}
          </p>
        </div>

        <div className="flex w-full shrink-0 flex-wrap items-center gap-2 sm:w-auto">
          {busy && <span className="text-[length:var(--type-small)] text-[var(--c-ink-dim)]">updating…</span>}

          <button onClick={() => setExporting(true)} className="clay-pill clay-pressable min-h-9">
            <Icon name="export" size={16} />
            Export
          </button>

          <ThemeToggle />
          <button onClick={share} className="clay-pill clay-pressable min-h-9">
            <Icon name="bookmark" size={16} />
            {copied ? 'Copied' : 'Share'}
          </button>
          <button onClick={() => navigate('/planning')} className="clay-pill clay-pressable min-h-9 font-medium">
            New trip
          </button>
        </div>
      </header>

      {note && (
        <p
          className="clay-soft mx-4 mb-2 px-4 py-2 text-[length:var(--type-small)]"
          style={{ color: 'var(--c-warn)' }}
          role="status"
        >
          {note}
        </p>
      )}

      {/* Three columns on a desktop, stacked everywhere smaller. */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-y-auto p-3 pt-0 lg:grid-cols-[minmax(300px,0.95fr)_minmax(0,2fr)_21rem] lg:overflow-hidden">
        <div className="min-h-[60vh] lg:min-h-0">
          <Itinerary trip={trip} onFocus={onFocus} focused={focus?.key} semi={semi} onEdit={openEdit} />
        </div>

        <div className="clay flex min-h-[60vh] flex-col overflow-hidden lg:min-h-0">
          <Suspense fallback={<Centered>Drawing the trail…</Centered>}>
            <FunMap trip={trip} focus={focus} />
          </Suspense>
        </div>

        <div className="clay flex min-h-0 flex-col overflow-hidden">
          <div className="clay-soft m-2 flex shrink-0 gap-1 p-1">
            {[
              ['budget', 'Budget', 'priceSliders'],
              ['chat', 'Ask AI', 'chat'],
            ].map(([id, label, icon]) => (
              <button
                key={id}
                onClick={() => setPane(id)}
                aria-pressed={pane === id}
                className="clay-pressable flex min-h-9 flex-1 items-center justify-center gap-2 rounded-[var(--clay-radius-pill)] px-3 text-[length:var(--type-small)] font-medium"
              >
                <Icon name={icon} size={16} />
                {label}
              </button>
            ))}
          </div>

          <div className="min-h-0 flex-1 overflow-hidden">
            {pane === 'budget' ? (
              <BudgetPanel
                key={trip.versionNumber}
                budget={plan.budget}
                verdict={trip.budgetVerdict}
                tripId={tripId}
                versionNumber={trip.versionNumber}
                onRefit={(result) => setTrip((t) => ({ ...t, ...result }))}
              />
            ) : (
              <ChatPanel
                tripId={tripId}
                context={editContext}
                onClearContext={() => setEditContext(null)}
                onApplied={(result) => setTrip((t) => ({ ...t, ...result }))}
                onClose={() => setPane('budget')}
              />
            )}
          </div>
        </div>
      </div>

      {exporting && <ExportSheet trip={trip} onClose={() => setExporting(false)} />}
    </main>
  );
}

/** The calendar, and the two export buttons it owns, in a sheet. */
const ExportSheet = ({ trip, onClose }) => (
  <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4" role="dialog" aria-modal="true">
    <div className="clay flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden">
      <header className="flex items-center justify-between px-5 py-3">
        <h2 className="font-semibold">Day by day, and taking it with you</h2>
        <button onClick={onClose} aria-label="Close" className="clay-pill clay-pressable min-h-9">
          <Icon name="close" size={16} />
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-hidden">
        <CalendarView trip={trip} />
      </div>
    </div>
  </div>
);

const Centered = ({ children }) => (
  <div className="grid h-full place-items-center text-[length:var(--type-small)] text-[var(--c-ink-dim)]">{children}</div>
);

const Message = ({ children }) => (
  <main className="grid min-h-screen place-items-center bg-[var(--clay-surface)] p-6 text-[length:var(--type-body)] text-[var(--c-ink-muted)]">
    {children}
  </main>
);
