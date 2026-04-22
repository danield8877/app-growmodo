/**
 * Recrée le compte de test local (utile après reset DB ou changement de DATABASE_URL).
 *   npm run db:seed
 */
import 'dotenv/config';
import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set');

const prisma = new PrismaClient({
  adapter: new PrismaPg(url),
});

/** Compte bidon pour dev local — même email / mot de passe */
const DEV_EMAIL = 'pro@pro.pro';
const DEV_PASSWORD = 'pro@pro.pro';

async function main() {
  const passwordHash = await bcrypt.hash(DEV_PASSWORD, 10);
  const user = await prisma.user.upsert({
    where: { email: DEV_EMAIL },
    update: { passwordHash },
    create: {
      email: DEV_EMAIL,
      passwordHash,
      name: 'Compte test local',
    },
  });
  // eslint-disable-next-line no-console
  console.log('Seed OK — connexion:', user.email, '/', DEV_PASSWORD);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
