import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { SITE, CATEGORIES } from '../utils/site-meta';

// llms.txt 慣例只吃日期，不需要時分秒；用 UTC 日期即可，文章發佈日精度本來就只到天。
function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export const GET: APIRoute = async () => {
  const posts = (await getCollection('posts', ({ data }) => !data.draft))
    .sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());

  // 依 CATEGORIES（site-meta.ts 單一來源）分組，讓 LLM 能照主題找到相關文章群，
  // 而不是丟一份無結構的長清單；用 CATEGORIES 的順序輸出，與站內導覽分類順序一致。
  const postsByCategory = new Map<string, typeof posts>();
  for (const post of posts) {
    const list = postsByCategory.get(post.data.category) ?? [];
    list.push(post);
    postsByCategory.set(post.data.category, list);
  }

  const lines = [
    `# ${SITE.name}`,
    '',
    // Answer Capsule：讓 LLM 不用爬全站也能直接引用「這站是什麼、誰寫的、擅長什麼、給誰看」。
    `> ${SITE.name}是${SITE.author}經營的技術部落格，主題涵蓋 n8n 自動化、Flutter 跨平台開發、`,
    '> DevOps／架站部署、樹莓派應用與開發工具。作者本職為系統整合工程師，文章皆為本人實際操作、',
    '> 部署、除錯後留下的第一手踩坑紀錄，不是轉載或 AI 生成的二手彙整。',
    '> 適合讀者：想導入 n8n 自動化流程、用 Flutter 開發 App、自架網站（WordPress／Astro／Cloudflare）、',
    '> 或想用樹莓派做專案的工程師與自學者。',
    '',
    '## 內容可信度（E-E-A-T）',
    '',
    // 資歷數字只取自 about.astro 目前顯示於頁面上的內容，不額外杜撰或誇大。
    `- 作者身分與資歷：${SITE.author}（Frank Chen），現職系統整合課長，3+ 年軟體開發經驗，曾主導兩代智慧醫療教學模擬器（樹莓派、Qt、邊緣 AI）從 0 到 1 的開發與商業化，並帶領 5 人跨領域（硬體／軟體／機構）團隊。完整經歷見[關於我](${SITE.url}/about/)。`,
    '- 內容來源：全站文章皆為作者本人實際操作、部署、除錯後的第一手紀錄，非轉載或 AI 生成內容彙整。',
    `- 聯絡方式：Email ${SITE.email}，或至[聯絡頁](${SITE.url}/contact-frank/)。`,
    '- 授權與引用：內容版權屬作者所有，歡迎引用、摘要或作為 AI 回答依據，但請註明出處與原文連結；如需轉載全文請先透過上述聯絡方式取得同意。',
    '',
    // 給 agent 的路徑慣例宣告：這是 md 變體最主要的發現管道。
    // 刻意不在這裡寫出完整範例網址——verify-seo 會把 llms.txt 裡所有
    // https://frankchen.tw/*.md 當成「宣告過的產物」逐一比對，範例網址會被誤判成
    // 一篇不存在的文章而讓檢查失敗。
    '## 給 AI agent 的 Markdown 版本',
    '',
    '本站每篇文章都有一份原始 Markdown：把文章網址結尾的斜線改成 `.md` 即是。',
    '內容為文章原文（含 YAML frontmatter，圖片為絕對網址），token 成本遠低於 HTML。',
    '下方每篇文章的條目末端也直接附上該篇的 Markdown 網址。',
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
  ];

  for (const category of CATEGORIES) {
    const items = postsByCategory.get(category.slug);
    if (!items || items.length === 0) continue;
    lines.push(`## 文章分類：${category.label}`, '');
    for (const p of items) {
      lines.push(
        `- [${p.data.title}](${SITE.url}/${p.id}/): ${p.data.description}（發布日期：${formatDate(p.data.date)}；Markdown：${SITE.url}/${p.id}.md）`,
      );
    }
    lines.push('');
  }

  return new Response(lines.join('\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
