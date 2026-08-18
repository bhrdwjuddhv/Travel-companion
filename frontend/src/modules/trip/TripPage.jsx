import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import TripGraph from '../graph/TripGraph';
import BudgetPanel from '../budget/BudgetPanel';
import { api } from '../../shared/api';
import { THEME } from '../../constants';

export default function TripPage() {
  const { tripId } = useParams();
  const navigate = useNavigate();
  const [trip, setTrip] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api(`/api/trips/${tripId}`).then(setTrip, (e) => setError(e.message));
  }, [tripId]);

  // No useCallback/useMemo here on purpose — the React Compiler memoizes these,
  // and hand-rolling it made the compiler bail out entirely.
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

  // Semi mode is the only one with on-diagram controls.
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
    <main className="flex h-screen flex-col bg-neutral-950 text-neutral-100">
      <header className="flex items-center justify-between gap-4 border-b border-neutral-800 px-5 py-3">
        <div className="min-w-0">
          <h1 className="truncate text-sm font-medium">{route}</h1>
          <p className="text-xs text-neutral-500">
            {input.durationDays} days · {input.travellerCount} traveller{input.travellerCount > 1 ? 's' : ''} · v
            {trip.versionNumber} · {input.planningMode}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2 text-sm">
          {busy && (
            <span className="text-xs" style={{ color: THEME.originGreen }}>
              updating…
            </span>
          )}
          <button onClick={share} className="rounded-full border border-neutral-700 px-4 py-1.5 hover:bg-neutral-900">
            {copied ? 'Link copied' : 'Share'}
          </button>
          <button
            onClick={() => navigate('/planning')}
            className="rounded-full px-4 py-1.5 font-medium text-neutral-950"
            style={{ background: THEME.originGreen }}
          >
            New trip
          </button>
        </div>
      </header>

      {note && <p className="border-b border-amber-500/30 bg-amber-500/10 px-5 py-2 text-xs text-amber-300">{note}</p>}

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="min-h-0 flex-1">
          <TripGraph plan={plan} semi={semi} />
        </div>
        <BudgetPanel budget={plan.budget} verdict={trip.budgetVerdict} />
      </div>
    </main>
  );
}

const Message = ({ children }) => (
  <main className="grid min-h-screen place-items-center bg-neutral-950 p-6 text-sm text-neutral-400">{children}</main>
);
