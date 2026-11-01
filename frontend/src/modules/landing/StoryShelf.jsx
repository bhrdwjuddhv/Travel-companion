import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { SHELF, STORIES } from '../../constants';

const { items, hint } = STORIES;
const N = items.length;
const TOTAL = N * SHELF.copies;

const smoothstep = (x) => x * x * (3 - 2 * x);
const wrapIndex = (i, n) => ((i % n) + n) % n;

/**
 * How far a book sits from the centre, in shelf units. Within one step of the
 * middle it eases, so the opened book pushes its neighbours apart by exactly
 * half its extra width on each side — and because the curve is continuous, a
 * half-finished move slides everything rather than jumping it.
 */
const spread = (r) => (Math.abs(r) < 1 ? (r + Math.sin(Math.PI * r) / Math.PI) / 2 : Math.sign(r) * 0.5);

/** The shelf height, and every other dimension derived from it. */
const measure = () => {
  const W = window.innerWidth;
  const H =
    W < SHELF.mobileAtPx
      ? Math.min(SHELF.mobileHeightVw * W, SHELF.mobileHeightVh * window.innerHeight)
      : Math.min(SHELF.heightVw * W, SHELF.heightVh * window.innerHeight);
  return { W, H, ws: H * SHELF.spineRatio, d: H * SHELF.coverRatio, gap: H * SHELF.gapRatio };
};

/**
 * A shelf of books, spine out, with one pulled from the row and turned a
 * quarter turn so its cover faces you.
 *
 * Each book is a real cuboid: a narrow spine on the front, the cover on the
 * right-hand side. Nothing fades and nothing is swapped — the box turns, and
 * which face you see follows from that. One animation frame writes every
 * transform straight to the nodes, so React never renders per frame.
 */
