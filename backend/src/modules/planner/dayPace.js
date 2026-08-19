import { DAY_RULES } from '../../constants.js';

const minutes = (hhmm) => {
  const m = String(hhmm ?? '').match(/^(\d{2}):(\d{2})$/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

const RULE = {
  fullBefore: minutes(DAY_RULES.arriveFullDayBefore),
  travelAfter: minutes(DAY_RULES.arriveTravelOnlyAfter),
  lightBefore: minutes(DAY_RULES.departLightDayBefore),
  nightAfter: minutes(DAY_RULES.departNightAfter),
};

/**
 * How much of a day is actually free, given the trains touching it.
 *
 * The bug this fixes: the last day showed the return train *and* a list of
 * sights to visit. If the train leaves at 10:00 there is no day left; if it
 * leaves at 23:00 there is.
 */
export function paceForDay({ date, destination, segments }) {
  // Which end of the leg this destination is on is what separates an arrival
  // from a departure — the same segment is both, seen from different cities.
  const onDate = segments.filter((s) => s.date === date);
  const arriving = onDate.find((s) => s.toPlace === destination);
  const departing = onDate.find((s) => s.fromPlace === destination);

  const arrivedAt = minutes(arriving?.arrivalTime);
  const leavesAt = minutes(departing?.departureTime);

  let pace = 'full';
  const anchors = [];

  if (arriving) {
    anchors.push(
      arriving.arrivalTime
        ? `Arrive ${arriving.toPlace} ${arriving.arrivalTime}`
        : `Arrive ${arriving.toPlace}`
    );
    // No time on the clock means we can't claim the day is short.
    if (arrivedAt != null) {
      if (arrivedAt >= RULE.travelAfter) pace = 'travel';
      else if (arrivedAt >= RULE.fullBefore) pace = 'half';
    }
  }

  if (departing) {
    anchors.push(
      departing.departureTime
        ? `Depart ${departing.fromPlace} ${departing.departureTime}`
        : `Depart ${departing.fromPlace}`
    );
    if (leavesAt != null) {
      // A night train leaves the day intact; a midday one does not.
      if (leavesAt < RULE.lightBefore) pace = 'light';
      else if (leavesAt < RULE.nightAfter && pace === 'full') pace = 'half';
    } else {
      // Unknown departure time on a travel day: assume it eats into the day.
      if (pace === 'full') pace = 'half';
    }
  }

  return {
    pace,
    maxActivities: DAY_RULES.maxActivities[pace] ?? DAY_RULES.maxActivities.full,
    anchorNote: anchors.join(' · ') || null,
    // Late arrivals still allow something nearby to eat.
    allowsDinnerOnly: pace === 'travel' && DAY_RULES.lateArrivalAllowsDinner,
  };
}

/**
 * Trims a day's activities to what the trains leave room for. Returns the
 * activities that survive — dropping is the point, not a side effect.
 */
export function trimToPace(activities, { maxActivities, allowsDinnerOnly }) {
  if (activities.length <= maxActivities) return activities;

  if (maxActivities === 0) {
    // Travel day: nothing during the day, but a meal near the hotel is fine.
    const meal = allowsDinnerOnly ? activities.find((a) => a.category === 'meal' || a.category === 'cafe') : null;
    return meal ? [{ ...meal, plannedStart: '20:30' }] : [];
  }

  return activities.slice(0, maxActivities);
}
