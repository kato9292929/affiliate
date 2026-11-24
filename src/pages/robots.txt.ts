import type { APIContext } from 'astro';
export const GET = ({ site }: APIContext) =>
  new Response(`User-agent: *\nAllow: /\nDisallow: /search/\n\nSitemap: ${new URL('/sitemap-index.xml', site).href}\n`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
