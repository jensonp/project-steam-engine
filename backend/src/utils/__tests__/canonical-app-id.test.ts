import { canonicalizeAppId, extractCanonicalAppIdFromHeaderImage } from '../canonical-app-id';

describe('canonical app id utilities', () => {
  it('extracts canonical app id from Steam header image path', () => {
    const canonical = extractCanonicalAppIdFromHeaderImage(
      'https://cdn.cloudflare.steamstatic.com/steam/apps/10180/header.jpg'
    );
    expect(canonical).toBe(10180);
  });

  it('falls back to original app id when no Steam app id can be inferred', () => {
    expect(canonicalizeAppId(730, 'https://example.com/image.jpg')).toBe(730);
    expect(canonicalizeAppId(730, null)).toBe(730);
  });
});
