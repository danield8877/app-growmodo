import jwt from 'jsonwebtoken';

const DEV_FALLBACK = 'revamperr-dev-jwt-secret-min-16';

const secret = (): string => {
  const s = process.env.JWT_SECRET;
  if (s && s.length >= 16) return s;
  if (process.env.NODE_ENV !== 'production') return DEV_FALLBACK;
  throw new Error('JWT_SECRET must be set (min 16 chars)');
};

const WEEK_SEC = 7 * 24 * 60 * 60;

export function signToken(payload: { sub: string; email: string }, expiresInSec: number = WEEK_SEC): string {
  return jwt.sign(payload, secret(), { expiresIn: expiresInSec });
}

export function verifyToken(token: string): { sub: string; email: string } {
  const decoded = jwt.verify(token, secret()) as jwt.JwtPayload;
  if (decoded.typ === 'guest') {
    throw new Error('Invalid token payload');
  }
  if (typeof decoded.sub !== 'string' || typeof decoded.email !== 'string') {
    throw new Error('Invalid token payload');
  }
  return { sub: decoded.sub, email: decoded.email };
}

const GUEST_MONTH_SEC = 30 * 24 * 60 * 60;

export function signGuestToken(sessionId: string, expiresInSec: number = GUEST_MONTH_SEC): string {
  return jwt.sign({ sub: sessionId, typ: 'guest' }, secret(), { expiresIn: expiresInSec });
}

export function verifyGuestToken(token: string): { sub: string } {
  const decoded = jwt.verify(token, secret()) as jwt.JwtPayload;
  if (decoded.typ !== 'guest' || typeof decoded.sub !== 'string') {
    throw new Error('Invalid guest token');
  }
  return { sub: decoded.sub };
}
