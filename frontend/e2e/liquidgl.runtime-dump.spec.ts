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

test('dump runtime diagnostics for lens/card layering and visibility', async ({ page }) => {
  const outDir = path.join(process.cwd(), '..', 'artifacts', 'liquidgl', 'debug');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'runtime-state.json');

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
  await magnifier.click();
  await expect(magnifier).toHaveClass(/is-expanded/);

  const before = await magnifier.boundingBox();
  expect(before).not.toBeNull();
  if (!before) {
    throw new Error('Magnifier bounding box unavailable before drag.');
  }

  const fromX = before.x + before.width * 0.5;
  const fromY = before.y + before.height * 0.5;
  const toX = fromX + 140;
  const toY = fromY + 88;

  await page.mouse.move(fromX, fromY);
  await page.mouse.down();
  await page.mouse.move(toX, toY, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(120);

  const diagnostics = await page.evaluate(() => {
    const asNum = (v: string | null): number => {
      const parsed = Number.parseInt(v ?? '0', 10);
      return Number.isFinite(parsed) ? parsed : 0;
    };

    const shape = document.querySelector('.liquid-shape-trigger') as HTMLElement | null;
    const canvas = document.querySelector('canvas[data-liquid-ignore]') as HTMLElement | null;
    const header = document.querySelector('.result-header') as HTMLElement | null;
    const container = document.querySelector('.results-container') as HTMLElement | null;
    const title = document.querySelector('.result-card-title') as HTMLElement | null;
    const description = document.querySelector('.result-card-description') as HTMLElement | null;

    const shapeRect = shape?.getBoundingClientRect();
    const titleRect = title?.getBoundingClientRect();

    return {
      generatedAt: new Date().toISOString(),
      url: window.location.href,
      cards: {
        count: document.querySelectorAll('.marquee-card').length,
        titleCount: document.querySelectorAll('.result-card-title').length,
      },
      layering: {
        shapeZ: asNum(shape ? getComputedStyle(shape).zIndex : null),
        canvasZ: asNum(canvas ? getComputedStyle(canvas).zIndex : null),
        headerZ: asNum(header ? getComputedStyle(header).zIndex : null),
        containerZ: asNum(container ? getComputedStyle(container).zIndex : null),
      },
      visibility: {
        titleVisible: !!title && getComputedStyle(title).visibility !== 'hidden' && getComputedStyle(title).display !== 'none',
        descriptionVisible:
          !!description &&
          getComputedStyle(description).visibility !== 'hidden' &&
          getComputedStyle(description).display !== 'none',
      },
      geometry: {
        shape: shapeRect
          ? {
              x: Number(shapeRect.x.toFixed(2)),
              y: Number(shapeRect.y.toFixed(2)),
              width: Number(shapeRect.width.toFixed(2)),
              height: Number(shapeRect.height.toFixed(2)),
            }
          : null,
        firstTitle: titleRect
          ? {
              x: Number(titleRect.x.toFixed(2)),
              y: Number(titleRect.y.toFixed(2)),
              width: Number(titleRect.width.toFixed(2)),
              height: Number(titleRect.height.toFixed(2)),
            }
          : null,
      },
      webgl: {
        hasRenderer: !!(window as unknown as { __liquidGLRenderer__?: unknown }).__liquidGLRenderer__,
        hasCanvas: !!canvas,
      },
    };
  });

  const after = await magnifier.boundingBox();
  expect(after).not.toBeNull();
  if (!after) {
    throw new Error('Magnifier bounding box unavailable after drag.');
  }

  const movedBy = {
    dx: Number((after.x - before.x).toFixed(2)),
    dy: Number((after.y - before.y).toFixed(2)),
  };

  const payload = {
    ...diagnostics,
    drag: {
      from: {
        x: Number(before.x.toFixed(2)),
        y: Number(before.y.toFixed(2)),
      },
      to: {
        x: Number(after.x.toFixed(2)),
        y: Number(after.y.toFixed(2)),
      },
      movedBy,
      movedEnough: Math.abs(movedBy.dx) > 18 || Math.abs(movedBy.dy) > 18,
    },
  };

  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2));

  expect(fs.existsSync(outPath)).toBe(true);
  expect(payload.cards.count).toBeGreaterThan(0);
  expect(payload.drag.movedEnough).toBe(true);
  expect(payload.visibility.titleVisible).toBe(true);
  expect(payload.visibility.descriptionVisible).toBe(true);
});
