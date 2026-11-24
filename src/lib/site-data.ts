// サイト本体用の型付きデータアクセス
import { loadOffers, loadPrograms, readYamlFile, PATHS, loadComparison, registrationOf } from './data.mjs';

export type Offer = {
  id: string;
  name: string;
  asp: string;
  url: string;
  fallbackUrl: string;
  impressionTag: string;
  active: boolean;
};

export type Category = {
  label: string;
  description?: string;
  group?: string;
  audience?: 'corporate' | 'personal' | 'both';
  related?: Partial<Record<ArticleCollection, string[]>>;
};

export type Supervisor = {
  id: string;
  name: string;
  title: string;
  type?: 'organization' | 'person';
  affiliation?: string;
  url?: string;
  specialties?: string[];
  scope?: string;
  notice?: string;
};

export type Broker = { key: string; name: string; offers: string[] };

export type ArticleCollection = 'news' | 'guides' | 'reviews' | 'stock';
export const ARTICLE_COLLECTIONS: ArticleCollection[] = ['news', 'guides', 'reviews', 'stock'];

export const COLLECTION_LABELS: Record<ArticleCollection, string> = {
  news: 'ニュース',
  guides: '解説・対策',
  reviews: '製品・サービス',
  stock: '株式',
};

const offersResult = loadOffers();
if (offersResult.errors.length) {
  throw new Error(`offers.yaml にエラーがあります（pnpm check:offers で詳細を確認）:\n${offersResult.errors.join('\n')}`);
}
export const OFFERS: Record<string, Offer> = offersResult.offers;
export const PROGRAMS = loadPrograms().rows;

export const CATEGORIES = readYamlFile(PATHS.categories) as Record<ArticleCollection, Record<string, Category>>;

const supRaw = readYamlFile(PATHS.supervisors) as Record<string, Omit<Supervisor, 'id'>>;
export const SUPERVISORS: Record<string, Supervisor> = Object.fromEntries(
  Object.entries(supRaw).map(([id, s]) => [id, { id, ...s }]),
);

const brokersRaw = readYamlFile(PATHS.brokers) as Record<string, { name: string; offers?: string[] }>;
export const BROKERS: Record<string, Broker> = Object.fromEntries(
  Object.entries(brokersRaw ?? {}).map(([key, b]) => [key, { key, name: b.name, offers: b.offers ?? [] }]),
);

export function getOffer(id: string): Offer {
  const o = OFFERS[id];
  if (!o) throw new Error(`offers.yaml に無い案件 id: ${id}`);
  return o;
}

/** アフィリエイトリンクを使うか（active かつ url あり） */
export const isAffiliate = (o: Offer) => o.active && !!o.url;

/** 記事の offers に active な案件が1つでもあれば広告表記を出す */
export const hasActiveOffer = (ids: string[] = []) => ids.some((id) => OFFERS[id] && isAffiliate(OFFERS[id]));

export const registration = (offerId: string) => registrationOf(PROGRAMS, offerId);

export function category(collection: ArticleCollection, key: string): Category {
  return CATEGORIES[collection]?.[key] ?? { label: key };
}

export type ComparisonData = {
  title?: string;
  type?: 'security' | 'general';
  infoDate: string;
  columns?: { key: string; label: string }[];
  rows: {
    offer: string;
    name?: string;
    infoDate?: string;
    mfa?: string;
    passkey?: string;
    mfaRequired?: string;
    values?: Record<string, string>;
  }[];
};

export function comparison(key: string): ComparisonData {
  const d = loadComparison(key);
  if (!d) throw new Error(`比較表データがありません: src/data/comparisons/${key}.yaml`);
  return d as ComparisonData;
}
