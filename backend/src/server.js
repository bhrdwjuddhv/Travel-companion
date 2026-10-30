import express from 'express';
import cors from 'cors';
import { setupExpressRequestContext } from 'posthog-node';
import { ENV } from './constants.js';
import { posthog, captureServerError, shutdownPosthog } from './config/posthog.js';
import { connectMongo, mongoReady } from './config/db.js';
import { ensureCollection } from './config/qdrant.js';
import { tripRoutes } from './modules/trip/trip.routes.js';
import { placeRoutes } from './modules/places/places.routes.js';
import { plannerRoutes } from './modules/planner/planner.routes.js';

const app = express();
app.use(cors({ origin: ENV.CLIENT_ORIGIN }));
app.use(express.json());

// Before the routes: picks up the session and distinct id the browser sends,
// so server events join the same person's timeline as the frontend's.
if (posthog) setupExpressRequestContext(posthog, app);

let qdrantStatus = 'pending';
app.get('/health', (_req, res) =>
  res.json({ ok: mongoReady(), mongo: mongoReady() ? 'up' : 'down', qdrant: qdrantStatus })
);

app.use('/api/planning', plannerRoutes);
app.use('/api/trips', tripRoutes);
app.use('/api/places', placeRoutes);

app.use((err, req, res, _next) => {
  const status = err.status ?? 500;
  if (status >= 500) {
    console.error(err);
    // Only real faults. A 4xx is the client being told no, and posthog-node's
    // own express handler captures every error regardless of status, which
    // would bury the 500s under validation noise.
    captureServerError(err, req);
  }
  res.status(status).json({ error: err.message });
});

await connectMongo();

app.listen(ENV.PORT, () => console.log(`api on http://localhost:${ENV.PORT}`));

// Qdrant is optional (gems fall back to live research), so warm it up *after*
// binding — an unreachable Qdrant used to hold the whole API offline until its
// connection attempt gave up.
// Render stops a service with SIGTERM; flush the queue before the process goes.
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.once(signal, async () => {
    await shutdownPosthog();
    process.exit(0);
  });
}

ensureCollection()
  .then((status) => {
    qdrantStatus = status;
    console.log(`qdrant: ${status}`);
  })
  .catch((e) => {
    qdrantStatus = `error: ${e.message}`;
    console.warn(`qdrant unavailable, hidden gems will be researched fresh each time: ${e.message}`);
  });
