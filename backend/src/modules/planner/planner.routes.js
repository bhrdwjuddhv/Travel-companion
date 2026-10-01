import { Router } from 'express';
import { wrap, requireOwnerKey } from '../../shared/http.js';
import { start, decide, extract } from './planner.controller.js';

export const plannerRoutes = Router()
  .use(requireOwnerKey)
  .post('/start', wrap(start))
  .post('/extract', wrap(extract))
  .post('/:tripId/decision', wrap(decide));
