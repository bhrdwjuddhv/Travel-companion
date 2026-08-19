import mongoose from 'mongoose';

const TripSchema = new mongoose.Schema(
  {
    ownerKey: { type: String, required: true, index: true },
    input: { type: Object, required: true },
    currentVersion: { type: Number, default: 0 },
    // nodeId -> {x, y} for nodes the user has dragged. A view preference, not
    // plan content, so it lives here rather than making a version per drag.
    layout: { type: Object, default: {} },
  },
  { timestamps: true }
);

export const Trip = mongoose.model('Trip', TripSchema);
