import { useEffect, useRef, useState } from 'react';
import { IMAGE_SEQUENCE as SEQ, THEME } from '../../constants';

const frameUrl = (i) =>
  `${SEQ.path}/${SEQ.filePattern.replace(/#+/, (h) => String(i).padStart(h.length, '0'))}`;

/**
 * Pinned full-viewport canvas behind the whole landing page. Frame index is
 * driven by *document* scroll, so the last frame lands exactly at the bottom
 * of the page — page height sets the pace.
 */
export default function ScrollSequence() {
  const canvasRef = useRef(null);
  const framesRef = useRef([]);
  const [loaded, setLoaded] = useState(0);

  const startAt = Math.min(SEQ.minFramesToStart, SEQ.frameCount);
  const ready = loaded >= startAt;

  useEffect(() => {
    let done = 0;
    framesRef.current = Array.from({ length: SEQ.frameCount }, (_, k) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = img.onerror = () => setLoaded((done += 1));
      img.src = frameUrl(SEQ.startIndex + k);
      return img;
    });
  }, []);

  useEffect(() => {
    if (!ready) return;
    let raf = 0;

    const draw = (img) => {
      const canvas = canvasRef.current;
      if (!canvas || !img?.naturalWidth) return;
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      // object-fit: cover
      const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
      const dw = img.naturalWidth * scale;
      const dh = img.naturalHeight * scale;
      const ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
    };

    const render = () => {
      raf = 0;
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      const p = scrollable > 0 ? Math.min(1, Math.max(0, window.scrollY / scrollable)) : 0;
      draw(framesRef.current[Math.round(p * (SEQ.frameCount - 1))]);
    };

    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(render);
    };

    render();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [ready]);

  return (
    <div className="fixed inset-0 z-0" aria-hidden="true" style={{ background: '#09090b' }}>
      <canvas ref={canvasRef} className="block h-full w-full" />
      {!ready && (
        <div
          className="absolute inset-0 grid place-items-center text-sm"
          style={{ color: THEME.textMutedOnMedia }}
        >
          Loading {loaded}/{startAt}
        </div>
      )}
    </div>
  );
}
