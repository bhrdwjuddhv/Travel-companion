import { Router } from 'express';
import { wrap, requireOwnerKey } from '../../shared/http.js';
import { start, decide } from './planner.controller.js';

export const plannerRoutes = Router()
  .use(requireOwnerKey)
  .post('/start', wrap(start))
  .post('/:tripId/decision', wrap(decide));
