import { useEffect, useRef } from 'react';
import { BACKDROP } from '../../constants';

/**
 * One fixed, blurred, looping clip behind the whole page, under a scrim that
 * is the single knob for text readability. The mouse moves it a little; the
 * scroll does not, so there is nothing to scrub and nothing to preload.
 */
export default function VideoBackdrop() {
  const videoRef = useRef(null);

  // Lerped mouse parallax. The loop owns the whole transform so the base
  // scale can't fight the offset, and it parks itself once it settles.
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let targetX = 0;
    let targetY = 0;
    let x = 0;
    let y = 0;
    let raf = 0;

    const tick = () => {
      x += (targetX - x) * BACKDROP.parallaxEase;
      y += (targetY - y) * BACKDROP.parallaxEase;
      el.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${BACKDROP.scale})`;
      if (Math.abs(targetX - x) < 0.05 && Math.abs(targetY - y) < 0.05) {
        raf = 0;
        return;
      }
      raf = requestAnimationFrame(tick);
    };

    const onMove = (e) => {
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      targetX = ((e.clientX - cx) / cx) * BACKDROP.parallaxPx;
      targetY = ((e.clientY - cy) / cy) * BACKDROP.parallaxPx;
      if (!raf) raf = requestAnimationFrame(tick);
    };

    window.addEventListener('mousemove', onMove);
    return () => {
      window.removeEventListener('mousemove', onMove);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-0 overflow-hidden bg-black">
      <video
        ref={videoRef}
        src={BACKDROP.video}
        autoPlay
        muted
        loop
        playsInline
        // Decorative: it carries no information the copy doesn't.
        aria-hidden="true"
        className="block h-full w-full object-cover"
        style={{
          filter: `blur(${BACKDROP.blurPx}px)`,
          transform: `translate3d(0, 0, 0) scale(${BACKDROP.scale})`,
          willChange: 'transform',
        }}
      />
      <div className="pointer-events-none absolute inset-0" style={{ background: 'var(--c-scrim)' }} />
    </div>
  );
}
