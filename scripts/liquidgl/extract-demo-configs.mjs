#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const baseDir = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve(process.cwd(), 'liquidgl_local');

const demos = ['demo-1', 'demo-2', 'demo-3', 'demo-4', 'demo-5'];

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
      const body = source.slice(start + 1, end);
      calls.push(parseObjectLiteral(body));
      idx = end + 1;
    } else {
      idx = i + 1;
    }
  }

  return calls;
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
  const liquidGLCalls = extractLiquidCalls(html);
  report.demos[demo] = {
    file,
    // Keep legacy key for existing parity scripts.
    liquidGL: liquidGLCalls[0] ?? null,
    liquidGLCalls,
  };
}

const outputPath = path.join(baseDir, 'demo-configs.json');
fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
console.log(`Wrote ${outputPath}`);
console.log(JSON.stringify(report, null, 2));
