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
];

function jsonHeaders(): Record<string, string> {
  return {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
  };
}

test('results route mounts liquidGL controls and runtime checks', async ({ page }) => {
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
  await expect(page.locator('.game-card')).toHaveCount(mockSearchResults.length);
  await expect(page.locator('.game-card.liquidgl-primary-card')).toHaveCount(1);
  await expect(page.locator('.results-container .game-card').first()).toHaveClass(/liquidgl-primary-card/);
  const magnifierButton = page.locator('[data-ui-check="liquid-magnifier-button"]');
  await expect(magnifierButton).toBeVisible();

  await magnifierButton.click();
  await expect(magnifierButton).toHaveClass(/is-expanded/);

  await magnifierButton.click();
  await expect(magnifierButton).not.toHaveClass(/is-expanded/);

  const menu = page.locator('[data-ui-check="liquid-glass-menu"]');
  await expect(menu).toBeVisible({ timeout: 10000 });

  const diagnostics = page.locator('.liquid-diagnostics');
  const summary = await page.evaluate(() => {
    const hasRenderer = !!(window as unknown as { __liquidGLRenderer__?: unknown }).__liquidGLRenderer__;
    const hasDiagnostics = !!document.querySelector('.liquid-diagnostics');
    return { hasRenderer, hasDiagnostics };
  });

  // Either full WebGL renderer is active, or explicit fallback diagnostics is shown.
  expect(summary.hasRenderer || summary.hasDiagnostics).toBe(true);

  // If fallback is active, message should be visible and actionable.
  if (await diagnostics.count()) {
    await expect(diagnostics).toContainText(/LiquidGL/i);
  }
});
