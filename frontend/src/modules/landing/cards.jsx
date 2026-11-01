import Reveal from '../../shared/Reveal';

/** A section of the page, gutters and measure handled. */
export function Section({ children, id = undefined, className = '' }) {
  return (
    <section id={id} className={`relative z-10 ui-section ${className}`}>
      <div className="ui-measure">{children}</div>
    </section>
  );
}

/**
 * Centred, the way a poster sets a heading. A title given as a pair puts its
 * second half in the accent hand.
 */
export const SectionHeading = ({ eyebrow, title, subtitle, className = '' }) => {
  const [plain, script] = Array.isArray(title) ? title : [title, null];
  return (
    <Reveal className={`flex flex-col items-center gap-4 text-center ${className}`}>
      {eyebrow && <span className="poster-eyebrow">{eyebrow}</span>}
      <h2 className="ui-h2">
        {plain} {script && <span className="poster-script">{script}</span>}
      </h2>
      {subtitle && <p className="ui-prose text-[length:var(--type-body)]">{subtitle}</p>}
    </Reveal>
  );
};

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
