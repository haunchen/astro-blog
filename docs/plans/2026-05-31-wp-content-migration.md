# WordPress 內容遷移 Implementation Plan

Goal: 將 WordPress（WXR XML）35 篇已發布文章遷移為 Astro content collection，圖片在地化轉 webp，frontmatter 對應 schema，並逐篇補語意圖檔名、描述性 alt、文章間內連。

Architecture: 兩階段。Phase 1 是確定性 Node 腳本（`scripts/migrate-wp.mjs` + `scripts/lib/*`），解析 WXR → 對應 frontmatter → HTML 轉 Markdown → 下載圖片轉 webp → 寫 `src/content/posts/<slug>/index.md`。純函式用 `node --test`（內建，無新測試框架）驗證，整體用 `npm run build`（Zod schema）把關。Phase 2 是 AI 逐篇加工：先以腳本產 manifest，再由 subagent 逐篇改檔名/alt/內連。

Tech Stack: Node 22（ESM、global fetch、node:test）、fast-xml-parser、turndown、sharp。

Spec: `docs/specs/content-migration.md`

來源檔: `/Volumes/Data_1T/UserData/Downloads/WordPress.2026-05-31.xml`（WXR, 35 posts, 250 內文圖, 全在 www.frankchen.tw）

---

## 慣例與共用知識（執行者必讀）

- 專案 `package.json` 是 `"type": "module"`，所有 `.mjs`/`.js` 皆 ESM，用 `import`。
- 現有腳本範例：`scripts/subset-fonts.mjs`。
- content schema（`src/content.config.ts`）：`title`(≤60) / `date`(z.date) / `updated`(optional) / `description`(≤160) / `category`(enum: n8n|flutter|devops|raspberry-pi|tools) / `tags`(string[]) / `cover`(image()) / `draft`(default false)。
- 文章輸出路徑 = `src/content/posts/<slug>/index.md`；`<slug>` 即 Astro route `/<slug>/`，必須等於 WP `post_name`。
- 圖片放該篇 `images/` 子資料夾；`cover` frontmatter 與內文圖 ref 用相對路徑 `./images/xxx.webp`。
- 測試指令統一 `node --test scripts/lib/`（執行 `scripts/lib/*.test.mjs`）。
- WXR 結構速查（已實測）：
  - 每篇 `<item>` 內 `<wp:post_type><![CDATA[post]]>`、`<wp:status><![CDATA[publish]]>`
  - `<title><![CDATA[...]]>`、`<wp:post_name><![CDATA[slug]]>`、`<pubDate>Wed, 28 May 2025 02:22:20 +0000</pubDate>`
  - `<excerpt:encoded><![CDATA[...]]>`、`<content:encoded><![CDATA[Gutenberg HTML]]>`
  - category：`<category domain="category" nicename="n8n"><![CDATA[n8n]]></category>`；tag：`domain="post_tag"`
  - featured image：postmeta `_thumbnail_id` → attachment id；attachment item 的 `<wp:attachment_url>` 是圖片 URL
  - attachment item：`<wp:post_type><![CDATA[attachment]]>`，`<wp:post_id>` 為 id

---

### Task 1: 安裝依賴與 lib 目錄骨架

Implements: `content-migration.md` #R6, #R7, #R8

Files:
- Modify: `package.json`（devDependencies）
- Create: `scripts/lib/.gitkeep`（暫位，後續 task 取代）

Step 1: 安裝依賴
Run:
```
npm install -D fast-xml-parser turndown sharp
```
Expected: package.json devDependencies 出現三者，無錯誤。

Step 2: 確認可 import
Run:
```
node -e "import('fast-xml-parser').then(()=>import('turndown')).then(()=>import('sharp')).then(()=>console.log('ok'))"
```
Expected: 印出 `ok`

Step 3: Commit
Run: `git add package.json package-lock.json && git commit -m "build: add migration deps (fast-xml-parser, turndown, sharp)"`

---

### Task 2: WXR 解析與篩選（scripts/lib/wxr.mjs）

Implements: `content-migration.md` #R1

Files:
- Create: `scripts/lib/wxr.mjs`
- Test: `scripts/lib/wxr.test.mjs`

Step 1: 寫失敗的測試 `scripts/lib/wxr.test.mjs`
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseWxr } from './wxr.mjs';

