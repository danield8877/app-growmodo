import type { Response, NextFunction } from 'express';
import { verifyToken, verifyGuestToken } from '../auth/jwt';
import type { AuthedRequest } from './requireAuth';

/** Accepte un JWT utilisateur (email+sub) ou un JWT invité (typ: guest). */
export function requireUserOrGuest(req: AuthedRequest, res: Response, next: NextFunction): void {
  try {
    const h = req.headers.authorization;
    if (!h?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Authentification requise.' });
      return;
    }
    const raw = h.slice(7);
    try {
      const payload = verifyToken(raw);
      req.userId = payload.sub;
      req.userEmail = payload.email;
      req.guestSessionId = undefined;
      next();
      return;
    } catch {
      /* tenter invité */
    }
    const guest = verifyGuestToken(raw);
    req.userId = undefined;
    req.userEmail = undefined;
    req.guestSessionId = guest.sub;
    next();
  } catch {
    res.status(401).json({ error: 'Session invalide ou expirée.' });
  }
}
