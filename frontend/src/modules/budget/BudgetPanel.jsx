const ROWS = [
  ['intercityTransport', 'Transport'],
  ['accommodation', 'Stays'],
  ['food', 'Food'],
  ['activities', 'Activities'],
  ['localTransport', 'Local travel'],
  ['misc', 'Buffer'],
];

const money = (n, currency) => `${currency === 'INR' ? '₹' : ''}${Number(n).toLocaleString('en-IN')}`;

export default function BudgetPanel({ budget, verdict }) {
  const max = Math.max(...ROWS.map(([k]) => budget[k]), 1);

  return (
    <aside className="w-full shrink-0 border-t border-neutral-800 p-5 lg:w-80 lg:border-l lg:border-t-0">
      <p className="text-xs uppercase tracking-wide text-neutral-500">Estimated total</p>
      <p className="mb-1 text-3xl font-semibold tabular-nums transition-all">{money(budget.total, budget.currency)}</p>

      {verdict?.cap != null && (
        <p className={`mb-4 text-xs ${verdict.withinBudget ? 'text-emerald-400' : 'text-amber-400'}`}>
          {verdict.withinBudget
            ? `Within your ${money(verdict.cap, budget.currency)} budget`
            : `Over budget by ${money(verdict.overBy, budget.currency)}`}
        </p>
      )}

      <ul className="mt-4 space-y-3">
        {ROWS.map(([key, name]) => (
          <li key={key}>
            <div className="flex justify-between text-sm">
              <span className="text-neutral-400">{name}</span>
              <span className="tabular-nums">{money(budget[key], budget.currency)}</span>
            </div>
            <div className="mt-1 h-1 rounded bg-neutral-900">
              <div
                className="h-1 rounded bg-neutral-500 transition-[width] duration-500"
                style={{ width: `${(budget[key] / max) * 100}%` }}
              />
            </div>
          </li>
        ))}
      </ul>

      <p className="mt-5 text-xs text-neutral-600">
        Fares and room rates are estimates unless a provider confirmed them.
      </p>
    </aside>
  );
}