const SAMPLE = `<?xml version="1.0"?><rss><channel>
<item>
  <title><![CDATA[Hello SSL]]></title>
  <link>https://www.frankchen.tw/hello-ssl/</link>
  <pubDate>Wed, 28 May 2025 02:22:20 +0000</pubDate>
  <wp:post_id>10</wp:post_id>
  <wp:post_name><![CDATA[hello-ssl]]></wp:post_name>
  <wp:status><![CDATA[publish]]></wp:status>
  <wp:post_type><![CDATA[post]]></wp:post_type>
  <excerpt:encoded><![CDATA[摘要文字]]></excerpt:encoded>
  <content:encoded><![CDATA[<p>內文</p>]]></content:encoded>
  <category domain="category" nicename="n8n"><![CDATA[n8n]]></category>
  <category domain="post_tag" nicename="ssl"><![CDATA[SSL]]></category>
  <wp:postmeta><wp:meta_key><![CDATA[_thumbnail_id]]></wp:meta_key><wp:meta_value><![CDATA[99]]></wp:meta_value></wp:postmeta>
</item>
<item>
  <title><![CDATA[草稿不要]]></title>
  <wp:post_name><![CDATA[draft-x]]></wp:post_name>
  <wp:status><![CDATA[draft]]></wp:status>
  <wp:post_type><![CDATA[post]]></wp:post_type>
  <content:encoded><![CDATA[x]]></content:encoded>
</item>
<item>
  <title><![CDATA[圖片]]></title>
  <wp:post_id>99</wp:post_id>
  <wp:status><![CDATA[inherit]]></wp:status>
  <wp:post_type><![CDATA[attachment]]></wp:post_type>
  <wp:attachment_url>https://www.frankchen.tw/wp-content/uploads/x.png</wp:attachment_url>
</item>
</channel></rss>`;

test('parseWxr 只回傳 post+publish', () => {
  const { posts } = parseWxr(SAMPLE);
  assert.equal(posts.length, 1);
  assert.equal(posts[0].slug, 'hello-ssl');
  assert.equal(posts[0].title, 'Hello SSL');
  assert.equal(posts[0].status, 'publish');
});

test('parseWxr 抽出 category/tags/thumbnailId/excerpt/content', () => {
  const { posts } = parseWxr(SAMPLE);
  const p = posts[0];
  assert.equal(p.categoryNicename, 'n8n');
  assert.deepEqual(p.tags, ['SSL']);
  assert.equal(p.thumbnailId, '99');
  assert.equal(p.excerpt, '摘要文字');
  assert.match(p.contentHtml, /內文/);
  assert.equal(p.pubDate, 'Wed, 28 May 2025 02:22:20 +0000');
});

test('parseWxr 建 attachment id→url map', () => {
  const { attachments } = parseWxr(SAMPLE);
  assert.equal(attachments['99'], 'https://www.frankchen.tw/wp-content/uploads/x.png');
});
```

Step 2: 跑測試確認失敗
Run: `node --test scripts/lib/wxr.test.mjs`
Expected: FAIL（找不到 `./wxr.mjs`）

Step 3: 寫實作 `scripts/lib/wxr.mjs`
```js
import { XMLParser } from 'fast-xml-parser';

// fast-xml-parser 設定：保留 CDATA 為文字、保留屬性
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  cdataPropName: '__cdata',
  trimValues: false,
});

// 取節點文字：可能是字串、{ '#text' }、{ __cdata }
function text(node) {
  if (node == null) return '';
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (node.__cdata != null) return String(node.__cdata);
  if (node['#text'] != null) return String(node['#text']);
  return '';
}

function asArray(x) {
  if (x == null) return [];
  return Array.isArray(x) ? x : [x];
}

