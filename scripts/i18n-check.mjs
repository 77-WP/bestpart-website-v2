#!/usr/bin/env node
/**
 * i18n-check.mjs  (two checks)
 *
 * 1. FAIL if Thai word characters appear in src/**\/*.{ts,tsx}
 *    outside src/i18n/ — excluding:
 *      • ฿ (U+0E3F, currency symbol — appears everywhere legitimately)
 *      • Data / config files (personalization, featured, shop, data/menu)
 *      • Me.tsx (not in active routing — placeholder page)
 *      • Lines with TEST_MODE, internal_notes, or inside known test-only blocks
 *
 * 2. REPORT keys where EN value === TH value (likely untranslated).
 *
 * Also validates key parity: EN must have the same keys as TH.
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve, relative } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SRC  = resolve(ROOT, 'src');
const I18N = resolve(SRC, 'i18n');

/* ── Files/dirs to skip entirely ── */
const SKIP_FILES = new Set([
  resolve(SRC, 'config/personalization.ts'),
  resolve(SRC, 'config/featured.ts'),
  resolve(SRC, 'config/shop.ts'),
  resolve(SRC, 'data/menu.ts'),
  resolve(SRC, 'pages/Me.tsx'),
]);

/* ── file walker ── */
function walk(dir, files = []) {
  for (const name of readdirSync(dir)) {
    const full = resolve(dir, name);
    if (statSync(full).isDirectory()) {
      if (name === 'node_modules') continue;
      walk(full, files);
    } else if (/\.(tsx?|jsx?)$/.test(name)) {
      files.push(full);
    }
  }
  return files;
}

/* Thai word chars (U+0E00–U+0E7F) but NOT ฿ (U+0E3F) */
const THAI_WORD_RE = /[\u0E00-\u0E3E\u0E40-\u0E7F]/;

/* Patterns to ignore — these lines contain Thai that is intentionally kept in Thai */
const IGNORE_PATTERNS = [
  /internal_notes/,          // kitchen note — must stay Thai per spec
  /TEST MODE/,               // test mode banner
  /TEST_MODE/,               // test mode flag usage
  /name_th\s*:/,             // DB field mapping
  /name_th\s*\./,            // DB field access
  /group_name_th/,           // DB field
  /option_name_th/,          // DB field
  /DRINKS_CAT_NAME_TH/,      // DB category matcher constant
  /SPICE_TH/,                // spice options array for DB matching
  /isSizeGroup|isSpiceGroup|isPersonalizationGroup/, // DB group helpers
  /cleanLabel/,              // label helper
  /สินค้าขายดี/,             // DB category name used for dedup logic
  /\[Order\]/,               // console.log
  /console\.(log|error|warn)/, // any console output
  /name_th:\s*['`]/,         // DB record name_th field
  /\.includes\(/,            // DB category name matchers (ProductSheet)
  /isAsap:\s*true/,          // TEST_MODE ASAP slot (Cart, Order)
  /rawMsg/,                  // Pay.tsx internal error handler
  /e instanceof Error/,      // catch-block fallback (Pay.tsx)
];

/* Strip comments */
function stripComments(src) {
  let s = src.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '));
  s = s.replace(/\/\/[^\n]*/g, m => ' '.repeat(m.length));
  return s;
}

/* ── parse keys from TS dict files ── */
function extractKeys(filepath) {
  const src = readFileSync(filepath, 'utf8');
  const re = /^\s+'([a-zA-Z][a-zA-Z0-9]*(?:\.[a-zA-Z][a-zA-Z0-9]*)*)'\s*:/gm;
  const keys = [];
  let m;
  while ((m = re.exec(src)) !== null) keys.push(m[1]);
  return keys;
}

function extractStringValues(filepath) {
  const src = readFileSync(filepath, 'utf8');
  const re = /^\s+'([a-zA-Z][a-zA-Z0-9]*(?:\.[a-zA-Z][a-zA-Z0-9]*)*)'\s*:\s*'([^'\\]*)'/gm;
  const map = {};
  let m;
  while ((m = re.exec(src)) !== null) map[m[1]] = m[2];
  return map;
}

