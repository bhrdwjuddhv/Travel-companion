import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock } from 'lucide-react';
import VideoBackdrop from './VideoBackdrop';
import HeroPrompt from './HeroPrompt';
import DestinationBento from './DestinationBento';
import { Section, SectionHeading, FeatureTile, ModeTile, StepTile, PillButton } from './cards.jsx';
import Reveal from '../../shared/Reveal';
import { BACKDROP, FEATURES, LANDING, PLANNING_MODES } from '../../constants';

/**
 * The backdrop clip is bright, so hero text rides on its own translucent dark
 * pane. Tint and blur are tokens; the text colour is not touched.
 */
const pane = (weight = 'base') => ({
  background: weight === 'strong' ? BACKDROP.textPaneTintStrong : BACKDROP.textPaneTint,
  backdropFilter: `blur(${BACKDROP.textPaneBlurPx}px)`,
  WebkitBackdropFilter: `blur(${BACKDROP.textPaneBlurPx}px)`,
});

export default function Landing() {
  const navigate = useNavigate();
  const [wipeFrom, setWipeFrom] = useState(null);
  const [promptText, setPromptText] = useState('');
  const heroRef = useRef(null);

  // The transition starts wherever it was triggered and lands on /planning
  // still lit.
  const go = (origin, state = {}) => {
    setWipeFrom(origin);
    setTimeout(() => navigate('/planning', { state: { fromAccent: true, ...state } }), FEATURES.transitionMs);
  };

  // A missing element must not cost the user their trip, so the wipe falls
  // back to the middle of the screen rather than throwing.
  const centreOf = (el) => {
    const r = el?.getBoundingClientRect?.();
    return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  };

  // Extraction done: carry whatever was found into the form. Nothing found
  // (or it failed) just opens the form empty, which is the old path.
  const onExtracted = (fields, formEl) => go(centreOf(formEl), { prefill: fields ?? null });

  const pickDestination = (text) => {
    setPromptText(text);
    heroRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  return (
    <div id="top" className="relative min-h-screen overflow-x-clip bg-[var(--c-bg)] text-[var(--c-ink)]">
      <VideoBackdrop />

      <header className="fixed inset-x-0 top-0 z-50 flex items-center justify-between gap-4 px-6 py-6 md:px-10 md:py-8">
        <a href="#top" className="text-[17px] font-semibold tracking-tight">
          {LANDING.productName}
          <sup className="text-[10px] opacity-70">{LANDING.trademark}</sup>
        </a>
        <PillButton onStart={(o) => go(o)} variant="ghost" className="ui-btn-sm">
          {LANDING.footer.cta}
        </PillButton>
      </header>

      <div className="relative z-10">
        {/* Hero */}
        <section className="relative flex min-h-screen flex-col items-center justify-center px-6 py-28 text-center">
          <div ref={heroRef} className="ui-measure flex flex-col items-center">
            <Reveal as="h1" className="ui-display max-w-4xl rounded-[var(--r-xl)] px-6 py-5" style={pane('strong')}>
              <span className="block">{LANDING.hero.headline[0]}</span>
              <span className="block text-[var(--c-ink-dim)]">{LANDING.hero.headline[1]}</span>
            </Reveal>

            <Reveal
              delay={1}
              className="mt-5 max-w-[620px] rounded-[var(--r-lg)] px-5 py-4 text-[length:var(--type-body)] leading-relaxed"
              style={pane()}
            >
              {LANDING.hero.paragraph.lead}
              <span className="text-[var(--c-ink-dim)]">{LANDING.hero.paragraph.muted}</span>
            </Reveal>

            <Reveal delay={2} className="mt-10 w-full max-w-3xl">
              <HeroPrompt value={promptText} onChange={setPromptText} onExtracted={onExtracted} />
            </Reveal>

            <Reveal
              delay={3}
              className="mt-8 flex items-center gap-2 rounded-[var(--r-pill)] px-4 py-2 text-[var(--c-ink-dim)]"
              style={pane()}
            >
              <Lock size={13} aria-hidden="true" />
              <span className="ui-eyebrow">{LANDING.hero.assurance}</span>
            </Reveal>
          </div>
        </section>

        {/* Destinations */}
        <Section>
          <SectionHeading {...LANDING.destinations} className="mb-12" />
          <DestinationBento onPick={pickDestination} />
        </Section>

        {/* What you get */}
        <Section>
          <SectionHeading eyebrow={LANDING.features.eyebrow} title={LANDING.features.title} className="mb-12" />
          <div className="ui-bento">
            {LANDING.features.items.map((f, i) => (
              <FeatureTile key={f.title} {...f} index={i} />
            ))}
          </div>
        </Section>

        {/* Three planning modes */}
        <Section>
          <SectionHeading
            eyebrow={LANDING.modes.eyebrow}
            title={LANDING.modes.title}
            subtitle={LANDING.modes.subtitle}
            className="mb-12"
          />
          <div className="ui-bento">
            {PLANNING_MODES.map((m, i) => (
              <ModeTile key={m.id} mode={m} index={i} />
            ))}
          </div>
        </Section>

        {/* How it works */}
        <Section>
          <SectionHeading
            eyebrow={LANDING.howItWorks.eyebrow}
            title={LANDING.howItWorks.title}
            className="mb-12"
          />
          <div className="ui-bento">
            {LANDING.howItWorks.steps.map((s, i) => (
              <StepTile key={s.title} index={i} {...s} />
            ))}
          </div>
        </Section>

        {/* Footer CTA */}
        <section className="relative z-10 px-6 py-16 md:px-10">
          <Reveal className="ui-measure">
            <div className="ui-card">
              <div className="bg-gradient-to-b from-white/[0.07] to-transparent px-8 py-16 text-center md:px-16 md:py-24">
                <h2 className="mx-auto max-w-3xl" style={{ fontSize: 'var(--type-h1)' }}>
                  {LANDING.footer.title}
                </h2>
                <p className="mx-auto mt-5 max-w-[540px] text-[length:var(--type-body)] leading-relaxed text-[var(--c-ink-dim)]">
                  {LANDING.footer.subtitle}
                </p>
                <div className="mt-9 flex justify-center">
                  <PillButton onStart={(o) => go(o)}>{LANDING.footer.cta}</PillButton>
                </div>
              </div>
            </div>
          </Reveal>
        </section>

        <footer className="relative z-10 px-6 pb-12 md:px-10">
          <div className="ui-measure flex flex-wrap items-center justify-between gap-4 border-t border-[var(--c-border)] pt-8">
            <span className="text-[17px] font-semibold tracking-tight">
              {LANDING.productName}
              <sup className="text-[10px] opacity-70">{LANDING.trademark}</sup>
            </span>
            <p className="max-w-[420px] text-[length:var(--type-small)] text-[var(--c-ink-dim)]">
              {LANDING.footer.note}
            </p>
          </div>
        </footer>
      </div>

      {wipeFrom && (
        <div className="pointer-events-none fixed inset-0 z-50" style={{ '--wipe-ms': `${FEATURES.transitionMs}ms` }}>
          <span
            className="accent-wipe absolute block h-6 w-6 rounded-full"
            style={{ left: wipeFrom.x, top: wipeFrom.y, background: 'var(--c-accent)' }}
          />
        </div>
      )}
    </div>
  );
}
