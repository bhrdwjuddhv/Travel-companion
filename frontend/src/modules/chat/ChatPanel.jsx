import { useEffect, useRef, useState } from 'react';
import { CornerDownLeft, Sparkles, X } from 'lucide-react';
import EditContextChip from './EditContextChip';
import { api } from '../../shared/api';
import { THEME } from '../../constants';

/**
 * Editing by conversation. The chip says which element the message is about;
 * the server decides whether it's a question or a change.
 */
export default function ChatPanel({ tripId, context, onClearContext, onApplied, onClose }) {
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, busy]);

  const send = async (e) => {
    e.preventDefault();
    const message = draft.trim();
    if (!message || busy) return;

    setMessages((m) => [...m, { role: 'user', text: message }]);
    setDraft('');
    setBusy(true);

    try {
      const result = await api(`/api/trips/${tripId}/chat`, {
        method: 'POST',
        body: { message, editContext: context },
      });
      setMessages((m) => [...m, { role: 'assistant', text: result.summary, changed: result.changed }]);
      // Only a real change repaints the plan.
      if (result.changed) {
        onApplied(result);
        onClearContext();
      }
    } catch (err) {
      setMessages((m) => [...m, { role: 'assistant', text: err.message, error: true }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <aside className="flex h-full w-full flex-col border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
      <header className="flex items-center justify-between border-b border-neutral-200 px-4 py-2.5 dark:border-neutral-800">
        <span className="flex items-center gap-2 text-sm font-medium">
          <Sparkles size={14} style={{ color: THEME.originGreen }} />
          Edit by chat
        </span>
        <button onClick={onClose} className="text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100">
          <X size={15} />
        </button>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {!messages.length && (
          <p className="text-xs leading-relaxed text-neutral-500">
            Point at anything with the pencil, then say what to change — “make the return cheaper”, “drop the
            fort”, “move this to day 2”. Questions are answered without touching the plan.
          </p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`max-w-[90%] rounded-xl px-3 py-2 text-sm ${
              m.role === 'user'
                ? 'ml-auto bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
                : m.error
                  ? 'border border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300'
                  : 'border border-neutral-200 text-neutral-800 dark:border-neutral-800 dark:text-neutral-200'
            }`}
          >
            {m.text}
            {m.role === 'assistant' && m.changed && (
              <span className="mt-1 block text-[11px]" style={{ color: THEME.originGreen }}>
                plan updated
              </span>
            )}
          </div>
        ))}
        {busy && <p className="text-xs text-neutral-500">Working on it…</p>}
        <div ref={endRef} />
      </div>

      <EditContextChip context={context} onClose={onClearContext} />

      <form onSubmit={send} className="flex items-end gap-2 border-t border-neutral-200 p-3 dark:border-neutral-800">
        <textarea
          rows={2}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) send(e);
          }}
          placeholder="Ask or tell…"
          className="min-h-11 flex-1 resize-none rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-900"
        />
        <button
          disabled={busy || !draft.trim()}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-lg font-medium text-neutral-950 disabled:opacity-40"
          style={{ background: THEME.originGreen }}
        >
          <CornerDownLeft size={15} />
        </button>
      </form>
    </aside>
  );
}
