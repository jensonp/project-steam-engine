#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, '..', '..');
const demoRoot = path.join(rootDir, 'liquidgl_local');
const demoFile = path.join(demoRoot, 'demos', 'demo-4.html');
const outDir = path.join(rootDir, 'artifacts', 'liquidgl', 'debug');
const outPath = path.join(outDir, 'demo-visibility.json');
const port = Number.parseInt(process.env.DEMO_VIS_PORT ?? '8092', 10);
const host = '127.0.0.1';
const demoUrl = `http://${host}:${port}/demos/demo-4.html`;
const playwrightModulePath = path.join(
  rootDir,
  'frontend',
  'node_modules',
  '@playwright',
  'test',
  'index.js'
);

if (!fs.existsSync(demoFile)) {
  console.error(`Missing demo source: ${demoFile}`);
  console.error('Run: ./scripts/liquidgl/fetch-demos.sh');
  process.exit(1);
}
if (!fs.existsSync(playwrightModulePath)) {
  console.error(`Missing Playwright module: ${playwrightModulePath}`);
  console.error('Run: cd frontend && npm install');
  process.exit(1);
}

const playwrightModule = await import(pathToFileURL(playwrightModulePath).href);
const chromium = playwrightModule?.default?.chromium;
if (!chromium) {
  console.error('Failed to load chromium launcher from @playwright/test.');
  process.exit(1);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForServerReady(url, attempts = 40, delayMs = 250) {
  for (let i = 0; i < attempts; i += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // server not ready yet
    }
    await sleep(delayMs);
  }
  throw new Error(`Timed out waiting for demo server: ${url}`);
}

function resolvePythonBinary() {
  if (process.env.PYTHON_BIN) return process.env.PYTHON_BIN;
  return 'python3';
}

const pythonBin = resolvePythonBinary();
const server = spawn(
  pythonBin,
  ['-m', 'http.server', String(port), '--bind', host, '--directory', demoRoot],
  { stdio: 'ignore' }
);

const cleanup = () => {
  if (!server.killed) {
    server.kill('SIGTERM');
  }
};

process.on('exit', cleanup);
process.on('SIGINT', () => {
  cleanup();
  process.exit(130);
});
process.on('SIGTERM', () => {
  cleanup();
  process.exit(143);
});

try {
  await waitForServerReady(demoUrl);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const response = await page.goto(demoUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.marquee-card', { timeout: 10000 });
  await page.waitForTimeout(120);

  const metrics = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('.marquee-card'));
    const visibility = cards.map(card => {
      const style = window.getComputedStyle(card);
      const rect = card.getBoundingClientRect();
      const opacity = Number.parseFloat(style.opacity || '1');
      const visible =
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        opacity > 0.8 &&
        rect.width > 40 &&
        rect.height > 40;
      return {
        visible,
        opacity: Number(opacity.toFixed(3)),
        width: Number(rect.width.toFixed(2)),
        height: Number(rect.height.toFixed(2)),
      };
    });

    return {
      cardCount: cards.length,
      visibleCount: visibility.filter(v => v.visible).length,
      cardVisibility: visibility,
      pageTitle: document.title,
      bodyLength: document.body?.innerText?.length ?? 0,
      timestamp: new Date().toISOString(),
    };
  });

  await browser.close();

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    outPath,
    JSON.stringify(
      {
        source: demoUrl,
        httpStatus: response?.status() ?? null,
        ...metrics,
      },
      null,
      2
    )
  );

  if (metrics.cardCount === 0) {
    throw new Error('Demo 4 check failed: no .marquee-card elements found.');
  }
  if (metrics.visibleCount !== metrics.cardCount) {
    throw new Error(
      `Demo 4 check failed: visible cards ${metrics.visibleCount}/${metrics.cardCount}.`
    );
  }

  console.log('Demo visibility check passed.');
  console.log(`- cards visible: ${metrics.visibleCount}/${metrics.cardCount}`);
  console.log(`- report: ${outPath}`);
} catch (error) {
  console.error('Demo visibility check failed.');
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  cleanup();
}
