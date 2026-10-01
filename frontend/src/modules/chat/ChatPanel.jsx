import { useEffect, useRef, useState } from 'react';
import { CornerDownLeft, Sparkles, X } from 'lucide-react';
import EditContextChip from './EditContextChip';
import { api } from '../../shared/api';

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
    <aside className="flex h-full w-full flex-col bg-[var(--c-bg-alt)]">
      <header className="flex items-center justify-between border-b border-[var(--c-border)] px-4 py-3">
        <span className="flex items-center gap-2 text-[length:var(--type-body)] font-medium">
          <Sparkles size={14} style={{ color: 'var(--c-accent)' }} />
          Edit by chat
        </span>
        <button
          onClick={onClose}
          aria-label="Close chat"
          className="text-[var(--c-ink-muted)] transition-colors hover:text-[var(--c-ink)]"
        >
          <X size={15} />
        </button>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {!messages.length && (
          <p className="text-[length:var(--type-small)] leading-relaxed text-[var(--c-ink-muted)]">
            Point at anything with the pencil, then say what to change — “make the return cheaper”, “drop the
            fort”, “move this to day 2”. Questions are answered without touching the plan.
          </p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className="max-w-[90%] rounded-[var(--r-md)] px-3 py-2 text-[length:var(--type-body)]"
            style={
              m.role === 'user'
                ? { marginLeft: 'auto', background: 'var(--c-accent)', color: 'var(--c-accent-ink)' }
                : m.error
                  ? { background: 'var(--c-warn-soft)', color: 'var(--c-warn)' }
                  : { border: '1px solid var(--c-border)', color: 'var(--c-ink)' }
            }
          >
            {m.text}
            {m.role === 'assistant' && m.changed && (
              <span className="mt-1 block text-[length:var(--type-micro)] opacity-80">
                plan updated
              </span>
            )}
          </div>
        ))}
        {busy && <p className="text-[length:var(--type-small)] text-[var(--c-ink-muted)]">Working on it…</p>}
        <div ref={endRef} />
      </div>

      <EditContextChip context={context} onClose={onClearContext} />

      <form onSubmit={send} className="flex items-end gap-2 border-t border-[var(--c-border)] p-3">
        <textarea
          rows={2}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) send(e);
          }}
          placeholder="Ask or tell…"
          className="ui-field min-h-11 flex-1 resize-none"
        />
        <button
          disabled={busy || !draft.trim()}
          aria-label="Send"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-[var(--r-md)] font-medium disabled:opacity-40"
          style={{ background: 'var(--c-accent)', color: 'var(--c-accent-ink)' }}
        >
          <CornerDownLeft size={15} />
        </button>
      </form>
    </aside>
  );
}
