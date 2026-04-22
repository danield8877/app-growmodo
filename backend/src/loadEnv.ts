import dotenv from 'dotenv';
import fsSync from 'fs';
import path from 'path';

const envCandidates = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(__dirname, '../.env'),
  path.resolve(__dirname, '../../.env'),
];

export const envPath = envCandidates.find((p) => fsSync.existsSync(p)) ?? null;
if (envPath) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
}

export const backendRoot = envPath ? path.dirname(envPath) : process.cwd();
