#!/usr/bin/env node
// pnpm check:content — stock の記事本文・タイトル・説明に禁止表現があれば警告を出す。
// 語のリストは src/data/banned-phrases.yaml。--strict を付けると警告があれば終了コード 1。
import { readFileSync } from 'node:fs';
import { PATHS, listContentFiles, readYamlFile } from '../src/lib/data.mjs';

const strict = process.argv.includes('--strict');
const { phrases = [] } = readYamlFile(PATHS.bannedPhrases);
const hits = [];

for (const file of listContentFiles('stock')) {
  const text = readFileSync(file.abs, 'utf8');
  const lines = text.split(/\r?\n/);
  lines.forEach((line, i) => {
    for (const p of phrases) if (line.includes(p)) hits.push(`${file.rel}:${i + 1}: 禁止表現「${p}」: ${line.trim()}`);
  });
}

if (hits.length) {
  for (const h of hits) console.warn(`warning: ${h}`);
  console.warn(`\ncheck:content: ${hits.length} 件の警告`);
  if (strict) process.exit(1);
} else {
  console.log(`check:content: OK（禁止表現 ${phrases.length} 語で stock の記事を確認）`);
}
