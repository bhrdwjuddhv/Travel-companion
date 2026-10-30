import { useState } from 'react';
import { API_BASE_URL, PLACE_PHOTO } from '../constants';
import Icon from './Icon';

/**
 * A place's photograph, fetched through our own route so the Google key never
 * reaches the browser. Lazy by default: an itinerary is a long column and most
 * of its pictures are below the fold.
 *
 * With no photo — or a failed one — a clay well with the place's own icon
 * stands in, which reads as deliberate rather than broken.
 */
export default function PlacePhoto({ photo, alt, icon = 'place', className = '', width = PLACE_PHOTO.width }) {
  const [failed, setFailed] = useState(false);
  const src = photo?.ref
    ? `${API_BASE_URL}${PLACE_PHOTO.path}?ref=${encodeURIComponent(photo.ref)}&w=${width}`
    : null;

  if (!src || failed) {
    return (
      <div className={`clay-photo grid place-items-center ${className}`} role="img" aria-label={alt}>
        <Icon name={icon} size={30} />
      </div>
    );
  }

  return (
    <div className={`clay-photo ${className}`}>
      <img src={src} alt={alt} loading="lazy" decoding="async" onError={() => setFailed(true)} />
      {photo.attribution && (
        // Google requires the photographer to be credited wherever the photo runs.
        <span
          className="absolute inset-x-0 bottom-0 truncate bg-black/45 px-1.5 py-0.5 text-[9px] text-white/90"
          title={`Photo: ${photo.attribution}`}
        >
          {photo.attribution}
        </span>
      )}
    </div>
  );
}
