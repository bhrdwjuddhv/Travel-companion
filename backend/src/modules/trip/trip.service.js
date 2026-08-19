import { isValidObjectId } from 'mongoose';
import { Trip } from './trip.model.js';
import { TripVersion } from './tripVersion.model.js';
import { LIMITS } from '../../constants.js';
import { HttpError, notFound } from '../../shared/errors.js';

export async function assertGenerationQuota(ownerKey) {
  const since = new Date(Date.now() - 24 * 3600_000);
  const used = await Trip.countDocuments({ ownerKey, createdAt: { $gte: since } });
  if (used >= LIMITS.generationsPerOwnerPerDay) {
    throw new HttpError(429, `Daily limit of ${LIMITS.generationsPerOwnerPerDay} trip generations reached.`);
  }
}

export async function createTrip({ ownerKey, input, plan }) {
  const trip = await Trip.create({ ownerKey, input, currentVersion: 1 });
  await TripVersion.create({ tripId: trip._id, versionNumber: 1, parentVersion: null, plan });
  return { tripId: String(trip._id), versionNumber: 1 };
}

/**
 * Optimistic concurrency: the version bump only lands if the trip is still at
 * `expectedVersion`. A racing writer loses and gets 409 with current state,
 * so nothing is ever half-applied.
 */
export async function appendVersion({ tripId, ownerKey, expectedVersion, plan }) {
  assertId(tripId);
  const trip = await Trip.findOneAndUpdate(
    { _id: tripId, ownerKey, currentVersion: expectedVersion },
    { $inc: { currentVersion: 1 } },
    { new: true }
  );

  if (!trip) {
    const current = await getTrip(tripId, ownerKey); // throws 404 if it isn't theirs
    throw Object.assign(new HttpError(409, `Trip has moved on to v${current.versionNumber}`), { current });
  }

  await TripVersion.create({
    tripId: trip._id,
    versionNumber: trip.currentVersion,
    parentVersion: expectedVersion,
    plan,
  });
  return { tripId: String(trip._id), versionNumber: trip.currentVersion };
}

/** Dragged positions win; everything else keeps the deterministic layout. */
const applyLayout = (plan, layout) =>
  !plan || !layout || !Object.keys(layout).length
    ? plan
    : {
        ...plan,
        graph: {
          ...plan.graph,
          nodes: plan.graph.nodes.map((n) => (layout[n.id] ? { ...n, position: layout[n.id] } : n)),
        },
      };

// A malformed id is a missing trip, not a server error — without this Mongoose
// throws a CastError and we'd answer 500 with its internals.
const assertId = (tripId) => {
  if (!isValidObjectId(tripId)) throw notFound('Trip not found');
};

export async function getTrip(tripId, ownerKey) {
  assertId(tripId);
  const trip = await Trip.findOne({ _id: tripId, ownerKey }).lean();
  if (!trip) throw notFound('Trip not found');
  const version = await TripVersion.findOne({ tripId, versionNumber: trip.currentVersion }).lean();
  return {
    tripId: String(trip._id),
    input: trip.input,
    versionNumber: trip.currentVersion,
    plan: applyLayout(version?.plan ?? null, trip.layout),
    layout: trip.layout ?? {},
    createdAt: trip.createdAt,
  };
}

export async function saveLayout(tripId, ownerKey, layout) {
  assertId(tripId);
  const res = await Trip.updateOne({ _id: tripId, ownerKey }, { $set: { layout } });
  if (!res.matchedCount) throw notFound('Trip not found');
  return { ok: true, moved: Object.keys(layout).length };
}

export async function listTrips(ownerKey) {
  const trips = await Trip.find({ ownerKey }).sort({ createdAt: -1 }).limit(20).lean();
  return trips.map((t) => ({
    tripId: String(t._id),
    input: t.input,
    versionNumber: t.currentVersion,
    createdAt: t.createdAt,
  }));
}
