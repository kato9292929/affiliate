// サイト本体（Astro）と検査スクリプト（scripts/*.mjs）で共有するデータ読み込み・検証ロジック。
// 素の JavaScript にしているのは、node から直接 import できるようにするため。
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative, extname } from 'node:path';
import { load as loadYamlText } from 'js-yaml';
import { parse as parseCsv } from 'csv-parse/sync';

/** 検査対象のルート。テストでは DATA_ROOT で差し替える */
export const ROOT = process.env.DATA_ROOT || process.cwd();

export const PATHS = {
  offers: 'src/data/offers.yaml',
  supervisors: 'src/data/supervisors.yaml',
  categories: 'src/data/categories.yaml',
  brokers: 'src/data/brokers.yaml',
  bannedPhrases: 'src/data/banned-phrases.yaml',
  comparisons: 'src/data/comparisons',
  programs: 'data/affiliate-programs.csv',
  content: 'src/content',
};

export const ASPS = ['a8', 'moshimo', 'valuecommerce', 'afb', 'accesstrade', 'felmat', 'amazon', 'rakuten', 'direct'];
export const OFFER_KEYS = ['name', 'asp', 'url', 'fallbackUrl', 'impressionTag', 'active'];
export const ARTICLE_COLLECTIONS = ['news', 'guides', 'reviews', 'stock'];

/** affiliate-programs.csv の列名の候補（実データの列名が違っても拾えるように） */
const CSV_ID_COLUMNS = ['id', 'offer_id', 'offerId', 'offer', 'ID'];
const CSV_REG_COLUMNS = ['registration', 'registration_number', '登録番号'];

const abs = (p) => join(ROOT, p);

export function readYamlFile(path) {
  return loadYamlText(readFileSync(abs(path), 'utf8')) ?? {};
}

