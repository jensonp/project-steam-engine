import { expect, test } from '@playwright/test';

const mockSearchResults = Array.from({ length: 10 }, (_, index) => {
  const appId = 5000 + index;
  return {
    appId,
    name: `Steam Title ${index + 1}`,
    genres: ['Action', 'Indie'],
    headerImage: '/steam.png',
    price: index % 3 === 0 ? 0 : 9.99 + index,
    isFree: index % 3 === 0,
    description: `Synthetic recommendation entry ${index + 1} used for liquidGL visibility and layering checks.`,
  };
});

function jsonHeaders(): Record<string, string> {
  return {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
  };
}

test('occlusion guard keeps result cards readable in collapsed and expanded lens modes', async ({ page }) => {
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
    const container = document.querySelector('.results-container') as HTMLElement | null;
    const shape = document.querySelector('.liquid-shape-trigger') as HTMLElement | null;
    if (!container || !shape) return false;

    const titleNodes = Array.from(document.querySelectorAll<HTMLElement>('.result-card-title'));
    const topTitles = titleNodes.slice(0, 5);
    if (topTitles.length < 5) return false;

    const isVisible = (el: HTMLElement): boolean => {
      const style = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return (
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        Number.parseFloat(style.opacity || '1') > 0.2 &&
        rect.width > 10 &&
        rect.height > 10
      );
    };

    const titlesVisible = topTitles.every(isVisible);
    if (!titlesVisible) return false;

    const hasRenderer = !!(
      window as unknown as { __liquidGLRenderer__?: unknown }
    ).__liquidGLRenderer__;
    const canvas = document.querySelector('canvas[data-liquid-ignore]') as HTMLElement | null;
    const parseZ = (z: string): number => {
      const value = Number.parseInt(z, 10);
      return Number.isFinite(value) ? value : 0;
    };

    if (hasRenderer && canvas) {
      const canvasZ = parseZ(getComputedStyle(canvas).zIndex);
      const containerZ = parseZ(getComputedStyle(container).zIndex);
      if (canvasZ >= containerZ) return false;
    }

    return !shape.classList.contains('is-expanded');
  }, { timeout: 15000 });

  const magnifierButton = page.locator('[data-ui-check="liquid-magnifier-button"]');
  await expect(magnifierButton).toBeVisible();
  await magnifierButton.click();
  await expect(magnifierButton).toHaveClass(/is-expanded/);

  await page.waitForFunction(() => {
    const titleNodes = Array.from(document.querySelectorAll<HTMLElement>('.result-card-title'));
    const topTitles = titleNodes.slice(0, 3);
    if (topTitles.length < 3) return false;

    return topTitles.every(title => {
      const style = getComputedStyle(title);
      const rect = title.getBoundingClientRect();
      return (
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        Number.parseFloat(style.opacity || '1') > 0.2 &&
        rect.width > 10 &&
        rect.height > 10
      );
    });
  }, { timeout: 12000 });

  await magnifierButton.click();
  await expect(magnifierButton).not.toHaveClass(/is-expanded/);
});
