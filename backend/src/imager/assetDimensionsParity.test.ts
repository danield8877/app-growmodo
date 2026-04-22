import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { ASSET_DIMENSIONS, type AssetType } from './buildPrompt';

/**
 * Garde le frontend `types.ts` aligné sur le backend (évite écarts UI / génération).
 */
function parseFrontendAssetDimensions(): Record<string, { width: number; height: number }> {
  const typesPath = path.resolve(__dirname, '../../../frontend/src/services/imager/types.ts');
  const raw = readFileSync(typesPath, 'utf8');
  const out: Record<string, { width: number; height: number }> = {};
  const re = /'([a-z-]+)':\s*\{\s*width:\s*(\d+),\s*height:\s*(\d+)\s*\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    out[m[1]] = { width: Number(m[2]), height: Number(m[3]) };
  }
  return out;
}

describe('ASSET_DIMENSIONS backend ↔ frontend', () => {
  it('toutes les clés backend ont la même taille que le frontend', () => {
    const front = parseFrontendAssetDimensions();
    const keys = Object.keys(ASSET_DIMENSIONS) as AssetType[];
    for (const k of keys) {
      const b = ASSET_DIMENSIONS[k];
      const f = front[k];
      expect(f, `frontend manque ${k}`).toBeDefined();
      expect(f!.width, k).toBe(b.width);
      expect(f!.height, k).toBe(b.height);
    }
  });
});
