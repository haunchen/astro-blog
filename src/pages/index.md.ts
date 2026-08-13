import type { APIRoute } from 'astro';
import { SITE, HOME, CATEGORIES } from '../utils/site-meta';
import { getPublishedPostsByDateDesc } from '../utils/posts';
import { toYamlFrontmatter } from '../../scripts/lib/md-export.mjs';

/**
 * 首頁的 markdown 變體（見 docs/specs/agent-markdown.md R6）。
 *
 * 與文章的 `/<slug>.md` 分屬兩種東西，別照著改：文章 md 是「原始正文原樣輸出」，
 * 這支是「把首頁這個由元件組出來的頁面，重新以 markdown 表述一次」——首頁沒有
 * 原始 markdown 可以照抄。因此它不套用文章那組 frontmatter 契約（沒有 date／
 * category／tags，那些欄位對一個入口頁沒有意義），verify-seo 也把它分開檢查。
 *
 * 內容刻意只列最新四篇再指向 llms.txt，不重印全站目錄：llms.txt 已經是完整清單，
 * 在這裡再抄一份只是讓 agent 為同一份資料付兩次 token。
 */
const LATEST_COUNT = 4;

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export const GET: APIRoute = async () => {
  const posts = await getPublishedPostsByDateDesc();

  const countByCategory = new Map<string, number>();
  for (const post of posts) {
    countByCategory.set(post.data.category, (countByCategory.get(post.data.category) ?? 0) + 1);
  }

  const frontmatter = toYamlFrontmatter({
    title: HOME.title,
    description: HOME.description,
    canonical: `${SITE.url}/`,
    image: `${SITE.url}${HOME.ogImage}`,
  });

  const lines = [
    `# ${SITE.name}`,
    '',
    `> ${SITE.tagline}`,
    '',
    HOME.description,
    '',
    `## 最新文章`,
    '',
  ];

  for (const p of posts.slice(0, LATEST_COUNT)) {
    lines.push(
      `- [${p.data.title}](${SITE.url}/${p.id}/)：${p.data.description}（發布日期：${formatDate(p.data.date)}；Markdown：${SITE.url}/${p.id}.md）`,
    );
  }

  lines.push(
    '',
    `全部 ${posts.length} 篇文章依年份排列見[文章總覽](${SITE.url}/articles/)；`,
    `含描述與 Markdown 網址的完整清單見 [llms.txt](${SITE.url}/llms.txt)。`,
    '',
    '## 探索主題',
    '',
  );

  for (const category of CATEGORIES) {
    const count = countByCategory.get(category.slug) ?? 0;
    if (count === 0) continue;
    lines.push(`- [${category.label}](${SITE.url}/category/${category.slug}/)：${count} 篇`);
  }

  lines.push(
    '',
    '## 關於我',
    '',
    HOME.about.bio,
    '',
    `- 現職：${HOME.about.role}`,
    `- 專長：${HOME.about.tags.join('、')}`,
    `- 完整經歷：${SITE.url}/about/`,
    `- 聯絡方式：Email ${SITE.email}，或至 ${SITE.url}/contact-frank/`,
    '',
    '## 專案作品',
    '',
  );

  for (const project of HOME.projects) {
    // 專案連結在首頁有站內相對路徑（/about/），md 可能被 agent 搬離本站脈絡後閱讀，
    // 一律絕對化。
    const href = project.link.startsWith('http') ? project.link : `${SITE.url}${project.link}`;
    lines.push(`- [${project.name}](${href})：${project.desc}（${project.tags.join('、')}）`);
  }

  lines.push(
    '',
    '## 給 AI agent 的 Markdown 版本',
    '',
    '本站每篇文章都有一份原始 Markdown：把文章網址結尾的斜線改成 `.md` 即是。',
    '內容為文章原文（含 YAML frontmatter，圖片為絕對網址），token 成本遠低於 HTML。',
    '',
  );

  return new Response(`${frontmatter}\n\n${lines.join('\n')}`, {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
};
