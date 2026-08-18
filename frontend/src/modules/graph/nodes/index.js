import { Place, Stay, Day, ActivityNode } from './cards.jsx';

// Kept separate from the components so fast refresh keeps working.
export const nodeTypes = {
  origin: Place,
  destination: Place,
  return: Place,
  stay: Stay,
  day: Day,
  activity: ActivityNode,
};
