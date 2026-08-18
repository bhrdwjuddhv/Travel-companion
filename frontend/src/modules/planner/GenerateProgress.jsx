const STEPS = [
  ['resolving', 'Resolving locations'],
  ['researching_transport', 'Researching transport'],
  ['researching_stays', 'Researching stays'],
  ['researching_places', 'Researching places'],
  ['building_itinerary', 'Building itinerary'],
  ['calculating_budget', 'Calculating budget'],
  ['saving', 'Saving'],
];

export default function GenerateProgress({ current, label, error, onRetry }) {
  // Tools fire out of order; the furthest step reached is the honest one.
  const reached = STEPS.findIndex(([id]) => id === current);

  return (
    <div className="mx-auto w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-950/80 p-6">
      <h2 className="mb-1 text-lg font-semibold">{error ? 'That did not work' : 'Planning your trip'}</h2>
      <p className="mb-6 text-sm text-neutral-400">{error?.message ?? label ?? 'Starting...'}</p>

      {!error && (
        <ol className="space-y-2 text-sm">
          {STEPS.map(([id, text], i) => (
            <li key={id} className={`flex items-center gap-3 ${i <= reached ? 'text-neutral-200' : 'text-neutral-600'}`}>
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  i < reached ? 'bg-emerald-500' : i === reached ? 'animate-pulse bg-white' : 'bg-neutral-700'
                }`}
              />
              {text}
            </li>
          ))}
        </ol>
      )}

      {error && (
        <button onClick={onRetry} className="rounded-full bg-white px-5 py-2 text-sm font-medium text-neutral-900">
          {error.recoverable === false ? 'Start over' : 'Try again'}
        </button>
      )}
    </div>
  );
}
