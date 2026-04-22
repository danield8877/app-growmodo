import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import {
  computeLuminanceStdDev,
  isProbablyUniformOutput,
  DEFAULT_BLANK_STD_DEV_THRESHOLD,
} from './imageUniformity';

describe('imageUniformity', () => {
  it('surface unie → faible écart-type', async () => {
    const buf = await sharp({
      create: {
        width: 200,
        height: 200,
        channels: 3,
        background: { r: 220, g: 210, b: 200 },
      },
    })
      .png()
      .toBuffer();
    const std = await computeLuminanceStdDev(buf);
    expect(std).toBeLessThan(DEFAULT_BLANK_STD_DEV_THRESHOLD);
    expect(isProbablyUniformOutput(std)).toBe(true);
  });

  it('deux tons côte à côte → écart-type élevé', async () => {
    const svg = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect width="60" height="120" fill="#000"/><rect x="60" width="60" height="120" fill="#fff"/></svg>`
    );
    const buf = await sharp(svg).png().toBuffer();
    const std = await computeLuminanceStdDev(buf);
    expect(std).toBeGreaterThan(15);
    expect(isProbablyUniformOutput(std)).toBe(false);
  });
});
