#!/usr/bin/env node
// pnpm import:offers <offers-additions.yaml>
// offers-additions.yaml の案件を src/data/offers.yaml の末尾に追記する（既存の id は上書きしない）。
import { readFileSync, appendFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import { load, dump } from 'js-yaml';
import { loadOffers, OFFER_KEYS, PATHS, ROOT } from '../src/lib/data.mjs';

const src = process.argv[2];
if (!src) {
  console.error('usage: pnpm import:offers <offers-additions.yaml>');
  process.exit(1);
}
const additions = load(readFileSync(src, 'utf8')) ?? {};
const { offers } = loadOffers();
let added = 0;
let out = `\n# ---- ${basename(src)} から取り込み（${new Date().toISOString().slice(0, 10)}） ----\n`;
for (const [id, o] of Object.entries(additions)) {
  if (offers[id]) {
    console.warn(`skip: ${id} は既に offers.yaml にあります`);
    continue;
  }
  const entry = Object.fromEntries(OFFER_KEYS.map((k) => [k, o?.[k] ?? (k === 'active' ? false : '')]));
  out += `\n${dump({ [id]: entry }, { lineWidth: -1, quotingType: '"', forceQuotes: false })}`;
  added++;
}
appendFileSync(join(ROOT, PATHS.offers), out);
console.log(`${added} 件を ${PATHS.offers} に追記しました。pnpm check:offers で確認してください。`);
