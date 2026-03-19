#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const manifestPath = path.join(rootDir, 'liquidgl_local', 'mirror-manifest.json');

if (!fs.existsSync(manifestPath)) {
  console.error(`Missing mirror manifest: ${manifestPath}`);
  console.error('Run: ./scripts/liquidgl/fetch-demos.sh');
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const failures = [];

const requiredPages = [
  'index.html',
  'demos/demo-1.html',
  'demos/demo-2.html',
  'demos/demo-3.html',
  'demos/demo-4.html',
  'demos/demo-5.html',
];

const requiredLocalContains = [
  'scripts/liquidGL.js',
  'scripts/html2canvas.min.js',
  'assets/liquid-bkg-_0000_Comp-33.webp',
  'assets/liquid-bkg-_0001_Comp-183.webp',
  'assets/liquid-bkg-_0002_Comp-163.webp',
  'assets/liquid-bkg-_0003_Comp-151.webp',
  'assets/liquid-bkg-_0004_Comp-13.webp',
  'assets/download-icon.svg',
  'assets/card-chip.svg',
  'assets/visa.png',
];

const requiredRemoteContains = [
  'cdn.jsdelivr.net/npm/gsap@3.13.0/dist/gsap.min.js',
  'cdn.jsdelivr.net/npm/gsap@3.13.0/dist/ScrollTrigger.min.js',
  'cdn.jsdelivr.net/npm/@studio-freight/lenis@1.0.42/dist/lenis.min.js',
  'cdn.jsdelivr.net/npm/lil-gui@0.19.1/dist/lil-gui.umd.min.js',
  'code.jquery.com/jquery-3.7.1.min.js',
];

function hasEntry(haystack, needle) {
  return haystack.some(entry => entry.includes(needle));
}

for (const page of requiredPages) {
  if (!manifest.pages?.includes(page)) {
    failures.push(`Missing mirrored page: ${page}`);
  }
}

for (const needle of requiredLocalContains) {
  if (!hasEntry(manifest.localAssets ?? [], needle)) {
    failures.push(`Missing mirrored local asset: ${needle}`);
  }
}

for (const needle of requiredRemoteContains) {
  if (!hasEntry(manifest.remoteAssets ?? [], needle)) {
    failures.push(`Missing mirrored remote asset: ${needle}`);
  }
}

if (failures.length > 0) {
  console.error('LiquidGL source coverage check failed:');
  for (const issue of failures) {
    console.error(`- ${issue}`);
  }
  process.exit(1);
}

console.log('LiquidGL source coverage check passed.');
console.log(`- pages: ${(manifest.pages ?? []).length}`);
console.log(`- local assets: ${(manifest.localAssets ?? []).length}`);
console.log(`- remote assets: ${(manifest.remoteAssets ?? []).length}`);
