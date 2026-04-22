import type { AuthedRequest } from './middleware/requireAuth';

export function ownerCreatePair(req: AuthedRequest): { userId: string | null; guestSessionId: string | null } {
  if (req.userId) return { userId: req.userId, guestSessionId: null };
  if (req.guestSessionId) return { userId: null, guestSessionId: req.guestSessionId };
  throw new Error('Missing owner');
}

export function revamperWhere(req: AuthedRequest): { userId: string } | { guestSessionId: string } {
  if (req.userId) return { userId: req.userId };
  if (req.guestSessionId) return { guestSessionId: req.guestSessionId };
  throw new Error('Missing owner');
}

export function imagerWhere(req: AuthedRequest): { userId: string } | { guestSessionId: string } {
  return revamperWhere(req);
}
