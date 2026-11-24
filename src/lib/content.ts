import { getCollection, type CollectionEntry } from 'astro:content';
import { ARTICLE_COLLECTIONS, CATEGORIES, type ArticleCollection } from './site-data';

export type Article = CollectionEntry<ArticleCollection>;

const isVisible = (e: { data: { draft?: boolean } }) => import.meta.env.DEV || !e.data.draft;
const byDateDesc = (a: Article, b: Article) => b.data.publishedAt.getTime() - a.data.publishedAt.getTime();

export async function getArticles(collection: ArticleCollection): Promise<Article[]> {
  const items = (await getCollection(collection, isVisible)) as Article[];
  return items.sort(byDateDesc);
}

export async function getAllArticles(): Promise<Article[]> {
  const all = (await Promise.all(ARTICLE_COLLECTIONS.map((c) => getArticles(c)))).flat();
  return all.sort(byDateDesc);
}

export const articleUrl = (e: { collection: string; id: string }) => `/${e.collection}/${e.id}/`;
export const categoryUrl = (collection: string, key: string) => `/${collection}/category/${key}/`;

export const BROKER_PREFIX = 'broker:';
export const isBrokerTag = (t: string) => t.startsWith(BROKER_PREFIX);
export const brokerKey = (t: string) => t.slice(BROKER_PREFIX.length);
export const brokerUrl = (key: string) => `/stock/broker/${key}/`;
export const tagUrl = (t: string) => (isBrokerTag(t) ? brokerUrl(brokerKey(t)) : `/tags/${encodeURIComponent(t)}/`);

/** ニュースの当事者（記事の指定 → カテゴリの audience → corporate） */
function audienceOf(e: Article): 'corporate' | 'personal' | 'both' {
  const d = e.data as { audience?: 'corporate' | 'personal' | 'both' };
  return d.audience ?? CATEGORIES[e.collection as ArticleCollection]?.[e.data.category]?.audience ?? 'both';
}

/**
 * ニュース記事の下に出す関連リンク。カテゴリ（categories.yaml の related）とタグの一致でスコアを付ける。
 * 当事者が個人なら個人向け、法人なら法人向けのカテゴリを優先する。
 */
export async function relatedFor(entry: Article, limit = 3) {
  const cat = CATEGORIES[entry.collection as ArticleCollection]?.[entry.data.category];
  const related = cat?.related ?? {};
  const audience = audienceOf(entry);
  const tags = new Set(entry.data.tags);

  const score = (c: Article) => {
    let s = 0;
    if ((related[c.collection as ArticleCollection] ?? []).includes(c.data.category)) s += 2;
    s += c.data.tags.filter((t) => tags.has(t)).length * 3;
    const ca = CATEGORIES[c.collection as ArticleCollection]?.[c.data.category]?.audience ?? 'both';
    if (audience !== 'both' && ca !== 'both') s += ca === audience ? 1 : -2;
    return s;
  };
  const pick = (items: Article[]) =>
    items
      .filter((c) => !(c.collection === entry.collection && c.id === entry.id))
      .map((c) => ({ c, s: score(c) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s || byDateDesc(a.c, b.c))
      .slice(0, limit)
      .map((x) => x.c);

  const [guides, reviews, stock] = await Promise.all([getArticles('guides'), getArticles('reviews'), getArticles('stock')]);
  return {
    guides: pick(guides),
    products: pick([...reviews, ...stock.filter((s) => s.data.isComparison), ...guides.filter((g) => g.data.isComparison)]),
  };
}

export function paginateItems<T>(items: T[], size: number) {
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += size) pages.push(items.slice(i, i + size));
  return pages.length ? pages : [[]];
}

const fmt = new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric', month: 'long', day: 'numeric' });
export const formatDate = (d?: Date) => (d ? fmt.format(d) : '');
export const isoDate = (d?: Date) => (d ? d.toISOString() : undefined);
