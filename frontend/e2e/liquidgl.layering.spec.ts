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

test('liquidGL applies demo-4 cards and maintains layer ordering', async ({ page }) => {
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
  await expect(page.locator('.marquee-content')).toHaveCount(mockSearchResults.length);
  await expect(page.locator('.liquid-shell')).toHaveCount(0);
  await expect(page.locator('.liquid-rim')).toHaveCount(0);
  await expect(page.locator('.liquid-specular')).toHaveCount(0);
  await expect(page.locator('.liquid-noise')).toHaveCount(0);

  await expect(page.locator('[data-ui-check="liquid-glass-menu"]')).toBeVisible({ timeout: 10000 });

  await page.waitForFunction(() => {
    const shape = document.querySelector('.liquid-shape-trigger') as HTMLElement | null;
    const canvas = document.querySelector('canvas[data-liquid-ignore]') as HTMLElement | null;
    const header = document.querySelector('.result-header') as HTMLElement | null;
    const container = document.querySelector('.results-container') as HTMLElement | null;
    const backButton = document.querySelector('.back-button') as HTMLElement | null;
    const first = document.querySelector('.marquee-card') as HTMLElement | null;
    const second = document.querySelectorAll('.marquee-card')[1] as HTMLElement | undefined;
    if (!shape || !header || !container || !backButton || !first || !second) return false;

    const asNum = (z: string): number => {
      const parsed = Number.parseInt(z, 10);
      return Number.isFinite(parsed) ? parsed : 0;
    };

    const shapeZ = asNum(getComputedStyle(shape).zIndex);
    const headerZ = asNum(getComputedStyle(header).zIndex);
    const containerZ = asNum(getComputedStyle(container).zIndex);
    const backButtonZ = asNum(getComputedStyle(backButton).zIndex);
    const firstOpacity = Number.parseFloat(getComputedStyle(first).opacity);
    const secondOpacity = Number.parseFloat(getComputedStyle(second).opacity);
    const cardCount = document.querySelectorAll('.results-container .marquee-card').length;
    const hasDiagnostics = !!document.querySelector('.liquid-diagnostics');

    const validStack =
      shapeZ > containerZ &&
      backButtonZ > containerZ &&
      headerZ >= containerZ;
    const allCardsPresent = cardCount >= 3;
    const visibleCards = firstOpacity > 0.85 && secondOpacity > 0.85;
    const cardSizingStable =
      first.getBoundingClientRect().width > 200 &&
      second.getBoundingClientRect().width > 200;
    const hasRenderer = !!(
      window as unknown as { __liquidGLRenderer__?: unknown }
    ).__liquidGLRenderer__;
    const webglLayeringValid = canvas
      ? asNum(getComputedStyle(canvas).zIndex) > containerZ &&
        shapeZ > asNum(getComputedStyle(canvas).zIndex) &&
        getComputedStyle(canvas).pointerEvents === 'none'
      : hasDiagnostics && !hasRenderer;

    return validStack && allCardsPresent && visibleCards && cardSizingStable && webglLayeringValid;
  }, { timeout: 12000 });
});
