import mongoose from 'mongoose';

const TripSchema = new mongoose.Schema(
  {
    ownerKey: { type: String, required: true, index: true },
    input: { type: Object, required: true },
    currentVersion: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const Trip = mongoose.model('Trip', TripSchema);
