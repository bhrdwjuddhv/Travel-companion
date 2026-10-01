/**
 * One decision at a time. Options are already shaped by the server
 * ({ id, title, subtitle, facts, badge }) so this stays stage-agnostic.
 */
export default function DecisionFlow({ decision, onChoose, busy, error }) {
  const { stageLabel, prompt, options, progress } = decision;

  return (
    <div className="flex h-full flex-col bg-[var(--c-bg-alt)]">
      <header className="border-b border-[var(--c-border)] px-4 py-4 sm:px-5">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[length:var(--type-micro)] font-semibold" style={{ color: 'var(--c-accent-text)' }}>
            {stageLabel}
          </span>
          <span className="text-[length:var(--type-small)] text-[var(--c-ink-muted)]">
            {progress.done} of {progress.total} decided
          </span>
        </div>
        <div className="mt-2.5 h-0.5 rounded bg-[var(--c-surface-hover)]">
          <div
            className="h-0.5 rounded transition-[width] duration-500"
            style={{ width: `${(progress.done / Math.max(progress.total, 1)) * 100}%`, background: 'var(--c-accent)' }}
          />
        </div>
        <h2 className="mt-3.5 text-[length:var(--type-body-lg)] font-medium">{prompt}</h2>
      </header>

      {error && (
        <p
          className="border-b px-5 py-2 text-[length:var(--type-small)]"
          style={{ borderColor: 'var(--c-border)', background: 'var(--c-warn-soft)', color: 'var(--c-warn)' }}
        >
          {error.message} — pick again.
        </p>
      )}

      <div className="flex-1 space-y-3 overflow-y-auto p-4 sm:p-5">
        {options.map((o) => (
          <button
            key={o.id}
            disabled={busy}
            onClick={() => onChoose(o.id)}
            className="ui-card-quiet ui-card-interactive w-full p-4 text-left disabled:opacity-40"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="break-words text-[length:var(--type-body)] font-medium">{o.title}</p>
                {o.subtitle && (
                  <p className="mt-0.5 break-words text-[length:var(--type-small)] text-[var(--c-ink-muted)]">
                    {o.subtitle}
                  </p>
                )}
              </div>
              {o.badge && (
                <span
                  className="shrink-0 rounded-[var(--r-pill)] px-2 py-0.5 text-[length:var(--type-micro)] font-medium"
                  style={{ background: 'var(--c-surface-hover)', color: 'var(--c-ink-muted)' }}
                >
                  {o.badge}
                </span>
              )}
            </div>
            <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[length:var(--type-small)]">
              {o.facts.map((f) => (
                <div key={f.label} className="flex gap-1.5">
                  <dt className="text-[var(--c-ink-dim)]">{f.label}</dt>
                  <dd className="font-medium">{f.value}</dd>
                </div>
              ))}
            </dl>
          </button>
        ))}
      </div>

      <footer className="border-t border-[var(--c-border)] p-4 sm:p-5">
        <button disabled={busy} onClick={() => onChoose('auto')} className="ui-btn ui-btn-ghost w-full">
          {busy ? 'Working…' : 'Let the AI decide this one'}
        </button>
      </footer>
    </div>
  );
}
