import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { BUDGET_TIERS, DEFAULT_BUDGET_TIER, PLANNING_MODES } from '../../constants';

const csv = (s) => s.split(',').map((x) => x.trim()).filter(Boolean);
const num = (s) => (s === '' ? null : Number(s));

const iso = (d) => d.toISOString().slice(0, 10);
const addDays = (isoDate, n) => {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
};
const daysBetween = (from, to) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);

const TODAY = iso(new Date());

/**
 * Starting values. Without a prefill the form opens on its usual defaults;
 * with one, only what the sentence actually said is filled and everything else
 * stays blank for the user — a guessed departure date is worse than an empty
 * one they have to notice.
 */
const initialState = (prefill) => {
  const base = {
    origin: '',
    primaryDestination: '',
    additionalDestinations: '',
    startDate: addDays(TODAY, 14),
    endDate: addDays(TODAY, 17),
    direction: 'round',
    budgetTotal: '',
    budgetTier: DEFAULT_BUDGET_TIER,
    preferredTransport: 'any',
    travellerCount: 2,
    interests: '',
    accommodationPreference: 'any',
    specialRequests: '',
  };
  if (!prefill) return base;

  return {
    ...base,
    origin: prefill.origin ?? '',
    primaryDestination: prefill.primaryDestination ?? '',
    additionalDestinations: (prefill.additionalDestinations ?? []).join(', '),
    startDate: prefill.startDate ?? '',
    endDate: prefill.endDate ?? '',
    direction: prefill.direction ?? base.direction,
    budgetTotal: prefill.budgetTotal != null ? String(prefill.budgetTotal) : '',
    budgetTier: prefill.budgetTier ?? base.budgetTier,
    preferredTransport: prefill.preferredTransport ?? base.preferredTransport,
    travellerCount: prefill.travellerCount ?? base.travellerCount,
    interests: (prefill.interests ?? []).join(', '),
    accommodationPreference: prefill.accommodationPreference ?? base.accommodationPreference,
    specialRequests: prefill.specialRequests ?? '',
  };
};

