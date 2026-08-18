import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ScrollSequence from './ScrollSequence';
import { Section, SectionHead, FeatureCard, ModeCard, StepCard, GreenCta } from './cards.jsx';
import { LANDING, PLANNING_MODES, THEME, FEATURES, IMAGE_SEQUENCE } from '../../constants';

export default function Landing() {
  const navigate = useNavigate();
  const [wipeFrom, setWipeFrom] = useState(null);

  // The transition starts at the CTA and lands on /planning still green.
  const start = (origin) => {
    setWipeFrom(origin);
    setTimeout(() => navigate('/planning', { state: { fromGreen: true } }), FEATURES.transitionMs);
  };

  return (
    <div className="relative" style={{ minHeight: `${IMAGE_SEQUENCE.pageMinHeightVh}vh` }}>
      <ScrollSequence />

      {/* Hero */}
      <Section strong>
        <p className="text-xs uppercase tracking-[0.2em]" style={{ color: THEME.originGreen }}>
          {LANDING.productName}
        </p>
        <h1
          className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight sm:text-6xl"
          style={{ color: THEME.textOnMedia }}
        >
          {LANDING.hero.headline}
        </h1>
        <p className="mt-5 max-w-xl text-base leading-relaxed" style={{ color: THEME.textMutedOnMedia }}>
          {LANDING.hero.sub}
        </p>
        <div className="mt-9">
          <GreenCta onStart={start}>{LANDING.hero.cta}</GreenCta>
        </div>
      </Section>

      {/* Features */}
      <Section>
        <SectionHead title={LANDING.features.title} />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {LANDING.features.items.map((f) => (
            <FeatureCard key={f.title} {...f} />
          ))}
        </div>
      </Section>

      {/* Three planning modes */}
      <Section>
        <SectionHead title={LANDING.modes.title} sub={LANDING.modes.sub} />
        <div className="grid gap-4 lg:grid-cols-3">
          {PLANNING_MODES.map((m) => (
            <ModeCard key={m.id} mode={m} />
          ))}
        </div>
      </Section>

      {/* How it works */}
      <Section>
        <SectionHead title={LANDING.howItWorks.title} />
        <div className="grid gap-4 sm:grid-cols-3">
          {LANDING.howItWorks.steps.map((s, i) => (
            <StepCard key={s.title} index={i + 1} {...s} />
          ))}
        </div>
      </Section>

      {/* Footer CTA */}
      <Section strong>
        <div className="flex flex-col items-start gap-7">
          <h2
            className="max-w-2xl text-2xl font-semibold tracking-tight sm:text-4xl"
            style={{ color: THEME.textOnMedia }}
          >
            {LANDING.footer.headline}
          </h2>
          <GreenCta onStart={start}>{LANDING.footer.cta}</GreenCta>
        </div>
      </Section>

      {wipeFrom && (
        <div className="pointer-events-none fixed inset-0 z-50" style={{ '--wipe-ms': `${FEATURES.transitionMs}ms` }}>
          <span
            className="green-wipe absolute block h-6 w-6 rounded-full"
            style={{ left: wipeFrom.x, top: wipeFrom.y, background: THEME.originGreen }}
          />
        </div>
      )}
    </div>
  );
}
