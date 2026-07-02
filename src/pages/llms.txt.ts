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
    `- [首頁](${SITE.url}/): 部落格首頁，最新文章與主題導覽`,
    `- [文章總覽](${SITE.url}/articles/): 全部文章依年份時間軸列出`,
    `- [分類總覽](${SITE.url}/category/): 文章分類與各分類篇數`,
    `- [標籤總覽](${SITE.url}/tag/): 全站標籤雲，依標籤瀏覽文章`,
    `- [n8n 相關資源](${SITE.url}/n8n-resources/): n8n 教學文章、模板與策展學習資源`,
    `- [關於我](${SITE.url}/about/): 作者介紹、經歷與作品集`,
    `- [聯絡我](${SITE.url}/contact-frank/): 聯絡方式與社群連結`,
    '',
    '## 文章',
    ...posts.map((p) => `- [${p.data.title}](${SITE.url}/${p.id}/): ${p.data.description}`),
    '',
  ];

  return new Response(lines.join('\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
