// Serving a Google place photo to the browser.
//
// The Places photo endpoint needs the API key on every request. Handing the
// browser a URL with the key in it would publish the key to everyone who opens
// a trip, so the image is fetched here and streamed on. The browser only ever
// sees a reference it already got from us.
import { ENV, TIMEOUTS_MS, TTL_HOURS } from '../../constants.js';
import { searchAttractions } from './places.service.js';
import { badRequest, HttpError } from '../../shared/errors.js';
import { logger } from '../../shared/logger.js';

const log = logger('places');

// Places photo references look like `places/<id>/photos/<token>`. Anything
// else is not ours to fetch — this endpoint must not become a URL proxy.
const REFERENCE = /^places\/[A-Za-z0-9_-]+\/photos\/[A-Za-z0-9_-]+$/;

/** GET /api/places/photo?ref=places/…/photos/…&w=640 */
export async function photo(req, res) {
  const ref = String(req.query.ref ?? '');
  if (!REFERENCE.test(ref)) throw badRequest('Not a Google place photo reference');

  const width = Math.min(Math.max(Number(req.query.w) || 640, 120), 1600);
  const url = `https://places.googleapis.com/v1/${ref}/media?maxWidthPx=${width}&key=${ENV.GOOGLE_MAPS_API_KEY}`;

  const upstream = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(TIMEOUTS_MS.places) });
  if (!upstream.ok) {
    log.warn(`photo ${ref.slice(-12)} failed: ${upstream.status}`);
    throw new HttpError(502, 'Could not load that photo');
  }

  // Photos are immutable for a given reference, so let the browser and any CDN
  // keep them for as long as the rest of the place data stays fresh.
  res.set({
    'Content-Type': upstream.headers.get('content-type') ?? 'image/jpeg',
    'Cache-Control': `public, max-age=${TTL_HOURS.attraction * 3600}, immutable`,
  });
  res.send(Buffer.from(await upstream.arrayBuffer()));
}

/**
 * GET /api/places/cover?q=Udaipur — one photo to stand at the head of an
 * itinerary.
 *
 * Trips saved before this existed carry no city photo, and regenerating a trip
 * to get a header image would be an absurd trade, so the client asks for one
 * by name. The underlying Places search is cached, so this is usually free.
 */
export async function cover(req, res) {
  const q = String(req.query.q ?? '').trim();
  if (!q || q.length > 120) throw badRequest('Which place?');

  try {
    const places = await searchAttractions(q, { interests: [], limit: 5 });
    const photo = places.find((p) => p.photo?.ref)?.photo ?? null;
    // A day without a cover is a layout the header already handles.
    res.set('Cache-Control', `public, max-age=${TTL_HOURS.attraction * 3600}`);
    res.json({ photo });
  } catch (e) {
    log.warn(`cover for "${q}" failed: ${e.message}`);
    res.json({ photo: null });
  }
}
