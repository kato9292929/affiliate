// 一覧ページ（コレクション・カテゴリ・タグ）の静的パス生成
import { SITE } from '../../site.config';
import { getArticles, getAllArticles, paginateItems, isBrokerTag, type Article } from './content';
import { ARTICLE_COLLECTIONS, CATEGORIES, COLLECTION_LABELS, type ArticleCollection } from './site-data';

type ListProps = { items: Article[]; current: number; last: number };

function pages<P extends Record<string, string>>(params: P, items: Article[], firstPage: boolean) {
  const chunks = paginateItems(items, SITE.pageSize);
  const out = chunks.map((chunk, i) => ({
    params: { ...params, page: String(i + 1) },
    props: { items: chunk, current: i + 1, last: chunks.length } as ListProps,
  }));
  return firstPage ? out.slice(0, 1) : out.slice(1);
}

export async function collectionPaths(firstPage: boolean) {
  const out = [];
  for (const c of ARTICLE_COLLECTIONS) out.push(...pages({ collection: c }, await getArticles(c), firstPage));
  return out;
}

export async function categoryPaths(firstPage: boolean) {
  const out = [];
  for (const c of ARTICLE_COLLECTIONS) {
    const items = await getArticles(c);
    for (const key of Object.keys(CATEGORIES[c] ?? {})) {
      out.push(...pages({ collection: c, category: key }, items.filter((e) => e.data.category === key), firstPage));
    }
  }
  return out;
}

export async function allTags() {
  const all = await getAllArticles();
  const map = new Map<string, Article[]>();
  for (const e of all) for (const t of e.data.tags) if (!isBrokerTag(t)) map.set(t, [...(map.get(t) ?? []), e]);
  return map;
}

export async function tagPaths(firstPage: boolean) {
  const out = [];
  for (const [tag, items] of await allTags()) out.push(...pages({ tag }, items, firstPage));
  return out;
}

export { COLLECTION_LABELS, CATEGORIES };
export type { ArticleCollection, ListProps };