export default function StoryShelf() {
  const navigate = useNavigate();
  const [dim, setDim] = useState(measure);
  const [active, setActive] = useState(0);
  const [dir, setDir] = useState(1);

  const books = useRef([]);
  const s = useRef(0); // where the shelf is
  const target = useRef(0); // where it is heading
  const lifts = useRef(new Float32Array(TOTAL));
  const hover = useRef(-1);
  const tilt = useRef(0);
  const drag = useRef(null);
  const dragged = useRef(false);
  const settle = useRef(0);
  const idleMs = useRef(0);
  const paused = useRef(false);

  useEffect(() => {
    const onResize = () => setDim(measure());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const layout = useCallback((at) => {
    const { W, H, ws, d, gap } = dim;
    const cull = W / 2 + SHELF.cullAtCovers * d;

    for (let v = 0; v < TOTAL; v += 1) {
      const el = books.current[v];
      if (!el) continue;

      let r = wrapIndex(v - at, TOTAL);
      if (r > TOTAL / 2) r -= TOTAL;

      const x = r * (ws + gap) + (d - ws + 1.6 * gap) * spread(r);
      if (Math.abs(x) > cull) {
        el.style.visibility = 'hidden';
        continue;
      }
      el.style.visibility = 'visible';

      // 1 when the book faces you, 0 while it stands in the row.
      const open = smoothstep(Math.max(0, 1 - Math.abs(r)));
      const lift = lifts.current[v];

      el.style.transform =
        `translate3d(${x}px, ${-open * SHELF.riseRatio * H - lift * SHELF.hoverRiseRatio * H}px, ` +
        `${open * SHELF.towardsViewer * H}px) rotateZ(${SHELF.leanDeg * open}deg) ` +
        `rotateY(${-90 * open + tilt.current * open}deg)`;
      el.style.zIndex = String(Math.round(100 - Math.abs(r) * 4));

      const [spine, cover] = el.children;
      spine.style.setProperty('--shade', String(open * SHELF.shadeSpine));
      cover.style.setProperty('--shade', String((1 - open) * SHELF.shadeCover));
    }
  }, [dim]);

  // The one loop: a spring chasing the chosen book, the hover lifts easing
  // behind it, and the shelf browsing itself when nobody is touching it.
  useEffect(() => {
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;
    let last = performance.now();
    let shown = -1;

    const frame = (now) => {
      const dt = Math.min(50, now - last) / 1000;
      last = now;

      const travel = target.current - s.current;
      if (still) {
        s.current = target.current;
      } else {
        const k = drag.current ? SHELF.dragSpring : SHELF.spring;
        s.current = Math.abs(travel) < SHELF.settleAt ? target.current : s.current + travel * (1 - Math.exp(-k * dt));

        // It browses itself, but only once it has arrived and nobody is on it.
        idleMs.current = paused.current ? 0 : idleMs.current + dt * 1000;
        if (idleMs.current > SHELF.autoplayMs && Math.abs(travel) < SHELF.settleAt) {
          target.current = Math.round(target.current) + 1;
          idleMs.current = 0;
          setDir(1);
        }
      }

      const ease = still ? 1 : 1 - Math.exp(-12 * dt);
      for (let v = 0; v < TOTAL; v += 1) {
        lifts.current[v] += ((hover.current === v ? 1 : 0) - lifts.current[v]) * ease;
      }

      layout(s.current);

      const at = wrapIndex(Math.round(s.current), N);
      if (at !== shown) {
        shown = at;
        setActive(at);
      }

      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [layout]);

  /** Any deliberate move also stops the shelf browsing on its own for a while. */
  const moveTo = useCallback((next) => {
    setDir(Math.sign(next - target.current) || 1);
    target.current = next;
    idleMs.current = -SHELF.resumeAfterMs;
  }, []);

  const nudge = useCallback((by) => moveTo(Math.round(target.current) + by), [moveTo]);

  const open = (id) => navigate(`/stories/${id}`);

  /** Where a book sits right now, relative to the centre. */
  const relative = (v) => {
    let r = wrapIndex(v - s.current, TOTAL);
    if (r > TOTAL / 2) r -= TOTAL;
    return r;
  };

  // Click the book that is already turned out and it opens; click any other
  // and the shelf brings it round first.
  const onBookClick = (v, i) => {
    if (dragged.current) return;
    const r = relative(v);
    if (Math.abs(r) < 0.5) open(items[i].id);
    else moveTo(Math.round(target.current + r));
  };

  const onPointerDown = (e) => {
    drag.current = { x: e.clientX, from: target.current };
    dragged.current = false;
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e) => {
    const { W, ws, gap } = dim;
    // A gentle lean towards the pointer, but only once the shelf has settled.
    tilt.current = Math.abs(target.current - s.current) < 0.3 ? ((e.clientX - W / 2) / W) * SHELF.tiltDeg * 2 : 0;

    if (!drag.current) return;
    const dx = e.clientX - drag.current.x;
    if (!dragged.current && Math.abs(dx) < SHELF.dragThresholdPx) return;
    dragged.current = true;
    target.current = drag.current.from - dx / (ws + gap);
    idleMs.current = -SHELF.resumeAfterMs;
  };

  const onPointerUp = () => {
    if (dragged.current) moveTo(Math.round(target.current));
    drag.current = null;
    // The click that ends a drag fires after this, so clear the flag behind it.
    setTimeout(() => {
      dragged.current = false;
    }, 0);
  };

  // Only a sideways wheel moves the shelf. Hijacking the vertical one would
  // trap the page, and the page is what the user was scrolling.
  const onWheel = (e) => {
    if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
    const { ws, gap } = dim;
    target.current += (e.deltaX / (ws + gap)) * 0.5;
    idleMs.current = -SHELF.resumeAfterMs;
    clearTimeout(settle.current);
    settle.current = setTimeout(() => moveTo(Math.round(target.current)), SHELF.wheelSettleMs);
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowLeft') nudge(-1);
    else if (e.key === 'ArrowRight') nudge(1);
    else if (e.key === 'Enter') open(items[active].id);
    else return;
    e.preventDefault();
  };

  const story = items[active];
  const { H, ws, d } = dim;
  const face = { height: H, top: -H / 2 };

  return (
    <div className="flex flex-col items-center">
      <div
        className="shelf-stage w-full select-none"
        style={{ height: H * 1.42, '--shelf-perspective': `${SHELF.perspectivePx}px` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerEnter={() => {
          paused.current = true;
        }}
        onPointerLeave={() => {
          paused.current = false;
          hover.current = -1;
          tilt.current = 0;
          onPointerUp();
        }}
        onWheel={onWheel}
        onKeyDown={onKeyDown}
        tabIndex={0}
        role="listbox"
        aria-label="Trip stories"
        aria-activedescendant={`story-${story.id}`}
      >
        <div className="shelf-rail">
          {Array.from({ length: TOTAL }, (_, v) => {
            const i = v % N;
            const st = items[i];
            return (
              <button
                key={v}
                id={v < N ? `story-${st.id}` : undefined}
                ref={(el) => {
                  books.current[v] = el;
                }}
                type="button"
                role="option"
                aria-selected={i === active}
                aria-label={`${st.title}, ${st.place}`}
                aria-hidden={v >= N}
                tabIndex={-1}
                className="shelf-book"
                onClick={() => onBookClick(v, i)}
                onPointerEnter={() => {
                  hover.current = v;
                }}
              >
                <span
                  className="shelf-face shelf-spine"
                  style={{ ...face, width: ws, left: -ws / 2, transform: `translateZ(${d / 2}px)`, background: st.spine }}
                >
                  <span className="shelf-spine-rule" />
                  <span className="shelf-spine-title">{st.title}</span>
                  <span className="shelf-spine-rule" />
                  <span className="shelf-spine-foot">{st.place.slice(0, 3).toUpperCase()}</span>
                </span>

                <span
                  className="shelf-face shelf-cover"
                  style={{
                    ...face,
                    width: d,
                    left: -d / 2,
                    transform: `rotateY(90deg) translateZ(${ws / 2}px)`,
                    background: st.spine,
                  }}
                >
                  <img src={st.cover} alt="" aria-hidden="true" className="h-full w-full object-cover" loading="lazy" />
                  <span
                    className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-4 text-left"
                    aria-hidden="true"
                  >
                    <span
                      className="block text-[length:var(--type-h3)] font-medium leading-tight text-white"
                      style={{ fontFamily: 'var(--type-display-family)' }}
                    >
                      {st.title}
                    </span>
                    <span className="mt-1 block text-[length:var(--type-micro)] uppercase tracking-[0.12em] text-white/70">
                      {st.place}
                    </span>
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* The shelf itself: one rule the books appear to stand on. */}
      <div
        className="h-px w-full max-w-2xl"
        style={{ background: 'linear-gradient(90deg, transparent, var(--c-border-strong), transparent)' }}
        aria-hidden="true"
      />

      <div className="shelf-caption mt-8 w-full max-w-xl text-center" aria-live="polite">
        {/* Keyed so the slide replays, and it arrives from the way it travelled. */}
        <div key={story.id} style={{ '--caption-from': `${dir * 105}%` }}>
          <h3 className="ui-h2" style={{ fontSize: 'var(--type-h3)' }}>
            {story.title}
          </h3>
          <p className="ui-eyebrow mt-2 block uppercase">
            {story.author} · {story.meta}
          </p>
          <p className="ui-prose mx-auto mt-4 text-[length:var(--type-body)]">{story.excerpt}</p>
        </div>
      </div>

      <div className="mt-8 flex items-center gap-3">
        <button type="button" onClick={() => nudge(-1)} aria-label="Previous story" className="ui-pill">
          <ArrowLeft size={15} />
        </button>
        <button type="button" onClick={() => open(story.id)} className="ui-pill">
          Read this one
        </button>
        <button type="button" onClick={() => nudge(1)} aria-label="Next story" className="ui-pill">
          <ArrowRight size={15} />
        </button>
      </div>

      <p className="ui-eyebrow mt-4 uppercase">{hint}</p>
    </div>
  );
}
