/**
 * Inspect CSV columns and RawGame interface fields.
 * Usage: npx ts-node src/scripts/inspect-csv-and-interface.ts
 */

import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';

const RAW_DIR = path.join(__dirname, '../../data/raw');
const PROCESSED_SCRIPT = path.join(__dirname, 'process-dataset.ts');

// 1. CSV columns (from games.csv or steam.csv) — use parser so quoted commas are handled
const csvPath = path.join(RAW_DIR, 'games.csv');
let csvColumns: string[] = [];
if (fs.existsSync(csvPath)) {
  const content = fs.readFileSync(csvPath, 'utf-8');
  const records = parse(content, { columns: true, to: 1 });
  csvColumns = records.length ? Object.keys(records[0]) : [];
  console.log(`Columns in CSV (${path.basename(csvPath)}):`);
  csvColumns.forEach((c, i) => console.log(`  ${i + 1}. ${c}`));
  console.log('');
} else {
  console.log(`CSV not found: ${csvPath}\n`);
}

// 2. RawGame interface fields (from process-dataset.ts source)
const source = fs.readFileSync(PROCESSED_SCRIPT, 'utf-8');
const interfaceMatch = source.match(/interface RawGame\s*\{([^}]+)\}/s);
let interfaceFields: string[] = [];
if (interfaceMatch) {
  const block = interfaceMatch[1];
  interfaceFields = block
    .split('\n')
    .map((line) => line.replace(/^\s*([\w?]+)\s*:.*/, '$1').trim())
    .filter((s) => s.length > 0 && !s.startsWith('/'));
  console.log('Fields in RawGame interface:');
  interfaceFields.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
  console.log('');
} else {
  console.log('RawGame interface not found in process-dataset.ts\n');
}

// 3. Compare: CSV columns vs interface fields
if (csvColumns.length > 0 && interfaceFields.length > 0) {
  const csvSet = new Set(csvColumns);
  const ifaceSet = new Set(interfaceFields);
  const onlyInCsv = csvColumns.filter((c) => !ifaceSet.has(c));
  const onlyInIface = interfaceFields.filter((f) => !csvSet.has(f));
  console.log('Comparison:');
  if (onlyInCsv.length) {
    console.log('  In CSV but not in RawGame:', onlyInCsv.join(', '));
  }
  if (onlyInIface.length) {
    console.log('  In RawGame but not in CSV:', onlyInIface.join(', '));
  }
  if (onlyInCsv.length === 0 && onlyInIface.length === 0) {
    console.log('  CSV columns and RawGame fields match.');
  }
}
