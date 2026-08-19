import { useEffect, useState } from 'react';
import { COLOR_MODE, COLOR_MODE_STORAGE, THEME } from '../constants';

const kebab = (s) => s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
const media = () => window.matchMedia('(prefers-color-scheme: dark)');

/** Publishes theme tokens as CSS custom properties. */
export function applyThemeVars(root = document.documentElement) {
  root.style.setProperty('--origin-green', THEME.originGreen);
  root.style.setProperty('--origin-green-edge', THEME.originGreenEdge);
  for (const [key, value] of Object.entries(THEME.graph)) {
    root.style.setProperty(`--rf-${kebab(key)}`, value);
  }
}

const readPreference = () => localStorage.getItem(COLOR_MODE_STORAGE) || COLOR_MODE;
const resolve = (pref) => (pref === 'system' ? (media().matches ? 'dark' : 'light') : pref);

/**
 * Applies the resolved theme to <html> immediately, before React paints, so
 * there's no flash of the wrong theme on load.
 */
export function initTheme() {
  const mode = resolve(readPreference());
  document.documentElement.dataset.colorMode = mode;
  document.documentElement.classList.toggle('dark', mode === 'dark');
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

  return mode;
}

/** The user's stored choice: 'light' | 'dark' | 'system'. */
export function useThemePreference() {
  const [preference, setPreference] = useState(readPreference);

  const choose = (next) => {
    localStorage.setItem(COLOR_MODE_STORAGE, next);
    setPreference(next);
    const mode = resolve(next);
    document.documentElement.dataset.colorMode = mode;
    document.documentElement.classList.toggle('dark', mode === 'dark');
    window.dispatchEvent(new Event('colormodechange'));
  };

  return [preference, choose];
}
