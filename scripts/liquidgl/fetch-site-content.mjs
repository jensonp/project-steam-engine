#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const rootDir = path.resolve(process.cwd());
const destDir = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(rootDir, 'liquidgl_local');
const baseUrl = new URL(process.env.LIQUIDGL_BASE_URL ?? 'https://liquidgl.naughtyduk.com');
const userAgent =
  process.env.LIQUIDGL_UA ??
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

const seedPaths = [
  '/',
  '/index.html',
  '/demos/demo-1',
  '/demos/demo-2',
  '/demos/demo-3',
  '/demos/demo-4',
  '/demos/demo-5',
];

const remoteJsAllowHosts = new Set([
  'cdn.jsdelivr.net',
  'code.jquery.com',
]);

function ensureDirFor(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function sanitizeUrlPath(urlPath) {
  return urlPath.replace(/\/+/g, '/');
}

function savePathForPage(urlPathname) {
  const pathname = sanitizeUrlPath(urlPathname);
  if (pathname === '/' || pathname === '') return 'index.html';
  if (/^\/demos\/demo-\d+$/.test(pathname)) return `${pathname.slice(1)}.html`;
  if (/^\/demos\/demo-\d+\/$/.test(pathname)) return `${pathname.slice(1, -1)}.html`;
  if (pathname.endsWith('.html')) return pathname.slice(1);
  if (pathname.startsWith('/demos/')) return `${pathname.slice(1)}.html`;
  return pathname.slice(1);
}

function isLikelyHtmlPath(urlPathname) {
  const pathname = sanitizeUrlPath(urlPathname);
  if (pathname === '/' || pathname === '/index.html') return true;
  if (/^\/demos\/demo-\d+\/?$/.test(pathname)) return true;
  return pathname.endsWith('.html');
}

function extractLinks(html) {
  const links = [];
  const regex = /(?:href|src)=["']([^"']+)["']/g;
  let match;
  while ((match = regex.exec(html)) !== null) {
    links.push(match[1]);
  }
  return links;
}

function shouldSkipLink(raw) {
  return (
    !raw ||
    raw.startsWith('#') ||
    raw.startsWith('mailto:') ||
    raw.startsWith('javascript:')
  );
}

async function fetchResponse(url) {
  const response = await fetch(url, {
    headers: { 'user-agent': userAgent },
    redirect: 'follow',
  });
  if (!response.ok) {
    throw new Error(`Request failed ${response.status} ${response.statusText}: ${url}`);
  }
  return response;
}

function resolveLink(rawLink, currentPageUrl) {
  try {
    return new URL(rawLink, currentPageUrl);
  } catch {
    return null;
  }
}

const pageQueue = [];
const queuedPages = new Set();
const visitedPages = new Set();
const localAssets = new Map();
const remoteAssets = new Map();
const ignoredRemoteLinks = new Set();

for (const seedPath of seedPaths) {
  const url = new URL(seedPath, baseUrl);
  const href = url.href;
  if (!queuedPages.has(href)) {
    queuedPages.add(href);
    pageQueue.push(url);
  }
}

const writtenPages = [];
const writtenLocalAssets = [];
const writtenRemoteAssets = [];

while (pageQueue.length > 0) {
  const pageUrl = pageQueue.shift();
  const pageHref = pageUrl.href;
  if (visitedPages.has(pageHref)) continue;
  visitedPages.add(pageHref);

  const response = await fetchResponse(pageHref);
  const html = await response.text();
  const pageSavePath = path.join(destDir, savePathForPage(pageUrl.pathname));
  ensureDirFor(pageSavePath);
  fs.writeFileSync(pageSavePath, html, 'utf8');
  writtenPages.push(pageSavePath);

  for (const raw of extractLinks(html)) {
    if (shouldSkipLink(raw)) continue;
    const resolved = resolveLink(raw, pageHref);
    if (!resolved) continue;

    if (resolved.origin === baseUrl.origin) {
      if (isLikelyHtmlPath(resolved.pathname)) {
        const nextHref = resolved.href;
        if (!queuedPages.has(nextHref) && !visitedPages.has(nextHref)) {
          queuedPages.add(nextHref);
          pageQueue.push(resolved);
        }
        continue;
      }

      const assetPath = sanitizeUrlPath(resolved.pathname);
      if (!assetPath || assetPath === '/') continue;
      const savePath = path.join(destDir, assetPath.slice(1));
      localAssets.set(resolved.href, savePath);
      continue;
    }

    if (remoteJsAllowHosts.has(resolved.host)) {
      const ext = path.extname(resolved.pathname).toLowerCase();
      if (ext === '.js' || ext === '.css') {
        const savePath = path.join(destDir, 'external', resolved.host, resolved.pathname.replace(/^\/+/, ''));
        remoteAssets.set(resolved.href, savePath);
        continue;
      }
    }

    ignoredRemoteLinks.add(resolved.href);
  }
}

for (const [assetUrl, savePath] of localAssets.entries()) {
  const response = await fetchResponse(assetUrl);
  const buf = Buffer.from(await response.arrayBuffer());
  ensureDirFor(savePath);
  fs.writeFileSync(savePath, buf);
  writtenLocalAssets.push(savePath);
}

for (const [assetUrl, savePath] of remoteAssets.entries()) {
  const response = await fetchResponse(assetUrl);
  const buf = Buffer.from(await response.arrayBuffer());
  ensureDirFor(savePath);
  fs.writeFileSync(savePath, buf);
  writtenRemoteAssets.push(savePath);
}

const manifest = {
  generatedAt: new Date().toISOString(),
  source: baseUrl.href,
  destination: destDir,
  pages: Array.from(new Set(writtenPages.map(file => path.relative(destDir, file)))).sort(),
  localAssets: Array.from(new Set(writtenLocalAssets.map(file => path.relative(destDir, file)))).sort(),
  remoteAssets: Array.from(new Set(writtenRemoteAssets.map(file => path.relative(destDir, file)))).sort(),
  ignoredRemoteLinks: Array.from(ignoredRemoteLinks).sort(),
};

const manifestPath = path.join(destDir, 'mirror-manifest.json');
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

console.log(`Wrote mirror manifest: ${manifestPath}`);
console.log(`- pages: ${manifest.pages.length}`);
console.log(`- local assets: ${manifest.localAssets.length}`);
console.log(`- remote assets: ${manifest.remoteAssets.length}`);
