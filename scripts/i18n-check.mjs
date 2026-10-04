#!/usr/bin/env node
/**
 * i18n-check.mjs
 * Verifies that EN has exactly the same keys as TH (the master dict).
 * Exits 1 if any keys are missing or extra in EN.
 */

import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

// Parse keys from the TS dict files without full TS compilation.
// Strategy: extract quoted dot-notation keys via regex.
function extractKeys(filepath) {
  const src = readFileSync(filepath, 'utf8');
  const re = /^\s+'([a-zA-Z][a-zA-Z0-9]*(?:\.[a-zA-Z][a-zA-Z0-9]*)*)'\s*:/gm;
  const keys = [];
  let m;
  while ((m = re.exec(src)) !== null) {
    keys.push(m[1]);
  }
  return keys;
}

const thKeys = extractKeys(resolve(root, 'src/i18n/th.ts'));
const enKeys = extractKeys(resolve(root, 'src/i18n/en.ts'));

const thSet = new Set(thKeys);
const enSet = new Set(enKeys);

const missingInEn  = thKeys.filter(k => !enSet.has(k));
const extraInEn    = enKeys.filter(k => !thSet.has(k));

let ok = true;

if (missingInEn.length > 0) {
  console.error(`\n[i18n] Missing in EN (${missingInEn.length}):`);
  missingInEn.forEach(k => console.error(`  - ${k}`));
  ok = false;
}

if (extraInEn.length > 0) {
  console.error(`\n[i18n] Extra in EN not in TH (${extraInEn.length}):`);
  extraInEn.forEach(k => console.error(`  + ${k}`));
  ok = false;
}

if (ok) {
  console.log(`[i18n] OK — ${thKeys.length} keys match between TH and EN.`);
} else {
  process.exit(1);
}
