import { expect, test } from '@playwright/test';

const mockSearchResults = [
  {
    appId: 1245620,
    name: 'ELDEN RING',
    genres: ['Action', 'RPG'],
    headerImage: 'https://cdn.example.com/elden-ring.jpg',
    price: 38.99,
    isFree: false,
    description: 'Rise, Tarnished, and become an Elden Lord.',
  },
  {
    appId: 292030,
    name: 'The Witcher 3: Wild Hunt',
    genres: ['RPG'],
    headerImage: 'https://cdn.example.com/witcher3.jpg',
    price: 3.99,
    isFree: false,
    description: 'A story-driven open world RPG set in a dark fantasy universe.',
  },
  {
    appId: 1091500,
    name: 'Cyberpunk 2077',
    genres: ['RPG', 'Action'],
    headerImage: 'https://cdn.example.com/cyberpunk2077.jpg',
    price: 59.99,
    isFree: false,
    description: 'An open-world, action-adventure RPG set in Night City.',
  },
];

function jsonHeaders(): Record<string, string> {
  return {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
  };
}

async function resetLocalState(page: import('@playwright/test').Page): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
}

test('suggest button hover uses crowbar cursor', async ({ page }) => {
  await resetLocalState(page);
  await page.goto('/');
  await page.waitForSelector('[data-ui-check="search-button"]');

  await page.hover('[data-ui-check="search-button"]');

  const cursorValue = await page
    .locator('[data-ui-check="search-button"]')
    .evaluate(el => getComputedStyle(el).cursor);
  expect(cursorValue).toContain('crowbar-cursor.svg');
});

test('suggest button hover does not render legacy katana overlay', async ({ page }) => {
  await resetLocalState(page);
  await page.goto('/');
  await page.waitForSelector('[data-ui-check="search-button"]');

  await page.hover('[data-ui-check="search-button"]');
  await expect(page.locator('.katana-cursor')).toHaveCount(0);
});

test('query flow renders result cards from /api/search response', async ({ page }) => {
  await resetLocalState(page);

  let searchHits = 0;
  let recommendationHits = 0;

  await page.route('**/api/search**', route => {
    searchHits += 1;
    void route.fulfill({
      status: 200,
      headers: jsonHeaders(),
      body: JSON.stringify(mockSearchResults),
    });
  });

  await page.route('**/api/recommend/user/**', route => {
    recommendationHits += 1;
    void route.fulfill({
      status: 200,
      headers: jsonHeaders(),
      body: JSON.stringify(mockSearchResults),
    });
  });

  await page.goto('/');
  await page.waitForSelector('[data-ui-check="search-button"]');

  const queryRequestPromise = Promise.race([
    page.waitForRequest('**/api/search**'),
    page.waitForRequest('**/api/recommend/user/**'),
  ]);

  await page.click('[data-ui-check="search-button"]');
  await queryRequestPromise;

  await expect(page).toHaveURL(/\/results$/);
  await expect(page.locator('.game-card')).toHaveCount(mockSearchResults.length);
  await expect(page.locator('.result-summary')).toContainText(`${mockSearchResults.length} titles`);
  await expect(page.locator('.game-title').first()).toContainText('ELDEN RING');
  expect(searchHits + recommendationHits).toBeGreaterThan(0);
});

test('query flow shows empty state when /api/search returns an empty array', async ({ page }) => {
  await resetLocalState(page);

  await page.route('**/api/search**', route => {
    void route.fulfill({
      status: 200,
      headers: jsonHeaders(),
      body: JSON.stringify([]),
    });
  });

  await page.route('**/api/recommend/user/**', route => {
    void route.fulfill({
      status: 200,
      headers: jsonHeaders(),
      body: JSON.stringify([]),
    });
  });

  await page.goto('/');
  await page.waitForSelector('[data-ui-check="search-button"]');

  await page.click('[data-ui-check="search-button"]');

  await expect(page).toHaveURL(/\/results$/);
  await expect(page.locator('app-game-card')).toHaveCount(0);
  await expect(page.locator('.empty-state')).toBeVisible();
});

test('query flow surfaces backend errors and does not navigate', async ({ page }) => {
  await resetLocalState(page);

  await page.route('**/api/search**', route => {
    void route.fulfill({
      status: 503,
      headers: jsonHeaders(),
      body: JSON.stringify({
        error: 'Search database is unavailable. Configure PostgreSQL connection variables.',
      }),
    });
  });

  await page.route('**/api/recommend/user/**', route => {
    void route.fulfill({
      status: 503,
      headers: jsonHeaders(),
      body: JSON.stringify({
        error: 'Search database is unavailable. Configure PostgreSQL connection variables.',
      }),
    });
  });

  await page.goto('/');
  await page.waitForSelector('[data-ui-check="search-button"]');

  const failedSearchResponse = page.waitForResponse(
    response => response.url().includes('/api/search') && response.status() === 503
  );

  await page.click('[data-ui-check="search-button"]');
  await failedSearchResponse;

  await expect(page).toHaveURL(/\/$/);
  await expect.poll(async () => page.evaluate(() => {
    try {
      const raw = localStorage.getItem('appState');
      const parsed = raw ? JSON.parse(raw) : null;
      return parsed?.error ?? null;
    } catch {
      return null;
    }
  })).toContain('Search database is unavailable');
});
