import { STEP_LABELS, THEME } from '../../constants';

const ORDER = Object.keys(STEP_LABELS);

export default function BuildingScreen({ current, label, error, onRetry, onBack }) {
  // Tool calls fire out of order; the furthest step reached is the honest one.
  const reached = ORDER.indexOf(current);
  const pct = error ? 100 : ((reached + 1) / ORDER.length) * 100;

  if (error) {
    return (
      <div className="w-full max-w-md text-center">
        <h1 className="text-lg font-semibold text-neutral-100">That did not work</h1>
        <p className="mt-2 text-sm text-neutral-400">{error.message}</p>
        <div className="mt-7 flex justify-center gap-3">
          <button
            onClick={onRetry}
            className="min-h-11 rounded-full px-5 py-2 text-sm font-semibold text-neutral-950"
            style={{ background: THEME.originGreen }}
          >
            {error.recoverable === false ? 'Start over' : 'Retry'}
          </button>
          <button onClick={onBack} className="min-h-11 rounded-full border border-neutral-700 px-5 py-2 text-sm text-neutral-300">
            Change the trip
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-xl px-1">
      <h1 className="text-center text-lg font-semibold text-neutral-100">Building your trip</h1>
      <p className="mt-1 text-center text-sm text-neutral-400">{label ?? 'Starting...'}</p>

      {/* A route drawing itself from the green origin outward. */}
      <div className="relative mt-8 hidden h-10 sm:block">
        <div className="absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 bg-neutral-800" />
        <div
          className="absolute left-0 top-1/2 h-px -translate-y-1/2 transition-[width] duration-700 ease-out"
          style={{ width: `${pct}%`, background: THEME.originGreen }}
        />
        <div className="relative flex justify-between">
          {ORDER.map((key, i) => {
            const done = i < reached;
            const now = i === reached;
            return (
              <span
                key={key}
                className={`h-3 w-3 rounded-full ring-4 ring-neutral-950 transition-all duration-500 ${now ? 'scale-150 animate-pulse' : ''}`}
                style={{
                  background: done || now ? THEME.originGreen : '#262626',
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
              className={`flex items-center gap-3 text-sm transition-colors ${
                done ? 'text-neutral-300' : now ? 'text-neutral-100' : 'text-neutral-600'
              }`}
            >
              <span
                className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border text-[10px] ${
                  now ? 'animate-pulse' : ''
                }`}
                style={{
                  borderColor: done || now ? THEME.originGreen : '#404040',
                  background: done ? THEME.originGreen : 'transparent',
                  color: '#0a0a0a',
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
