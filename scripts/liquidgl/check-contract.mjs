#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

const files = {
  resultTs: path.join(root, 'frontend/src/app/pages/result-screen/result-screen.ts'),
  resultHtml: path.join(root, 'frontend/src/app/pages/result-screen/result-screen.html'),
  resultCss: path.join(root, 'frontend/src/app/pages/result-screen/result-screen.css'),
  cardHtml: path.join(root, 'frontend/src/app/components/game-card/game-card.component.html'),
  cardCss: path.join(root, 'frontend/src/app/components/game-card/game-card.component.css'),
  cardTs: path.join(root, 'frontend/src/app/components/game-card/game-card.component.ts'),
  dragScript: path.join(root, 'scripts/liquidgl/run-drag-visibility.sh'),
};

const violations = [];

function readFile(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function requireContains(haystack, needle, label) {
  if (!haystack.includes(needle)) {
    violations.push(`${label} is missing: ${needle}`);
  }
}

function requireNotContains(haystack, needle, label) {
  if (haystack.includes(needle)) {
    violations.push(`${label} should not include: ${needle}`);
  }
}

function getSelectorBlock(css, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\}`, 'm');
  const match = css.match(regex);
  return match ? match[1] : null;
}

function extractZIndex(css, selector) {
  const block = getSelectorBlock(css, selector);
  if (!block) return null;
  const match = block.match(/z-index:\s*(\d+)/);
  if (!match) return null;
  return Number.parseInt(match[1], 10);
}

const resultTs = readFile(files.resultTs);
const resultHtml = readFile(files.resultHtml);
const resultCss = readFile(files.resultCss);
const cardHtml = readFile(files.cardHtml);
const cardCss = readFile(files.cardCss);
const cardTs = readFile(files.cardTs);

requireContains(
  resultTs,
  "target: '.results-container .marquee-card'",
  'result-screen.ts'
);
requireContains(
  resultTs,
  "target: '.shape.liquid-shape-trigger'",
  'result-screen.ts'
);
requireContains(
  resultHtml,
  'class="main-content result-screen"',
  'result-screen.html'
);
requireContains(
  resultHtml,
  '(pointerdown)="onMagnifierPointerDown($event)"',
  'result-screen.html'
);
requireContains(
  resultHtml,
  'class="marquee-card result-card"',
  'result-screen.html'
);
requireContains(
  resultCss,
  '.marquee-card',
  'result-screen.css'
);
requireContains(
  resultCss,
  '.marquee-content',
  'result-screen.css'
);
requireContains(
  resultTs,
  'onMagnifierPointerDown(event: PointerEvent): void',
  'result-screen.ts'
);
requireContains(
  resultTs,
  'onMagnifierClick(event: MouseEvent): void',
  'result-screen.ts'
);

if (!fs.existsSync(files.dragScript)) {
  violations.push(`Missing drag visibility runner: ${files.dragScript}`);
}

const imitationTokens = [
  'liquid-shell',
  'liquid-rim',
  'liquid-specular',
  'liquid-noise',
  '--liquid-x',
  '--liquid-y',
];

for (const token of imitationTokens) {
  requireNotContains(cardHtml, token, 'game-card.component.html');
  requireNotContains(cardCss, token, 'game-card.component.css');
  requireNotContains(cardTs, token, 'game-card.component.ts');
}

const shapeZ = extractZIndex(resultCss, '.shape');
const headerZ = extractZIndex(resultCss, '.result-header');
const containerZ = extractZIndex(resultCss, '.results-container');
const backButtonZ = extractZIndex(resultCss, '.back-button');

if (shapeZ === null) violations.push('result-screen.css missing z-index for .shape');
if (headerZ === null) violations.push('result-screen.css missing z-index for .result-header');
if (containerZ === null) violations.push('result-screen.css missing z-index for .results-container');
if (backButtonZ === null) violations.push('result-screen.css missing z-index for .back-button');

if (shapeZ !== null && shapeZ < 60) {
  violations.push(`.shape z-index expected >= 60, found ${shapeZ}`);
}

if (
  headerZ !== null &&
  containerZ !== null &&
  backButtonZ !== null &&
  !(shapeZ !== null && shapeZ > containerZ && backButtonZ > containerZ && headerZ >= containerZ)
) {
  violations.push(
    `Expected shape/back-button above results-container and header >= results-container, found shape=${shapeZ}, back=${backButtonZ}, container=${containerZ}, header=${headerZ}`
  );
}

if (violations.length > 0) {
  console.error('liquidGL contract check failed:');
  for (const issue of violations) {
    console.error(`- ${issue}`);
  }
  process.exit(1);
}

console.log('liquidGL contract check passed.');
console.log(
  `z-index summary: shape=${shapeZ}, back-button=${backButtonZ}, results-container=${containerZ}, result-header=${headerZ}`
);
