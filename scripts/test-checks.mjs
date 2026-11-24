#!/usr/bin/env node
// pnpm test:checks — check:offers / check:content が、ダミーの不正データを検出できることを確かめる。
// リポジトリのデータを一時ディレクトリに複製し、1ケースずつ壊して検査を走らせる。
import { cpSync, mkdtempSync, readFileSync, writeFileSync, appendFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..');
const OFFERS = 'src/data/offers.yaml';
const CSV = 'data/affiliate-programs.csv';
const REVIEW = 'src/content/reviews/zz-dummy.md';
const STOCK = 'src/content/stock/zz-dummy.md';
// テストで使う既存の案件 id（offers.yaml の先頭のもの）
const EXISTING = /^([a-z0-9][a-z0-9_-]*):/im.exec(readFileSync(join(repo, OFFERS), 'utf8').replace(/^#.*$/gm, ''))[1];
const article = (offers, body = '') =>
  `---\ntitle: dummy\ndescription: dummy\ncategory: x\npublishedAt: 2026-01-01\nsupervisor: x402\noffers: [${offers.join(', ')}]\n---\n${body}\n`;

const cases = [
  { name: '存在しない id の参照', expect: '"no-such-offer"', setup: (w) => w(REVIEW, article(['no-such-offer'])) },
  { name: '本文の <Offer> が存在しない id', expect: '"ghost"', setup: (w) => w(REVIEW, article([], '<Offer id="ghost" />')) },
  { name: 'id の重複', expect: '重複', setup: (w, a) => a(OFFERS, `\n${EXISTING}:\n  name: dup\n  asp: a8\n  url: ""\n  fallbackUrl: https://example.com\n  impressionTag: ""\n  active: false\n`) },
  { name: 'active: true なのに url が空', expect: 'url が空', setup: (w, a) => a(OFFERS, `\nzz-active-empty:\n  name: x\n  asp: a8\n  url: ""\n  fallbackUrl: https://example.com\n  impressionTag: ""\n  active: true\n`) },
  { name: 'fallbackUrl がURLでない', expect: 'fallbackUrl', setup: (w, a) => a(OFFERS, `\nzz-bad-url:\n  name: x\n  asp: a8\n  url: ""\n  fallbackUrl: example.com/no-scheme\n  impressionTag: ""\n  active: false\n`) },
  { name: 'asp がスキーマ外', expect: 'asp', setup: (w, a) => a(OFFERS, `\nzz-bad-asp:\n  name: x\n  asp: unknown-asp\n  url: ""\n  fallbackUrl: https://example.com\n  impressionTag: ""\n  active: false\n`) },
  { name: 'YAML の構文エラー', expect: '構文エラー', setup: (w, a) => a(OFFERS, `\nzz-broken: [unclosed\n`) },
  {
    name: 'stock 記事が registration の空いた案件を参照',
    expect: 'registration',
    setup: (w, a) => {
      a(OFFERS, `\nzz-no-reg:\n  name: x\n  asp: a8\n  url: ""\n  fallbackUrl: https://example.com\n  impressionTag: ""\n  active: false\n`);
      a(CSV, `zz-no-reg,x,a8,stock,,,,,\n`);
      w(STOCK, article(['zz-no-reg']));
    },
  },
  {
    name: 'stock 記事が台帳に無い案件を参照',
    expect: 'ありません',
    setup: (w, a) => {
      a(OFFERS, `\nzz-not-in-csv:\n  name: x\n  asp: a8\n  url: ""\n  fallbackUrl: https://example.com\n  impressionTag: ""\n  active: false\n`);
      w(STOCK, article(['zz-not-in-csv']));
    },
  },
];

let failed = 0;
// ガード以外のケースはプレビュー扱いで走らせる（ガードは下で個別に確かめる）
const baseEnv = { ...process.env, VERCEL_ENV: 'preview', ALLOW_SAMPLE_DATA: '', PUBLISH_GUARD: '' };
const run = (script, root, env = {}) => spawnSync(process.execPath, [join(repo, 'scripts', script)], { env: { ...baseEnv, DATA_ROOT: root, ...env }, encoding: 'utf8' });

function sandbox() {
  const root = mkdtempSync(join(tmpdir(), 'check-'));
  for (const p of ['src/data', 'src/content', 'data']) cpSync(join(repo, p), join(root, p), { recursive: true });
  const w = (p, s) => writeFileSync(join(root, p), s);
  const a = (p, s) => appendFileSync(join(root, p), s);
  return { root, w, a };
}

// 正常系
{
  const { root } = sandbox();
  const r = run('check-offers.mjs', root);
  console.log(`${r.status === 0 ? 'ok  ' : 'FAIL'} 現在のデータは通る`);
  if (r.status !== 0) { failed++; console.log(r.stderr); }
  rmSync(root, { recursive: true, force: true });
}
// 異常系
for (const c of cases) {
  const { root, w, a } = sandbox();
  c.setup(w, a);
  const r = run('check-offers.mjs', root);
  const ok = r.status !== 0 && r.stderr.includes(c.expect);
  console.log(`${ok ? 'ok  ' : 'FAIL'} 検出: ${c.name}`);
  if (!ok) { failed++; console.log(r.stdout, r.stderr); }
  rmSync(root, { recursive: true, force: true });
}
// active: false の案件を参照してもビルド（検査）は通る
{
  const { root, w } = sandbox();
  w(REVIEW, article([EXISTING], `<Offer id="${EXISTING}" />`));
  const r = run('check-offers.mjs', root);
  const ok = r.status === 0;
  console.log(`${ok ? 'ok  ' : 'FAIL'} active: false の案件の参照は通る`);
  if (!ok) { failed++; console.log(r.stderr); }
  rmSync(root, { recursive: true, force: true });
}
// 本番公開ガード：仮データが残っていれば止まる／止まらない条件
for (const [label, env, shouldFail] of [
  ['VERCEL_ENV=production で止まる', { VERCEL_ENV: 'production' }, true],
  ['VERCEL_ENV が空（システム環境変数オフ・手元）で止まる', { VERCEL_ENV: '' }, true],
  ['VERCEL_ENV が想定外の値で止まる', { VERCEL_ENV: 'prod' }, true],
  ['production では ALLOW_SAMPLE_DATA=1 を無視して止まる', { VERCEL_ENV: 'production', ALLOW_SAMPLE_DATA: '1' }, true],
  ['VERCEL_ENV=preview では通る', { VERCEL_ENV: 'preview' }, false],
  ['VERCEL_ENV が空でも ALLOW_SAMPLE_DATA=1 なら通る', { VERCEL_ENV: '', ALLOW_SAMPLE_DATA: '1' }, false],
]) {
  const { root } = sandbox();
  const r = run('check-offers.mjs', root, env);
  const ok = shouldFail ? r.status !== 0 && r.stderr.includes('本番公開ガード') : r.status === 0;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ガード: ${label}`);
  if (!ok) { failed++; console.log(r.stdout, r.stderr); }
  rmSync(root, { recursive: true, force: true });
}
// 禁止表現
{
  const { root, w } = sandbox();
  w(STOCK, article([], 'この投資は元本保証でノーリスクです。'));
  const r = run('check-content.mjs', root);
  const ok = r.stderr.includes('元本保証') && r.stderr.includes('ノーリスク');
  console.log(`${ok ? 'ok  ' : 'FAIL'} 警告: stock 本文の禁止表現`);
  if (!ok) { failed++; console.log(r.stdout, r.stderr); }
  rmSync(root, { recursive: true, force: true });
}

console.log(failed ? `\n${failed} 件失敗` : '\nすべて成功');
process.exit(failed ? 1 : 0);
