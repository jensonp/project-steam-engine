import { expect, test } from '@playwright/test';

function parseScaleFromMatrix(transform: string): number {
  if (!transform || transform === 'none') return 1;
  const match = transform.match(/matrix\(([^)]+)\)/);
  if (!match) return 1;
  const values = match[1].split(',').map((v) => Number.parseFloat(v.trim()));
  if (!Number.isFinite(values[0])) return 1;
  return values[0];
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    // Disable the 3D valve during transition tests to remove WebGL noise.
    window.localStorage.setItem('ui.query.valveEnabled', '0');
  });
});

test('Suggest Games hover uses gradual growth timing', async ({ page }) => {
  await page.goto('/');
  const button = page.locator('[data-ui-check="search-button"]');
  await button.waitFor();
  await button.scrollIntoViewIfNeeded();

  const initialTransition = await button.evaluate((el) => getComputedStyle(el as HTMLElement).transition);
  expect(initialTransition).toContain('transform 0.92s');

  await button.hover({ force: true });
  await page.waitForTimeout(260);
  const earlyScale = await button.evaluate((el) =>
    parseFloat((() => {
      const transform = getComputedStyle(el as HTMLElement).transform;
      const match = transform.match(/matrix\(([^)]+)\)/);
      if (!match) return '1';
      const values = match[1].split(',').map((v) => Number.parseFloat(v.trim()));
      return Number.isFinite(values[0]) ? values[0].toFixed(5) : '1';
    })())
  );

  await page.waitForTimeout(820);
  const finalTransform = await button.evaluate((el) => getComputedStyle(el as HTMLElement).transform);
  const finalScale = parseScaleFromMatrix(finalTransform);

  // Early sample should not jump straight to full size.
  expect(earlyScale).toBeGreaterThan(1.003);
  expect(earlyScale).toBeLessThan(1.03);
  // Final hover scale should settle around the target envelope.
  expect(finalScale).toBeGreaterThan(1.033);
  expect(finalScale).toBeLessThan(1.042);
});

test('Route transition fades in and out during query -> results navigation', async ({ page }) => {
  const responseBody = [
    {
      appId: 10,
      name: 'Counter-Strike',
      genres: ['Action'],
      isFree: true,
      description: 'Competitive FPS',
      headerImage: 'https://cdn.example.com/cs.jpg',
      price: 0,
    },
  ];

  await page.route('**/api/search**', (route) => {
    void route.fulfill({
      status: 200,
      contentType: 'application/json; charset=utf-8',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify(responseBody),
    });
  });

  await page.route('**/api/recommend/user/**', (route) => {
    void route.fulfill({
      status: 200,
      contentType: 'application/json; charset=utf-8',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify(responseBody),
    });
  });

  await page.goto('/');
  const button = page.locator('[data-ui-check="search-button"]');
  await button.waitFor();
  await button.scrollIntoViewIfNeeded();
  const samplerPromise = page.evaluate(async () => {
    const output: Array<{ opacity: number; classes: string; visibility: string; t: number }> = [];
    const start = performance.now();
    while (performance.now() - start <= 2400) {
      const overlay = document.querySelector('.route-transition-overlay') as HTMLElement | null;
      const styles = overlay ? getComputedStyle(overlay) : null;
      output.push({
        opacity: Number.parseFloat(styles?.opacity ?? '0'),
        classes: overlay?.className ?? '',
        visibility: styles?.visibility ?? 'hidden',
        t: performance.now() - start,
      });
      await new Promise((resolve) => setTimeout(resolve, 40));
    }
    return output;
  });

  await page.waitForTimeout(40);
  await button.click();
  await expect(page).toHaveURL(/\/results$/);
  const samples = await samplerPromise;

  const opacities = samples.map((s) => s.opacity);
  const maxOpacity = Math.max(...opacities);
  const sawVisibleClass = samples.some((s) => s.classes.includes('is-visible'));
  const finalSample = samples[samples.length - 1];

  expect(sawVisibleClass).toBeTruthy();
  expect(maxOpacity).toBeGreaterThan(0.4);
  expect(finalSample.opacity).toBeLessThanOrEqual(0.01);
  expect(finalSample.classes).toBe('route-transition-overlay');
  expect(finalSample.visibility).toBe('hidden');
});

test('Result card keeps rounded corners and smooth hover transform', async ({ page }) => {
  const responseBody = [
    {
      appId: 10,
      name: 'Counter-Strike',
      genres: ['Action'],
      isFree: true,
      description: 'Competitive FPS',
      headerImage: 'https://cdn.example.com/cs.jpg',
      price: 0,
    },
  ];

  await page.route('**/api/search**', (route) => {
    void route.fulfill({
      status: 200,
      contentType: 'application/json; charset=utf-8',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify(responseBody),
    });
  });

  await page.route('**/api/recommend/user/**', (route) => {
    void route.fulfill({
      status: 200,
      contentType: 'application/json; charset=utf-8',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify(responseBody),
    });
  });

  await page.goto('/');
  await page.fill('[data-ui-check="keyword-field"] input', 'portal');
  await page.click('[data-ui-check="search-button"]');
  await expect(page).toHaveURL(/\/results$/);
  const card = page.locator('.game-card').first();
  await card.waitFor();
  await card.scrollIntoViewIfNeeded();

  const beforeHover = await card.evaluate((el) => {
    const s = getComputedStyle(el as HTMLElement);
    return {
      borderRadius: s.borderRadius,
      transition: s.transition,
      transform: s.transform,
    };
  });

  await card.hover({ force: true });
  await page.waitForTimeout(260);

  const duringHover = await card.evaluate((el) => {
    const s = getComputedStyle(el as HTMLElement);
    return {
      hovered: (el as HTMLElement).matches(':hover'),
      borderRadius: s.borderRadius,
      transform: s.transform,
    };
  });

  const hoverScale = parseScaleFromMatrix(duringHover.transform);

  expect(beforeHover.borderRadius).toBe('20px');
  expect(beforeHover.transition).toContain('transform 0.54s');
  expect(duringHover.hovered).toBeTruthy();
  expect(duringHover.borderRadius).toBe('20px');
  expect(hoverScale).toBeGreaterThan(1.004);
  expect(hoverScale).toBeLessThan(1.02);
});