export function parseWxr(xml) {
  const doc = parser.parse(xml);
  const channel = doc?.rss?.channel ?? {};
  const items = asArray(channel.item);

  const attachments = {};
  for (const it of items) {
    if (text(it['wp:post_type']) !== 'attachment') continue;
    const id = text(it['wp:post_id']);
    const url = text(it['wp:attachment_url']);
    if (id && url) attachments[id] = url;
  }

  const posts = [];
  for (const it of items) {
    if (text(it['wp:post_type']) !== 'post') continue;
    if (text(it['wp:status']) !== 'publish') continue;

    const cats = asArray(it.category);
    const categoryNode = cats.find((c) => c['@_domain'] === 'category');
    const tags = cats
      .filter((c) => c['@_domain'] === 'post_tag')
      .map((c) => text(c))
      .filter(Boolean);

    const metas = asArray(it['wp:postmeta']);
    const thumbMeta = metas.find((m) => text(m['wp:meta_key']) === '_thumbnail_id');

    posts.push({
      title: text(it.title).trim(),
      slug: text(it['wp:post_name']).trim(),
      pubDate: text(it.pubDate).trim(),
      status: text(it['wp:status']),
      excerpt: text(it['excerpt:encoded']).trim(),
      contentHtml: text(it['content:encoded']),
      categoryNicename: categoryNode ? (categoryNode['@_nicename'] ?? '') : '',
      tags,
      thumbnailId: thumbMeta ? text(thumbMeta['wp:meta_value']).trim() : null,
    });
  }

  return { posts, attachments };
}
```

Step 4: 跑測試確認通過
Run: `node --test scripts/lib/wxr.test.mjs`
Expected: PASS（3 tests）

Step 5: 刪除暫位 `.gitkeep`，Commit
Run: `git rm -f scripts/lib/.gitkeep 2>/dev/null; git add scripts/lib/wxr.mjs scripts/lib/wxr.test.mjs && git commit -m "feat: WXR parser — filter posts, build attachment map"`

---

### Task 3: Frontmatter 對應與 description 收斂（scripts/lib/frontmatter.mjs）

Implements: `content-migration.md` #R2, #R3, #R4

Files:
- Create: `scripts/lib/frontmatter.mjs`
- Test: `scripts/lib/frontmatter.test.mjs`

Step 1: 寫失敗的測試 `scripts/lib/frontmatter.test.mjs`
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapCategory, toIsoDate, makeDescription } from './frontmatter.mjs';

test('mapCategory：nicename 直接對應、uncategorized → n8n', () => {
  assert.equal(mapCategory('n8n'), 'n8n');
  assert.equal(mapCategory('raspberry-pi'), 'raspberry-pi');
  assert.equal(mapCategory('uncategorized'), 'n8n');
  assert.equal(mapCategory(''), 'n8n');
});

test('toIsoDate：pubDate → YYYY-MM-DD', () => {
  assert.equal(toIsoDate('Wed, 28 May 2025 02:22:20 +0000'), '2025-05-28');
});

test('makeDescription：≤160 原樣', () => {
  const d = makeDescription('短摘要', '<p>內文</p>');
  assert.equal(d, '短摘要');
});

test('makeDescription：>160 句號截斷補…且 ≤160', () => {
  const long = '第一句結束。' + '第二句很長'.repeat(40) + '。';
  const d = makeDescription(long, '');
  assert.ok(d.length <= 160, `len=${d.length}`);
  assert.ok(d.endsWith('…'));
});

test('makeDescription：空 excerpt 取內文首段前 150 字純文字', () => {
  const html = '<h2>標題</h2><p>這是第一段內文，' + '字'.repeat(200) + '</p>';
  const d = makeDescription('', html);
  assert.ok(d.length <= 160);
  assert.ok(d.startsWith('這是第一段內文'));
});
```

Step 2: 跑測試確認失敗
Run: `node --test scripts/lib/frontmatter.test.mjs`
Expected: FAIL

Step 3: 寫實作 `scripts/lib/frontmatter.mjs`
```js
const VALID = new Set(['n8n', 'flutter', 'devops', 'raspberry-pi', 'tools']);

export function mapCategory(nicename) {
  if (VALID.has(nicename)) return nicename;
  return 'n8n'; // uncategorized 與其餘未知值歸 n8n
}

export function toIsoDate(pubDate) {
  const d = new Date(pubDate);
  return d.toISOString().slice(0, 10);
}

// 去 HTML tag，取純文字（給空 excerpt 的 fallback 用）
function stripHtml(html) {
  return html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const MAX = 160;

export function makeDescription(excerpt, contentHtml) {
  let base = (excerpt || '').trim();
  if (!base) base = stripHtml(contentHtml || '').slice(0, 150);
  if (base.length <= MAX) return base;

  // 句號處截斷（保留 …，故在 MAX-1 範圍內找最後一個句號）
  const window = base.slice(0, MAX - 1);
  const lastPeriod = Math.max(window.lastIndexOf('。'), window.lastIndexOf('. '));
  if (lastPeriod > 40) {
    return window.slice(0, lastPeriod + 1) + '…';
  }
  // 找不到合適句號 → 硬切
  return base.slice(0, MAX - 3) + '…';
}
```

Step 4: 跑測試確認通過
Run: `node --test scripts/lib/frontmatter.test.mjs`
Expected: PASS（5 tests）

Step 5: Commit
Run: `git add scripts/lib/frontmatter.mjs scripts/lib/frontmatter.test.mjs && git commit -m "feat: frontmatter mapping — category, date, description truncation"`

---

### Task 4: HTML→Markdown 轉換（scripts/lib/html-to-md.mjs）

Implements: `content-migration.md` #R6

Files:
- Create: `scripts/lib/html-to-md.mjs`
- Test: `scripts/lib/html-to-md.test.mjs`

說明：本 task 處理「文字轉換」。圖片 ref 暫時保留原始 `src`（http URL）+ figcaption 當 alt，實際下載與路徑改寫在 Task 5/6。`htmlToMarkdown` 回傳 `{ markdown }`，其中 img 仍是 `![alt](原URL)`，供下游替換。

