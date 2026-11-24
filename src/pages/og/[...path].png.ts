import type { APIContext } from 'astro';
import { getAllArticles, type Article } from '../../lib/content';
import { category, COLLECTION_LABELS, type ArticleCollection } from '../../lib/site-data';
import { ogImage } from '../../lib/og';
import { SITE } from '../../../site.config';

export async function getStaticPaths() {
  const all = await getAllArticles();
  return [
    { params: { path: 'default' }, props: { title: SITE.description, label: SITE.name } },
    ...all
      .filter((e: Article) => !e.data.image)
      .map((e: Article) => ({
        params: { path: `${e.collection}/${e.id}` },
        props: {
          title: e.data.title,
          label: `${COLLECTION_LABELS[e.collection as ArticleCollection]} ／ ${category(e.collection as ArticleCollection, e.data.category).label}`,
        },
      })),
  ];
}
export const GET = async ({ props }: APIContext) =>
  new Response(new Uint8Array(await ogImage(props as { title: string; label?: string })), { headers: { 'Content-Type': 'image/png' } });
