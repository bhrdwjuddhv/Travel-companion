import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import ModeSelect from './ModeSelect';
import TripInputPanel from './TripInputPanel';
import BuildingScreen from './BuildingScreen';
import DecisionFlow from './DecisionFlow';
import TripGraph from '../graph/TripGraph';
import BudgetPanel from '../budget/BudgetPanel';
import { postSSE } from '../../shared/sse';
import { api } from '../../shared/api';
import { FEATURES, LIMITS, STEP_LABELS, THEME } from '../../constants';

/** Applies one `{ target, data }` patch to the live plan. */
const applyPatch = (plan, { target, data, label }) => {
  if (!plan) return plan;
  if (target === 'plan') return data;
  if (target === 'budget') return { ...plan, budget: data };

  // Otherwise it names a single node or edge — touch only that one.
  return {
    ...plan,
    graph: {
      nodes: plan.graph.nodes.map((n) =>
        n.id === target ? { ...n, label: label ?? n.label, data: { ...n.data, ...data, pending: false } } : n
      ),
      edges: plan.graph.edges.map((e) =>
        e.id === target ? { ...e, label: label ?? e.label, data: { ...e.data, ...data } } : e
      ),
    },
  };
};

export default function Planning() {
  const navigate = useNavigate();
  const arrivedFromGreen = useLocation().state?.fromGreen;

  const [step, setStep] = useState('mode'); // mode | input | building
  const [mode, setMode] = useState('auto');
  const [progress, setProgress] = useState({});
  const [error, setError] = useState(null);
  const [decision, setDecision] = useState(null);
  const [livePlan, setLivePlan] = useState(null);
  const [tripId, setTripId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [lastInput, setLastInput] = useState(null);
  const [lastEventAt, setLastEventAt] = useState(0);
  const [stalled, setStalled] = useState(false);

  // A pause waiting on the user is not a hang, so the watchdog only runs when
  // no decision is on screen.
  useEffect(() => {
    const id = setInterval(() => {
      const waitingOnServer = step === 'building' && !decision && !error && progress.step !== 'done';
      setStalled(waitingOnServer && Date.now() - lastEventAt > LIMITS.stepTimeoutMs);
    }, 2000);
    return () => clearInterval(id);
  }, [step, decision, error, lastEventAt, progress.step]);

  const run = async (input) => {
    setLastInput(input);
    setError(null);
    setDecision(null);
    setLivePlan(null);
    setProgress({});
    setStalled(false);
    setLastEventAt(Date.now());
    setStep('building');

    let landedOn = null;
    let failed = false;

    try {
      await postSSE('/api/planning/start', input, (event, data) => {
        setLastEventAt(Date.now());

        if (event === 'progress') setProgress(data);
        if (event === 'trip_created') setTripId(data.tripId);
        if (event === 'skeleton') setLivePlan(data.plan);
        if (event === 'patch') setLivePlan((plan) => applyPatch(plan, data));
        if (event === 'plan_partial') {
          setLivePlan(data.plan);
          setBusy(false);
        }
        if (event === 'decision_required') {
          setDecision(data);
          setBusy(false);
        }
        if (event === 'failed') {
          failed = true;
          setError(data);
        }
        if (event === 'done') {
          landedOn = data.tripId;
          setTripId(data.tripId);
          setLivePlan(data.plan);
          setProgress({ step: 'done', label: 'Ready' });
        }
      });

      // The stream stays open past `done` while background research patches in;
      // once it closes, the saved trip has everything.
      if (landedOn && !failed) navigate(`/trip/${landedOn}`, { replace: true });
    } catch (e) {
      // The plan was saved before the connection died — a dropped stream during
      // the background research is no reason to throw the trip away.
      if (landedOn) navigate(`/trip/${landedOn}`, { replace: true });
      else setError({ message: e.message, recoverable: true });
    }
  };

  // The stream is still open; answering unblocks it and the next event arrives.
  const choose = async (choiceId) => {
    const open = decision;
    setBusy(true);
    setDecision(null);
    setLastEventAt(Date.now());
    try {
      await api(`/api/planning/${tripId}/decision`, {
        method: 'POST',
        body: { decisionId: open.decisionId, choiceId },
      });
    } catch (e) {
      // Put the question back rather than stranding the run.
      setDecision(open);
      setBusy(false);
      setError({ message: e.message, recoverable: false });
    }
  };

  const retry = () => (error?.recoverable && lastInput ? run(lastInput) : setStep('input'));

  const statusError =
    error ??
    (stalled
      ? { message: 'This is taking longer than expected. Still working — you can wait or start over.', recoverable: true }
      : null);

  return (
    <main className="relative min-h-screen bg-neutral-950 text-neutral-100">
      {arrivedFromGreen && (
        <div
          className="green-settle pointer-events-none fixed inset-0 z-50"
          style={{ background: THEME.originGreen, '--wipe-ms': `${FEATURES.transitionMs}ms` }}
        />
      )}

      {step === 'mode' && (
        <Centered>
          <ModeSelect
            onSelect={(id) => {
              setMode(id);
              setStep('input');
            }}
            onBack={() => navigate('/')}
          />
        </Centered>
      )}

      {step === 'input' && (
        <Centered>
          <TripInputPanel mode={mode} onGenerate={run} onCancel={() => setStep('mode')} />
        </Centered>
      )}

      {/* A decision always wins the screen — it is the thing blocking the run. */}
      {step === 'building' && decision && (
        <div className="flex h-[100dvh] flex-col lg:flex-row">
          {livePlan && (
            <div className="min-h-0 flex-1">
              <TripGraph plan={livePlan} />
            </div>
          )}
          <div
            className={`min-h-0 w-full shrink-0 border-neutral-800 ${
              livePlan ? 'border-t lg:w-96 lg:border-l lg:border-t-0' : 'mx-auto max-w-lg'
            }`}
          >
            <DecisionFlow decision={decision} onChoose={choose} busy={busy} error={error} />
          </div>
        </div>
      )}

      {step === 'building' &&
        !decision &&
        (livePlan ? (
          // The graph is on screen from the first moment and fills in as SSE
          // patches land — no spinner, no waiting for the whole plan.
          <div className="flex h-[100dvh] flex-col">
            <LiveStrip progress={progress} error={statusError} onRetry={retry} busy={busy} />
            <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
              <div className="min-h-0 flex-1">
                <TripGraph plan={livePlan} />
              </div>
              <BudgetPanel budget={livePlan.budget} />
            </div>
          </div>
        ) : (
          <Centered>
            <BuildingScreen
              current={progress.step}
              label={progress.label}
              error={statusError}
              onRetry={retry}
              onBack={() => setStep('input')}
            />
          </Centered>
        ))}
    </main>
  );
}

/** Slim live status bar above the graph while the plan is still filling in. */
function LiveStrip({ progress, error, onRetry, busy }) {
  const steps = Object.keys(STEP_LABELS);
  const reached = steps.indexOf(progress.step);
  const pct = progress.step === 'done' ? 100 : ((reached + 1) / steps.length) * 100;

  if (error) {
    return (
      <div className="flex items-center justify-between gap-4 border-b border-amber-500/30 bg-amber-500/10 px-5 py-2 text-xs text-amber-300">
        <span>{error.message}</span>
        <button onClick={onRetry} className="rounded-full border border-amber-400/50 px-3 py-1 text-amber-200">
          {error.recoverable === false ? 'Start over' : 'Retry'}
        </button>
      </div>
    );
  }

  return (
    <div className="border-b border-neutral-800 px-5 py-2">
      <div className="flex items-center gap-3 text-xs text-neutral-400">
        <span
          className={`h-1.5 w-1.5 rounded-full ${progress.step === 'done' ? '' : 'animate-pulse'}`}
          style={{ background: THEME.originGreen }}
        />
        {busy ? 'Applying your choice…' : (progress.label ?? 'Sketching the route')}
      </div>
      <div className="mt-2 h-0.5 rounded bg-neutral-900">
        <div
          className="h-0.5 rounded transition-[width] duration-700 ease-out"
          style={{ width: `${Math.max(pct, 6)}%`, background: THEME.originGreen }}
        />
      </div>
    </div>
  );
}

const Centered = ({ children }) => (
  <div className="flex min-h-[100dvh] items-center justify-center px-4 py-10 sm:px-5 sm:py-16">{children}</div>
);
