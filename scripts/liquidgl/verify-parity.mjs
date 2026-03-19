#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const rootDir = path.resolve(process.cwd());
const configPath = path.join(rootDir, 'liquidgl_local', 'demo-configs.json');
const resultTsPath = path.join(rootDir, 'frontend', 'src', 'app', 'pages', 'result-screen', 'result-screen.ts');

if (!fs.existsSync(configPath)) {
  console.error(`Missing demo config file: ${configPath}`);
  console.error('Run: ./scripts/liquidgl/fetch-demos.sh && /opt/homebrew/bin/node ./scripts/liquidgl/extract-demo-configs.mjs');
  process.exit(1);
}
if (!fs.existsSync(resultTsPath)) {
  console.error(`Missing result screen source: ${resultTsPath}`);
  process.exit(1);
}

const demoConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const resultSource = fs.readFileSync(resultTsPath, 'utf8');

function parseObjectLiteral(source, constName) {
  const pattern = new RegExp(`const\\s+${constName}\\s*:\\s*LiquidControlState\\s*=\\s*\\{([\\s\\S]*?)\\};`, 'm');
  const match = source.match(pattern);
  if (!match) return null;
  const body = match[1];
  const parsed = {};
  for (const rawLine of body.split('\n')) {
    const line = rawLine.trim().replace(/,$/, '');
    if (!line || line.startsWith('//')) continue;
    const idx = line.indexOf(':');
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    const valueRaw = line.slice(idx + 1).trim();
    if (/^['"].*['"]$/.test(valueRaw)) {
      parsed[key] = valueRaw.slice(1, -1);
    } else if (valueRaw === 'true' || valueRaw === 'false') {
      parsed[key] = valueRaw === 'true';
    } else {
      const num = Number(valueRaw);
      parsed[key] = Number.isFinite(num) ? num : valueRaw;
    }
  }
  return parsed;
}

function compareProfile(name, expected, actual) {
  const keys = Object.keys(expected).filter(key => key !== 'target' && key !== 'snapshot');
  const issues = [];
  for (const key of keys) {
    if (!(key in actual)) {
      issues.push(`${name}: current source missing key '${key}'`);
      continue;
    }
    if (expected[key] !== actual[key]) {
      issues.push(`${name}: '${key}' mismatch expected=${expected[key]} actual=${actual[key]}`);
    }
  }
  return issues;
}

const demo4 = demoConfig?.demos?.['demo-4']?.liquidGL;
const demo5 = demoConfig?.demos?.['demo-5']?.liquidGL;
const currentDemo4 = parseObjectLiteral(resultSource, 'DEMO4_CARD_DEFAULTS');
const currentDemo5 = parseObjectLiteral(resultSource, 'DEMO5_SHAPE_DEFAULTS');

const failures = [];

if (!demo4 || !demo5) {
  failures.push('Missing demo-4/demo-5 config in liquidgl_local/demo-configs.json');
}
if (!currentDemo4 || !currentDemo5) {
  failures.push('Unable to parse DEMO4_CARD_DEFAULTS/DEMO5_SHAPE_DEFAULTS from result-screen.ts');
}

if (!failures.length) {
  failures.push(...compareProfile('demo-4 cards profile', demo4, currentDemo4));
  failures.push(...compareProfile('demo-5 shape profile', demo5, currentDemo5));
}

if (!resultSource.includes("target: '.results-container .result-card-lens'")) {
  failures.push("Demo-4 card selector missing (target: '.results-container .result-card-lens')");
}
if (!resultSource.includes("target: '.shape.liquid-shape-trigger'")) {
  failures.push("Shape target selector missing (target: '.shape.liquid-shape-trigger')");
}
if (!resultSource.includes("snapshot: '.main-content'")) {
  failures.push("Shape snapshot missing (snapshot: '.main-content')");
}

if (failures.length) {
  console.error('LiquidGL parity check failed:');
  for (const issue of failures) {
    console.error(`- ${issue}`);
  }
  process.exit(1);
}

console.log('LiquidGL parity check passed.');
console.log('- demo-4 card profile matches extracted source');
console.log('- demo-5 shape profile matches extracted source');
console.log('- demo-4 card lens target and demo-5 shape target wiring present');
