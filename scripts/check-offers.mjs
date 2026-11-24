#!/usr/bin/env node
// pnpm check:offers — 案件データ（offers.yaml / affiliate-programs.csv）と記事の参照を検査する。
// 問題があれば内容を出力し、終了コード 1 で終わる。
import { readFileSync } from 'node:fs';
import {
  ARTICLE_COLLECTIONS, PATHS, loadOffers, loadPrograms, registrationOf, listContentFiles,
  parseFrontmatter, offerIdsInBody, comparisonKeysInBody, loadComparison, listComparisonKeys, readYamlFile,
} from '../src/lib/data.mjs';

const errors = [];
const warnings = [];

const { offers, errors: offerErrors, warnings: offerWarnings } = loadOffers();
errors.push(...offerErrors);
warnings.push(...offerWarnings);

const { rows: programs, errors: csvErrors } = loadPrograms();
errors.push(...csvErrors);

const exists = (id) => Object.prototype.hasOwnProperty.call(offers, id);

/** 株式の案件は金融庁の登録業者のみ：registration 列が空なら掲載不可 */
function requireRegistration(id, where) {
  if (!exists(id)) return; // 存在しない id は別のエラーで出る
  if (!programs.has(id)) {
    errors.push(`${where}: 株式の案件 "${id}" が ${PATHS.programs} にありません（登録番号を確認できないため掲載不可）`);
  } else if (!registrationOf(programs, id)) {
    errors.push(`${where}: 株式の案件 "${id}" は ${PATHS.programs} の registration（登録番号）が空です（金融庁の登録業者のみ掲載可）`);
  }
}

// 比較表データ
const comparisonOffers = new Map();
for (const key of listComparisonKeys()) {
  const where = `${PATHS.comparisons}/${key}.yaml`;
  let data;
  try {
    data = loadComparison(key);
  } catch (e) {
    errors.push(`${where}: YAMLの構文エラー: ${e.message}`);
    continue;
  }
  if (!data?.infoDate) errors.push(`${where}: infoDate（情報基準日）がありません`);
  const ids = (data?.rows ?? []).map((r) => r?.offer).filter(Boolean);
  for (const id of ids) if (!exists(id)) errors.push(`${where}: offers.yaml に無い id "${id}" を参照しています`);
  comparisonOffers.set(key, ids);
}

// 記事
for (const collection of ARTICLE_COLLECTIONS) {
  for (const file of listContentFiles(collection)) {
    const { data, body, error } = parseFrontmatter(readFileSync(file.abs, 'utf8'));
    if (error) {
      errors.push(`${file.rel}: ${error}`);
      continue;
    }
    const fmOffers = Array.isArray(data.offers) ? data.offers : data.offers == null ? [] : null;
    if (fmOffers === null) {
      errors.push(`${file.rel}: offers は id の配列にしてください`);
      continue;
    }
    const bodyOffers = offerIdsInBody(body);
    for (const id of new Set([...fmOffers, ...bodyOffers])) {
      if (!exists(id)) errors.push(`${file.rel}: offers.yaml に無い id "${id}" を参照しています`);
    }
    for (const id of new Set(bodyOffers)) {
      if (!fmOffers.includes(id)) {
        errors.push(`${file.rel}: 本文の <Offer id="${id}"> が frontmatter の offers にありません（広告表記の自動表示に必要）`);
      }
    }
    const tables = comparisonKeysInBody(body);
    for (const key of tables) {
      if (!comparisonOffers.has(key)) errors.push(`${file.rel}: 比較表データ "${key}"（${PATHS.comparisons}/${key}.yaml）がありません`);
    }
    if (collection === 'stock') {
      const ids = new Set([...fmOffers, ...bodyOffers, ...tables.flatMap((k) => comparisonOffers.get(k) ?? [])]);
      for (const id of ids) requireRegistration(id, file.rel);
    }
  }
}

// 証券会社ページ（brokers.yaml）に並べる案件も株式扱い
try {
  const brokers = readYamlFile(PATHS.brokers);
  for (const [key, b] of Object.entries(brokers ?? {})) {
    for (const id of b?.offers ?? []) {
      const where = `${PATHS.brokers} [${key}]`;
      if (!exists(id)) errors.push(`${where}: offers.yaml に無い id "${id}" を参照しています`);
      else requireRegistration(id, where);
    }
  }
} catch (e) {
  errors.push(`${PATHS.brokers}: ${e.message}`);
}

// 本番公開ガード：仮の案件（sample-*）や「サンプル」の登録番号が残ったまま本番に出さない。
// Vercel の本番デプロイ（VERCEL_ENV=production）か PUBLISH_GUARD=1 のときだけ有効。プレビューでは通す。
if (process.env.VERCEL_ENV === 'production' || process.env.PUBLISH_GUARD === '1') {
  for (const id of Object.keys(offers)) {
    if (id.startsWith('sample-')) errors.push(`本番公開ガード: 仮の案件 "${id}" が ${PATHS.offers} に残っています（42件の取り込み後に削除し、記事の参照も付け替える）`);
  }
  for (const [id, row] of programs) {
    if (/サンプル|sample/i.test(row.registration)) errors.push(`本番公開ガード: ${PATHS.programs} の "${id}" の registration が仮の値です: ${row.registration}`);
  }
}

for (const w of warnings) console.warn(`warning: ${w}`);
if (errors.length) {
  for (const e of errors) console.error(`error: ${e}`);
  console.error(`\ncheck:offers: ${errors.length} 件のエラー`);
  process.exit(1);
}
const activeCount = Object.values(offers).filter((o) => o.active).length;
console.log(`check:offers: OK（案件 ${Object.keys(offers).length} 件 / active ${activeCount} 件 / 台帳 ${programs.size} 行）`);
