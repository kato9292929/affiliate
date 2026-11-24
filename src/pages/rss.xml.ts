import type { APIContext } from 'astro';
import { getAllArticles } from '../lib/content';
import { feed } from '../lib/feed';
export const GET = async (ctx: APIContext) => feed(ctx.site, await getAllArticles());
