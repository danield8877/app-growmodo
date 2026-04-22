import { Router } from 'express';
import { prisma } from '../db';
import { signGuestToken } from '../auth/jwt';

const router = Router();

router.post('/session', async (_req, res) => {
  try {
    const row = await prisma.guestSession.create({ data: {} });
    const token = signGuestToken(row.id);
    res.status(201).json({ token, guest_session_id: row.id });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Impossible de créer une session invité.' });
  }
});

export default router;
