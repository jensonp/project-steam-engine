import { expect, test } from '@playwright/test';

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

test('dragging the liquid lens keeps key text visible', async ({ page }) => {
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

  const magnifierButton = page.locator('[data-ui-check="liquid-magnifier-button"]');
  await expect(magnifierButton).toBeVisible();

  await magnifierButton.click();
  await expect(magnifierButton).toHaveClass(/is-expanded/);

  const before = await magnifierButton.boundingBox();
  expect(before).not.toBeNull();

  if (!before) {
    throw new Error('Magnifier bounding box unavailable before drag.');
  }

  const fromX = before.x + before.width * 0.5;
  const fromY = before.y + before.height * 0.5;
  const toX = fromX + 140;
  const toY = fromY + 96;

  await page.mouse.move(fromX, fromY);
  await page.mouse.down();
  await page.mouse.move(toX, toY, { steps: 12 });
  await page.mouse.up();

  await page.waitForTimeout(120);

  const after = await magnifierButton.boundingBox();
  expect(after).not.toBeNull();

  if (!after) {
    throw new Error('Magnifier bounding box unavailable after drag.');
  }

  const movedEnough =
    Math.abs(after.x - before.x) > 18 ||
    Math.abs(after.y - before.y) > 18;
  expect(movedEnough).toBe(true);

  const visibilityState = await page.evaluate(() => {
    function isVisible(el: Element | null): boolean {
      if (!el) return false;
      const style = window.getComputedStyle(el);
      const rect = (el as HTMLElement).getBoundingClientRect();
      return (
        style.visibility !== 'hidden' &&
        style.display !== 'none' &&
        Number.parseFloat(style.opacity || '1') > 0.2 &&
        rect.width > 0 &&
        rect.height > 0 &&
        rect.bottom > 0 &&
        rect.right > 0 &&
        rect.top < window.innerHeight &&
        rect.left < window.innerWidth
      );
    }

    function hasReadableColor(el: Element | null): boolean {
      if (!el) return false;
      const color = window.getComputedStyle(el).color.trim().toLowerCase();
      if (color === 'transparent') return false;
      if (color.endsWith(', 0)')) return false;
      return true;
    }

    const summary = document.querySelector('.result-summary');
    const firstTitle = document.querySelector('.result-card-title');
    const firstDescription = document.querySelector('.result-card-description');

    return {
      summaryVisible: isVisible(summary) && hasReadableColor(summary),
      titleVisible: isVisible(firstTitle) && hasReadableColor(firstTitle),
      descriptionVisible: isVisible(firstDescription) && hasReadableColor(firstDescription),
    };
  });

  expect(visibilityState.summaryVisible).toBe(true);
  expect(visibilityState.titleVisible).toBe(true);
  expect(visibilityState.descriptionVisible).toBe(true);
});
