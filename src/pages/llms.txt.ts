import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { SITE } from '../utils/site-meta';

export const GET: APIRoute = async () => {
  const posts = (await getCollection('posts', ({ data }) => !data.draft))
    .sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());

  const lines = [
    `# ${SITE.name}`,
    '',
    `> ${SITE.tagline} 一個專注於 n8n 自動化、Flutter、樹莓派、DevOps、工具的踩坑筆記平台。`,
    '',
    '## 主要頁面',
    `- [首頁](${SITE.url}/): 部落格首頁`,
    '',
    '## 文章',
    ...posts.map((p) => `- [${p.data.title}](${SITE.url}/${p.id}/): ${p.data.description}`),
    '',
  ];

  return new Response(lines.join('\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
