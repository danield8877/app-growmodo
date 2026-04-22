import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import { normalizeImageBufferForAsset, resizeOptionsForAsset } from './normalizeAssetImage';

describe('resizeOptionsForAsset', () => {
  it('logo-remake utilise contain + fond', () => {
    const o = resizeOptionsForAsset('logo-remake', 1024, 1024);
    expect(o.fit).toBe('contain');
    expect(o.background).toBeDefined();
  });

  it('facebook-ad utilise cover sans fond forcé', () => {
    const o = resizeOptionsForAsset('facebook-ad', 1200, 628);
    expect(o.fit).toBe('cover');
    expect(o.background).toBeUndefined();
    expect(o.position).toBe('centre');
  });

  it('linkedin-banner utilise cover + south (visuel bas de l’image source)', () => {
    const o = resizeOptionsForAsset('linkedin-banner', 1500, 300);
    expect(o.fit).toBe('cover');
    expect(o.position).toBe('south');
  });

  it('email-signature utilise cover + south', () => {
    const o = resizeOptionsForAsset('email-signature', 600, 200);
    expect(o.fit).toBe('cover');
    expect(o.position).toBe('south');
  });
});

describe('normalizeImageBufferForAsset', () => {
  it('produit exactement les dimensions demandées (facebook-ad)', async () => {
    const src = await sharp({
      create: {
        width: 400,
        height: 400,
        channels: 3,
        background: { r: 100, g: 150, b: 200 },
      },
    })
      .png()
      .toBuffer();

    const out = await normalizeImageBufferForAsset(src, 1200, 628, 'facebook-ad');
    const meta = await sharp(out).metadata();
    expect(meta.width).toBe(1200);
    expect(meta.height).toBe(628);
  });

  it('signature email 600×200 remplit le cadre (cover)', async () => {
    const src = await sharp({
      create: {
        width: 800,
        height: 800,
        channels: 3,
        background: { r: 200, g: 50, b: 50 },
      },
    })
      .png()
      .toBuffer();

    const out = await normalizeImageBufferForAsset(src, 600, 200, 'email-signature');
    const meta = await sharp(out).metadata();
    expect(meta.width).toBe(600);
    expect(meta.height).toBe(200);
  });
});
