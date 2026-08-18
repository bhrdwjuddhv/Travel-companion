import mongoose from 'mongoose';

const TripVersionSchema = new mongoose.Schema(
  {
    tripId: { type: mongoose.Schema.Types.ObjectId, ref: 'Trip', required: true, index: true },
    versionNumber: { type: Number, required: true },
    parentVersion: { type: Number, default: null },
    plan: { type: Object, required: true },
    status: { type: String, enum: ['active', 'failed'], default: 'active' },
  },
  { timestamps: true }
);

// Doubles as optimistic concurrency: two writers racing for the same version
// number, one of them loses on the unique index.
TripVersionSchema.index({ tripId: 1, versionNumber: 1 }, { unique: true });

export const TripVersion = mongoose.model('TripVersion', TripVersionSchema);
