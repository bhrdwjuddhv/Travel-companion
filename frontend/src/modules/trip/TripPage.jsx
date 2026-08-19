import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CalendarDays, MessageSquare, Share2, Workflow } from 'lucide-react';
import TripCanvas from '../graph/TripCanvas';
import BudgetPanel from '../budget/BudgetPanel';
import CalendarView from '../calendar/CalendarView';
import ChatPanel from '../chat/ChatPanel';
import ThemeToggle from '../../shared/ThemeToggle';
import { api } from '../../shared/api';
import { THEME } from '../../constants';
import { useIsMobile } from '../../shared/useIsMobile';

const LAYOUT_SAVE_DELAY_MS = 600;

export default function TripPage() {
  const { tripId } = useParams();
  const navigate = useNavigate();
  const [trip, setTrip] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null);
  const [copied, setCopied] = useState(false);
  // The node canvas is unusable on a phone, so Calendar opens first there.
  // Still a toggle, not a lockout.
  const isMobile = useIsMobile();
  const [view, setView] = useState(isMobile ? 'calendar' : 'graph');
  const [editContext, setEditContext] = useState(null);
  const [chatOpen, setChatOpen] = useState(false);

  const layoutRef = useRef({});
  const saveTimer = useRef(null);

  useEffect(() => {
    api(`/api/trips/${tripId}`).then((t) => {
      layoutRef.current = t.layout ?? {};
      setTrip(t);
    }, (e) => setError(e.message));
  }, [tripId]);

  // Dragging fires constantly; only the last position in a burst is worth a write.
  const onLayoutChange = (nodeId, position) => {
    layoutRef.current = { ...layoutRef.current, [nodeId]: position };
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      api(`/api/trips/${tripId}/layout`, { method: 'PUT', body: { layout: layoutRef.current } }).catch((e) =>
        setNote(`Could not save layout: ${e.message}`)
      );
    }, LAYOUT_SAVE_DELAY_MS);
  };

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
  const route = [input.origin, input.primaryDestination, ...(input.additionalDestinations ?? [])].join(' → ');

  const share = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <main className="flex h-[100dvh] flex-col bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-neutral-200 px-4 py-2.5 sm:px-5 sm:py-3 dark:border-neutral-800">
        <div className="min-w-0">
          <h1 className="truncate text-sm font-medium">{route}</h1>
          <p className="text-xs text-neutral-500">
            {input.startDate ? `${input.startDate} → ${input.endDate}` : `${input.durationDays} days`} ·{' '}
            {input.travellerCount} traveller{input.travellerCount > 1 ? 's' : ''} · v{trip.versionNumber} ·{' '}
            {input.planningMode}
          </p>
        </div>

        <div className="flex w-full shrink-0 flex-wrap items-center gap-2 text-sm sm:w-auto">
          {busy && <span className="text-xs" style={{ color: THEME.originGreen }}>updating…</span>}

          <div className="flex overflow-hidden rounded-full border border-neutral-300 dark:border-neutral-700">
            <ViewTab active={view === 'graph'} onClick={() => setView('graph')} Icon={Workflow} label="Graph" />
            <ViewTab active={view === 'calendar'} onClick={() => setView('calendar')} Icon={CalendarDays} label="Calendar" />
          </div>

          <button
            onClick={() => setChatOpen((v) => !v)}
            className={`flex min-h-9 items-center gap-1.5 rounded-full border px-4 py-1.5 ${
              chatOpen
                ? 'border-transparent bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
                : 'border-neutral-300 hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900'
            }`}
          >
            <MessageSquare size={13} />
            Chat
          </button>

          <ThemeToggle />

          <button
            onClick={share}
            className="flex min-h-9 items-center gap-1.5 rounded-full border border-neutral-300 px-4 py-1.5 hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900"
          >
            <Share2 size={13} />
            {copied ? 'Copied' : 'Share'}
          </button>
          <button
            onClick={() => navigate('/planning')}
            className="min-h-9 rounded-full px-4 py-1.5 font-medium text-neutral-950"
            style={{ background: THEME.originGreen }}
          >
            New trip
          </button>
        </div>
      </header>

      {note && <p className="border-b border-amber-500/30 bg-amber-500/10 px-5 py-2 text-xs text-amber-600 dark:text-amber-300">{note}</p>}

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="flex min-h-0 flex-1 flex-col">
          {view === 'graph' ? (
            <TripCanvas
              plan={plan}
              semi={semi}
              onEdit={(context) => {
                setEditContext(context);
                setChatOpen(true);
              }}
              onLayoutChange={onLayoutChange}
            />
          ) : (
            <CalendarView trip={trip} />
          )}
        </div>

        {chatOpen && (
          <div className="h-80 w-full shrink-0 border-t border-neutral-200 lg:h-auto lg:w-96 lg:border-l lg:border-t-0 dark:border-neutral-800">
            <ChatPanel
              tripId={tripId}
              context={editContext}
              onClearContext={() => setEditContext(null)}
              onApplied={(result) => setTrip((t) => ({ ...t, ...result }))}
              onClose={() => setChatOpen(false)}
            />
          </div>
        )}

        <BudgetPanel
          key={trip.versionNumber}
          budget={plan.budget}
          verdict={trip.budgetVerdict}
          tripId={tripId}
          versionNumber={trip.versionNumber}
          onRefit={(result) => setTrip((t) => ({ ...t, ...result }))}
        />
      </div>
    </main>
  );
}

const ViewTab = ({ active, onClick, Icon, label }) => (
  <button
    onClick={onClick}
    className={`flex min-h-9 items-center gap-1.5 px-3.5 py-1.5 text-xs transition ${
      active ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900' : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
    }`}
  >
    <Icon size={13} />
    {label}
  </button>
);

const Message = ({ children }) => (
  <main className="grid min-h-screen place-items-center bg-white p-6 text-sm text-neutral-500 dark:bg-neutral-950">
    {children}
  </main>
);
