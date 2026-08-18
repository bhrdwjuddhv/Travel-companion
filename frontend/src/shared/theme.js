import { THEME } from '../constants';

const kebab = (s) => s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

/**
 * Publishes theme tokens as CSS custom properties so stylesheets can restyle
 * third-party chrome (React Flow) without duplicating any colour value.
 */
export function applyThemeVars(root = document.documentElement) {
  root.style.setProperty('--origin-green', THEME.originGreen);
  root.style.setProperty('--origin-green-edge', THEME.originGreenEdge);
  for (const [key, value] of Object.entries(THEME.graph)) {
    root.style.setProperty(`--rf-${kebab(key)}`, value);
  }
}
