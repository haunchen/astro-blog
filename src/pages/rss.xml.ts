import type { APIContext } from 'astro';
import rss from '@astrojs/rss';
import { getCollection, render } from 'astro:content';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { loadRenderers } from 'astro:container';
import sanitizeHtml from 'sanitize-html';
import { SITE } from '../utils/site-meta';

export async function GET(context: APIContext) {
  const posts = (await getCollection('posts', ({ data }) => !data.draft))
    .sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf())
    .slice(0, 20);

  // 純 markdown 內容不需 framework renderer
  const renderers = await loadRenderers([]);
  const container = await AstroContainer.create({ renderers });

  const items = await Promise.all(
    posts.map(async (p) => {
      // 渲染真正的 Content，內文圖循 image pipeline 解析為 /_astro/<hash>.webp
      const { Content } = await render(p);
      let html = await container.renderToString(Content);
      // Content render 後 img src 與內連 href 皆 root-relative（/_astro/...、/<slug>/），改寫為絕對 URL
      html = html.replace(
        /(src|href)="(\/[^"]*)"/g,
        (_m, attr, path) => `${attr}="${SITE.url}${path}"`,
      );
      const safe = sanitizeHtml(html, {
        allowedTags: ['img', 'a', 'h2', 'h3', 'h4', 'h5', 'p', 'ul', 'ol', 'li', 'code', 'pre', 'blockquote', 'strong', 'em', 'br', 'hr', 'table', 'thead', 'tbody', 'tr', 'th', 'td'],
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
  );

  return rss({
    title: SITE.name,
    description: SITE.tagline,
    site: context.site ?? SITE.url,
    xmlns: { atom: 'http://www.w3.org/2005/Atom' },
    customData: `<language>zh-TW</language><atom:link href="${SITE.url}/rss.xml" rel="self" type="application/rss+xml"/>`,
    items,
  });
}