Step 1: 寫失敗的測試 `scripts/lib/html-to-md.test.mjs`
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { htmlToMarkdown } from './html-to-md.mjs';

test('清除 wp 註解', () => {
  const md = htmlToMarkdown('<!-- wp:paragraph --><p>嗨</p><!-- /wp:paragraph -->');
  assert.equal(md.trim(), '嗨');
});

test('h2/h3 轉 ##/###', () => {
  const md = htmlToMarkdown('<h2 class="wp-block-heading">前言</h2><h3>小節</h3>');
  assert.match(md, /^## 前言/m);
  assert.match(md, /^### 小節/m);
});

test('pre/code 轉 fenced block', () => {
  const md = htmlToMarkdown('<pre class="wp-block-code"><code>npm install</code></pre>');
  assert.match(md, /```\n?npm install\n?```/);
});

test('img 轉 markdown 並保留原 URL，figcaption 當 alt', () => {
  const html = '<figure class="wp-block-image"><img src="https://www.frankchen.tw/wp-content/uploads/a.png" alt=""/><figcaption>憑證流程</figcaption></figure>';
  const md = htmlToMarkdown(html);
  assert.match(md, /!\[憑證流程\]\(https:\/\/www\.frankchen\.tw\/wp-content\/uploads\/a\.png\)/);
});

test('連結與粗體正常', () => {
  const md = htmlToMarkdown('<p>看 <a href="https://x.com">這裡</a> 與 <strong>重點</strong></p>');
  assert.match(md, /\[這裡\]\(https:\/\/x\.com\)/);
  assert.match(md, /\*\*重點\*\*/);
});
```

Step 2: 跑測試確認失敗
Run: `node --test scripts/lib/html-to-md.test.mjs`
Expected: FAIL

Step 3: 寫實作 `scripts/lib/html-to-md.mjs`
```js
import TurndownService from 'turndown';

function makeTurndown() {
  const td = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
    emDelimiter: '*',
  });

  // figure > img (+figcaption) → ![caption](src)
  td.addRule('wpImage', {
    filter: (node) =>
      node.nodeName === 'FIGURE' && node.querySelector && node.querySelector('img'),
    replacement: (_content, node) => {
      const img = node.querySelector('img');
      const src = img.getAttribute('src') || '';
      const cap = node.querySelector('figcaption');
      const alt = (cap && cap.textContent.trim()) || img.getAttribute('alt') || '';
      return src ? `\n\n![${alt}](${src})\n\n` : '';
    },
  });

  // 裸 <img>（不在 figure 內）
  td.addRule('bareImage', {
    filter: 'img',
    replacement: (_c, node) => {
      const src = node.getAttribute('src') || '';
      const alt = node.getAttribute('alt') || '';
      return src ? `![${alt}](${src})` : '';
    },
  });

  return td;
}

// 先用 regex 移除 Gutenberg 註解，turndown 不認得 HTML comment 的去留
function stripWpComments(html) {
  return html.replace(/<!--\s*\/?wp:[\s\S]*?-->/g, '');
}

export function htmlToMarkdown(html) {
  const cleaned = stripWpComments(html || '');
  const td = makeTurndown();
  return td
    .turndown(cleaned)
    .replace(/\n{3,}/g, '\n\n')
    .trim() + '\n';
}
```

Step 4: 跑測試確認通過
Run: `node --test scripts/lib/html-to-md.test.mjs`
Expected: PASS（5 tests）

注意：turndown 依賴 DOM。Node 環境下 turndown 內建用 `@mixmark-io/domino`，無需額外安裝；若 import 報缺 DOM，於 Task 1 補 `npm i -D jsdom` 並改用 `new TurndownService()` 前置 `global` 注入。先按上方實作跑，失敗再處理。

Step 5: Commit
Run: `git add scripts/lib/html-to-md.mjs scripts/lib/html-to-md.test.mjs && git commit -m "feat: Gutenberg HTML to Markdown conversion"`

---

### Task 5: 圖片下載與 WebP 轉換（scripts/lib/images.mjs）

Implements: `content-migration.md` #R7, #R8

Files:
- Create: `scripts/lib/images.mjs`
- Test: `scripts/lib/images.test.mjs`

說明：可測試部分＝URL 蒐集、去重、檔名規劃（純函式）。實際 `fetch`+sharp 寫成 `downloadAndConvert`，測試用 mock 注入避免真連網。

Step 1: 寫失敗的測試 `scripts/lib/images.test.mjs`
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { collectImageUrls, planImageNames } from './images.mjs';

test('collectImageUrls：抓出內文所有 img src 並去重', () => {
  const md = '![a](https://x/1.png)\n\n![b](https://x/2.png)\n\n![c](https://x/1.png)';
  const urls = collectImageUrls(md);
  assert.deepEqual(urls, ['https://x/1.png', 'https://x/2.png']);
});

test('planImageNames：cover + 內文圖編號，皆 .webp', () => {
  const plan = planImageNames(
    'https://x/cover.jpg',
    ['https://x/1.png', 'https://x/2.gif']
  );
  assert.equal(plan.cover.localName, 'cover.webp');
  assert.equal(plan.content[0].localName, 'img-1.webp');
  assert.equal(plan.content[1].localName, 'img-2.webp');
  assert.equal(plan.content[0].url, 'https://x/1.png');
});
```

