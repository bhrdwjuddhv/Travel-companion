import { THEME } from '../../constants';

/** A readable panel floating over the pinned video. */
export function Section({ children, className = '', strong = false }) {
  return (
    <section className={`relative z-10 flex min-h-screen items-center justify-center px-5 py-24 ${className}`}>
      <div
        className="w-full max-w-5xl rounded-3xl border border-white/10 p-8 shadow-2xl backdrop-blur-md sm:p-12"
        style={{ background: strong ? THEME.scrimStrong : THEME.scrim }}
      >
        {children}
      </div>
    </section>
  );
}

export const SectionHead = ({ title, sub }) => (
  <header className="mb-8">
    <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl" style={{ color: THEME.textOnMedia }}>
      {title}
    </h2>
    {sub && <p className="mt-2 max-w-2xl text-sm" style={{ color: THEME.textMutedOnMedia }}>{sub}</p>}
  </header>
);

export const FeatureCard = ({ title, body }) => (
  <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
    <h3 className="text-sm font-medium" style={{ color: THEME.textOnMedia }}>{title}</h3>
    <p className="mt-2 text-sm leading-relaxed" style={{ color: THEME.textMutedOnMedia }}>{body}</p>
  </div>
);

export const ModeCard = ({ mode }) => (
  <div className="flex flex-col rounded-2xl border border-white/10 bg-white/5 p-5">
    <span className="text-[11px] uppercase tracking-wider" style={{ color: THEME.originGreen }}>
      {mode.tagline}
    </span>
    <h3 className="mt-1 text-base font-medium" style={{ color: THEME.textOnMedia }}>{mode.name}</h3>
    <p className="mt-2 text-sm leading-relaxed" style={{ color: THEME.textMutedOnMedia }}>{mode.description}</p>
    <ul className="mt-4 space-y-1.5 text-xs" style={{ color: THEME.textMutedOnMedia }}>
      {mode.bullets.map((b) => (
        <li key={b} className="flex items-center gap-2">
          <span className="h-1 w-1 rounded-full" style={{ background: THEME.originGreen }} />
          {b}
        </li>
      ))}
    </ul>
  </div>
);

export const StepCard = ({ index, title, body }) => (
  <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
    <span
      className="grid h-7 w-7 place-items-center rounded-full text-xs font-semibold text-neutral-950"
      style={{ background: THEME.originGreen }}
    >
      {index}
    </span>
    <h3 className="mt-3 text-sm font-medium" style={{ color: THEME.textOnMedia }}>{title}</h3>
    <p className="mt-2 text-sm leading-relaxed" style={{ color: THEME.textMutedOnMedia }}>{body}</p>
  </div>
);

/** The one green button. Reports its centre so the transition can start there. */
export const GreenCta = ({ children, onStart }) => (
  <button
    onClick={(e) => {
      const r = e.currentTarget.getBoundingClientRect();
      onStart({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
    }}
    className="rounded-full px-7 py-3 text-sm font-semibold text-neutral-950 transition hover:brightness-110"
    style={{ background: THEME.originGreen, boxShadow: `0 0 40px ${THEME.originGreenEdge}` }}
  >
    {children}
  </button>
);
