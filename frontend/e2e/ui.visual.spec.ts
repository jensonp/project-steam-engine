import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const VIEWPORTS = [
  { name: 'desktop-wide', width: 1440, height: 900 },
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'tablet', width: 1024, height: 768 },
  { name: 'mobile', width: 390, height: 844 },
];

const CONTROL_PAIRS_NO_OVERLAP = [
  ['steam-field', 'load-profile-button'],
  ['os-field', 'detect-os-button'],
] as const;

const REQUIRED_SELECTORS = [
  'search-container',
  'terminal-panel',
  'steam-field',
  'load-profile-button',
  'genre-field',
  'player-count-field',
  'os-field',
  'detect-os-button',
  'keyword-field',
  'search-button',
];

async function disableMotion(page: import('@playwright/test').Page): Promise<void> {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation: none !important;
        transition: none !important;
      }
    `,
  });
}

for (const viewport of VIEWPORTS) {
  test(`Query page visual baseline: ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('/');
    await page.waitForSelector('[data-ui-check="terminal-panel"]');
    await disableMotion(page);

    await expect(page).toHaveScreenshot(`query-${viewport.name}.png`, {
      fullPage: true,
      maxDiffPixelRatio: 0.015,
    });
  });

  test(`Query page geometry (no overlap / clipping): ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('/');
    await page.waitForSelector('[data-ui-check="terminal-panel"]');
    await disableMotion(page);

    type GeometryResult = {
      missing: string[];
      overlaps: string[];
      outsidePanel: string[];
      labelOverflow: string[];
      clipped: string[];
      viewportOverflow: string[];
    };

    const result = await page.evaluate(
      ({ requiredSelectors, noOverlapPairs }) => {
        type Rect = {
          left: number;
          top: number;
          right: number;
          bottom: number;
          width: number;
          height: number;
        };

        const byName = (name: string): HTMLElement | null =>
          document.querySelector(`[data-ui-check="${name}"]`);

        const asRect = (el: Element): Rect => {
          const r = el.getBoundingClientRect();
          return {
            left: r.left,
            top: r.top,
            right: r.right,
            bottom: r.bottom,
            width: r.width,
            height: r.height,
          };
        };

        const overlaps = (a: Rect, b: Rect): boolean =>
          !(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top);

        const missing: string[] = [];
        const rects = new Map<string, Rect>();
        for (const name of requiredSelectors) {
          const el = byName(name);
          if (!el) {
            missing.push(name);
            continue;
          }
          rects.set(name, asRect(el));
        }

        const overlapFailures: string[] = [];
        for (const [a, b] of noOverlapPairs) {
          const ra = rects.get(a);
          const rb = rects.get(b);
          if (!ra || !rb) continue;
          if (overlaps(ra, rb)) {
            overlapFailures.push(`${a} overlaps ${b}`);
          }
        }

        const outsidePanel: string[] = [];
        const panelRect = rects.get('terminal-panel');
        if (panelRect) {
          for (const [name, rect] of rects.entries()) {
            if (name === 'search-container' || name === 'terminal-panel') continue;
            const outside =
              rect.left < panelRect.left - 1 ||
              rect.right > panelRect.right + 1 ||
              rect.top < panelRect.top - 1 ||
              rect.bottom > panelRect.bottom + 1;
            if (outside) outsidePanel.push(name);
          }
        }

        const labelOverflow: string[] = [];
        for (const name of ['steam-field', 'genre-field', 'player-count-field', 'os-field', 'keyword-field']) {
          const field = byName(name);
          if (!field) continue;

          const label = field.querySelector('.mdc-floating-label') as HTMLElement | null;
          const content = field.querySelector('.mat-mdc-form-field-infix') as HTMLElement | null;
          if (!label || !content) continue;

          const availableWidth = content.clientWidth - 12;
          if (label.scrollWidth > availableWidth) {
            labelOverflow.push(name);
          }
        }

        const clipped: string[] = [];
        for (const name of ['load-profile-button', 'detect-os-button', 'search-button']) {
          const el = byName(name);
          if (!el) continue;
          if (el.scrollWidth > el.clientWidth + 2 || el.scrollHeight > el.clientHeight + 2) {
            clipped.push(name);
          }
        }

        const viewportOverflow: string[] = [];
        const viewportW = window.innerWidth;
        for (const [name, rect] of rects.entries()) {
          if (rect.left < -1 || rect.right > viewportW + 1) {
            viewportOverflow.push(name);
          }
        }

        const output: GeometryResult = {
          missing,
          overlaps: overlapFailures,
          outsidePanel,
          labelOverflow,
          clipped,
          viewportOverflow,
        };

        return output;
      },
      { requiredSelectors: REQUIRED_SELECTORS, noOverlapPairs: CONTROL_PAIRS_NO_OVERLAP }
    );

    expect(
      result.missing,
      `Missing UI check anchors at ${viewport.name}: ${result.missing.join(', ')}`
    ).toEqual([]);
    expect(
      result.overlaps,
      `Layout overlaps at ${viewport.name}: ${result.overlaps.join(', ')}`
    ).toEqual([]);
    expect(
      result.outsidePanel,
      `Controls escaped panel bounds at ${viewport.name}: ${result.outsidePanel.join(', ')}`
    ).toEqual([]);
    expect(
      result.labelOverflow,
      `Field labels overflowed their controls at ${viewport.name}: ${result.labelOverflow.join(', ')}`
    ).toEqual([]);
    expect(
      result.clipped,
      `Control labels clipped at ${viewport.name}: ${result.clipped.join(', ')}`
    ).toEqual([]);
    expect(
      result.viewportOverflow,
      `Horizontal viewport overflow at ${viewport.name}: ${result.viewportOverflow.join(', ')}`
    ).toEqual([]);
  });
}

test('A11y guardrail (axe serious/critical)', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await page.waitForSelector('[data-ui-check="terminal-panel"]');
  await disableMotion(page);

  const axeResults = await new AxeBuilder({ page }).analyze();
  const blockers = axeResults.violations.filter(v => v.impact === 'critical' || v.impact === 'serious');

  expect(
    blockers,
    `Axe serious/critical issues:\n${blockers
      .map(v => `- ${v.id}: ${v.help} (${v.nodes.length} nodes)`)
      .join('\n')}`
  ).toEqual([]);
});
