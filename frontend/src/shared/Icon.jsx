import { createElement } from 'react';
import { iconFor } from './icons';

/**
 * One sticker, by semantic name.
 *
 * Call sites say `<Icon name="train" />` rather than looking the component up
 * themselves: resolving a component inside a render body gives it a new
 * identity on every pass, which React treats as a different component and
 * remounts. Doing the lookup here keeps that in one place.
 */
export default function Icon({ name, size = 18, ...rest }) {
  return createElement(iconFor(name), { size, ...rest });
}
