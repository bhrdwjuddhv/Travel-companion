import { useEffect, useState } from 'react';
import { RotateCcw, Wand2 } from 'lucide-react';
import { api } from '../../shared/api';
import { THEME } from '../../constants';

const ROWS = [
  ['intercityTransport', 'Transport', true],
  ['accommodation', 'Stays', true],
  ['food', 'Food', true],
  ['activities', 'Activities', false],
  ['localTransport', 'Local travel', false],
  ['misc', 'Buffer', false],
];

const startingTargets = (budget) => ({
  intercityTransport: budget.intercityTransport,
  accommodation: budget.accommodation,
  food: budget.food,
  activityCount: null,
});

const money = (n, currency) => `${currency === 'INR' ? '₹' : ''}${Math.round(Number(n)).toLocaleString('en-IN')}`;

/**
 * Read-only when there's no trip to re-fit. With `tripId` the adjustable
 * categories get sliders and "Generate new" re-selects from options already
 * stored on the version — no provider calls, no model.
 */
export default function BudgetPanel({ budget, verdict, tripId = null, versionNumber = null, onRefit = null }) {
  const [bands, setBands] = useState(null);
  // Sliders start where the plan actually is. The parent re-keys this component
  // per version, so a re-fit re-seeds them without an effect.
  const [targets, setTargets] = useState(() => startingTargets(budget));
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null);

  useEffect(() => {
    if (!tripId) return;
    api(`/api/trips/${tripId}/bands`).then(setBands, () => setBands(null));
  }, [tripId]);

  const dirty = bands && Object.entries(targets).some(([k, v]) => v != null && k !== 'activityCount' && v !== budget[k]);
  const projected = ROWS.reduce((n, [key]) => n + (targets[key] ?? budget[key]), 0);

  const generate = async () => {
    setBusy(true);
    setNote(null);
    try {
      const result = await api(`/api/trips/${tripId}/refit`, {
        method: 'POST',
        body: { targets, expectedVersion: versionNumber },
      });
      onRefit?.(result);
      if (result.unmet?.length) {
        setNote(`Could not reach the target for ${result.unmet.join(', ')} from the options already found.`);
      }
    } catch (e) {
      setNote(e.message);
    } finally {
      setBusy(false);
    }
  };

  const reset = () => setTargets(startingTargets(budget));

  return (
    <aside className="w-full shrink-0 overflow-y-auto border-t border-neutral-200 p-5 lg:w-80 lg:border-l lg:border-t-0 dark:border-neutral-800">
      <p className="text-xs uppercase tracking-wide text-neutral-500">Estimated total</p>
      <p className="mb-1 text-3xl font-semibold tabular-nums">{money(budget.total, budget.currency)}</p>

      {dirty && (
        <p className="text-xs text-neutral-500">
          Targets add up to <span className="tabular-nums">{money(projected, budget.currency)}</span>
        </p>
      )}

      {verdict?.cap != null && (
        <p className={`mt-1 text-xs ${verdict.withinBudget ? 'text-emerald-500' : 'text-amber-500'}`}>
          {verdict.withinBudget
            ? `Within your ${money(verdict.cap, budget.currency)} budget`
            : `Over budget by ${money(verdict.overBy, budget.currency)}`}
        </p>
      )}

      <ul className="mt-5 space-y-4">
        {ROWS.map(([key, name, adjustable]) => {
          const band = bands?.[key];
          const value = targets[key] ?? budget[key];
          return (
            <li key={key}>
              <div className="flex justify-between text-sm">
                <span className="text-neutral-500">{name}</span>
                <span className="tabular-nums">{money(value, budget.currency)}</span>
              </div>

              {adjustable && band && band.max > band.min ? (
                <input
                  type="range"
                  min={band.min}
                  max={band.max}
                  step={Math.max(1, Math.round((band.max - band.min) / 100))}
                  value={Math.min(Math.max(value, band.min), band.max)}
                  onChange={(e) => setTargets((t) => ({ ...t, [key]: Number(e.target.value) }))}
                  className="mt-2 h-1 w-full cursor-pointer appearance-none rounded bg-neutral-200 accent-emerald-500 dark:bg-neutral-800"
                />
              ) : (
                <div className="mt-2 h-1 rounded bg-neutral-100 dark:bg-neutral-900">
                  <div
                    className="h-1 rounded bg-neutral-400 transition-[width] duration-500 dark:bg-neutral-600"
                    style={{ width: `${(budget[key] / Math.max(budget.total, 1)) * 100}%` }}
                  />
                </div>
              )}
            </li>
          );
        })}

        {bands?.activityCount && (
          <li>
            <div className="flex justify-between text-sm">
              <span className="text-neutral-500">Stops per day</span>
              <span className="tabular-nums">{targets.activityCount ?? 'as planned'}</span>
            </div>
            <input
              type="range"
              min={bands.activityCount.min}
              max={bands.activityCount.max}
              value={targets.activityCount ?? Math.ceil(bands.activityCount.max / 2)}
              onChange={(e) => setTargets((t) => ({ ...t, activityCount: Number(e.target.value) }))}
              className="mt-2 h-1 w-full cursor-pointer appearance-none rounded bg-neutral-200 accent-emerald-500 dark:bg-neutral-800"
            />
          </li>
        )}
      </ul>

      {tripId && bands && (
        <div className="mt-5 flex gap-2">
          <button
            onClick={generate}
            disabled={busy}
            className="flex min-h-10 flex-1 items-center justify-center gap-2 rounded-full text-sm font-semibold text-neutral-950 disabled:opacity-50"
            style={{ background: THEME.originGreen }}
          >
            <Wand2 size={14} />
            {busy ? 'Re-fitting…' : 'Generate new'}
          </button>
          <button
            onClick={reset}
            title="Reset sliders"
            className="grid h-10 w-10 place-items-center rounded-full border border-neutral-300 text-neutral-500 dark:border-neutral-700"
          >
            <RotateCcw size={14} />
          </button>
        </div>
      )}

      {note && <p className="mt-3 text-xs text-amber-500">{note}</p>}

      <p className="mt-5 text-xs text-neutral-500">
        Re-fitting trades between options already researched, so it costs nothing and takes no time.
      </p>
      <p className="mt-2 text-xs text-neutral-500">
        Fares and room rates are estimates unless a provider confirmed them.
      </p>
    </aside>
  );
}
