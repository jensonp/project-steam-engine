#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const baseDir = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve(rootDir, 'liquidgl_local');

const pageFiles = [
  'index.html',
  'demos/demo-1.html',
  'demos/demo-2.html',
  'demos/demo-3.html',
  'demos/demo-4.html',
  'demos/demo-5.html',
];

function parseObjectLiteral(objectBody) {
  const lines = objectBody
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .filter(line => !line.startsWith('//'));

  const result = {};
  for (const raw of lines) {
    const line = raw.endsWith(',') ? raw.slice(0, -1) : raw;
    const idx = line.indexOf(':');
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    const valueRaw = line.slice(idx + 1).trim();

    if (/^['"].*['"]$/.test(valueRaw)) {
      result[key] = valueRaw.slice(1, -1);
      continue;
    }
    if (valueRaw === 'true' || valueRaw === 'false') {
      result[key] = valueRaw === 'true';
      continue;
    }
    const num = Number(valueRaw);
    if (!Number.isNaN(num) && /^-?\d+(\.\d+)?$/.test(valueRaw)) {
      result[key] = num;
      continue;
    }
    result[key] = valueRaw;
  }
  return result;
}

function extractLiquidCalls(source) {
  const calls = [];
  let idx = 0;
  while (idx < source.length) {
    const hit = source.indexOf('liquidGL(', idx);
    if (hit === -1) break;

    let i = hit + 'liquidGL('.length;
    while (i < source.length && /\s/.test(source[i])) i += 1;
    if (source[i] !== '{') {
      idx = i;
      continue;
    }

    const start = i;
    let depth = 0;
    let inString = null;
    let escaped = false;
    let end = -1;

    for (let j = start; j < source.length; j += 1) {
      const ch = source[j];
      if (inString) {
        if (escaped) {
          escaped = false;
          continue;
        }
        if (ch === '\\') {
          escaped = true;
          continue;
        }
        if (ch === inString) {
          inString = null;
        }
        continue;
      }
      if (ch === '\'' || ch === '"' || ch === '`') {
        inString = ch;
        continue;
      }
      if (ch === '{') {
        depth += 1;
        continue;
      }
      if (ch === '}') {
        depth -= 1;
        if (depth === 0) {
          end = j;
          break;
        }
      }
    }

    if (end !== -1) {
      calls.push(parseObjectLiteral(source.slice(start + 1, end)));
      idx = end + 1;
    } else {
      idx = i + 1;
    }
  }
  return calls;
}

function extractTitle(source) {
  const m = source.match(/<title>([\s\S]*?)<\/title>/i);
  return m ? m[1].trim() : '';
}

function extractScriptSources(source) {
  const out = [];
  const regex = /<script[^>]*src=["']([^"']+)["'][^>]*>/gi;
  let match;
  while ((match = regex.exec(source)) !== null) {
    out.push(match[1]);
  }
  return Array.from(new Set(out));
}

function extractBlendModes(source) {
  const modes = [];
  const regex = /mix-blend-mode\s*:\s*([^;]+);/gi;
  let match;
  while ((match = regex.exec(source)) !== null) {
    modes.push(match[1].trim());
  }
  return Array.from(new Set(modes));
}

function hasToken(source, token) {
  return source.includes(token);
}

function extractFolderNames(source) {
  const names = [];
  const regex = /addFolder\(\s*["']([^"']+)["']\s*\)/g;
  let match;
  while ((match = regex.exec(source)) !== null) {
    names.push(match[1]);
  }
  return Array.from(new Set(names));
}

function lensFeatureFromCalls(calls) {
  return calls.map(call => ({
    target: call.target ?? null,
    snapshot: call.snapshot ?? null,
    refraction: call.refraction ?? null,
    bevelDepth: call.bevelDepth ?? null,
    bevelWidth: call.bevelWidth ?? null,
    frost: call.frost ?? null,
    shadow: call.shadow ?? null,
    specular: call.specular ?? null,
    tilt: call.tilt ?? null,
    tiltFactor: call.tiltFactor ?? null,
    reveal: call.reveal ?? null,
    magnify: call.magnify ?? null,
  }));
}

const matrix = {
  generatedAt: new Date().toISOString(),
  sourceDir: baseDir,
  pages: {},
};

for (const file of pageFiles) {
  const fullPath = path.join(baseDir, file);
  if (!fs.existsSync(fullPath)) {
    matrix.pages[file] = { missing: true };
    continue;
  }

  const source = fs.readFileSync(fullPath, 'utf8');
  const calls = extractLiquidCalls(source);

  matrix.pages[file] = {
    title: extractTitle(source),
    liquidCalls: lensFeatureFromCalls(calls),
    scriptSources: extractScriptSources(source),
    folderNames: extractFolderNames(source),
    blendModes: extractBlendModes(source),
    hasSyncWith: hasToken(source, 'liquidGL.syncWith'),
    hasLenis: hasToken(source, 'lenis') || hasToken(source, 'Lenis'),
    hasGsap: hasToken(source, 'gsap'),
    hasScrollTrigger: hasToken(source, 'ScrollTrigger'),
    hasJquery: hasToken(source, 'jquery'),
    hasRipples: hasToken(source, 'ripples'),
    hasMenuAnchor: hasToken(source, 'menu-anchor'),
    hasCardAnchor: hasToken(source, 'card-anchor'),
    hasMarqueeAnchor: hasToken(source, 'marquee-anchor'),
    hasShapeLens: hasToken(source, 'class="shape"') || hasToken(source, 'liquid-shape'),
  };
}

const jsonOut = path.join(baseDir, 'feature-matrix.json');
fs.writeFileSync(jsonOut, JSON.stringify(matrix, null, 2));

const lines = [];
lines.push('# LiquidGL Demo Feature Matrix');
lines.push('');
lines.push(`Generated: ${matrix.generatedAt}`);
lines.push('');
lines.push('| Page | Targets | Snapshot | Blend Modes | Key Runtime |');
lines.push('|---|---|---|---|---|');

for (const file of pageFiles) {
  const entry = matrix.pages[file];
  if (!entry || entry.missing) {
    lines.push(`| ${file} | missing | - | - | - |`);
    continue;
  }
  const targets = entry.liquidCalls.length
    ? entry.liquidCalls.map(call => call.target ?? '(none)').join('<br>')
    : '(none)';
  const snapshots = entry.liquidCalls
    .map(call => call.snapshot)
    .filter(Boolean)
    .join('<br>') || '(none)';
  const blendModes = entry.blendModes.length ? entry.blendModes.join(', ') : '(none)';
  const runtimeTags = [
    entry.hasSyncWith ? 'syncWith' : null,
    entry.hasGsap ? 'gsap' : null,
    entry.hasLenis ? 'lenis' : null,
    entry.hasScrollTrigger ? 'ScrollTrigger' : null,
    entry.hasJquery ? 'jquery' : null,
    entry.hasRipples ? 'ripples' : null,
  ].filter(Boolean).join(', ') || '(none)';

  lines.push(`| ${file} | ${targets} | ${snapshots} | ${blendModes} | ${runtimeTags} |`);
}

lines.push('');
lines.push('## Porting Notes');
lines.push('');
lines.push('1. Demo-4 card liquid effect target is `.marquee-card`; for Steam Engine this is safer via inert overlays to avoid card-content mutation.');
lines.push('2. Demo-5 shape lens uses `.shape` with `snapshot: .main-content`; this should be mounted separately from card lenses to avoid shared-canvas z-order conflicts.');
lines.push('3. Demos keep foreground text readable by explicit z-layering and `pointer-events: none` on liquid canvas/overlay nodes.');
lines.push('4. The controls menu is from `lil-gui`; exact folder naming and parameter ranges should remain aligned.');

const markdownOut = path.join(rootDir, 'docs', 'liquidgl-demo-feature-matrix.md');
fs.writeFileSync(markdownOut, lines.join('\n'));

console.log(`Wrote ${jsonOut}`);
console.log(`Wrote ${markdownOut}`);
