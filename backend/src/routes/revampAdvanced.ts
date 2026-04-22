import { Router } from 'express';
import { type AuthedRequest } from '../middleware/requireAuth';
import { requireUserOrGuest } from '../middleware/requireUserOrGuest';
import { generateAdvancedRevampHtml } from '../revamper/advancedGenerator';

const router = Router();

router.post('/', requireUserOrGuest, async (req: AuthedRequest, res) => {
  const body = req.body as Record<string, unknown>;
  const url = typeof body.url === 'string' ? body.url.trim() : '';
  if (!url) {
    res.status(400).json({ success: false, error: 'URL requise.' });
    return;
  }
  try {
    const html = await generateAdvancedRevampHtml(url);
    res.json({ success: true, html });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erreur serveur';
    res.status(500).json({ success: false, error: msg });
  }
});

export default router;
