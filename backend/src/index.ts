import express from 'express';
import cors from 'cors';
import { getCorsOptions } from './corsConfig';
import path from 'path';
import fs from 'fs/promises';
import { Client } from 'pg';
import { backendRoot, envPath } from './loadEnv';
import authRoutes from './routes/auth';
import guestRoutes from './routes/guest';
import preRegRoutes from './routes/preReg';
import revamperRoutes from './routes/revamper';
import revampAdvancedRoutes from './routes/revampAdvanced';
import imagerRoutes from './routes/imager';
import emailRoutes from './routes/email';
import emailerRoutes from './routes/emailer';
import { bootRevamperQueue } from './revamper/queue';

const app = express();

app.use(cors(getCorsOptions()));
app.use(express.json({ limit: '4mb' }));

const uploadsRoot = path.join(backendRoot, 'uploads');
void fs.mkdir(path.join(uploadsRoot, 'imager'), { recursive: true });
app.use('/uploads', express.static(uploadsRoot));

/** Racine : l’UI est sur le frontend (Vite), pas ici — évite un 404 trompeur dans le navigateur. */
app.get('/', (_req, res) => {
  const appUrl = process.env.PUBLIC_APP_URL?.trim() || 'http://localhost:5173';
  res.type('html').send(
    `<!DOCTYPE html><meta charset="utf-8"><title>Revamperr API</title>` +
      `<p>API OK. Interface : <a href="${appUrl}">${appUrl}</a></p>` +
      `<p><a href="/api/health">/api/health</a></p>`
  );
});

app.get('/api/health', (_req, res) => {
  const corsList = process.env.CORS_ALLOWED_ORIGINS?.split(',').map((s) => s.trim()).filter(Boolean) ?? [];
  const hasPublic = Boolean(
    (() => {
      const u = process.env.PUBLIC_APP_URL?.trim();
      if (!u || !/^https?:\/\//i.test(u)) return null;
      try {
        return new URL(u).origin;
      } catch {
        return null;
      }
    })()
  );
  res.json({
    ok: true,
    /** Indique que CORS est basé sur une liste / PUBLIC_APP_URL (ou encore tout ouvert en prod). */
    cors: {
      allowedOriginsListSize: corsList.length,
      hasPublicAppUrl: hasPublic,
    },
    grokConfigured: Boolean(process.env.GROK_API_KEY?.trim() || process.env.XAI_API_KEY?.trim()),
    openaiConfigured: Boolean(process.env.OPENAI_API_KEY?.trim()),
    anthropicConfigured: Boolean(process.env.ANTHROPIC_API_KEY?.trim() || process.env.CLAUDE_API_KEY?.trim()),
  });
});

const PG_CONNECT_MS = 5_000;

/** Ping PostgreSQL avec un client `pg` neuf uniquement (jamais Prisma) — répond vite même si le pool Prisma est bloqué. */
app.get('/api/db/health', async (_req, res) => {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    res.status(500).json({ ok: false, error: 'missing_database_url' });
    return;
  }
  const client = new Client({
    connectionString: url,
    connectionTimeoutMillis: PG_CONNECT_MS,
  });
  try {
    await Promise.race([
      (async () => {
        await client.connect();
        await client.query('SELECT 1');
      })(),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('pg_connect_timeout')), PG_CONNECT_MS + 1_000);
      }),
    ]);
    await client.end();

    res.json({ ok: true, postgres: true });
  } catch (e) {
    await client.end().catch(() => {});
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === 'pg_connect_timeout') {
      res.status(503).json({
        ok: false,
        postgres: false,
        error: 'database_unreachable',
        hint:
          'Impossible de joindre PostgreSQL. Vérifiez le service Windows, le port dans DATABASE_URL, et que la base existe.',
      });
      return;
    }
    res.status(503).json({
      ok: false,
      postgres: false,
      error: 'database_unreachable',
      detail: process.env.NODE_ENV !== 'production' ? msg : undefined,
    });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/guest', guestRoutes);
app.use('/api/pre-registrations', preRegRoutes);
app.use('/api/revamper', revamperRoutes);
app.use('/api/revamp-advanced', revampAdvancedRoutes);
app.use('/api/imager', imagerRoutes);
app.use('/api/email', emailRoutes);
app.use('/api/emailer', emailerRoutes);

void bootRevamperQueue().catch((e) => {
  // eslint-disable-next-line no-console
  console.error('bootRevamperQueue error:', e);
});

const port = Number(process.env.PORT ?? 3001);
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`API listening on http://localhost:${port}`);
  // eslint-disable-next-line no-console
  console.log(
    `[config] env=${envPath ?? '(default)'} GROK=${Boolean(
      process.env.GROK_API_KEY?.trim() || process.env.XAI_API_KEY?.trim()
    )} OPENAI=${Boolean(process.env.OPENAI_API_KEY?.trim())} ANTHROPIC=${Boolean(
      process.env.ANTHROPIC_API_KEY?.trim() || process.env.CLAUDE_API_KEY?.trim()
    )}`
  );
});
