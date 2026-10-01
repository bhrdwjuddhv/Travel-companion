import Reveal from '../../shared/Reveal';
import { BENTO, LANDING } from '../../constants';

const { destinations } = LANDING;

/**
 * Real photography in a bento, uniform radius, spans doing the composition.
 * Tapping a tile writes its sentence into the hero bar — it plans nothing on
 * its own, so the user still edits and confirms exactly as if they'd typed it.
 */
export default function DestinationBento({ onPick }) {
  return (
    <ul className="ui-bento list-none">
      {destinations.items.map((d, i) => (
        <Reveal as="li" key={d.name} delay={i} className={BENTO[d.size] ?? BENTO.sm}>
          <button
            type="button"
            onClick={() => onPick(d.prompt)}
            className="group relative block h-full w-full overflow-hidden rounded-[var(--r-lg)] text-left transition-transform duration-500 ease-out hover:-translate-y-1"
          >
            <img
              src={d.image}
              alt={`${d.name}, ${d.region}`}
              loading="lazy"
              decoding="async"
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
            />
            {/* One gradient for legibility, one flat wash on hover. */}
            <span
              className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent"
              aria-hidden="true"
            />
            <span
              className="pointer-events-none absolute inset-0 bg-black/25 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
              aria-hidden="true"
            />
            <span className="absolute inset-x-0 bottom-0 p-5">
              <span
                className="block text-[length:var(--type-h3)] font-medium text-white"
                style={{ fontFamily: 'var(--type-display-family)' }}
              >
                {d.name}
              </span>
              <span
                className="mt-1 block text-[length:var(--type-micro)] font-medium uppercase text-white/70"
                style={{ letterSpacing: 'var(--type-label-tracking)' }}
              >
                {d.region} · {d.tag}
              </span>
            </span>
          </button>
        </Reveal>
      ))}
    </ul>
  );
}
