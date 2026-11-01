import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Lock } from 'lucide-react';
import HeroPrompt from './HeroPrompt';
import DestinationGrid from './DestinationGrid';
import StoryShelf from './StoryShelf';
import { Section, SectionHeading, PillButton } from './cards.jsx';
import Reveal from '../../shared/Reveal';
import { track } from '../../shared/analytics';
import { FEATURES, HERO, LANDING, STORIES } from '../../constants';

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

  const pickDestination = (text, name) => {
    track('destination tile picked', { destination: name });
    setPromptText(text);
    heroRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  return (
    <div id="top" className="poster relative min-h-screen overflow-x-clip">
      <header className="absolute inset-x-0 top-0 z-50 flex items-center justify-between gap-4 px-6 py-6 text-white md:px-10 md:py-8">
        <a href="#top" className="text-[17px] font-semibold tracking-tight">
          {LANDING.productName}
          <sup className="text-[10px] opacity-70">{LANDING.trademark}</sup>
        </a>
        <PillButton onStart={(o) => go(o)} variant="ghost" className="ui-btn-sm border-white/40 text-white">
          {LANDING.footer.cta}
        </PillButton>
      </header>

      {/* 1 · Hero. The illustration is the whole section; the bar floats on it. */}
      <section
        className="relative flex flex-col items-center justify-center overflow-hidden px-6 pb-20 pt-36 text-center"
        style={{ minHeight: HERO.minHeight }}
      >
        <img
          src={HERO.image}
          alt=""
          aria-hidden="true"
          // The largest thing on the first paint; it should not queue behind
          // the destination photos below the fold.
          fetchPriority="high"
          className="absolute inset-0 h-full w-full object-cover object-center"
        />
        <span className="absolute inset-0" style={{ background: HERO.overlay }} aria-hidden="true" />

        <div ref={heroRef} className="ui-measure relative flex flex-col items-center">
          <Reveal as="h1" className="ui-display max-w-4xl text-white drop-shadow-[0_2px_18px_rgba(10,40,66,0.45)]">
            <span className="block">{LANDING.hero.headline[0]}</span>
            <span className="block opacity-80">{LANDING.hero.headline[1]}</span>
          </Reveal>

          <Reveal delay={2} className="mt-10 w-full max-w-3xl">
            <HeroPrompt value={promptText} onChange={setPromptText} onExtracted={onExtracted} />
          </Reveal>

          <Reveal delay={3} className="on-media mt-8 flex items-center gap-2 opacity-85">
            <Lock size={13} aria-hidden="true" />
            <span className="ui-eyebrow">{LANDING.hero.assurance}</span>
          </Reveal>
        </div>
      </section>

      {/* 2 · Destinations */}
      <Section>
        <SectionHeading
          eyebrow={LANDING.destinations.eyebrow}
          title={LANDING.destinations.title}
          subtitle={LANDING.destinations.subtitle}
          className="mb-12"
        />
        <DestinationGrid onPick={pickDestination} />
        <div className="mt-12 flex justify-center">
          <PillButton onStart={(o) => go(o)}>
            {LANDING.destinations.cta}
            <ArrowRight size={15} />
          </PillButton>
        </div>
      </Section>

      {/* 3 · Stories from people who took the trip */}
      <Section className="overflow-hidden">
        <SectionHeading eyebrow={STORIES.eyebrow} title={STORIES.title} subtitle={STORIES.subtitle} className="mb-14" />
        <StoryShelf />
      </Section>

      <footer className="px-6 pb-12 md:px-10">
        <div className="ui-measure flex flex-wrap items-center justify-between gap-4 border-t border-[var(--c-border)] pt-8">
          <span className="text-[17px] font-semibold tracking-tight">
            {LANDING.productName}
            <sup className="text-[10px] opacity-70">{LANDING.trademark}</sup>
          </span>
          <p className="max-w-[420px] text-[length:var(--type-small)] text-[var(--c-ink-dim)]">{LANDING.footer.note}</p>
        </div>
      </footer>

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