Step 2: 跑測試確認失敗
Run: `node --test scripts/lib/images.test.mjs`
Expected: FAIL

Step 3: 寫實作 `scripts/lib/images.mjs`
```js
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

export function collectImageUrls(markdown) {
  const re = /!\[[^\]]*\]\((https?:\/\/[^)]+)\)/g;
  const seen = new Set();
  const out = [];
  let m;
  while ((m = re.exec(markdown)) !== null) {
    if (!seen.has(m[1])) {
      seen.add(m[1]);
      out.push(m[1]);
    }
  }
  return out;
}

export function planImageNames(coverUrl, contentUrls) {
  return {
    cover: coverUrl ? { url: coverUrl, localName: 'cover.webp' } : null,
    content: contentUrls.map((url, i) => ({ url, localName: `img-${i + 1}.webp` })),
  };
}

// 下載單張並轉 webp，回傳 true/false（失敗不丟出）
export async function downloadAndConvert(url, destPath, fetchImpl = fetch) {
  try {
    const res = await fetchImpl(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    await mkdir(path.dirname(destPath), { recursive: true });
    await sharp(buf).webp({ quality: 82 }).toFile(destPath);
    return true;
  } catch (err) {
    console.warn(`  [IMG FAIL] ${url} -> ${err.message}`);
    return false;
  }
}
```

Step 4: 跑測試確認通過
Run: `node --test scripts/lib/images.test.mjs`
Expected: PASS（2 tests）

Step 5: Commit
Run: `git add scripts/lib/images.mjs scripts/lib/images.test.mjs && git commit -m "feat: image localization helpers — collect, plan, download+webp"`

---

### Task 6: 輸出組裝（scripts/lib/post-writer.mjs）

Implements: `content-migration.md` #R2, #R5, #R7, #R13

Files:
- Create: `scripts/lib/post-writer.mjs`
- Test: `scripts/lib/post-writer.test.mjs`

說明：負責把 markdown 內的圖片 URL 替換成本地路徑、組 frontmatter YAML、決定輸出資料夾。純字串/物件處理，可測。實際寫檔在 Task 7 orchestrator。

Step 1: 寫失敗的測試 `scripts/lib/post-writer.test.mjs`
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rewriteImageRefs, buildFrontmatter } from './post-writer.mjs';

test('rewriteImageRefs：URL → ./images/img-N.webp', () => {
  const md = '![憑證](https://x/1.png)\n\n文字\n\n![圖二](https://x/2.png)';
  const map = { 'https://x/1.png': 'img-1.webp', 'https://x/2.png': 'img-2.webp' };
  const out = rewriteImageRefs(md, map);
  assert.match(out, /!\[憑證\]\(\.\/images\/img-1\.webp\)/);
  assert.match(out, /!\[圖二\]\(\.\/images\/img-2\.webp\)/);
});

test('rewriteImageRefs：找不到對應的 URL 保留並加 TODO 註解', () => {
  const md = '![x](https://x/miss.png)';
  const out = rewriteImageRefs(md, {});
  assert.match(out, /https:\/\/x\/miss\.png/);
  assert.match(out, /TODO/);
});

test('buildFrontmatter：產出合法 YAML 區塊', () => {
  const fm = buildFrontmatter({
    title: '如何使用 Certbot',
    date: '2025-05-28',
    description: '摘要',
    category: 'devops',
    tags: ['SSL', 'Nginx'],
    cover: './images/cover.webp',
  });
  assert.match(fm, /^---\n/);
  assert.match(fm, /title: "如何使用 Certbot"/);
  assert.match(fm, /date: 2025-05-28/);
  assert.match(fm, /category: "devops"/);
  assert.match(fm, /tags: \["SSL", "Nginx"\]/);
  assert.match(fm, /cover: "\.\/images\/cover\.webp"/);
  assert.match(fm, /draft: false/);
  assert.match(fm, /\n---\n$/);
});
```

Step 2: 跑測試確認失敗
Run: `node --test scripts/lib/post-writer.test.mjs`
Expected: FAIL

Step 3: 寫實作 `scripts/lib/post-writer.mjs`
```js
// 把 markdown 內 http(s) 圖片 URL 換成本地相對路徑；map: url -> localName
export function rewriteImageRefs(markdown, map) {
  return markdown.replace(
    /!\[([^\]]*)\]\((https?:\/\/[^)]+)\)/g,
    (whole, alt, url) => {
      const local = map[url];
      if (local) return `![${alt}](./images/${local})`;
      return `${whole}<!-- TODO: image download failed, original URL kept -->`;
    }
  );
}