export const isHttpUrl = (s) => {
  if (typeof s !== 'string' || !s) return false;
  try {
    const u = new URL(s);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
};

/** トップレベルのキー重複を検出（YAMLパーサより先に、分かりやすいメッセージで出す） */
export function findDuplicateTopLevelKeys(text) {
  const seen = new Map();
  const dups = [];
  text.split(/\r?\n/).forEach((line, i) => {
    const m = /^([^\s#'"][^:]*?|"[^"]+"|'[^']+'):(\s|$)/.exec(line);
    if (!m) return;
    const key = m[1].replace(/^['"]|['"]$/g, '');
    if (seen.has(key)) dups.push({ key, line: i + 1, firstLine: seen.get(key) });
    else seen.set(key, i + 1);
  });
  return dups;
}

/**
 * offers.yaml を読み込んで検証する。
 * @returns {{ offers: Record<string, any>, errors: string[], warnings: string[] }}
 */
export function loadOffers({ path = PATHS.offers } = {}) {
  const errors = [];
  const warnings = [];
  let text;
  try {
    text = readFileSync(abs(path), 'utf8');
  } catch (e) {
    return { offers: {}, errors: [`${path}: 読み込めません (${e.message})`], warnings };
  }
  for (const d of findDuplicateTopLevelKeys(text)) {
    errors.push(`${path}:${d.line}: id "${d.key}" が重複しています（最初の定義は ${d.firstLine} 行目）`);
  }
  let raw;
  try {
    raw = loadYamlText(text) ?? {};
  } catch (e) {
    errors.push(`${path}: YAMLの構文エラー: ${e.message}`);
    return { offers: {}, errors, warnings };
  }
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    errors.push(`${path}: トップレベルは「id: {...}」の対応表である必要があります`);
    return { offers: {}, errors, warnings };
  }
  const offers = {};
  for (const [id, o] of Object.entries(raw)) {
    const at = `${path} [${id}]`;
    if (!/^[a-z0-9][a-z0-9_-]*$/i.test(id)) errors.push(`${at}: id に使えない文字があります（英数字・-・_ のみ）`);
    if (!o || typeof o !== 'object' || Array.isArray(o)) {
      errors.push(`${at}: 値がオブジェクトではありません`);
      continue;
    }
    for (const k of OFFER_KEYS) if (!(k in o)) errors.push(`${at}: 必須キー "${k}" がありません`);
    for (const k of Object.keys(o)) if (!OFFER_KEYS.includes(k)) warnings.push(`${at}: 未定義のキー "${k}" は無視されます`);
    if ('name' in o && (typeof o.name !== 'string' || !o.name.trim())) errors.push(`${at}: name は空でない文字列にしてください`);
    if ('asp' in o && !ASPS.includes(o.asp)) errors.push(`${at}: asp "${o.asp}" は ${ASPS.join(' / ')} のどれかにしてください`);
    if ('url' in o && o.url !== null && typeof o.url !== 'string') errors.push(`${at}: url は文字列にしてください`);
    if (typeof o.url === 'string' && o.url && !isHttpUrl(o.url)) errors.push(`${at}: url "${o.url}" がURLの形式ではありません`);
    if ('fallbackUrl' in o && !isHttpUrl(o.fallbackUrl)) errors.push(`${at}: fallbackUrl "${o.fallbackUrl ?? ''}" がURLの形式ではありません`);
    if ('impressionTag' in o && o.impressionTag !== null && typeof o.impressionTag !== 'string') errors.push(`${at}: impressionTag は文字列にしてください`);
    if ('active' in o && typeof o.active !== 'boolean') errors.push(`${at}: active は true / false にしてください`);
    if (o.active === true && !(typeof o.url === 'string' && o.url.trim())) errors.push(`${at}: active: true なのに url が空です`);
    offers[id] = {
      id,
      name: String(o.name ?? id),
      asp: o.asp,
      url: typeof o.url === 'string' ? o.url.trim() : '',
      fallbackUrl: o.fallbackUrl,
      impressionTag: typeof o.impressionTag === 'string' ? o.impressionTag.trim() : '',
      active: o.active === true,
    };
  }
  return { offers, errors, warnings };
}

/** affiliate-programs.csv を読み込み、id → 行 の Map を返す */
export function loadPrograms({ path = PATHS.programs } = {}) {
  const errors = [];
  const rows = new Map();
  if (!existsSync(abs(path))) return { rows, errors: [`${path}: ファイルがありません`] };
  let records;
  try {
    records = parseCsv(readFileSync(abs(path), 'utf8'), { columns: true, skip_empty_lines: true, bom: true, trim: true });
  } catch (e) {
    return { rows, errors: [`${path}: CSVの構文エラー: ${e.message}`] };
  }
  const header = records.length ? Object.keys(records[0]) : [];
  const idCol = CSV_ID_COLUMNS.find((c) => header.includes(c));
  const regCol = CSV_REG_COLUMNS.find((c) => header.includes(c));
  if (records.length && !idCol) errors.push(`${path}: id の列が見つかりません（${CSV_ID_COLUMNS.join(' / ')}）`);
  if (records.length && !regCol) errors.push(`${path}: registration の列が見つかりません（${CSV_REG_COLUMNS.join(' / ')}）`);
  for (const r of records) {
    const id = idCol ? r[idCol] : '';
    if (!id) continue;
    rows.set(id, { ...r, id, registration: regCol ? (r[regCol] ?? '').trim() : '' });
  }
  return { rows, errors };
}

/** 登録番号（affiliate-programs.csv の registration 列が正）。無ければ空文字 */
export function registrationOf(programs, offerId) {
  return programs.get(offerId)?.registration ?? '';
}

/** src/content/<collection> 配下の md / mdx を列挙 */
export function listContentFiles(collection) {
  const dir = abs(join(PATHS.content, collection));
  if (!existsSync(dir)) return [];
  const out = [];
  const walk = (d) => {
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (['.md', '.mdx'].includes(extname(name))) out.push(p);
    }
  };
  walk(dir);
  return out.map((p) => ({ abs: p, rel: relative(ROOT, p) }));
}

/** frontmatter と本文に分ける */
export function parseFrontmatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text);
  if (!m) return { data: {}, body: text, error: 'frontmatter がありません' };
  try {
    return { data: loadYamlText(m[1]) ?? {}, body: m[2] };
  } catch (e) {
    return { data: {}, body: m[2], error: `frontmatter の構文エラー: ${e.message}` };
  }
}

/** 本文中の <Offer id="..."> / <OfferButton id="..."> の id を拾う */
export function offerIdsInBody(body) {
  const ids = [];
  const re = /<(?:Offer|OfferButton)\b[^>]*?\bid\s*=\s*(?:"([^"]+)"|'([^']+)'|\{\s*["']([^"']+)["']\s*\})/g;
  let m;
  while ((m = re.exec(body))) ids.push(m[1] ?? m[2] ?? m[3]);
  return ids;
}

/** 本文中の <ComparisonTable data="..."> のキーを拾う */
export function comparisonKeysInBody(body) {
  const keys = [];
  const re = /<ComparisonTable\b[^>]*?\bdata\s*=\s*(?:"([^"]+)"|'([^']+)')/g;
  let m;
  while ((m = re.exec(body))) keys.push(m[1] ?? m[2]);
  return keys;
}

/** 比較表データ（src/data/comparisons/<key>.yaml） */
export function loadComparison(key) {
  const p = join(PATHS.comparisons, `${key}.yaml`);
  if (!existsSync(abs(p))) return null;
  return readYamlFile(p);
}

export function listComparisonKeys() {
  const dir = abs(PATHS.comparisons);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith('.yaml')).map((f) => f.replace(/\.yaml$/, ''));
}
