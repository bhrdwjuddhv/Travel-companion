import { X } from 'lucide-react';

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
    <div className="border-t border-[var(--c-border)] px-3 py-2">
      <div className="flex items-center gap-2">
        <span
          className="inline-flex min-w-0 items-center gap-2 rounded-[var(--r-pill)] border px-3 py-1 text-[length:var(--type-small)]"
          style={{ borderColor: 'var(--c-accent-edge)', color: 'var(--c-accent-text)' }}
        >
          <span className="opacity-70">Editing</span>
          <span className="truncate text-[var(--c-ink)]">{summarise(context)}</span>
        </span>
        <button
          onClick={onClose}
          aria-label="Stop editing this element"
          className="ml-auto text-[var(--c-ink-muted)] transition-colors hover:text-[var(--c-ink)]"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
