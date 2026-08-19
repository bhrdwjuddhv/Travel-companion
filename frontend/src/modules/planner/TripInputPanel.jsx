import { useState } from 'react';
import { BUDGET_TIERS, DEFAULT_BUDGET_TIER, PLANNING_MODES, THEME } from '../../constants';

const field =
  'w-full min-h-10 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-base outline-none focus:border-neutral-500 sm:text-sm';
const label = 'mb-1 block text-xs uppercase tracking-wide text-neutral-500';

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

export default function TripInputPanel({ mode = 'auto', onGenerate, onCancel }) {
  const modeInfo = PLANNING_MODES.find((m) => m.id === mode);
  const [f, setF] = useState({
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
  });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  // Trains don't run every day, so the range is the source of truth and the day
  // count is derived from it — the two can never disagree.
  const durationDays = daysBetween(f.startDate, f.endDate) + 1;
  const validRange = Number.isFinite(durationDays) && durationDays >= 1 && durationDays <= 21;

  const setStart = (e) => {
    const startDate = e.target.value;
    // Dragging the start past the end pushes the end along rather than
    // silently producing an invalid range.
    setF({ ...f, startDate, endDate: f.endDate < startDate ? addDays(startDate, Math.max(durationDays - 1, 0)) : f.endDate });
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
    <form
      onSubmit={submit}
      className="mx-auto w-full max-w-2xl rounded-2xl border border-neutral-800 bg-neutral-950/80 p-4 sm:p-6"
    >
      <div className="mb-6 flex items-baseline justify-between">
        <h2 className="text-xl font-semibold">Where are we going?</h2>
        {modeInfo && (
          <span
            className="rounded-full border px-3 py-1 text-[11px] uppercase tracking-wide"
            style={{ borderColor: THEME.originGreenEdge, color: THEME.originGreen }}
          >
            {modeInfo.name}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <span className={label}>From</span>
          <input className={field} required value={f.origin} onChange={set('origin')} placeholder="Delhi" />
        </div>
        <div>
          <span className={label}>To</span>
          <input
            className={field}
            required
            value={f.primaryDestination}
            onChange={set('primaryDestination')}
            placeholder="Jaipur"
          />
        </div>
        <div className="sm:col-span-2">
          <span className={label}>Other stops (optional, comma separated)</span>
          <input
            className={field}
            value={f.additionalDestinations}
            onChange={set('additionalDestinations')}
            placeholder="Udaipur, Jodhpur"
          />
        </div>
        <div>
          <span className={label}>Leaving</span>
          <input className={field} type="date" required min={TODAY} value={f.startDate} onChange={setStart} />
        </div>
        <div>
          <span className={label}>Coming back</span>
          <input className={field} type="date" required min={f.startDate} value={f.endDate} onChange={set('endDate')} />
        </div>
        <div>
          <span className={label}>Travellers</span>
          <input className={field} type="number" min="1" value={f.travellerCount} onChange={set('travellerCount')} />
        </div>
        <div>
          <span className={label}>Trip type</span>
          <select className={field} value={f.direction} onChange={set('direction')}>
            <option value="round">Round trip</option>
            <option value="oneway">One way</option>
          </select>
        </div>
        <div>
          <span className={label}>Transport</span>
          <select className={field} value={f.preferredTransport} onChange={set('preferredTransport')}>
            {['any', 'train', 'bus', 'flight', 'car'].map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div>
          <span className={label}>Budget cap (INR, optional)</span>
          <input
            className={field}
            type="number"
            min="0"
            inputMode="numeric"
            value={f.budgetTotal}
            onChange={set('budgetTotal')}
            placeholder="leave blank to use the style"
          />
        </div>
        <div>
          <span className={label}>Stay</span>
          <select className={field} value={f.accommodationPreference} onChange={set('accommodationPreference')}>
            {['any', 'hotel', 'hostel', 'homestay', 'budget'].map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <span className={label}>How comfortable?</span>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {BUDGET_TIERS.map((tier) => {
              const active = f.budgetTier === tier.id;
              return (
                <button
                  key={tier.id}
                  type="button"
                  onClick={() => setF({ ...f, budgetTier: tier.id })}
                  className={`rounded-lg border p-3 text-left transition ${
                    active ? 'border-transparent bg-neutral-800' : 'border-neutral-800 hover:border-neutral-600'
                  }`}
                  style={active ? { borderColor: THEME.originGreenEdge } : undefined}
                >
                  <span
                    className="block text-sm font-medium"
                    style={{ color: active ? THEME.originGreen : undefined }}
                  >
                    {tier.label}
                  </span>
                  <span className="mt-1 block text-[11px] leading-snug text-neutral-500">{tier.blurb}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="sm:col-span-2">
          <span className={label}>Special requests (optional)</span>
          <textarea
            rows={2}
            className={`${field} resize-none`}
            value={f.specialRequests}
            onChange={set('specialRequests')}
            placeholder="vegetarian food · avoid long train rides · temples over nightlife"
          />
        </div>

        <div className="sm:col-span-2">
          <span className={label}>Interests (comma separated)</span>
          <input
            className={field}
            value={f.interests}
            onChange={set('interests')}
            placeholder="forts, street food, photography"
          />
        </div>
      </div>

      <p className="mt-5 text-xs text-neutral-500">
        {validRange
          ? `${durationDays} day${durationDays > 1 ? 's' : ''} — trains and fares are checked against these dates.`
          : 'Pick an end date on or after the start, within 21 days.'}
      </p>

      <div className="mt-4 flex items-center gap-3">
        <button
          disabled={!validRange}
          className="min-h-11 flex-1 rounded-full px-6 py-2.5 text-sm font-semibold text-neutral-950 transition hover:brightness-110 disabled:opacity-40 sm:flex-none"
          style={{ background: THEME.originGreen }}
        >
          {mode === 'guided' ? 'Start planning' : 'Generate plan'}
        </button>
        <button type="button" onClick={onCancel} className="text-sm text-neutral-500 hover:text-neutral-300">
          Change mode
        </button>
      </div>
    </form>
  );
}
