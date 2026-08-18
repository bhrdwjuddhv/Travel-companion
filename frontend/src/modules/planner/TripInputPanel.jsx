import { useState } from 'react';
import { PLANNING_MODES, THEME } from '../../constants';

const field =
  'w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm outline-none focus:border-neutral-500';
const label = 'mb-1 block text-xs uppercase tracking-wide text-neutral-500';

const csv = (s) => s.split(',').map((x) => x.trim()).filter(Boolean);
const num = (s) => (s === '' ? null : Number(s));

export default function TripInputPanel({ mode = 'auto', onGenerate, onCancel }) {
  const modeInfo = PLANNING_MODES.find((m) => m.id === mode);
  const [f, setF] = useState({
    origin: '',
    primaryDestination: '',
    additionalDestinations: '',
    durationDays: 4,
    direction: 'round',
    budgetTotal: '',
    preferredTransport: 'any',
    travellerCount: 2,
    interests: '',
    accommodationPreference: 'any',
  });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = (e) => {
    e.preventDefault();
    onGenerate({
      origin: f.origin.trim(),
      primaryDestination: f.primaryDestination.trim(),
      additionalDestinations: csv(f.additionalDestinations),
      durationDays: Number(f.durationDays),
      direction: f.direction,
      budgetTotal: num(f.budgetTotal),
      preferredTransport: f.preferredTransport,
      travellerCount: Number(f.travellerCount),
      interests: csv(f.interests),
      accommodationPreference: f.accommodationPreference,
      planningMode: mode,
    });
  };

  return (
    <form
      onSubmit={submit}
      className="mx-auto w-full max-w-2xl rounded-2xl border border-neutral-800 bg-neutral-950/80 p-6"
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
          <span className={label}>Days</span>
          <input className={field} type="number" min="1" max="21" value={f.durationDays} onChange={set('durationDays')} />
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
          <span className={label}>Budget total (INR, optional)</span>
          <input className={field} type="number" min="0" value={f.budgetTotal} onChange={set('budgetTotal')} placeholder="25000" />
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
          <span className={label}>Interests (comma separated)</span>
          <input
            className={field}
            value={f.interests}
            onChange={set('interests')}
            placeholder="forts, street food, photography"
          />
        </div>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <button
          className="rounded-full px-6 py-2.5 text-sm font-semibold text-neutral-950 transition hover:brightness-110"
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
