import path from 'path';
import fs from 'fs/promises';
import { backendRoot } from '../loadEnv';

/** Chemin disque pour une URL servie sous `/uploads/...` (notre stockage local). */
export function localFilePathFromUploadsUrl(url: string): string | null {
  const trimmed = url.trim();
  let pathname = trimmed;
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      pathname = new URL(trimmed).pathname;
    } catch {
      return null;
    }
  }
  if (!pathname.startsWith('/uploads/')) return null;
  const rel = pathname.slice('/uploads/'.length);
  if (!rel || rel.includes('..')) return null;
  return path.join(backendRoot, 'uploads', rel);
}

export async function readUploadsFileBuffer(url: string): Promise<Buffer | null> {
  const p = localFilePathFromUploadsUrl(url);
  if (!p) return null;
  try {
    return await fs.readFile(p);
  } catch {
    return null;
  }
}
