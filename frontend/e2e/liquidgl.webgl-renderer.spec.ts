import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const mockSearchResults = [
  {
    appId: 730,
    name: 'Counter-Strike 2',
    genres: ['Action', 'Free To Play'],
    headerImage: 'https://cdn.akamai.steamstatic.com/steam/apps/730/header.jpg',
    price: 0,
    isFree: true,
    description: 'Competitive tactical FPS with smoke and map updates.',
  },
  {
    appId: 570,
    name: 'Dota 2',
    genres: ['Action', 'Strategy', 'Free To Play'],
    headerImage: 'https://cdn.akamai.steamstatic.com/steam/apps/570/header.jpg',
    price: 0,
    isFree: true,
    description: 'Team-based strategy combat in a five versus five arena.',
  },
  {
    appId: 400,
    name: 'Portal',
    genres: ['Puzzle', 'Action'],
    headerImage: 'https://cdn.akamai.steamstatic.com/steam/apps/400/header.jpg',
    price: 9.99,
    isFree: false,
    description: 'Portal-based puzzle game in Aperture Science.',
  },
];

function jsonHeaders(): Record<string, string> {
  return {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
  };
}

test('webgl mode mounts renderer and keeps first-card text readable', async ({ page }) => {
  const outDir = path.join(process.cwd(), '..', 'artifacts', 'liquidgl', 'design');
  fs.mkdirSync(outDir, { recursive: true });

  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  await page.route('**/api/search**', route => {
    void route.fulfill({
      status: 200,
      headers: jsonHeaders(),
      body: JSON.stringify(mockSearchResults),
    });
  });

  await page.goto('/');
  await page.waitForSelector('[data-ui-check="search-button"]');
  await page.click('[data-ui-check="search-button"]');
  await expect(page).toHaveURL(/\/results$/);

  await expect(page.locator('.marquee-card')).toHaveCount(mockSearchResults.length);
  await expect(page.locator('.result-card-lens')).toHaveCount(mockSearchResults.length);

  await page.waitForFunction(() => {
    const hasRenderer = !!(window as unknown as { __liquidGLRenderer__?: unknown }).__liquidGLRenderer__;
    const forcedNoWebGL = !!(window as unknown as { __liquidGLNoWebGL__?: boolean }).__liquidGLNoWebGL__;
    const canvas = document.querySelector('canvas[data-liquid-ignore]') as HTMLElement | null;
    return hasRenderer && !forcedNoWebGL && !!canvas;
  }, { timeout: 15000 });

  const diagnostics = page.locator('.liquid-diagnostics');
  await expect(diagnostics).toHaveCount(0);

  const geometry = await page.evaluate(() => {
    const card = document.querySelector('.marquee-card') as HTMLElement | null;
    const lens = document.querySelector('.result-card-lens') as HTMLElement | null;
    const title = document.querySelector('.result-card-title') as HTMLElement | null;
    const canvas = document.querySelector('canvas[data-liquid-ignore]') as HTMLElement | null;

    if (!card || !lens || !title || !canvas) {
      return null;
    }

    const cardRect = card.getBoundingClientRect();
    const lensRect = lens.getBoundingClientRect();
    const titleRect = title.getBoundingClientRect();
    const titleStyle = getComputedStyle(title);
    const topAtTitleCenter = document.elementFromPoint(
      titleRect.left + titleRect.width * 0.5,
      titleRect.top + titleRect.height * 0.5
    );

    const parseZ = (value: string): number => {
      const parsed = Number.parseInt(value, 10);
      return Number.isFinite(parsed) ? parsed : 0;
    };

    return {
      cardWidth: cardRect.width,
      lensWidth: lensRect.width,
      lensLeft: lensRect.left,
      cardLeft: cardRect.left,
      titleVisible:
        titleStyle.display !== 'none' &&
        titleStyle.visibility !== 'hidden' &&
        Number.parseFloat(titleStyle.opacity || '1') > 0.3 &&
        titleRect.width > 30 &&
        titleRect.height > 16,
      titleTopElementClass: topAtTitleCenter instanceof HTMLElement ? topAtTitleCenter.className : '',
      canvasZ: parseZ(getComputedStyle(canvas).zIndex),
    };
  });

  expect(geometry).not.toBeNull();
  if (!geometry) {
    throw new Error('Missing first-card geometry for webgl renderer check.');
  }

  // Lens must remain controlled in width to avoid full-card distortion blobs.
  expect(geometry.lensWidth).toBeLessThanOrEqual(580);
  expect(geometry.lensWidth).toBeLessThan(geometry.cardWidth * 0.76);
  // Lens should be anchored toward the right side of the card.
  expect(geometry.lensLeft).toBeGreaterThan(geometry.cardLeft + geometry.cardWidth * 0.2);
  expect(geometry.titleVisible).toBe(true);
  expect(geometry.canvasZ).toBeLessThan(32);

  const screenshotPath = path.join(outDir, 'webgl-renderer-check.png');
  await page.screenshot({ path: screenshotPath, fullPage: true });
  expect(fs.existsSync(screenshotPath)).toBe(true);
});
