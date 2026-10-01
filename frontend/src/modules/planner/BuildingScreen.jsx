import { STEP_LABELS } from '../../constants';

const ORDER = Object.keys(STEP_LABELS);

export default function BuildingScreen({ current, label, error, onRetry, onBack }) {
  // Tool calls fire out of order; the furthest step reached is the honest one.
  const reached = ORDER.indexOf(current);
  const pct = error ? 100 : ((reached + 1) / ORDER.length) * 100;

  if (error) {
    return (
      <div className="w-full max-w-md text-center">
        <h1 className="text-lg font-semibold">That did not work</h1>
        <p className="mt-2 text-[length:var(--type-body)] text-[var(--c-ink-muted)]">{error.message}</p>
        <div className="mt-7 flex justify-center gap-3">
          <button onClick={onRetry} className="ui-btn ui-btn-primary">
            {error.recoverable === false ? 'Start over' : 'Retry'}
          </button>
          <button onClick={onBack} className="ui-btn ui-btn-ghost">
            Change the trip
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-xl px-1">
      <h1 className="text-center text-lg font-semibold">Building your trip</h1>
      <p className="mt-1.5 text-center text-[length:var(--type-body)] text-[var(--c-ink-muted)]">
        {label ?? 'Starting…'}
      </p>

      {/* A route drawing itself outward from the origin. */}
      <div className="relative mt-9 hidden h-10 sm:block">
        <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-[var(--c-border-strong)]" />
        <div
          className="absolute left-0 top-1/2 h-px -translate-y-1/2 transition-[width] duration-700 ease-out"
          style={{ width: `${pct}%`, background: 'var(--c-accent)' }}
        />
        <div className="relative flex justify-between">
          {ORDER.map((key, i) => {
            const done = i < reached;
            const now = i === reached;
            return (
              <span
                key={key}
                className={`h-3 w-3 rounded-full transition-all duration-500 ${now ? 'scale-150' : ''}`}
                style={{
                  background: done || now ? 'var(--c-accent)' : 'var(--c-surface-hover)',
                  boxShadow: '0 0 0 4px var(--c-bg)',
                  marginTop: '0.875rem',
                }}
              />
            );
          })}
        </div>
      </div>

      <ol className="mt-10 space-y-3">
        {ORDER.map((key, i) => {
          const done = i < reached;
          const now = i === reached;
          return (
            <li
              key={key}
              className="flex items-center gap-3 text-[length:var(--type-body)] transition-colors"
              style={{ color: done || now ? 'var(--c-ink)' : 'var(--c-ink-dim)' }}
            >
              <span
                className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border text-[10px] font-bold ${
                  now ? 'animate-pulse' : ''
                }`}
                style={{
                  borderColor: done || now ? 'var(--c-accent)' : 'var(--c-border-strong)',
                  background: done ? 'var(--c-accent)' : 'transparent',
                  color: 'var(--c-accent-ink)',
                }}
              >
                {done ? '✓' : ''}
              </span>
              {STEP_LABELS[key]}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
