import { useEffect, useState } from 'react';
import { FEATURES } from '../constants';

const query = `(max-width: ${FEATURES.mobileBreakpointPx - 1}px)`;

/** True on phone-sized screens, kept live so a rotation is picked up. */
export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.matchMedia(query).matches);

  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = (e) => setIsMobile(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return isMobile;
}
