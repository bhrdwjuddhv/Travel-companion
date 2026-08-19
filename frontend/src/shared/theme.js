import { useEffect, useState } from 'react';
import { COLOR_MODE, THEME } from '../constants';

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

const resolve = () => (COLOR_MODE === 'system' ? (media().matches ? 'dark' : 'light') : COLOR_MODE);

/**
 * Resolves COLOR_MODE to a concrete 'light' | 'dark' and stamps it on <html>,
 * so React Flow's colorMode and Tailwind's dark: variant always agree — one
 * can't be dark while the other is light.
 */
export function useColorMode() {
  const [mode, setMode] = useState(resolve);

  useEffect(() => {
    document.documentElement.dataset.colorMode = mode;
  }, [mode]);

  useEffect(() => {
    if (COLOR_MODE !== 'system') return;
    const mq = media();
    const onChange = () => setMode(resolve());
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return mode;
}
