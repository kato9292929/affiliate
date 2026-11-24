import type { APIContext } from 'astro';
import { SITE } from '../../../site.config';
import { getArticles } from '../../lib/content';
import { feed } from '../../lib/feed';
export const GET = async (ctx: APIContext) => feed(ctx.site, await getArticles('news'), `${SITE.name}（ニュース）`);
