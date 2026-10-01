import { useEffect, useState } from 'react';
import { COLOR_MODE, COLOR_MODE_STORAGE, MOTION, PALETTE, RADIUS, SPACE, TYPE } from '../constants';

const kebab = (s) => s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
const media = () => window.matchMedia('(prefers-color-scheme: dark)');

const publish = (root, prefix, values) => {
  for (const [key, value] of Object.entries(values)) {
    root.style.setProperty(`--${prefix}-${kebab(key)}`, String(value));
  }
};

/**
 * Publishes the tokens from constants.js as CSS custom properties. The colour
 * set is republished whenever the mode changes; everything else is fixed, so
 * it's written once.
 */
export function applyThemeVars(mode, root = document.documentElement) {
  publish(root, 'c', PALETTE[mode] ?? PALETTE.dark);
  publish(root, 'r', RADIUS);
  publish(root, 'sp', SPACE);
  publish(root, 'type', TYPE);
  publish(root, 'motion', MOTION);
}

const readPreference = () => localStorage.getItem(COLOR_MODE_STORAGE) || COLOR_MODE;
const resolve = (pref) => (pref === 'system' ? (media().matches ? 'dark' : 'light') : pref);

const stamp = (mode) => {
  document.documentElement.dataset.colorMode = mode;
  document.documentElement.classList.toggle('dark', mode === 'dark');
  applyThemeVars(mode);
};

/**
 * Applies the resolved theme to <html> immediately, before React paints, so
 * there's no flash of the wrong theme on load.
 */
export function initTheme() {
  stamp(resolve(readPreference()));
}

/** The concrete 'light' | 'dark' currently in force. */
export function useColorMode() {
  const [mode, setMode] = useState(() => resolve(readPreference()));

  useEffect(() => {
    const sync = () => setMode(resolve(readPreference()));
    // Both a system change and our own toggle should land here.
    const mq = media();
    mq.addEventListener('change', sync);
    window.addEventListener('colormodechange', sync);
    return () => {
      mq.removeEventListener('change', sync);
      window.removeEventListener('colormodechange', sync);
    };
  }, []);

  // A system-level change has to repaint the variables too, not just React.
  useEffect(() => applyThemeVars(mode), [mode]);

  return mode;
}

/** The user's stored choice: 'light' | 'dark' | 'system'. */
export function useThemePreference() {
  const [preference, setPreference] = useState(readPreference);

  const choose = (next) => {
    localStorage.setItem(COLOR_MODE_STORAGE, next);
    setPreference(next);
    stamp(resolve(next));
    window.dispatchEvent(new Event('colormodechange'));
  };

  return [preference, choose];
}
