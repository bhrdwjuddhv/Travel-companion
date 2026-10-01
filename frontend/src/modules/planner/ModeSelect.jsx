import { PLANNING_MODES } from '../../constants';

export default function ModeSelect({ onSelect, onBack }) {
  return (
    <div className="w-full max-w-5xl px-1">
      <h1 className="ui-h2">How do you want to plan?</h1>
      <p className="mt-3 text-[length:var(--type-body)] text-[var(--c-ink-muted)]">
        All three produce the same editable plan — only how much you decide changes.
      </p>

      <div className="mt-8 grid gap-4 lg:grid-cols-3">
        {PLANNING_MODES.map((mode) => (
          <button
            key={mode.id}
            onClick={() => onSelect(mode.id)}
            className="ui-card ui-card-interactive group flex flex-col p-5 text-left"
          >
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-[length:var(--type-h3)] font-semibold">{mode.name}</h2>
              <span className="ui-eyebrow">{mode.tagline}</span>
            </div>
            <p className="mt-2 text-[length:var(--type-body)] leading-relaxed text-[var(--c-ink-muted)]">
              {mode.description}
            </p>
            <ul className="mt-4 space-y-2 text-[length:var(--type-small)] text-[var(--c-ink-muted)]">
              {mode.bullets.map((b) => (
                <li key={b} className="flex items-center gap-2.5">
                  <span className="h-1 w-1 shrink-0 rounded-full bg-[var(--c-ink-dim)]" />
                  {b}
                </li>
              ))}
            </ul>
            <span
              className="mt-6 text-[length:var(--type-small)] font-medium text-[var(--c-ink)] transition-opacity duration-200 lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-visible:opacity-100"
            >
              Choose {mode.name} &rarr;
            </span>
          </button>
        ))}
      </div>

      <button onClick={onBack} className="ui-btn ui-btn-sm mt-8 text-[var(--c-ink-muted)]">
        &larr; Back
      </button>
    </div>
  );
}
