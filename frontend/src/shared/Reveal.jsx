import { useLayoutEffect, useRef } from 'react';
import { MOTION } from '../constants';

/**
 * Scroll reveal: opacity and a short rise, once, when the element comes into
 * view. The hidden state is applied by this effect rather than in the markup,
 * so if the observer never runs — headless render, old browser, script error —
 * the content is simply visible instead of invisible forever.
 */
export default function Reveal({ as: Tag = 'div', delay = 0, className = '', children, ...rest }) {
  const ref = useRef(null);

  // Layout effect, not an effect: hiding after the browser has painted would
  // show the content and then snatch it back.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    // Already on screen at first paint (the hero): nothing to reveal.
    if (el.getBoundingClientRect().top < window.innerHeight) return;

    el.dataset.reveal = 'pending';
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        el.dataset.reveal = 'in';
        io.disconnect();
      },
      { threshold: 0.2 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <Tag ref={ref} data-reveal="in" className={className} style={{ '--reveal-delay': `${delay * MOTION.staggerMs}ms` }} {...rest}>
      {children}
    </Tag>
  );
}
