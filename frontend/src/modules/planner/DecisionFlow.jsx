import { THEME } from '../../constants';

/**
 * One decision at a time. Options are already shaped by the server
 * ({ id, title, subtitle, facts, badge }) so this stays stage-agnostic.
 */
export default function DecisionFlow({ decision, onChoose, busy, error }) {
  const { stageLabel, prompt, options, progress } = decision;

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-neutral-800 px-4 py-3 sm:px-5 sm:py-4">
        <div className="flex items-baseline justify-between">
          <span className="text-[11px] uppercase tracking-wider" style={{ color: THEME.originGreen }}>
            {stageLabel}
          </span>
          <span className="text-xs text-neutral-500">
            {progress.done} of {progress.total} decided
          </span>
        </div>
        <div className="mt-2 h-0.5 rounded bg-neutral-800">
          <div
            className="h-0.5 rounded transition-[width] duration-500"
            style={{ width: `${(progress.done / Math.max(progress.total, 1)) * 100}%`, background: THEME.originGreen }}
          />
        </div>
        <h2 className="mt-3 text-sm font-medium text-neutral-100">{prompt}</h2>
      </header>

      {error && (
        <p className="border-b border-amber-500/30 bg-amber-500/10 px-5 py-2 text-xs text-amber-300">
          {error.message} — pick again.
        </p>
      )}

      <div className="flex-1 space-y-3 overflow-y-auto p-4 sm:p-5">
        {options.map((o) => (
          <button
            key={o.id}
            disabled={busy}
            onClick={() => onChoose(o.id)}
            className="w-full rounded-xl border border-neutral-800 bg-neutral-900/60 p-4 text-left transition hover:border-neutral-600 hover:bg-neutral-900 active:border-neutral-500 disabled:opacity-40"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="break-words text-sm font-medium text-neutral-100">{o.title}</p>
                {o.subtitle && <p className="mt-0.5 break-words text-xs text-neutral-500">{o.subtitle}</p>}
              </div>
              {o.badge && (
                <span className="shrink-0 rounded-full bg-neutral-800 px-2 py-0.5 text-[10px] uppercase text-neutral-400">
                  {o.badge}
                </span>
              )}
            </div>
            <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs">
              {o.facts.map((f) => (
                <div key={f.label} className="flex gap-1.5">
                  <dt className="text-neutral-600">{f.label}</dt>
                  <dd className="text-neutral-300">{f.value}</dd>
                </div>
              ))}
            </dl>
          </button>
        ))}
      </div>

      <footer className="border-t border-neutral-800 p-4 sm:p-5">
        <button
          disabled={busy}
          onClick={() => onChoose('auto')}
          className="min-h-11 w-full rounded-full border border-neutral-700 py-2.5 text-sm text-neutral-300 transition hover:bg-neutral-900 disabled:opacity-40"
        >
          {busy ? 'Working...' : 'Let the AI decide this one'}
        </button>
      </footer>
    </div>
  );
}
