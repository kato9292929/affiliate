import rss from '@astrojs/rss';
import { SITE } from '../../site.config';
import { articleUrl, type Article } from './content';
import { category, type ArticleCollection } from './site-data';

export function feed(site: URL | undefined, items: Article[], title = SITE.name) {
  return rss({
    title,
    description: SITE.description,
    site: site ?? SITE.url,
    items: items.slice(0, 50).map((e) => ({
      title: e.data.title,
      description: e.data.description,
      pubDate: e.data.publishedAt,
      link: articleUrl(e),
      categories: [category(e.collection as ArticleCollection, e.data.category).label],
    })),
    customData: '<language>ja</language>',
  });
}
