import Reveal from '../../shared/Reveal';
import { MapPin } from 'lucide-react';
import { DEST_CARD, LANDING } from '../../constants';

const { destinations: COPY } = LANDING;

/**
 * Six places, one shape. Each card is sheared, so a row of them zigzags
 * instead of sitting square — the picture shears with the card and only the
 * label is turned back upright.
 *
 * Tapping a tile writes its sentence into the hero bar and sends you back up
 * to it: the tile plans nothing on its own, so the user still edits and
 * confirms exactly as if they had typed it.
 */
export default function DestinationGrid({ onPick }) {
  return (
    <ul className="grid list-none grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {COPY.items.map((d, i) => (
        <Reveal as="li" key={d.name} delay={i % 3}>
          <button
            type="button"
            onClick={() => onPick(d.prompt, d.name)}
            aria-label={`Plan a trip to ${d.name}, ${d.region}`}
            className="dest-card group relative block w-full overflow-hidden rounded-[var(--r-lg)] text-left shadow-[var(--c-shadow-raised)]"
            style={{ aspectRatio: DEST_CARD.aspect, '--skew': `${DEST_CARD.skewDeg}deg` }}
          >
            {/* Wider than the card so the shear never pulls a corner off the
                picture, and the overflow above crops it back to the shape. */}
            <img
              src={d.image}
              alt=""
              aria-hidden="true"
              loading="lazy"
              decoding="async"
              className="absolute inset-y-0 -left-[12%] h-full w-[124%] object-cover transition-transform duration-700 ease-out group-hover:scale-105"
            />

            <span className="pointer-events-none absolute inset-0" style={{ background: DEST_CARD.scrim }} aria-hidden="true" />

            <span className="absolute inset-y-0 left-0 flex w-[62%] flex-col justify-end p-6 pb-5">
              <span
                className="dest-upright block text-[length:var(--type-h2)] font-semibold leading-none text-white"
                style={{ fontFamily: 'var(--type-serif-family)' }}
              >
                {d.name}
              </span>
              <span
                className="dest-upright mt-2 flex items-center gap-1.5 text-[length:var(--type-small)] text-white/80">
                <MapPin size={14} aria-hidden="true" />
                {d.region}
              </span>
            </span>
          </button>
        </Reveal>
      ))}
    </ul>
  );
}
