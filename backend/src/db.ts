import './loadEnv';
import { Pool } from 'pg';
import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

function createPool(connectionString: string): Pool {
  const pool = new Pool({
    connectionString,
    max: 10,
    connectionTimeoutMillis: 15_000,
    idleTimeoutMillis: 30_000,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10_000,
  });
  pool.on('error', (err) => {
    // Connexion idle fermée côté Postgres (sleep OS, restart service, etc.)
    console.error('[pg Pool] erreur client inactif — redémarrer l’API si les requêtes restent bloquées', err.message);
  });
  return pool;
}

function createPrisma(): PrismaClient {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  const adapter = new PrismaPg(createPool(url));
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });
}

export const prisma = global.__prisma ?? createPrisma();

if (process.env.NODE_ENV !== 'production') global.__prisma = prisma;
