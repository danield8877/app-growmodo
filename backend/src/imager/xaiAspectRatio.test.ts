import { describe, it, expect } from 'vitest';
import { xaiAspectRatioFromDimensions } from './xaiAspectRatios';

describe('xaiAspectRatioFromDimensions', () => {
  it('1:1 pour carré', () => {
    expect(xaiAspectRatioFromDimensions(1080, 1080)).toBe('1:1');
  });

  it('Facebook 1200×628 → ratio le plus proche (2:1)', () => {
    expect(xaiAspectRatioFromDimensions(1200, 628)).toBe('2:1');
  });

  it('bannière LinkedIn 1500×300 (très large) → 20:9', () => {
    expect(xaiAspectRatioFromDimensions(1500, 300)).toBe('20:9');
  });

  it('signature email 600×200 → 20:9', () => {
    expect(xaiAspectRatioFromDimensions(600, 200)).toBe('20:9');
  });

  it('story 1080×1920 → 9:16', () => {
    expect(xaiAspectRatioFromDimensions(1080, 1920)).toBe('9:16');
  });
});
