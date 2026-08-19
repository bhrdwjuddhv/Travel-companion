import { X } from 'lucide-react';
import { THEME } from '../../constants';

const money = (n) => `₹${Number(n).toLocaleString('en-IN')}`;

/** One-line summary of whatever the user clicked the pencil on. */
function summarise({ nodeType, data }) {
  if (nodeType === 'stay') return `${data.name} · ${money(data.pricePerNight)}/night`;
  if (nodeType === 'activity') return `${data.name}${data.ticketCost ? ` · ${money(data.ticketCost)}` : ''}`;
  if (nodeType === 'day') return `Day ${data.dayNumber} · ${data.destination}`;
  return data.place ?? data.name ?? nodeType;
}

export default function EditContextChip({ context, onClose }) {
  if (!context) return null;

  return (
    <div className="border-t border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex items-center gap-2">
        <span
          className="inline-flex min-w-0 items-center gap-2 rounded-full border px-3 py-1 text-xs"
          style={{ borderColor: THEME.originGreenEdge, color: THEME.originGreen }}
        >
          <span className="uppercase tracking-wide opacity-70">Editing</span>
          <span className="truncate text-neutral-700 dark:text-neutral-200">{summarise(context)}</span>
        </span>
        <button onClick={onClose} className="ml-auto text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200">
          <X size={14} />
        </button>
      </div>

      <p className="mt-3 text-xs text-neutral-500">
        AI chat editing is not wired up yet — this chip is the hook it will attach to. For now, use the dropdowns on
        the node itself in Semi mode.
      </p>
    </div>
  );
}
