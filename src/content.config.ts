import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { readYamlFile, PATHS } from './lib/data.mjs';

const categories = readYamlFile(PATHS.categories) as Record<string, Record<string, unknown>>;
const supervisors = readYamlFile(PATHS.supervisors) as Record<string, unknown>;

const date = z.coerce.date();

/** 全コレクション共通のフィールド */
const base = {
  title: z.string().min(1),
  description: z.string().min(1),
  category: z.string().min(1),
  tags: z.array(z.string().min(1)).default([]),
  publishedAt: date,
  updatedAt: date.optional(),
  supervisor: z.string().min(1),
  author: z.string().optional(),
  offers: z.array(z.string().min(1)).default([]),
  sourceUrls: z.array(z.url()).default([]),
  infoDate: date.optional(),
  isComparison: z.boolean().default(false),
  draft: z.boolean().default(false),
  /** OGP画像（無ければビルド時に自動生成） */
  image: z.string().optional(),
};

/** category / supervisor が定義ファイルに存在するか、比較記事に情報基準日があるか */
function refineArticle(collection: string) {
  return (d: { category: string; supervisor: string; isComparison: boolean; infoDate?: Date }, ctx: z.RefinementCtx) => {
    const cats = categories[collection] ?? {};
    if (!Object.prototype.hasOwnProperty.call(cats, d.category)) {
      ctx.addIssue({
        code: 'custom',
        path: ['category'],
        message: `category "${d.category}" は categories.yaml の ${collection} にありません（使えるキー: ${Object.keys(cats).join(', ')}）`,
      });
    }
    if (!Object.prototype.hasOwnProperty.call(supervisors, d.supervisor)) {
      ctx.addIssue({
        code: 'custom',
        path: ['supervisor'],
        message: `supervisor "${d.supervisor}" は supervisors.yaml にありません（使えるid: ${Object.keys(supervisors).join(', ')}）`,
      });
    }
    if (d.isComparison && !d.infoDate) {
      ctx.addIssue({ code: 'custom', path: ['infoDate'], message: '比較記事（isComparison: true）は infoDate（情報基準日）が必須です' });
    }
  };
}

const articles = (collection: string, extra: Record<string, z.ZodType> = {}) =>
  defineCollection({
    loader: glob({ pattern: '**/*.{md,mdx}', base: `./src/content/${collection}` }),
    schema: z.object({ ...base, ...extra }).superRefine(refineArticle(collection)),
  });

const news = articles('news', {
  /** 発生企業・団体 */
  organization: z.string().optional(),
  /** 件数（「約7万人」のような表記も可。不明なら空） */
  affectedCount: z.string().optional(),
  /** 漏えいした項目 */
  leakedItems: z.array(z.string()).default([]),
  /** 原因 */
  cause: z.string().optional(),
  /** 当事者：corporate（法人）/ personal（個人）。関連リンクの導線を切り替える。省略時はカテゴリの audience */
  audience: z.enum(['corporate', 'personal', 'both']).optional(),
});

const pages = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/pages' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    updatedAt: date.optional(),
  }),
});

export const collections = {
  news,
  guides: articles('guides'),
  reviews: articles('reviews'),
  stock: articles('stock'),
  pages,
};
