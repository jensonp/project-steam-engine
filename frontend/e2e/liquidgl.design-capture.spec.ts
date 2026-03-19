import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const mockSearchResults = [
  {
    appId: 400,
    name: 'Portal',
    genres: ['Puzzle', 'Action'],
    headerImage: 'https://cdn.example.com/portal.jpg',
    price: 1.99,
    isFree: false,
    description: 'The classic Aperture puzzle shooter with portal-based movement.',
  },
  {
    appId: 620,
    name: 'Portal 2',
    genres: ['Puzzle', 'Action', 'Co-op'],
    headerImage: 'https://cdn.example.com/portal2.jpg',
    price: 1.99,
    isFree: false,
    description: 'Cooperative and single player puzzle chambers with extensive dialogue.',
  },
  {
    appId: 730,
    name: 'Counter-Strike 2',
    genres: ['Action', 'FPS'],
    headerImage: 'https://cdn.example.com/cs2.jpg',
    price: 0,
    isFree: true,
    description: 'Competitive tactical FPS with updated map and smoke systems.',
  },
];

function jsonHeaders(): Record<string, string> {
  return {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
  };
}

test('capture design screenshots for liquidGL results workflow', async ({ page }) => {
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

  const magnifier = page.locator('[data-ui-check="liquid-magnifier-button"]');
  await expect(magnifier).toBeVisible();

  const initialPath = path.join(outDir, 'results-initial.png');
  await page.screenshot({ path: initialPath, fullPage: true });

  await magnifier.click();
  await expect(magnifier).toHaveClass(/is-expanded/);

  const expandedPath = path.join(outDir, 'lens-expanded.png');
  await page.screenshot({ path: expandedPath, fullPage: true });

  const before = await magnifier.boundingBox();
  expect(before).not.toBeNull();
  if (!before) {
    throw new Error('Magnifier bounding box unavailable before drag.');
  }

  const fromX = before.x + before.width * 0.5;
  const fromY = before.y + before.height * 0.5;
  const toX = fromX + 150;
  const toY = fromY + 90;

  await page.mouse.move(fromX, fromY);
  await page.mouse.down();
  await page.mouse.move(toX, toY, { steps: 14 });
  await page.mouse.up();
  await page.waitForTimeout(120);

  const draggedPath = path.join(outDir, 'lens-dragged.png');
  await page.screenshot({ path: draggedPath, fullPage: true });

  const paths = [initialPath, expandedPath, draggedPath];
  for (const screenshotPath of paths) {
    expect(fs.existsSync(screenshotPath)).toBe(true);
  }
});
