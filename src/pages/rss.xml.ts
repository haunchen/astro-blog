import type { APIContext } from 'astro';
import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import MarkdownIt from 'markdown-it';
import sanitizeHtml from 'sanitize-html';
import { SITE } from '../utils/site-meta';

const md = new MarkdownIt({ html: true, linkify: true });

export async function GET(context: APIContext) {
  const posts = (await getCollection('posts', ({ data }) => !data.draft))
    .sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf())
    .slice(0, 20);

  return rss({
    title: SITE.name,
    description: SITE.tagline,
    site: context.site ?? SITE.url,
    customData: '<language>zh-TW</language>',
    items: posts.map((p) => {
      let html = md.render(p.body ?? '');
      // 相對路徑改絕對
      html = html.replace(/(src|href)="(?!https?:|\/\/|mailto:|#)([^"]+)"/g, (_m, attr, p2) => {
        const abs = p2.startsWith('/') ? `${SITE.url}${p2}` : `${SITE.url}/${p.id}/${p2}`;
        return `${attr}="${abs}"`;
      });
      const safe = sanitizeHtml(html, {
        allowedTags: ['img','a','h2','h3','h4','h5','p','ul','ol','li','code','pre','blockquote','strong','em','br','hr','table','thead','tbody','tr','th','td'],
        allowedAttributes: {
          a: ['href', 'title'],
          img: ['src', 'alt', 'title'],
          code: ['class'],
          pre: ['class'],
        },
      });
      return {
        title: p.data.title,
        pubDate: p.data.date,
        description: p.data.description,
        link: `/${p.id}/`,
        categories: [p.data.category, ...(p.data.tags ?? [])],
        content: safe,
      };
    }),
  });
}