function yamlString(s) {
  // 用雙引號並跳脫內部雙引號
  return '"' + String(s).replace(/"/g, '\\"') + '"';
}

export function buildFrontmatter({ title, date, description, category, tags, cover }) {
  const tagList = (tags || []).map(yamlString).join(', ');
  return [
    '---',
    `title: ${yamlString(title)}`,
    `date: ${date}`,
    `description: ${yamlString(description)}`,
    `category: ${yamlString(category)}`,
    `tags: [${tagList}]`,
    `cover: ${yamlString(cover)}`,
    'draft: false',
    '---',
    '',
  ].join('\n');
}
```

Step 4: 跑測試確認通過
Run: `node --test scripts/lib/post-writer.test.mjs`
Expected: PASS（3 tests）

Step 5: Commit
Run: `git add scripts/lib/post-writer.mjs scripts/lib/post-writer.test.mjs && git commit -m "feat: post writer — image ref rewrite, frontmatter builder"`

---

### Task 7: Orchestrator 主腳本（scripts/migrate-wp.mjs）

Implements: `content-migration.md` #R1, #R5, #R7, #R13

Files:
- Create: `scripts/migrate-wp.mjs`

說明：串接所有 lib，對 35 篇逐篇：轉 MD → 蒐集圖片 → 下載+webp → 改寫 ref → 寫 index.md。冪等：每篇先 `rm -rf <slug>/` 再重建。無單元測試，靠 Task 8 實跑 + build 把關。

Step 1: 寫 `scripts/migrate-wp.mjs`
```js
#!/usr/bin/env node
import { readFile, rm, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseWxr } from './lib/wxr.mjs';
import { mapCategory, toIsoDate, makeDescription } from './lib/frontmatter.mjs';
import { htmlToMarkdown } from './lib/html-to-md.mjs';
import {
  collectImageUrls,
  planImageNames,
  downloadAndConvert,
} from './lib/images.mjs';
import { rewriteImageRefs, buildFrontmatter } from './lib/post-writer.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const POSTS_DIR = path.join(ROOT, 'src/content/posts');

const WXR_PATH = process.argv[2];
if (!WXR_PATH) {
  console.error('用法: node scripts/migrate-wp.mjs <path-to-WXR.xml>');
  process.exit(1);
}

const xml = await readFile(WXR_PATH, 'utf-8');
const { posts, attachments } = parseWxr(xml);
console.log(`解析到 ${posts.length} 篇 publish 文章`);

let imgOk = 0;
let imgFail = 0;

for (const post of posts) {
  const slug = post.slug;
  const outDir = path.join(POSTS_DIR, slug);
  const imagesDir = path.join(outDir, 'images');

  // 冪等：清空重建
  await rm(outDir, { recursive: true, force: true });
  await mkdir(imagesDir, { recursive: true });

  // 1. HTML → Markdown（圖片仍是原 URL）
  let markdown = htmlToMarkdown(post.contentHtml);

  // 2. 蒐集內文圖 + featured
  const contentUrls = collectImageUrls(markdown);
  const coverUrl = post.thumbnailId ? attachments[post.thumbnailId] : null;
  const plan = planImageNames(coverUrl, contentUrls);

  // 3. 下載 + webp
  const urlToLocal = {};
  if (plan.cover) {
    const ok = await downloadAndConvert(
      plan.cover.url,
      path.join(imagesDir, plan.cover.localName)
    );
    ok ? imgOk++ : imgFail++;
  }
  for (const item of plan.content) {
    const ok = await downloadAndConvert(
      item.url,
      path.join(imagesDir, item.localName)
    );
    if (ok) {
      urlToLocal[item.url] = item.localName;
      imgOk++;
    } else {
      imgFail++;
    }
  }

  // 4. 改寫內文圖 ref
  markdown = rewriteImageRefs(markdown, urlToLocal);

  // 5. frontmatter
  const coverRef = plan.cover ? './images/cover.webp' : null;
  const fm = buildFrontmatter({
    title: post.title,
    date: toIsoDate(post.pubDate),
    description: makeDescription(post.excerpt, post.contentHtml),
    category: mapCategory(post.categoryNicename),
    tags: post.tags,
    cover: coverRef ?? './images/cover.webp',
  });

  // 6. 寫檔
  await writeFile(path.join(outDir, 'index.md'), fm + '\n' + markdown, 'utf-8');
  console.log(`✓ ${slug}  (圖片 ${plan.content.length + (plan.cover ? 1 : 0)})`);
}

console.log(`\n完成。圖片成功 ${imgOk} / 失敗 ${imgFail}`);
if (imgFail > 0) console.log('失敗圖片見上方 [IMG FAIL]，內文已標 TODO。');
```

Step 2: 語法檢查
Run: `node --check scripts/migrate-wp.mjs`
Expected: 無輸出（語法正確）

Step 3: Commit
Run: `git add scripts/migrate-wp.mjs && git commit -m "feat: migrate-wp orchestrator script"`

---

### Task 8: 實跑遷移 + build 驗證

Implements: `content-migration.md` #R12

Files:
- 產出: `src/content/posts/<slug>/`（35 篇）

Step 1: 對真實 WXR 實跑
Run:
```
node scripts/migrate-wp.mjs "/Volumes/Data_1T/UserData/Downloads/WordPress.2026-05-31.xml"
```
Expected: 印出「解析到 35 篇」、逐篇 ✓、最後圖片成功/失敗統計。若 turndown 報 DOM 缺失，依 Task 4 註記補 jsdom 後重跑。

Step 2: 確認產出篇數
Run: `ls src/content/posts/ | grep -v test-markdown-rendering | wc -l`
Expected: `35`

Step 3: 抽看一篇 frontmatter
Run: `head -12 src/content/posts/create-free-ssl-domain-certificates-using-certbot/index.md`
Expected: 合法 frontmatter，cover/category/date/description 皆有值。

Step 4: build 驗證（主關卡）
Run: `npm run build`
Expected: build 成功。若 Zod 報某篇 description>160 或 category 非 enum，回對應 lib 修正後重跑 Task 8。

Step 5: 本地預覽抽查
Run: `npm run dev`（手動開 localhost:4321，抽看含圖最多與含 code 最多的文章，確認排版/圖片/TOC/code fence）。確認後 Ctrl-C。

Step 6: Commit
Run: `git add src/content/posts && git commit -m "feat: migrate 35 WordPress posts (Phase 1)"`

備註：若 `src/content/posts/` 圖片體積大，確認 `.gitignore` 不排除它們（content 圖片要進 repo）。

---

### Task 9: 產生 Phase 2 manifest（scripts/build-manifest.mjs）

Implements: `content-migration.md` #R11

Files:
- Create: `scripts/build-manifest.mjs`
- 產出: `docs/data/migration-manifest.json`

說明：掃描已遷移的 35 篇，輸出 `{slug, title, description, category, tags, images:[localName]}` 清單，供 Phase 2 subagent 判斷內連與圖片清單。

Step 1: 寫 `scripts/build-manifest.mjs`
```js
#!/usr/bin/env node
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const POSTS_DIR = path.join(ROOT, 'src/content/posts');
const OUT = path.join(ROOT, 'docs/data/migration-manifest.json');

function parseFrontmatter(md) {
  const m = md.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return {};
  const fm = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (!kv) continue;
    let [, k, v] = kv;
    v = v.trim().replace(/^"(.*)"$/, '$1');
    fm[k] = v;
  }
  return fm;
}

