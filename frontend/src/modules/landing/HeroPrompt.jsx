import { useRef, useState } from 'react';
import { Loader2, MapPin, Sparkles } from 'lucide-react';
import { api } from '../../shared/api';
import { LANDING, LIMITS } from '../../constants';

const { prompt: COPY } = LANDING;

/**
 * Free text in, a pre-filled form out. The model only reads the sentence — no
 * provider calls, no plan — and the user still reviews every field before
 * anything is generated, so a misread costs a correction, not a trip.
 */
export default function HeroPrompt({ value, onChange, onExtracted }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  const submit = async (e) => {
    e.preventDefault();
    const text = value.trim();
    if (!text || busy) return;

    setBusy(true);
    setError(null);
    try {
      const { fields } = await api('/api/planning/extract', { method: 'POST', body: { text } });
      onExtracted(fields, e.currentTarget);
    } catch (err) {
      // Off topic is worth saying out loud; anything else just opens the empty
      // form, which is where the user was headed anyway.
      if (err.status === 400) setError(err.message);
      else onExtracted(null, e.currentTarget);
    } finally {
      setBusy(false);
    }
  };

  const applySuggestion = (text) => {
    onChange(text);
    inputRef.current?.focus();
  };

  return (
    <div className="w-full">
      <form
        onSubmit={submit}
        className="liquid-glass flex w-full flex-col gap-2 rounded-[var(--r-xl)] p-2 sm:flex-row sm:items-center sm:rounded-[var(--r-pill)]"
      >
        <label className="flex min-w-0 flex-1 items-center gap-3 px-4">
          <MapPin size={16} className="shrink-0 text-[var(--c-ink-dim)]" aria-hidden="true" />
          <span className="sr-only">Describe your trip</span>
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => onChange(e.target.value.slice(0, LIMITS.promptMaxChars))}
            placeholder={COPY.placeholder}
            className="min-h-11 w-full bg-transparent text-[length:var(--type-body)] text-[var(--c-ink)] outline-none placeholder:text-[var(--c-ink-dim)]"
          />
        </label>
        <button type="submit" disabled={!value.trim() || busy} className="ui-btn ui-btn-primary shrink-0">
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
          {busy ? COPY.reading : COPY.action}
        </button>
      </form>

      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {COPY.suggestions.map((s) => (
          <button key={s} type="button" onClick={() => applySuggestion(s)} className="ui-pill text-left">
            {s}
          </button>
        ))}
      </div>

      <p
        className="mt-4 text-[length:var(--type-small)]"
        style={{ color: error ? 'var(--c-danger)' : 'var(--c-ink-dim)' }}
        role={error ? 'alert' : undefined}
      >
        {error ?? COPY.hint}
      </p>
    </div>
  );
}
