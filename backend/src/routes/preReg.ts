import { Router } from 'express';
import { prisma } from '../db';

const router = Router();

router.post('/', async (req, res) => {
  try {
    const { full_name, company_name, phone, email, accept_contact } = req.body as Record<string, unknown>;
    if (!email || typeof email !== 'string' || !String(email).includes('@')) {
      res.status(400).json({ error: 'Email invalide.' });
      return;
    }
    await prisma.preRegistration.create({
      data: {
        fullName: typeof full_name === 'string' ? full_name : '',
        companyName: typeof company_name === 'string' ? company_name : null,
        phone: typeof phone === 'string' ? phone : null,
        email: String(email).trim().toLowerCase(),
        acceptContact: Boolean(accept_contact),
      },
    });
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Enregistrement impossible.' });
  }
});

export default router;