export default function TripInputPanel({ mode = 'auto', prefill = null, onGenerate, onCancel }) {
  const modeInfo = PLANNING_MODES.find((m) => m.id === mode);
  const [f, setF] = useState(() => initialState(prefill));
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  // Trains don't run every day, so the range is the source of truth and the day
  // count is derived from it — the two can never disagree.
  const durationDays = daysBetween(f.startDate, f.endDate) + 1;
  const validRange = Number.isFinite(durationDays) && durationDays >= 1 && durationDays <= 21;

  const setStart = (e) => {
    const startDate = e.target.value;
    // Dragging the start past the end pushes the end along rather than
    // silently producing an invalid range.
    setF({
      ...f,
      startDate,
      endDate: f.endDate && f.endDate < startDate ? addDays(startDate, Math.max(durationDays - 1, 0)) : f.endDate,
    });
  };

  const submit = (e) => {
    e.preventDefault();
    onGenerate({
      origin: f.origin.trim(),
      primaryDestination: f.primaryDestination.trim(),
      additionalDestinations: csv(f.additionalDestinations),
      startDate: f.startDate,
      endDate: f.endDate,
      direction: f.direction,
      budgetTotal: num(f.budgetTotal),
      budgetTier: f.budgetTier,
      preferredTransport: f.preferredTransport,
      travellerCount: Number(f.travellerCount),
      interests: csv(f.interests),
      accommodationPreference: f.accommodationPreference,
      specialRequests: f.specialRequests.trim() || null,
      planningMode: mode,
    });
  };

  return (
    <form onSubmit={submit} className="ui-card mx-auto w-full max-w-2xl p-5 sm:p-7">
      <div className="mb-6 flex items-baseline justify-between gap-3">
        <h2 className="text-xl font-semibold tracking-tight">Where are we going?</h2>
        {modeInfo && (
          <span
            className="rounded-[var(--r-pill)] border px-3 py-1 text-[length:var(--type-micro)] font-semibold"
            style={{ borderColor: 'var(--c-accent-edge)', color: 'var(--c-accent-text)' }}
          >
            {modeInfo.name}
          </span>
        )}
      </div>

      {prefill && (
        <p
          className="mb-5 flex items-start gap-2 rounded-[var(--r-md)] px-3 py-2.5 text-[length:var(--type-small)]"
          style={{ background: 'var(--c-accent-soft)', color: 'var(--c-accent-text)' }}
        >
          <Sparkles size={14} className="mt-0.5 shrink-0" />
          Filled in from what you typed. Check it, fill the gaps, then plan — nothing has been generated yet.
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <span className="ui-label">From</span>
          <input className="ui-field" required value={f.origin} onChange={set('origin')} placeholder="Delhi" />
        </div>
        <div>
          <span className="ui-label">To</span>
          <input
            className="ui-field"
            required
            value={f.primaryDestination}
            onChange={set('primaryDestination')}
            placeholder="Jaipur"
          />
        </div>
        <div className="sm:col-span-2">
          <span className="ui-label">Other stops (optional, comma separated)</span>
          <input
            className="ui-field"
            value={f.additionalDestinations}
            onChange={set('additionalDestinations')}
            placeholder="Udaipur, Jodhpur"
          />
        </div>
        <div>
          <span className="ui-label">Leaving</span>
          <input className="ui-field" type="date" required min={TODAY} value={f.startDate} onChange={setStart} />
        </div>
        <div>
          <span className="ui-label">Coming back</span>
          <input
            className="ui-field"
            type="date"
            required
            min={f.startDate || TODAY}
            value={f.endDate}
            onChange={set('endDate')}
          />
        </div>
        <div>
          <span className="ui-label">Travellers</span>
          <input className="ui-field" type="number" min="1" value={f.travellerCount} onChange={set('travellerCount')} />
        </div>
        <div>
          <span className="ui-label">Trip type</span>
          <select className="ui-field" value={f.direction} onChange={set('direction')}>
            <option value="round">Round trip</option>
            <option value="oneway">One way</option>
          </select>
        </div>
        <div>
          <span className="ui-label">Transport</span>
          <select className="ui-field" value={f.preferredTransport} onChange={set('preferredTransport')}>
            {['any', 'train', 'bus', 'flight', 'car'].map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div>
          <span className="ui-label">Budget cap (INR, optional)</span>
          <input
            className="ui-field"
            type="number"
            min="0"
            inputMode="numeric"
            value={f.budgetTotal}
            onChange={set('budgetTotal')}
            placeholder="leave blank to use the style"
          />
        </div>
        <div>
          <span className="ui-label">Stay</span>
          <select className="ui-field" value={f.accommodationPreference} onChange={set('accommodationPreference')}>
            {['any', 'hotel', 'hostel', 'homestay', 'budget'].map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <span className="ui-label">How comfortable?</span>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {BUDGET_TIERS.map((tier) => {
              const active = f.budgetTier === tier.id;
              return (
                <button
                  key={tier.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setF({ ...f, budgetTier: tier.id })}
                  className="ui-pill flex-col items-start rounded-[var(--r-md)] p-3 text-left"
                >
                  <span className="block text-[length:var(--type-body)] font-medium">{tier.label}</span>
                  <span className="mt-1 block text-[length:var(--type-micro)] leading-snug opacity-70">
                    {tier.blurb}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="sm:col-span-2">
          <span className="ui-label">Special requests (optional)</span>
          <textarea
            rows={2}
            className="ui-field resize-none"
            value={f.specialRequests}
            onChange={set('specialRequests')}
            placeholder="vegetarian food · avoid long train rides · temples over nightlife"
          />
        </div>

        <div className="sm:col-span-2">
          <span className="ui-label">Interests (comma separated)</span>
          <input
            className="ui-field"
            value={f.interests}
            onChange={set('interests')}
            placeholder="forts, street food, photography"
          />
        </div>
      </div>

      <p className="mt-5 text-[length:var(--type-small)] text-[var(--c-ink-muted)]">
        {validRange
          ? `${durationDays} day${durationDays > 1 ? 's' : ''} — trains and fares are checked against these dates.`
          : 'Pick both dates: an end on or after the start, within 21 days.'}
      </p>

      <div className="mt-5 flex items-center gap-3">
        <button disabled={!validRange} className="ui-btn ui-btn-primary flex-1 sm:flex-none">
          {mode === 'guided' ? 'Start planning' : 'Generate plan'}
        </button>
        <button type="button" onClick={onCancel} className="ui-btn ui-btn-sm text-[var(--c-ink-muted)]">
          Change mode
        </button>
      </div>
    </form>
  );
}
