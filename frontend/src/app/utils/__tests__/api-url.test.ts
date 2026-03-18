import { normalizeApiUrl } from '../api-url';

describe('normalizeApiUrl', () => {
  it('adds https protocol when host is missing a scheme', () => {
    expect(normalizeApiUrl('project-steam-engine-production.up.railway.app')).toBe(
      'https://project-steam-engine-production.up.railway.app'
    );
  });

  it('preserves explicit http and trims trailing slashes', () => {
    expect(normalizeApiUrl('http://localhost:3000/')).toBe('http://localhost:3000');
  });

  it('falls back to localhost when empty input is provided', () => {
    expect(normalizeApiUrl('')).toBe('http://localhost:3000');
  });
});
