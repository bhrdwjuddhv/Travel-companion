import { badRequest } from './errors.js';

/** Async route handlers -> express error middleware. */
export const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);

/** No auth in MVP: an anonymous browser key owns the trips. */
export const requireOwnerKey = (req, _res, next) => {
  req.ownerKey = req.get('x-owner-key');
  next(req.ownerKey ? undefined : badRequest('Missing x-owner-key header'));
};