const entries = await readdir(POSTS_DIR, { withFileTypes: true });
const manifest = [];
for (const e of entries) {
  if (!e.isDirectory()) continue;
  if (e.name === 'test-markdown-rendering') continue;
  const dir = path.join(POSTS_DIR, e.name);
  const md = await readFile(path.join(dir, 'index.md'), 'utf-8');
  const fm = parseFrontmatter(md);
  let images = [];
  try {
    images = (await readdir(path.join(dir, 'images'))).filter((f) => f.endsWith('.webp'));
  } catch {}
  manifest.push({
    slug: e.name,
    title: fm.title ?? '',
    description: fm.description ?? '',
    category: fm.category ?? '',
    tags: fm.tags ?? '',
    images,
  });
}

await mkdir(path.dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify(manifest, null, 2), 'utf-8');
console.log(`manifest 寫出 ${manifest.length} 篇 -> ${OUT}`);
```

Step 2: 執行
Run: `node scripts/build-manifest.mjs`
Expected: `manifest 寫出 35 篇`

Step 3: Commit
Run: `git add scripts/build-manifest.mjs docs/data/migration-manifest.json && git commit -m "feat: Phase 2 manifest generator"`

---

### Task 10: Phase 2 逐篇 AI 加工（語意檔名 / alt / 內連）

Implements: `content-migration.md` #R9, #R10, #R11

Files:
- Modify: 每篇 `src/content/posts/<slug>/index.md` 與其 `images/` 內檔名

說明：本 task 在 dev:execute 階段「逐篇」由 subagent 執行，共 35 次（可分批）。**這是判斷型工作，非確定性腳本。** 每篇一個 subagent，流程如下，主對話負責派遣與彙整。

每篇 subagent 的指令模板（執行者照此派遣）：
```
你要加工一篇已從 WordPress 遷移的文章。

