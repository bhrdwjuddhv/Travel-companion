import { Router } from 'express';
import { wrap, requireOwnerKey } from '../../shared/http.js';
import { show, index, mutate } from './trip.controller.js';

export const tripRoutes = Router()
  .use(requireOwnerKey)
  .get('/', wrap(index))
  .get('/:id', wrap(show))
  .post('/:id/mutate', wrap(mutate));
