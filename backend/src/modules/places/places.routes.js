import { Router } from 'express';
import { wrap } from '../../shared/http.js';
import { cover, photo } from './photo.controller.js';

// No owner key: a photo reference is already public data the client got from
// us, and requiring the header would block <img> tags, which cannot set one.
export const placeRoutes = Router().get('/photo', wrap(photo)).get('/cover', wrap(cover));
