import { expect, test } from '@playwright/test';

const mockSearchResults = [
  {
    appId: 400,
    name: 'Portal',
    genres: ['Puzzle', 'Action'],
    headerImage: 'https://cdn.example.com/portal.jpg',
    price: 1.99,
    isFree: false,
    description: 'The classic Aperture puzzle shooter.',
  },
  {
    appId: 620,
    name: 'Portal 2',
    genres: ['Puzzle', 'Action', 'Co-op'],
    headerImage: 'https://cdn.example.com/portal2.jpg',
    price: 1.99,
    isFree: false,
    description: 'Cooperative and single player puzzle chambers.',
  },
  {
    appId: 730,
    name: 'Counter-Strike 2',
    genres: ['Action', 'FPS'],
    headerImage: 'https://cdn.example.com/cs2.jpg',
    price: 0,
    isFree: true,
    description: 'Competitive tactical FPS.',
  },
];

function jsonHeaders(): Record<string, string> {
  return {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
  };
}

test('cards remain visible when liquidGL falls back (no WebGL)', async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { __liquidGLNoWebGL__?: boolean }).__liquidGLNoWebGL__ = true;
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
  const cards = page.locator('.marquee-card');
  await expect(cards).toHaveCount(mockSearchResults.length);

  await page.waitForFunction(() => {
    const list = Array.from(document.querySelectorAll<HTMLElement>('.marquee-card'));
    if (list.length < 3) return false;

    return list.every(card => {
      const style = getComputedStyle(card);
      const opacity = Number.parseFloat(style.opacity || '1');
      const rect = card.getBoundingClientRect();
      return (
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        opacity > 0.85 &&
        rect.width > 200 &&
        rect.height > 120
      );
    });
  }, { timeout: 12000 });

  const diagnostics = page.locator('.liquid-diagnostics');
  await expect(diagnostics).toContainText(/fallback mode/i);

  const visibility = await page.evaluate(() => {
    const firstTitle = document.querySelector('.result-card-title') as HTMLElement | null;
    const firstDescription = document.querySelector('.result-card-description') as HTMLElement | null;

    const isVisible = (el: HTMLElement | null): boolean => {
      if (!el) return false;
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return (
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        Number.parseFloat(style.opacity || '1') > 0.2 &&
        rect.width > 40 &&
        rect.height > 12
      );
    };

    return {
      titleVisible: isVisible(firstTitle),
      descriptionVisible: isVisible(firstDescription),
      hasRenderer: !!(window as unknown as { __liquidGLRenderer__?: unknown }).__liquidGLRenderer__,
      forcedNoWebGL: !!(window as unknown as { __liquidGLNoWebGL__?: boolean }).__liquidGLNoWebGL__,
    };
  });

  expect(visibility.titleVisible).toBe(true);
  expect(visibility.descriptionVisible).toBe(true);
  expect(visibility.hasRenderer).toBe(false);
  expect(visibility.forcedNoWebGL).toBe(true);
});
