import type { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../auth/jwt';

export type AuthedRequest = Request & {
  userId?: string;
  userEmail?: string;
  guestSessionId?: string;
};

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  try {
    const h = req.headers.authorization;
    if (!h?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Authentification requise.' });
      return;
    }
    const payload = verifyToken(h.slice(7));
    req.userId = payload.sub;
    req.userEmail = payload.email;
    next();
  } catch {
    res.status(401).json({ error: 'Session invalide ou expirée.' });
  }
}
