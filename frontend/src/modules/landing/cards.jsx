import Reveal from '../../shared/Reveal';
import { BENTO, SECTION_INTRO } from '../../constants';

/**
 * A dark pane so light text reads over the bright clip. The `on-media` class
 * rebinds the ink variables, so everything inside turns light with it.
 */
const pane = (tint) => ({
  background: tint,
  backdropFilter: `blur(${SECTION_INTRO.blurPx}px)`,
  WebkitBackdropFilter: `blur(${SECTION_INTRO.blurPx}px)`,
});

/** A full-height section that rides above the fixed backdrop. */
export function Section({ children, id = undefined, className = '' }) {
  return (
    <section id={id} className={`relative z-10 ui-section ${className}`}>
      <div className="ui-measure">{children}</div>
    </section>
  );
}

export const SectionHeading = ({ eyebrow, title, subtitle, aside = null, className = '' }) => (
  <Reveal
    className={`on-media flex flex-wrap items-end justify-between gap-6 rounded-[var(--r-lg)] px-6 py-7 sm:px-8 ${className}`}
    style={pane(SECTION_INTRO.tint)}
  >
    <div className="flex flex-col gap-3">
      {eyebrow && <span className="ui-eyebrow">{eyebrow}</span>}
      <h2 className="ui-h2">{title}</h2>
      {subtitle && <p className="ui-prose text-[length:var(--type-body)]">{subtitle}</p>}
    </div>
    {aside}
  </Reveal>
);

/**
 * A bento tile. Everything on the landing page is one of these: same glass,
 * same radius, different span.
 */
export const BentoTile = ({ size = 'sm', index = 0, className = '', children }) => (
  <Reveal delay={index} className={BENTO[size] ?? BENTO.sm}>
    <div className={`ui-card on-media flex h-full flex-col p-6 ${className}`} style={pane(SECTION_INTRO.cardTint)}>
      {children}
    </div>
  </Reveal>
);

export const FeatureTile = ({ title, body, size, index }) => (
  <BentoTile size={size} index={index}>
    <h3 className="text-[length:var(--type-h3)] font-medium" style={{ fontFamily: 'var(--type-display-family)' }}>
      {title}
    </h3>
    <p className="ui-prose mt-3 text-[length:var(--type-body)]">{body}</p>
  </BentoTile>
);

export const ModeTile = ({ mode, index }) => (
  <BentoTile size={index === 0 ? 'lg' : 'tall'} index={index}>
    <div className="flex items-baseline justify-between gap-3">
      <h3 className="text-[length:var(--type-h3)] font-medium" style={{ fontFamily: 'var(--type-display-family)' }}>
        {mode.name}
      </h3>
      <span className="ui-eyebrow">{mode.tagline}</span>
    </div>
    <p className="ui-prose mt-3 text-[length:var(--type-small)]">{mode.description}</p>
    <ul className="mt-auto flex flex-col gap-2 pt-4 text-[length:var(--type-small)] text-[var(--c-ink-dim)]">
      {mode.bullets.map((b) => (
        <li key={b} className="flex items-center gap-2.5">
          <span className="h-1 w-1 shrink-0 rounded-full bg-[var(--c-ink-dim)]" />
          {b}
        </li>
      ))}
    </ul>
  </BentoTile>
);

/**
 * The three steps are a real sequence — a trip cannot be edited before it is
 * planned — so this is the one place a number carries information.
 */
export const StepTile = ({ index, title, body }) => (
  <BentoTile size={index === 0 ? 'wide' : 'sm'} index={index}>
    <span
      className="grid h-8 w-8 place-items-center rounded-full text-[length:var(--type-small)] font-medium"
      style={{ background: 'var(--c-accent)', color: 'var(--c-accent-ink)' }}
    >
      {index + 1}
    </span>
    <h3 className="mt-5 text-[length:var(--type-h3)] font-medium" style={{ fontFamily: 'var(--type-display-family)' }}>
      {title}
    </h3>
    <p className="ui-prose mt-2 text-[length:var(--type-small)]">{body}</p>
  </BentoTile>
);

/** The one primary button. Reports its centre so the transition starts there. */
export const PillButton = ({ children, onStart, variant = 'primary', className = '' }) => (
  <button
    onClick={(e) => {
      const r = e.currentTarget.getBoundingClientRect();
      onStart({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
    }}
    className={`ui-btn ${variant === 'primary' ? 'ui-btn-primary' : 'ui-btn-ghost'} ${className}`}
  >
    {children}
  </button>
);