let exitCode = 0;

/* ══════════════════════════════════════════════════════════
   CHECK 1 — Thai word text outside src/i18n/
══════════════════════════════════════════════════════════ */
const srcFiles = walk(SRC);
const thaiIssues = [];

for (const file of srcFiles) {
  if (file.startsWith(I18N)) continue;
  if (SKIP_FILES.has(file)) continue;

  const content = readFileSync(file, 'utf8');
  const stripped = stripComments(content);
  const lines = stripped.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!THAI_WORD_RE.test(line)) continue;
    if (IGNORE_PATTERNS.some(p => p.test(line))) continue;
    thaiIssues.push({ file: relative(ROOT, file), line: i + 1, text: line.trim() });
  }
}

if (thaiIssues.length > 0) {
  console.error(`\n[i18n] ❌ Thai text outside src/i18n/ (${thaiIssues.length} occurrences):`);
  for (const { file, line, text } of thaiIssues) {
    console.error(`  ${file}:${line}`);
    console.error(`    ${text.slice(0, 120)}`);
  }
  exitCode = 1;
} else {
  console.log('[i18n] ✅ No stray Thai word text found outside src/i18n/');
}

/* ══════════════════════════════════════════════════════════
   CHECK 2 — Key parity
══════════════════════════════════════════════════════════ */
const thKeys = extractKeys(resolve(SRC, 'i18n/th.ts'));
const enKeys = extractKeys(resolve(SRC, 'i18n/en.ts'));
const thSet = new Set(thKeys);
const enSet = new Set(enKeys);

const missingInEn = thKeys.filter(k => !enSet.has(k));
const extraInEn   = enKeys.filter(k => !thSet.has(k));

if (missingInEn.length > 0) {
  console.error(`\n[i18n] ❌ Missing in EN (${missingInEn.length}):`);
  missingInEn.forEach(k => console.error(`  - ${k}`));
  exitCode = 1;
}
if (extraInEn.length > 0) {
  console.error(`\n[i18n] ❌ Extra in EN not in TH (${extraInEn.length}):`);
  extraInEn.forEach(k => console.error(`  + ${k}`));
  exitCode = 1;
}
if (missingInEn.length === 0 && extraInEn.length === 0) {
  console.log(`[i18n] ✅ Key parity: ${thKeys.length} TH = ${enKeys.length} EN`);
}

/* ══════════════════════════════════════════════════════════
   REPORT — Keys where EN = TH (likely untranslated)
══════════════════════════════════════════════════════════ */
const thValues = extractStringValues(resolve(SRC, 'i18n/th.ts'));
const enValues = extractStringValues(resolve(SRC, 'i18n/en.ts'));

/* Intentional brand-English phrases — same in both modes by design */
const BRAND_PHRASES = new Set([
  'MADE FOR THE WAY YOU EAT.',
  'YOUR BEST PART',
  'Made just how you like it.',
  'Made for you.',
  'Craft Your Best Part',
  'Social',
  'Social Media',
  'Best Part Bowls',
  'PromptPay QR',
  '0812345678',
  'Because your meal should feel like yours.',
]);

const sameValue = [];
for (const key of Object.keys(thValues)) {
  if (enValues[key] === undefined) continue;
  if (enValues[key] !== thValues[key]) continue;
  if (BRAND_PHRASES.has(thValues[key])) continue;
  sameValue.push({ key, value: thValues[key] });
}

if (sameValue.length > 0) {
  console.warn(`\n[i18n] ⚠️  Keys where EN = TH (check if intentional) (${sameValue.length}):`);
  for (const { key, value } of sameValue) {
    console.warn(`  ${key}: "${value}"`);
  }
}

/* ── summary ── */
console.log(`\n[i18n] TH keys: ${thKeys.length} · EN keys: ${enKeys.length} · files scanned: ${srcFiles.length}`);
if (exitCode !== 0) process.exit(exitCode);
