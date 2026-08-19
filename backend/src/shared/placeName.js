// Google Places genuinely returns POIs called "Mehrangarh Fort Review" and
// "Mehrangarh Fort Way" beside the real thing, so cleaning names isn't enough —
// near-duplicates have to be rejected too.

const LISTICLE = '(things to do in|top \\d+[^:]*? in|best [^:]*? in|places to visit in)';
// "Things to do in Jaipur: City Palace" -> the bit after the colon is the place.
const LEADING_WITH_COLON = new RegExp(`^\\s*${LISTICLE}\\b[^:]*:\\s*`, 'i');
const LEADING = new RegExp(`^\\s*${LISTICLE}\\s+`, 'i');
const TRAILING_REVIEW = /[\s,–—-]*\b(reviews?|ratings?|photos?|timings?|entry fee)\b\s*$/i;
const SITE_TAIL = /\s*\|.*$/; // "Name | Tripadvisor"

/** Strips search-result cruft. Conservative: only patterns that are always junk. */
export function normalizePlaceName(raw) {
  let name = String(raw ?? '').trim();
  name = name.replace(SITE_TAIL, '');
  name = name.replace(LEADING_WITH_COLON, '').replace(LEADING, '');
  // "Fort Review Reviews" -> run until stable, but never strip the whole name.
  for (let i = 0; i < 3; i += 1) {
    const next = name.replace(TRAILING_REVIEW, '').trim();
    if (next === name || !next) break;
    name = next;
  }
  return name.replace(/\s{2,}/g, ' ').trim() || String(raw ?? '').trim();
}

const key = (name) => normalizePlaceName(name).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/**
 * Tracks what's already in the itinerary and rejects anything that repeats it.
 * "Mehrangarh Fort Way" and "Mehrangarh Fort Sunrise Point" are both just the
 * fort again, so a candidate that extends a name already used is a duplicate.
 */
export function placeDeduper() {
  const used = new Set();
  const ids = new Set();

  return {
    /** true if the candidate is new (and records it), false if it repeats one. */
    accept({ name, placeId = null }) {
      const k = key(name);
      if (!k) return false;
      if (placeId && ids.has(placeId)) return false;
      for (const seen of used) {
        if (k === seen || k.startsWith(`${seen} `) || seen.startsWith(`${k} `)) return false;
      }
      used.add(k);
      if (placeId) ids.add(placeId);
      return true;
    },
  };
}
