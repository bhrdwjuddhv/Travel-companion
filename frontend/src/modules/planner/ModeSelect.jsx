import { PLANNING_MODES, THEME } from '../../constants';

export default function ModeSelect({ onSelect, onBack }) {
  return (
    <div className="w-full max-w-4xl">
      <h1 className="text-2xl font-semibold tracking-tight text-neutral-100">How do you want to plan?</h1>
      <p className="mt-2 text-sm text-neutral-400">
        All three produce the same editable plan — only how much you decide changes.
      </p>

      <div className="mt-8 grid gap-4 lg:grid-cols-3">
        {PLANNING_MODES.map((mode) => (
          <button
            key={mode.id}
            onClick={() => onSelect(mode.id)}
            className="group flex flex-col rounded-2xl border border-neutral-800 bg-neutral-900/60 p-5 text-left transition hover:border-neutral-600 hover:bg-neutral-900"
          >
            <span className="text-[11px] uppercase tracking-wider" style={{ color: THEME.originGreen }}>
              {mode.tagline}
            </span>
            <h2 className="mt-1 text-base font-medium text-neutral-100">{mode.name}</h2>
            <p className="mt-2 text-sm leading-relaxed text-neutral-400">{mode.description}</p>
            <ul className="mt-4 space-y-1.5 text-xs text-neutral-500">
              {mode.bullets.map((b) => (
                <li key={b} className="flex items-center gap-2">
                  <span className="h-1 w-1 rounded-full" style={{ background: THEME.originGreen }} />
                  {b}
                </li>
              ))}
            </ul>
            <span
              className="mt-5 text-xs font-medium opacity-0 transition group-hover:opacity-100"
              style={{ color: THEME.originGreen }}
            >
              Choose {mode.name} &rarr;
            </span>
          </button>
        ))}
      </div>

      <button onClick={onBack} className="mt-8 text-sm text-neutral-500 hover:text-neutral-300">
        &larr; Back
      </button>
    </div>
  );
}