輸入：
- 文章檔：src/content/posts/<slug>/index.md
- 全站文章清單：docs/data/migration-manifest.json（含每篇 slug/title/description/category/tags）

做三件事，全部直接編輯檔案：

1. 語意化圖片檔名
   - 讀 index.md 內每個 ./images/img-N.webp 在文中的上下文（前後段落、所屬小節標題）。
   - 為每張圖取一個語意化、kebab-case、英文檔名（如 certbot-dns-challenge.webp）。
   - 用 `git mv src/content/posts/<slug>/images/img-N.webp src/content/posts/<slug>/images/<新名>.webp` 改檔名。
   - 同步把 index.md 內該圖 ref 改成新檔名。
   - cover.webp 不改名（frontmatter cover 固定指向 cover.webp）。

2. 描述性 alt
   - 為每張內文圖，依其在文中脈絡補上描述性「中文」alt（替換 ![原alt](...) 的方括號內文字）。
   - alt 要描述圖片內容與用途，不是只放檔名。

3. 文章間內部連結
   - 參考 manifest，找出與本篇主題真正相關的其他文章（同類別或主題延續）。
   - 在內文自然語句處，把適合的關鍵詞改寫為指向 /<目標slug>/ 的 Markdown 連結。
   - 上限 2-4 條，只在真正相關時插入，不硬塞、不重複連同一篇。
   - 不可捏造 manifest 中不存在的 slug。

完成後回報：改了哪些檔名、加了幾條內連、指向哪些 slug。
```

派遣策略（主對話）：依 `docs/data/migration-manifest.json` 逐篇派 subagent。可平行分批（每批數篇），但同一篇只派一次。每篇完成後不需逐篇 commit，集中在 Step 末。

Step 1: 逐篇派遣 subagent（35 篇，照上方模板）
Expected: 每篇回報改名清單與內連。

Step 2: build 驗證（內連 slug 與圖片路徑正確性）
Run: `npm run build`
Expected: build 成功（圖片 import 路徑、內連不影響 build，但破圖 ref 會讓 Astro 圖片最佳化報錯，可抓出改名遺漏）。

Step 3: 抽查 git diff
Run: `git status && git diff --stat`
Expected: 多個 index.md 改動 + images/ 內 `git mv` 改名；無遺留 img-N.webp 與 index.md ref 不一致。

Step 4: 一致性檢查（無孤兒 img-N 或斷鏈）
Run:
```
grep -rl "img-[0-9]" src/content/posts --include=index.md | grep -v test-markdown && echo "仍有 img-N 未語意化" || echo "全部語意化完成"
```
Expected: `全部語意化完成`

Step 5: Commit
Run: `git add src/content/posts && git commit -m "feat: Phase 2 — semantic image names, alt text, internal links"`

---

### Task 11: 最終驗證與收尾

Implements: `content-migration.md` #R12

Step 1: 全測試
Run: `node --test scripts/lib/`
Expected: 所有 lib 單元測試 PASS。

Step 2: 乾淨 build
Run: `rm -rf dist && npm run build`
Expected: build 成功，35 篇文章與圖片皆產出。

Step 3: 本地最終抽查
Run: `npm run dev`（抽看 3-5 篇：原網址保留 `/<slug>/`、cover 顯示、內文圖顯示、alt、內連可點、TOC、code fence）。

Step 4: 確認原網址保留正確
Run: `ls src/content/posts | grep create-free-ssl-domain-certificates-using-certbot`
Expected: 存在（slug 與 WP 原網址一致）。

Step 5: Commit（若有抽查微調）
Run: `git add -A && git commit -m "chore: final migration validation" || echo "無待提交變更"`

---

## 風險與備註

- **WP 必須在線**：Phase 1 下載圖片依賴 www.frankchen.tw（cutover 未發生）。先跑 Phase 1。
- **turndown DOM**：Node 下 turndown 用內建 domino；若報缺 DOM，補 `npm i -D jsdom` 並在 html-to-md.mjs 注入。Task 4 已註記。
- **code 語言別**：WXR 無資料，fenced block 無語言標註；19 篇含 code，事後手動補語言才會被 Shiki 上色（不在本計畫自動化範圍）。
- **圖片進 repo**：確認 `.gitignore` 未排除 `src/content/posts/**/images/`。
- **test-markdown-rendering**：非 WXR 來源，全程保留不動，最後可另行決定是否刪除。
- **Phase 2 為判斷型**：Task 10 由 subagent 逐篇執行，非確定性，需人工審查 git diff。
