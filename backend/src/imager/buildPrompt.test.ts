import { describe, it, expect } from 'vitest';
import {
  ASSET_DIMENSIONS,
  buildImagerPrompt,
  formatCoverInstructionForAssetType,
  type AssetType,
} from './buildPrompt';

const ALL_TYPES = Object.keys(ASSET_DIMENSIONS) as AssetType[];

describe('buildImagerPrompt', () => {
  it('inclut BRAND MARK pour une pub Facebook (pas typo seule)', () => {
    const p = buildImagerPrompt('facebook-ad', 'Grower', 'Agence', 'friendly', 'B2B');
    expect(p).toContain('BRAND MARK');
    expect(p).toContain('OUTPUT LAYOUT');
    expect(p).toContain('Full-bleed');
    expect(p.toLowerCase()).not.toContain('typography only');
  });

  it('n’ajoute pas OUTPUT LAYOUT pour logo-remake', () => {
    const p = buildImagerPrompt('logo-remake', 'Grower', '', 'professional', 'all');
    expect(p).not.toContain('OUTPUT LAYOUT (mandatory)');
    expect(p).toContain('LOGO OUTPUT DISCIPLINE');
  });

  it('n’ajoute pas OUTPUT LAYOUT pour brand-icon', () => {
    const p = buildImagerPrompt('brand-icon', 'Grower', 'SaaS', 'professional', 'pros');
    expect(p).not.toContain('OUTPUT LAYOUT (mandatory)');
    expect(p).toContain('ICON DISCIPLINE');
  });

  it('couvre tous les types d’assets sans throw', () => {
    for (const t of ALL_TYPES) {
      expect(() =>
        buildImagerPrompt(t, 'Brand', 'Desc', 'professional', 'people', '', '', 'fr')
      ).not.toThrow();
    }
  });
});

describe('formatCoverInstructionForAssetType', () => {
  it('mentionne dimensions cibles pour linkedin-banner', () => {
    const s = formatCoverInstructionForAssetType('linkedin-banner');
    expect(s).toContain('1500');
    expect(s).toContain('300');
  });
});

describe('ASSET_DIMENSIONS', () => {
  it('chaque type a largeur et hauteur > 0', () => {
    for (const t of ALL_TYPES) {
      const d = ASSET_DIMENSIONS[t];
      expect(d.width, t).toBeGreaterThan(0);
      expect(d.height, t).toBeGreaterThan(0);
    }
  });
});
