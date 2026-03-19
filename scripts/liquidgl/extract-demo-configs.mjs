#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const baseDir = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve(process.cwd(), 'liquidgl_local');

const demos = ['demo-3', 'demo-4', 'demo-5'];

function parseLiquidObject(source) {
  const callMatch = source.match(/liquidGL\s*\(\s*\{([\s\S]*?)\}\s*\)/m);
  if (!callMatch) return null;

  const objectBody = callMatch[1];
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

const report = {
  sourceDir: baseDir,
  generatedAt: new Date().toISOString(),
  demos: {},
};

for (const demo of demos) {
  const file = path.join(baseDir, 'demos', `${demo}.html`);
  if (!fs.existsSync(file)) {
    report.demos[demo] = { error: 'missing file', file };
    continue;
  }
  const html = fs.readFileSync(file, 'utf8');
  const config = parseLiquidObject(html);
  report.demos[demo] = {
    file,
    liquidGL: config,
  };
}

const outputPath = path.join(baseDir, 'demo-configs.json');
fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
console.log(`Wrote ${outputPath}`);
console.log(JSON.stringify(report, null, 2));
