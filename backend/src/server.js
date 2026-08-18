import express from 'express';
import cors from 'cors';
import { ENV } from './constants.js';
import { connectMongo, mongoReady } from './config/db.js';
import { ensureCollection } from './config/qdrant.js';
import { tripRoutes } from './modules/trip/trip.routes.js';
import { plannerRoutes } from './modules/planner/planner.routes.js';

const app = express();
app.use(cors({ origin: ENV.CLIENT_ORIGIN }));
app.use(express.json());

let qdrantStatus = 'pending';
app.get('/health', (_req, res) =>
  res.json({ ok: mongoReady(), mongo: mongoReady() ? 'up' : 'down', qdrant: qdrantStatus })
);

app.use('/api/planning', plannerRoutes);
app.use('/api/trips', tripRoutes);

app.use((err, _req, res, _next) => {
  const status = err.status ?? 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: err.message });
});

await connectMongo();
qdrantStatus = await ensureCollection().catch((e) => `error: ${e.message}`);

app.listen(ENV.PORT, () => console.log(`api on http://localhost:${ENV.PORT} (qdrant: ${qdrantStatus})`));
