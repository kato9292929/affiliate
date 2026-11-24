import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { SITE_URL } from './site.config';
import { rehypeInArticleAds } from './src/lib/rehype-inarticle-ads';

export default defineConfig({
  site: SITE_URL,
  trailingSlash: 'always',
  build: { format: 'directory' },
  integrations: [
    mdx(),
    sitemap({
      filter: (page) => !/\/(search|404)\/?$/.test(page),
    }),
  ],
  markdown: {
    rehypePlugins: [rehypeInArticleAds],
  },
  prefetch: false,
});
