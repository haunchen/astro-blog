# Accept 內容協商 Implementation Plan

Goal: 對 `Accept: text/markdown` 的請求，在同一網址回該頁的 markdown 表示；HTML 維持所有其他請求的預設。

Architecture: 建置後掃描 `dist/**/*.html`，把尚無 md 變體的頁面（列表頁、靜態頁）轉成同路徑的 `.md`
產物；Cloudflare Pages Functions 的中介層依 `Accept` 取用這些既有產物並修正標頭。文章與首頁維持
既有的手寫 md 路由，不動。

Tech Stack: Astro `astro:build:done` hook、turndown（已在 devDependencies）、Cloudflare Pages
Functions、wrangler（新增 devDependency，供本機與 CI 執行 Functions）。

Spec: `docs/specs/agent-markdown.md`（Pending Changes 區塊，R10 / R11 / MODIFIED R4 / MODIFIED R5）

Design: `docs/plans/2026-08-03-markdown-negotiation-design.md`

設計文件有四處與本計畫不一致，以本計畫為準（實作完成後回填 design doc）：

1. design doc 把 turndown 列為「新依賴」。實際上 `turndown@^7.2.4` 與 `turndown-plugin-gfm@^1.0.2`
   早已在 devDependencies（WordPress importer 在用），直接使用即可。**唯一的新依賴是 wrangler。**
2. design doc 說建置後處理寫成獨立腳本 `scripts/build-page-md.mjs`。本計畫改寫成
   `astro.config.mjs` 內的 `pageMarkdownVariants()` integration（Task 3），與既有的
   `sitemapAsSingleFile` 同構——同一個 `astro:build:done` hook、同一種寫法，少一個獨立腳本與
   一次 npm script 串接。純轉換邏輯仍然獨立在 `scripts/lib/page-md.mjs`，維持可單元測試。
   **`scripts/build-page-md.mjs` 這個檔案不會存在。**
3. design doc 稱線上驗證腳本為 `verify:markdown-negotiation`。本計畫命名為 `verify:negotiation`
   （Task 7），與既有 `verify:seo`／`verify:headers`／`verify:dns-aid` 的長度慣例一致。
4. design doc 說 `_routes.json` 會排除 `.md`／`.txt`／`.xml` 等副檔名樣式。本計畫只排四個目錄
   前綴（Task 6），理由見該 task——Cloudflare 只對貪心前綴 wildcard 有明文，副檔名樣式的行為
   沒有文件依據，賭錯會靜默排掉整批頁面。代價是那些非 HTML 路徑各多一次 invocation（邏輯上
   仍會正確 fallback，只是多耗額度）。

## Global Constraints

- 正規主機為 non-www：`https://frankchen.tw`。任何產物、標頭、連結都不得出現 www 網址。
- 本站所有頁面一律以帶結尾斜線的路徑供應（`/about/`、`/category/n8n/`）；靜態資產一律不帶斜線。
- 協商回應（正規網址 + `Accept: text/markdown`）**不得**帶 `X-Robots-Tag`。直接請求 `/<path>.md`
  則仍須帶 `noindex`。這兩者是不同契約，不可共用同一組標頭。
- HTML 是預設表示。只有 `Accept` 明確含 `text/markdown` 才切換，不得改變瀏覽器行為。
- 協商必須在原網址以 200 完成，不得以重導向達成。
- 無對應 md 產物的路徑必須退回原本行為，不得因協商產生新的 404。
- 文章（`src/pages/[...slug].md.ts`）與首頁（`src/pages/index.md.ts`）的 md 產出邏輯**不得修改**，
  本次新增的是第二條管線，兩者刻意並存。
- md 變體不進 sitemap。
- TypeScript 為 strict 模式；`.astro` 內的 import 需通過 `npx astro check`。
- `astro.config.mjs` 的 `vite.build.assetsInlineLimit: 0` 與 `cssCodeSplit: false` 不得更動
  （前者是 CSP `script-src 'self'` 的前提）。
- 註解與文件一律正體中文（台灣用語）。
- `package.json` 的 `test` script 其 glob 必須維持雙引號（讓 Node 展開而非 shell，Windows 相容）。
- 新增的 npm script 命名比照既有慣例：驗證線上站的用 `verify:*`。

---

### Task 1: 頁面路徑 ↔ md 路徑的映射

Implements: `agent-markdown.md` #R10, #R11

Files:
- Create: `scripts/lib/md-path.mjs`
- Test: `scripts/lib/md-path.test.mjs`

Interfaces:
- Consumes: 無
- Produces: `pagePathToMdPath(pathname: string): string | null`

這支必須零依賴、純字串運算：Task 6 的 Pages Functions 中介層會 import 它並被 bundle 進
Cloudflare Worker，牽連任何 Node 專用相依（turndown、node:fs）都會讓 bundle 失敗。轉換邏輯本身
則要與 Task 3 的建置後處理共用同一份，兩邊各寫一份必定走鐘。

Step 1: 寫失敗的測試

建立 `scripts/lib/md-path.test.mjs`：

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pagePathToMdPath } from './md-path.mjs';

test('pagePathToMdPath：首頁映射到 /index.md', () => {
  assert.equal(pagePathToMdPath('/'), '/index.md');
});

test('pagePathToMdPath：單層頁面去掉結尾斜線加 .md', () => {
  assert.equal(pagePathToMdPath('/about/'), '/about.md');
  assert.equal(pagePathToMdPath('/articles/'), '/articles.md');
});

test('pagePathToMdPath：深層頁面保留目錄結構', () => {
  assert.equal(pagePathToMdPath('/category/n8n/'), '/category/n8n.md');
  assert.equal(pagePathToMdPath('/tag/raspberry-pi/'), '/tag/raspberry-pi.md');
});

// 本站頁面一律帶結尾斜線，不帶斜線即代表這不是頁面。回 null 讓呼叫端退回原行為，
// 而不是硬湊一個 md 路徑出來——那會讓中介層對每個字型檔都去撈一次不存在的資產。
test('pagePathToMdPath：不帶結尾斜線的路徑回 null', () => {
  assert.equal(pagePathToMdPath('/_astro/index.a1b2c3.js'), null);
  assert.equal(pagePathToMdPath('/fonts/inter-latin-400-normal.1a37bf8f.woff2'), null);
  assert.equal(pagePathToMdPath('/404.html'), null);
});

// 直接請求 md 本身不該再被映射一次（會變成 /about.md.md）。
test('pagePathToMdPath：已經是 .md 的路徑回 null', () => {
  assert.equal(pagePathToMdPath('/about.md'), null);
  assert.equal(pagePathToMdPath('/index.md'), null);
});

test('pagePathToMdPath：非絕對路徑與非字串回 null', () => {
  assert.equal(pagePathToMdPath('about/'), null);
  assert.equal(pagePathToMdPath(''), null);
  assert.equal(pagePathToMdPath(undefined), null);
});
```

Step 2: 跑測試確認失敗

Run: `npm test`
Expected: FAIL（`Cannot find module ... md-path.mjs`）

Step 3: 寫最小實作讓測試通過

建立 `scripts/lib/md-path.mjs`：

```js
/**
 * 頁面網址與其 markdown 變體之間的路徑映射。
 *
 * 這支刻意零依賴、純字串運算：Pages Functions 的中介層（functions/_middleware.js）與建置後
 * 處理（scripts/lib/page-md.mjs）都要用同一套規則，而前者會被 bundle 進 Cloudflare Worker，
 * 牽連 turndown 或 node:fs 那類 Node 專用相依會讓 bundle 直接失敗。
 *
 * 兩邊各寫一份映射是這個功能最容易靜默走鐘的地方：中介層算出 `/tag/x.md` 而建置產出的是
 * `/tag/x/index.md`，協商會安靜地退回 HTML，所有正向斷言照樣通過。
 */

/**
 * 頁面路徑 → md 變體路徑。
 *
 * 本站所有頁面一律以結尾斜線供應（見 CLAUDE.md 的慣例一節），因此「不以 / 結尾」即代表
 * 這不是頁面——靜態資產、`.md` 本身、`404.html` 都落在這裡，一律回 null 讓呼叫端維持原行為。
 *
 * @param {string} pathname 例如 '/'、'/about/'、'/tag/n8n/'
 * @returns {string | null} 例如 '/index.md'、'/about.md'、'/tag/n8n.md'
 */
export function pagePathToMdPath(pathname) {
  if (typeof pathname !== 'string') return null;
  if (!pathname.startsWith('/')) return null;
  if (!pathname.endsWith('/')) return null;
  if (pathname === '/') return '/index.md';
  return `${pathname.slice(0, -1)}.md`;
}
```

Step 4: 跑測試確認通過

Run: `npm test`
Expected: PASS（既有 71 項 + 新增 6 項全數通過）

Step 5: Commit

```
git add scripts/lib/md-path.mjs scripts/lib/md-path.test.mjs
git commit -m "feat(agent-markdown): 頁面路徑與 md 變體的映射函式"
```

---

### Task 2: 從建置產物 HTML 產生頁面 markdown

Implements: `agent-markdown.md` #R10

Files:
- Create: `scripts/lib/page-md.mjs`
- Test: `scripts/lib/page-md.test.mjs`

Interfaces:
- Consumes: `toYamlFrontmatter(fields)`（既有，來自 `scripts/lib/md-export.mjs`）
- Produces:
  - `extractMainContent(html: string): string | null`
  - `buildPageMarkdown(html: string, origin: string): string`

刻意不改既有的 `scripts/lib/html-to-md.mjs`：那支是 WordPress importer 專用（處理 Gutenberg
註解與 code-block-pro），有自己的 spec 與測試，為了本功能去動它會把兩個不相干的需求綁在一起。

主內容區的定位靠 `BaseLayout.astro` 的 `<div id="main-content" tabindex="-1">`——nav 與 footer
是它的兄弟節點，抽出這個容器等於同時剔除導覽與頁尾。`</div>` 要靠深度計數配對，不能用非貪婪
regex：頁面內每一層巢狀 div 都會讓非貪婪比對提早收尾，抽到的內容會被無聲截斷。

Step 1: 寫失敗的測試

建立 `scripts/lib/page-md.test.mjs`：

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractMainContent, buildPageMarkdown } from './page-md.mjs';

const ORIGIN = 'https://frankchen.tw';

/** 模擬 BaseLayout 的最小骨架：nav / footer 是 #main-content 的兄弟節點。 */
function page({ title = '關於我 - Frank Chen', description = '這是描述', body = '<p>內文</p>' } = {}) {
  return `<!DOCTYPE html><html lang="zh-TW"><head>
<title>${title}</title>
<meta name="description" content="${description}">
<link rel="canonical" href="https://frankchen.tw/about/">
<meta property="og:image" content="https://frankchen.tw/cover.webp">
</head><body>
<nav><a href="/">首頁</a></nav>
<div id="main-content" tabindex="-1">${body}</div>
<footer><p>版權宣告</p></footer>
</body></html>`;
}

test('extractMainContent：只取 #main-content，排除 nav 與 footer', () => {
  const main = extractMainContent(page());
  assert.equal(main, '<p>內文</p>');
});

// 非貪婪 regex 會在第一個 </div> 收尾，抽到的內容被無聲截斷——這條是主防線。
test('extractMainContent：巢狀 div 靠深度計數正確配對', () => {
  const body = '<div class="a"><div class="b"><p>深層</p></div></div><p>尾段</p>';
  const main = extractMainContent(page({ body }));
  assert.equal(main, body);
  assert.ok(main.includes('尾段'));
});

test('extractMainContent：找不到主內容區時回 null', () => {
  assert.equal(extractMainContent('<html><body><p>沒有容器</p></body></html>'), null);
});

test('buildPageMarkdown：frontmatter 為四欄非文章契約', () => {
  const md = buildPageMarkdown(page(), ORIGIN);
  assert.ok(md.startsWith('---\n'));
  assert.match(md, /^title: "關於我 - Frank Chen"$/m);
  assert.match(md, /^description: "這是描述"$/m);
  assert.match(md, /^canonical: "https:\/\/frankchen\.tw\/about\/"$/m);
  assert.match(md, /^image: "https:\/\/frankchen\.tw\/cover\.webp"$/m);
  // 文章契約的欄位對列表頁與靜態頁沒有意義，硬湊值等於編造資料。
  assert.doesNotMatch(md, /^date:/m);
  assert.doesNotMatch(md, /^category:/m);
  assert.doesNotMatch(md, /^tags:/m);
});

test('buildPageMarkdown：標題階層與清單轉成 markdown', () => {
  const body = '<h2>小標</h2><ul><li>項目一</li><li>項目二</li></ul>';
  const md = buildPageMarkdown(page({ body }), ORIGIN);
  assert.match(md, /^## 小標$/m);
  assert.match(md, /^- 項目一$/m);
});

// md 可能被 agent 搬離本站脈絡後閱讀，站內相對連結在那裡解不開。
test('buildPageMarkdown：站內連結絕對化', () => {
  const body = '<p><a href="/category/n8n/">n8n 分類</a></p>';
  const md = buildPageMarkdown(page({ body }), ORIGIN);
  assert.match(md, /\[n8n 分類\]\(https:\/\/frankchen\.tw\/category\/n8n\/\)/);
});

test('buildPageMarkdown：外部連結不被加上本站前綴', () => {
  const body = '<p><a href="https://example.com/x">外部</a></p>';
  const md = buildPageMarkdown(page({ body }), ORIGIN);
  assert.match(md, /\[外部\]\(https:\/\/example\.com\/x\)/);
});

// 圖示 svg 與 View Transitions 的內聯樣式若被轉成文字，會變成 agent 要付費閱讀的雜訊。
test('buildPageMarkdown：script / style / svg 不進輸出', () => {
  const body = '<p>內文</p><svg><title>圖示</title></svg><script>console.log(1)</script><style>.a{}</style>';
  const md = buildPageMarkdown(page({ body }), ORIGIN);
  assert.ok(!md.includes('圖示'));
  assert.ok(!md.includes('console.log'));
  assert.ok(!md.includes('.a{}'));
});

test('buildPageMarkdown：HTML 實體還原成原字元', () => {
  const md = buildPageMarkdown(page({ title: 'n8n &amp; Flutter' }), ORIGIN);
  assert.match(md, /^title: "n8n & Flutter"$/m);
});

test('buildPageMarkdown：找不到主內容區時拋錯', () => {
  assert.throws(
    () => buildPageMarkdown('<html><body><p>沒有容器</p></body></html>', ORIGIN),
    /main-content/,
  );
});
```

Step 2: 跑測試確認失敗

Run: `npm test`
Expected: FAIL（`Cannot find module ... page-md.mjs`）

Step 3: 寫最小實作讓測試通過

建立 `scripts/lib/page-md.mjs`：

```js
/**
 * 由建置產物 HTML 產生頁面的 markdown 變體（見 docs/specs/agent-markdown.md R10）。
 *
 * 為什麼是「轉換建置產物」而不是像 index.md.ts 那樣手寫一支路由：
 * 關於（544 行）、n8n 資源（301 行）、聯絡（131 行）、隱私權（77 行）的文案全寫在版面裡，
 * 沒有共用來源可讀。要手寫 md 就得先把上千行文案抽成常數，否則兩份副本必定漂移（D8 的教訓：
 * 那種漂移不會讓 build 失敗，只會讓 agent 拿到過期內容）。以最終 HTML 為單一來源則不可能漂移。
 *
 * 這條管線刻意**不涵蓋文章與首頁**：那兩者有手寫來源（原始 markdown、HOME 常數），
 * 通用轉換是品質退步。兩條管線並存是設計，不是待整併的重複。
 */

import TurndownService from 'turndown';
import { tables } from 'turndown-plugin-gfm';
import { toYamlFrontmatter } from './md-export.mjs';

/** BaseLayout.astro 的主內容容器；nav 與 footer 是它的兄弟節點，抽它等於同時剔除兩者。 */
const MAIN_OPEN_RE = /<div\b[^>]*\bid=["']main-content["'][^>]*>/i;
const DIV_TAG_RE = /<(\/?)div\b[^>]*>/gi;

function decodeEntities(s) {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&'); // &amp; 必須最後
}

/**
 * 抽出 `#main-content` 容器的內容。
 *
 * `</div>` 用深度計數配對，不用非貪婪 regex：頁面內每一層巢狀 div 都會讓非貪婪比對提早收尾，
 * 內容被無聲截斷，而產出的 md 看起來仍然是一份合法文件——沒有任何跡象。
 *
 * @param {string} html
 * @returns {string | null}
 */
export function extractMainContent(html) {
  const open = MAIN_OPEN_RE.exec(html);
  if (!open) return null;
  const start = open.index + open[0].length;
  const re = new RegExp(DIV_TAG_RE.source, 'gi');
  re.lastIndex = start;
  let depth = 1;
  let match;
  while ((match = re.exec(html)) !== null) {
    depth += match[1] === '/' ? -1 : 1;
    if (depth === 0) return html.slice(start, match.index);
  }
  return null;
}

function metaContent(html, attr, value) {
  const re = new RegExp(`<meta\\b[^>]*\\b${attr}=["']${value}["'][^>]*>`, 'i');
  const tag = re.exec(html)?.[0];
  if (!tag) return '';
  return decodeEntities(tag.match(/\bcontent=["']([^"']*)["']/i)?.[1] ?? '');
}

function linkHref(html, rel) {
  const re = new RegExp(`<link\\b[^>]*\\brel=["']${rel}["'][^>]*>`, 'i');
  const tag = re.exec(html)?.[0];
  if (!tag) return '';
  return decodeEntities(tag.match(/\bhref=["']([^"']*)["']/i)?.[1] ?? '');
}

/**
 * 從 `<head>` 抽 frontmatter 的四個欄位。
 *
 * canonical 與 image 取頁面自己宣告的值而非自行拼接：BaseLayout 已經算過一次
 * （canonical 用 Astro.site + pathname、og:image 有 fallback 到 /cover.webp 的邏輯），
 * 在這裡重算等於複製那套規則，改一邊忘了另一邊就會不一致。
 *
 * @param {string} html
 */
function extractPageMeta(html) {
  return {
    title: decodeEntities(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? ''),
    description: metaContent(html, 'name', 'description'),
    canonical: linkHref(html, 'canonical'),
    image: metaContent(html, 'property', 'og:image'),
  };
}

function makeTurndown() {
  const td = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
    emDelimiter: '*',
  });
  td.use(tables);
  // 圖示 svg 的 <title>、View Transitions 的內聯樣式、Nav 的腳本若被轉成文字，
  // 會變成 agent 要付費閱讀的雜訊——而本功能的全部意義就是省 token。
  td.remove(['script', 'style', 'noscript', 'svg']);
  return td;
}

/**
 * 把 markdown 內的站內絕對路徑補上來源網域。
 *
 * md 可能被 agent 搬離本站脈絡後閱讀，`/about/` 在那裡解不開。只處理以 `/` 開頭的目標，
 * 外部連結（https://…）與錨點（#…）原樣保留。
 *
 * @param {string} md
 * @param {string} origin
 */
function absolutizeLinks(md, origin) {
  return md.replace(/\]\((\/[^)\s]*)\)/g, (_, target) => `](${origin}${target})`);
}

/**
 * 產生一份頁面 md（frontmatter + 正文）。
 *
 * @param {string} html 建置產物的完整 HTML
 * @param {string} origin 例如 https://frankchen.tw
 * @returns {string}
 */
export function buildPageMarkdown(html, origin) {
  const main = extractMainContent(html);
  if (main === null) {
    throw new Error(
      '找不到 #main-content 容器：BaseLayout.astro 的主內容區結構可能改了。' +
        '頁面 md 的抽取邏輯與那個 id 耦合，改版面時要一併更新 scripts/lib/page-md.mjs。',
    );
  }
  const meta = extractPageMeta(html);
  const body = absolutizeLinks(
    makeTurndown().turndown(main).replace(/\n{3,}/g, '\n\n').trim(),
    origin,
  );
  const frontmatter = toYamlFrontmatter({
    title: meta.title,
    description: meta.description,
    canonical: meta.canonical,
    image: meta.image,
  });
  return `${frontmatter}\n\n${body}\n`;
}
```

Step 4: 跑測試確認通過

Run: `npm test`
Expected: PASS

Step 5: Commit

```
git add scripts/lib/page-md.mjs scripts/lib/page-md.test.mjs
git commit -m "feat(agent-markdown): 由建置產物 HTML 產生頁面 markdown 的轉換層"
```

---

### Task 3: 建置後產出全站頁面 md

Implements: `agent-markdown.md` #R10

Files:
- Modify: `astro.config.mjs`（檔頭 import 區、`sitemapAsSingleFile()` 定義之後、
  `defineConfig` 的 `integrations` 陣列）

Interfaces:
- Consumes: `pagePathToMdPath()`（Task 1）、`buildPageMarkdown(html, origin)`（Task 2）
- Produces: `dist/` 內約 70 份新的 `.md` 產物（不含文章與首頁既有的 36 份）

掛在 `astro:build:done`，與既有的 `sitemapAsSingleFile` 同一個 hook。判斷「這頁要不要產 md」的
規則是**目標檔案是否已存在**——文章與首頁的 md 由路由在此之前產出，已存在就跳過。不用維護一份
「哪些是文章」的清單，那種清單會在新增頁面型別時過期。

`404.html` 不需特例排除：它推導出的 pathname 是 `/404.html`，不以斜線結尾，`pagePathToMdPath`
回 null 而自然跳過。

Step 1: 寫失敗的測試

本 task 的驗證是建置產物本身，斷言在 Task 5 的 `verify:seo` 加。這一步先確立現況作為對照：

Run: `npm run build && node -e "const {globSync}=require('glob');console.log('md 產物數：'+globSync('**/*.md',{cwd:'dist'}).length)"`
Expected: `md 產物數：37`（35 篇文章 + index.md + AGENTS.md）

Step 2: 加入 integration

在 `astro.config.mjs` 檔頭，把 `node:fs` 那行 import 改為：

```js
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
```

在同檔 `rehypeTableCaption` 那行 import 之後加入（`fileURLToPath`、`globSync`、`join` 皆為既有
import，不需重複加）：

```js
import { pagePathToMdPath } from './scripts/lib/md-path.mjs';
import { buildPageMarkdown } from './scripts/lib/page-md.mjs';
```

在 `sitemapAsSingleFile()` 函式定義結束之後、`export default defineConfig` 之前加入：

```js
// 為列表頁與靜態頁產出 markdown 變體（見 docs/specs/agent-markdown.md R10）。
//
// 文章與首頁不走這裡：它們由 src/pages/[...slug].md.ts 與 index.md.ts 在此之前產出，
// 內容是手寫來源（原始 markdown、HOME 常數），品質高於任何通用轉換。判斷方式刻意用
// 「目標檔案已存在就跳過」而不是維護一份「哪些是文章」的清單——清單會在新增頁面型別時過期，
// 而過期的後果是靜默覆寫掉品質較好的那一份。
function pageMarkdownVariants(site) {
  return {
    name: 'page-markdown-variants',
    hooks: {
      'astro:build:done': ({ dir, logger }) => {
        const outDir = fileURLToPath(dir);
        const origin = site.replace(/\/$/, '');
        let written = 0;
        let skipped = 0;

        for (const file of globSync('**/*.html', { cwd: outDir })) {
          const posix = file.replace(/\\/g, '/');
          // dist/about/index.html → /about/；dist/index.html → /；dist/404.html → /404.html
          const pathname = `/${posix.replace(/(^|\/)index\.html$/, '$1')}`;
          const mdPath = pagePathToMdPath(pathname);
          // null 代表這不是以斜線結尾的頁面（404.html 落在這裡），不產 md。
          if (mdPath === null) continue;

          const target = join(outDir, mdPath.slice(1));
          if (existsSync(target)) {
            skipped++;
            continue;
          }

          const html = readFileSync(join(outDir, file), 'utf8');
          mkdirSync(dirname(target), { recursive: true });
          writeFileSync(target, buildPageMarkdown(html, origin), 'utf8');
          written++;
        }

        logger.info(`頁面 markdown 變體：新產出 ${written} 份，沿用既有 ${skipped} 份`);
      },
    },
  };
}
```

同檔 `node:path` 那行 import 補上 `dirname`：

```js
import { dirname, join } from 'node:path';
```

在 `integrations` 陣列中，於 `sitemapAsSingleFile(),` 之後加入：

```js
    pageMarkdownVariants('https://frankchen.tw'),
```

Step 3: 跑建置確認產物

Run: `npm run build`
Expected: 輸出含 `頁面 markdown 變體：新產出 70 份，沿用既有 36 份`（tag 頁數量會隨標籤增減浮動，
「沿用既有」應為 35 篇文章 + index.md = 36；AGENTS.md 是 public/ 的靜態檔、沒有對應 HTML 頁面，
不會被計入任何一邊）

Step 4: 抽驗三份產物

Run: `node -e "const fs=require('fs');for(const f of ['dist/about.md','dist/category/n8n.md','dist/tag/n8n.md']){const t=fs.readFileSync(f,'utf8');console.log('---',f,t.length,'bytes');console.log(t.slice(0,300))}"`
Expected: 三份都以 `---` 開頭，frontmatter 含 title / description / canonical / image 四欄，
canonical 分別為 `https://frankchen.tw/about/`、`.../category/n8n/`、`.../tag/n8n/`，
正文為可讀的 markdown（有 `#` 標題、`-` 清單），不含 `<div`、不含 `console.log`

Step 5: Commit

```
git add astro.config.mjs
git commit -m "feat(agent-markdown): 建置後為列表頁與靜態頁產出 markdown 變體"
```

---

### Task 4: 全站 HTML 宣告自己的 markdown 變體

Implements: `agent-markdown.md` #R4

Files:
- Modify: `src/layouts/BaseLayout.astro`（`markdownVariant` 的 prop 宣告、frontmatter script
  區塊、`<head>` 內輸出該 `<link>` 的地方）

Interfaces:
- Consumes: `pagePathToMdPath()`（Task 1）
- Produces: 全站每個非 noindex 頁面的 `<head>` 都有 `<link rel="alternate" type="text/markdown">`

現況是「傳入 `markdownVariant` prop 才輸出」，只有文章與首頁傳。全站都有 md 之後，逐頁去傳這個
prop 等於九個檔案各改一次、日後新增頁面還會忘記。改成由 `Astro.url.pathname` 自動推導，
顯式傳入時仍以傳入值優先（文章與首頁維持現狀，不必改那兩支路由）。

`noindex` 的頁面（404）沒有 md 產物，必須排除，否則會宣告一個 404 給 agent。

Step 1: 修改 prop 註解與解構

在 `interface Props` 內，把 `markdownVariant` 的註解與宣告改為：

```ts
  /**
   * 該頁 markdown 變體的路徑（例如 `/some-slug.md`）。
   *
   * 不傳則由 `Astro.url.pathname` 自動推導——全站頁面都有 md 變體（見 agent-markdown R10），
   * 逐頁傳一次等於九個檔案各改一遍，而且新增頁面時一定會有人忘記。
   * `noindex` 的頁面（404）沒有對應產物，自動推導會跳過它們。
   */
  markdownVariant?: string;
```

在 frontmatter script 區塊末尾、`const allJsonLd = ...` 那行之前加入：

```ts
// Astro.url.pathname 在靜態建置下未必帶結尾斜線（視路由定義而定），而 md 路徑映射以
// 「頁面一律帶結尾斜線」為前提。先正規化再推導，否則宣告會靜默消失——HTML 照樣正常，
// 只是 agent 少了一條發現管道。verify-seo 有一條斷言專門守這件事。
const normalizedPath = Astro.url.pathname.endsWith('/')
  ? Astro.url.pathname
  : `${Astro.url.pathname}/`;
const resolvedMarkdownVariant =
  markdownVariant ?? (noindex ? undefined : (pagePathToMdPath(normalizedPath) ?? undefined));
```

Step 2: 加入 import

在 `import { SITE, ... } from '../utils/site-meta';` 之後加入：

```ts
import { pagePathToMdPath } from '../../scripts/lib/md-path.mjs';
```

Step 3: 改用推導後的值輸出

把 `<head>` 內輸出 `text/markdown` 宣告的那三行改為：

```astro
    {resolvedMarkdownVariant && (
      <link rel="alternate" type="text/markdown" href={resolvedMarkdownVariant} />
    )}
```

Step 4: 建置並確認宣告出現在各類頁面

Run: `npm run build && node -e "const fs=require('fs');for(const f of ['dist/about/index.html','dist/tag/n8n/index.html','dist/index.html','dist/404.html']){const t=fs.readFileSync(f,'utf8');const m=t.match(/<link[^>]+text\/markdown[^>]*>/);console.log(f,'→',m?m[0]:'（無宣告）')}"`
Expected:
```
dist/about/index.html → <link rel="alternate" type="text/markdown" href="/about.md">
dist/tag/n8n/index.html → <link rel="alternate" type="text/markdown" href="/tag/n8n.md">
dist/index.html → <link rel="alternate" type="text/markdown" href="/index.md">
dist/404.html → （無宣告）
```

Step 5: 型別檢查

Run: `npx astro check`
Expected: 0 errors（既有的 warning/hint 數量不變）

Step 6: Commit

```
git add src/layouts/BaseLayout.astro
git commit -m "feat(agent-markdown): 全站頁面自動宣告自己的 markdown 變體"
```

---

### Task 5: verify-seo 拆分三類 md 並補頁面 md 斷言

Implements: `agent-markdown.md` #R10, #R4

Files:
- Modify: `scripts/verify-seo.mjs`（`// Markdown 變體（agent-markdown spec）` 那個註解區塊下的
  集合定義，以及檔案後段 `// Markdown 變體` 分隔線之後的 check 群）

Interfaces:
- Consumes: Task 3 的頁面 md 產物、Task 4 的 HTML 宣告
- Produces: 無（驗證腳本）

**這是本計畫的地雷步驟，順序不能顛倒。** `verify-seo.mjs` 目前用 `dist/**/*.md` 全域掃描當作
「文章 md 的集合」（`allMdInDist` 與 `mdBySlug` 的宣告），只排除 `index` 與 `AGENTS` 兩個 slug。
Task 3 一次多出約 70 份
頁面 md，它們會被當成文章，觸發一串看不出真正原因的失敗：缺 `date`／`category`／`tags` 欄位、
canonical 期待 `https://frankchen.tw/tag/n8n/index/`、llms.txt 判「產物未被宣告」。

先拆集合，再加新斷言。

Step 1: 拆分集合

把「`// dist 裡不是文章的 md`」那段註解起、到 `const mdBySlug = new Map(...)` 為止的整段
（含 `HOME_MD_SLUG`／`AGENTS_MD_SLUG`／`NON_ARTICLE_MD`／`allMdInDist`／`mdBySlug` 的宣告）
換成：

```js
// dist 裡的 md 分三類，各有各的契約，混在一起驗必定誤報：
//   1. 文章 md（R1/R2）：完整 frontmatter，canonical 指向 /<slug>/
//   2. 首頁 md（R6）：四欄契約，canonical 指向 /
//   3. 頁面 md（R10）：四欄契約，canonical 指向該頁自己的網址
// 另有 AGENTS.md，它根本沒有 frontmatter，四類都不適用。
//
// 這個分類曾經是「文章以外都例外」的黑名單（NON_ARTICLE_MD），在頁面 md 出現後不再夠用：
// 黑名單漏一項就會把它當文章驗，而失敗訊息完全看不出根因。改成以來源為準的白名單——
// 文章的集合直接來自 src/content/posts/，不靠 dist 的檔名去猜。
const HOME_MD_SLUG = 'index';
const AGENTS_MD_SLUG = 'AGENTS';

const allMdInDist = new Map(
  globSync('**/*.md', { cwd: DIST })
    .sort()
    .map((relFile) => [
      relFile.replace(/\\/g, '/').replace(/\.md$/, ''),
      readFileSync(path.join(DIST, relFile), 'utf8'),
    ]),
);

// 草稿判定要讀來源 frontmatter：dist 裡看不出「這篇是刻意不產 md，還是漏產了」。
const sourcePosts = globSync('src/content/posts/**/*.md', { cwd: PROJECT_ROOT }).map((file) => {
  const id = file
    .replace(/\\/g, '/')
    .replace(/^src\/content\/posts\//, '')
    .replace(/\/index\.md$/, '')
    .replace(/\.md$/, '');
  const { data } = matter(readFileSync(path.join(PROJECT_ROOT, file), 'utf8'));
  return { id, draft: data.draft === true };
});

const articleSlugs = new Set(sourcePosts.filter((p) => !p.draft).map((p) => p.id));

const mdBySlug = new Map([...allMdInDist].filter(([slug]) => articleSlugs.has(slug)));

const pageMdBySlug = new Map(
  [...allMdInDist].filter(
    ([slug]) => !articleSlugs.has(slug) && slug !== HOME_MD_SLUG && slug !== AGENTS_MD_SLUG,
  ),
);
```

注意：原本緊接在被替換區塊之後、以「`// 草稿判定要讀來源 frontmatter`」起頭的那份 `sourcePosts`
宣告已被併入上面這段，**要把原處那一份刪掉**——同一個 scope 內重複 `const` 宣告會讓腳本直接
SyntaxError，連第一項檢查都跑不到。

Step 2: 跑驗證確認集合拆對

Run: `npm run build && npm run verify:seo`
Expected: PASS（既有所有檢查通過。若這一步就紅，代表集合拆分有誤，先修這裡再往下）

Step 3: 加入頁面 md 的斷言

在名為 `sitemap 不得收錄 .md 變體` 的那個 `check(...)` 呼叫結束之後加入：

```js
// 每個 HTML 頁面都必須有對應的 md。這條是硬要求不是盡力而為：R11 的內容協商在找不到 md 時
// 會退回 HTML，缺漏因此完全靜默——協商「有回應」、頁面「看起來正常」，只有 agent 拿不到 md。
check('每個 HTML 頁面都有對應的 markdown 變體', (failures) => {
  for (const { pathname } of pages) {
    // 404 頁沒有 md 變體（noindex，且不在協商範圍內）
    if (pathname === '/404' || pathname === '/404.html') continue;
    const slug = pathname === '/' ? HOME_MD_SLUG : pathname.replace(/^\//, '').replace(/\/$/, '');
    if (!allMdInDist.has(slug)) {
      failures.push({ page: pathname, reason: `缺少對應的 ${slug}.md` });
    }
  }
});

check('頁面 markdown 變體的 frontmatter 為四欄契約且 canonical 正確', (failures) => {
  for (const [slug, text] of pageMdBySlug) {
    let data;
    try {
      ({ data } = matter(text));
    } catch (err) {
      failures.push({ page: `/${slug}.md`, reason: `frontmatter 解析失敗：${err.message}` });
      continue;
    }
    for (const key of ['title', 'description', 'canonical', 'image']) {
      if (!data[key]) failures.push({ page: `/${slug}.md`, reason: `frontmatter 缺少 ${key}` });
    }
    // 頁面不是文章，硬湊這些欄位只是為了讓同一組斷言跑得過而編造資料（見 spec D7）。
    for (const key of ['date', 'category', 'tags']) {
      if (key in data) {
        failures.push({ page: `/${slug}.md`, reason: `頁面 md 不應有文章欄位 ${key}` });
      }
    }
    const expectedCanonical = `${SITE_ORIGIN}/${slug}/`;
    if (data.canonical !== expectedCanonical) {
      failures.push({
        page: `/${slug}.md`,
        reason: `canonical 應為 ${expectedCanonical}，實際為 ${data.canonical}`,
      });
    }
  }
});

// 轉換器與 BaseLayout 的 #main-content 結構耦合，版面改結構時抽取會靜默劣化成一份
// 只有 frontmatter 的空殼。長度下限擋不住「讀起來好不好」，但擋得住「整段沒抽到」。
check('頁面 markdown 變體有實質內容', (failures) => {
  for (const [slug, text] of pageMdBySlug) {
    const body = matter(text).content.trim();
    if (body.length < 80) {
      failures.push({ page: `/${slug}.md`, reason: `正文僅 ${body.length} 字元，疑似抽取失敗` });
    }
    if (body.includes('<div') || body.includes('</div>')) {
      failures.push({ page: `/${slug}.md`, reason: '正文殘留未轉換的 HTML 標籤' });
    }
  }
});

// R4 的 HTML 宣告管道。Astro.url.pathname 是否帶結尾斜線會影響 BaseLayout 的推導結果，
// 推導失敗時宣告會靜默消失——頁面完全正常，只是少一條發現管道。
check('每個 HTML 頁面都宣告自己的 markdown 變體', (failures) => {
  for (const { pathname, html } of pages) {
    if (pathname === '/404' || pathname === '/404.html') continue;
    const expected = pathname === '/' ? '/index.md' : `${pathname.replace(/\/$/, '')}.md`;
    const re = new RegExp(
      `<link[^>]+type=["']text/markdown["'][^>]+href=["']${expected.replace(/\//g, '\\/')}["']`,
    );
    if (!re.test(html)) {
      failures.push({ page: pathname, reason: `缺少指向 ${expected} 的 text/markdown 宣告` });
    }
  }
});
```

Step 4: 跑驗證確認全部通過

Run: `npm run verify:seo`
Expected: PASS，且輸出含上述四條新檢查

Step 5: 反向驗證斷言真的會擋

Run: `node -e "require('fs').unlinkSync('dist/about.md')" && npm run verify:seo; echo "exit=$?"`
Expected: FAIL，訊息含 `缺少對應的 about.md`，`exit=1`

Run: `npm run build && npm run verify:seo`
Expected: 重新產出後回到 PASS

Step 6: Commit

```
git add scripts/verify-seo.mjs
git commit -m "test(agent-markdown): verify-seo 拆分三類 md 並補頁面 md 斷言"
```

---

### Task 6: Pages Functions 中介層做內容協商

Implements: `agent-markdown.md` #R11, #R5

Files:
- Create: `functions/_middleware.js`
- Create: `public/_routes.json`

Interfaces:
- Consumes: `pagePathToMdPath()`（Task 1）、Task 3 產出的 md 產物
- Produces: 對 `Accept: text/markdown` 的協商回應

`env.ASSETS.fetch()` 會**套用 `_headers` 規則**（Cloudflare 文件明載），所以取 `/about.md` 拿回來
的回應必定帶 `X-Robots-Tag: noindex`。協商回應走的是正規網址，那個標頭若跟著出去，等於對頁面
本體下架指令——必須顯式刪除。這是本功能唯一會造成實質傷害的失誤模式。

Step 1: 建立中介層

建立 `functions/_middleware.js`：

```js
/**
 * Accept 內容協商：同一網址依 Accept 供應 HTML 或 markdown（見 docs/specs/agent-markdown.md R11）。
 *
 * 為什麼是 Pages Functions 而不是 Cloudflare 原生的 Markdown for Agents：本站 zone 是 Free 方案，
 * 原生功能與 Snippets 都是 Pro 起。而且即使升級也不會採用——原生方案在邊緣做通用 HTML→md 轉換
 * 並附 JSON-LD（spec D3 刻意排除），本站的文章 md 則是作者手寫的原始 markdown，兩者並存等於
 * 同一份內容有兩種互相打架的表示。
 *
 * HTML 永遠是預設。只有 Accept 明確含 text/markdown 才切換，瀏覽器不受影響。
 */

import { pagePathToMdPath } from '../scripts/lib/md-path.mjs';

/**
 * token 數估算，供 x-markdown-tokens 使用。
 *
 * 是估算不是精確值：中文與英文的 token 密度差很多，這裡取「每 2.5 個字元約一個 token」的
 * 粗略係數，讓 agent 有個量級可以決定要不要抓全文。CF 原生方案的同名標頭一樣是估算值。
 */
function estimateTokens(text) {
  return Math.ceil([...text].length / 2.5);
}

function wantsMarkdown(request) {
  const accept = request.headers.get('accept');
  if (!accept) return false;
  // 只認明確列出的 media type。`*/*`（多數 HTTP 客戶端的預設）不算——那代表「什麼都行」，
  // 依 spec R11，什麼都行的時候給 HTML。
  return accept
    .toLowerCase()
    .split(',')
    .some((part) => part.split(';')[0].trim() === 'text/markdown');
}

/**
 * 補上 `Vary: Accept`。
 *
 * 兩種回應都要帶：Cloudflare 邊緣對 Accept-Encoding 以外的 Vary 不做快取分流，但這個標頭的
 * 對象是瀏覽器與中間層快取——同一個客戶端先後以不同 Accept 取同一個網址時，沒有 Vary 就會
 * 拿到快取裡的另一種表示。
 *
 * 逐一比對既有值而不是無條件 append：重複 append 會讓標頭在多次經手後累積成
 * `Accept, Accept, Accept`。
 */
function withVaryOnAccept(response) {
  const headers = new Headers(response.headers);
  const existing = headers.get('Vary');
  const values = existing ? existing.split(',').map((v) => v.trim().toLowerCase()) : [];
  if (!values.includes('accept') && !values.includes('*')) {
    headers.set('Vary', existing ? `${existing}, Accept` : 'Accept');
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export const onRequest = async (context) => {
  const { request, next, env } = context;

  if (request.method !== 'GET' && request.method !== 'HEAD') return next();

  const url = new URL(request.url);
  const mdPath = wantsMarkdown(request) ? pagePathToMdPath(url.pathname) : null;

  // 不要 markdown，或這個路徑根本不是頁面（靜態資產、.md 本身）→ 原本的行為。
  if (mdPath === null) return withVaryOnAccept(await next());

  const asset = await env.ASSETS.fetch(new URL(mdPath, url.origin));
  // 找不到 md 產物就退回 HTML，不製造新的 404（spec R11）。正常情況下不會走到這裡——
  // verify-seo 有一條硬斷言要求每個 HTML 頁面都有對應 md。
  if (!asset.ok) return withVaryOnAccept(await next());

  const body = await asset.text();
  const headers = new Headers(asset.headers);
  headers.set('Content-Type', 'text/markdown; charset=utf-8');
  headers.set('Vary', 'Accept');
  headers.set('x-markdown-tokens', String(estimateTokens(body)));
  // ASSETS.fetch 會套用 _headers 規則，所以這裡拿到的回應帶著給 /*.md 設的
  // X-Robots-Tag: noindex。那條規則的用途是防 /<slug>.md 與 /<slug>/ 被判重複內容；
  // 協商回應走的是正規網址本身，帶上它等於叫搜尋引擎不要收錄頁面本體（spec D14）。
  headers.delete('X-Robots-Tag');
  // body 已重新讀出，長度交給 runtime 重算。
  headers.delete('Content-Length');

  return new Response(body, { status: 200, headers });
};
```

Step 2: 建立 `_routes.json`

建立 `public/_routes.json`：

```json
{
  "version": 1,
  "include": ["/*"],
  "exclude": ["/_astro/*", "/fonts/*", "/og/*", "/samples/*"]
}
```

排除清單只列目錄前綴，不用 `/*.png` 那種副檔名樣式：Cloudflare 文件對 wildcard 只說明
「貪心比對」，副檔名樣式的行為沒有明文，賭錯的後果是把頁面一起排除掉、協商靜默失效。
被排除的四個目錄涵蓋絕大多數子資源請求；`/n8n-resources/` 底下的圖片刻意不排除——那個前綴
同時是一個頁面（`/n8n-resources/`），用 `/n8n-resources/*` 排除會連頁面一起排掉，代價只是
那幾張圖多計 invocation。

Step 3: 確認建置後 `_routes.json` 到位

Run: `npm run build && node -e "console.log(require('fs').readFileSync('dist/_routes.json','utf8'))"`
Expected: 印出上述 JSON（`public/` 的檔案會原樣複製到 `dist/` 根）

Step 4: Commit

```
git add functions/_middleware.js public/_routes.json
git commit -m "feat(agent-markdown): Accept 內容協商的 Pages Functions 中介層"
```

---

### Task 7: 內容協商的驗證腳本

Implements: `agent-markdown.md` #R11, #R5（情境 S10 / S11 / S12）

Files:
- Create: `scripts/verify-negotiation.mjs`
- Modify: `package.json`（scripts 區塊）

Interfaces:
- Consumes: 執行中的站台（本機 wrangler 或正式站）
- Produces: 無（驗證腳本）。用法 `node scripts/verify-negotiation.mjs [origin]`

一支腳本兩種用途：Task 8 拿它打本機 wrangler（CI 用），日常拿它打正式站。比照
`verify-headers.mjs` 的既有風格——origin 走 `process.argv[2]`、預設正式站、任一項不符 exit 1。

Step 1: 建立驗證腳本

建立 `scripts/verify-negotiation.mjs`：

```js
/**
 * 驗證 Accept 內容協商（見 docs/specs/agent-markdown.md R11、情境 S10-S12）。
 *
 * 為什麼需要這支：協商邏輯活在 Cloudflare Pages Functions 裡，`astro preview` 不執行它，
 * `_headers` 也不套用——建置全綠、產物全對，協商仍可能完全沒生效。而失效的方式是靜默的：
 * 中介層任何一個環節出錯都退回 HTML，站台看起來完全正常。
 *
 * 用法：
 *   node scripts/verify-negotiation.mjs                      # 檢查 https://frankchen.tw
 *   node scripts/verify-negotiation.mjs http://localhost:8788 # 檢查本機 wrangler
 *
 * 任一項不符即 exit 1。
 */

const ORIGIN = (process.argv[2] ?? 'https://frankchen.tw').replace(/\/$/, '');
const MD_ACCEPT = { Accept: 'text/markdown' };

async function get(path, headers = {}) {
  try {
    const res = await fetch(ORIGIN + path, { headers, redirect: 'follow' });
    return { res, body: await res.text() };
  } catch (err) {
    return { error: `請求失敗：${err.message}` };
  }
}

function contentType(res) {
  return (res.headers.get('content-type') ?? '').toLowerCase();
}

function varyIncludesAccept(res) {
  return (res.headers.get('vary') ?? '')
    .split(',')
    .map((v) => v.trim().toLowerCase())
    .includes('accept');
}

/** 協商成功的完整契約，套用在每一種頁面形狀上。 */
function checkNegotiated(label, path) {
  return async () => {
    const { res, body, error } = await get(path, MD_ACCEPT);
    if (error) return error;
    const problems = [];
    if (res.status !== 200) problems.push(`狀態碼 ${res.status}（應為 200，不得用重導向達成）`);
    if (!contentType(res).startsWith('text/markdown')) {
      problems.push(`Content-Type 為 ${contentType(res) || '（無）'}`);
    }
    if (!varyIncludesAccept(res)) problems.push(`Vary 為 ${res.headers.get('vary') ?? '（無）'}`);
    // 協商回應走正規網址，帶 noindex 等於對頁面本體下架（spec D14）。
    if (res.headers.get('x-robots-tag')) {
      problems.push(`不應有 X-Robots-Tag，實際為 ${res.headers.get('x-robots-tag')}`);
    }
    if (!body.startsWith('---')) problems.push('內容未以 YAML frontmatter 開頭');
    if (/^\s*<(!doctype|html)/i.test(body)) problems.push('內容是 HTML，協商未生效');
    return problems.length ? `${label}：${problems.join('｜')}` : null;
  };
}

const CHECKS = [
  { name: '首頁協商回 markdown', run: checkNegotiated('/', '/') },
  { name: '靜態頁協商回 markdown', run: checkNegotiated('/about/', '/about/') },
  {
    name: '深層頁面協商回 markdown（驗全站範圍）',
    run: checkNegotiated('/category/n8n/', '/category/n8n/'),
  },
  {
    name: '不帶 Accept 時仍回 HTML（HTML 是預設）',
    run: async () => {
      const { res, error } = await get('/');
      if (error) return error;
      if (!contentType(res).startsWith('text/html')) return `Content-Type 為 ${contentType(res)}`;
      if (!varyIncludesAccept(res)) return `HTML 回應缺 Vary: Accept（實際 ${res.headers.get('vary') ?? '（無）'}）`;
      return null;
    },
  },
  {
    name: 'Accept: */* 不觸發協商',
    run: async () => {
      const { res, error } = await get('/', { Accept: '*/*' });
      if (error) return error;
      return contentType(res).startsWith('text/html') ? null : `Content-Type 為 ${contentType(res)}`;
    },
  },
  {
    name: '瀏覽器的 Accept 不觸發協商',
    run: async () => {
      const { res, error } = await get('/', {
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,*/*;q=0.8',
      });
      if (error) return error;
      return contentType(res).startsWith('text/html') ? null : `Content-Type 為 ${contentType(res)}`;
    },
  },
  {
    // 反向斷言：直接請求 .md 是另一種契約，那條路徑仍須帶 noindex（spec R5、D5）。
    name: '直接請求 .md 仍帶 noindex',
    run: async () => {
      const { res, error } = await get('/about.md');
      if (error) return error;
      const tag = res.headers.get('x-robots-tag');
      return tag?.toLowerCase().includes('noindex') ? null : `實際為 ${tag ?? '（無）'}`;
    },
  },
  {
    name: '不存在的路徑不因協商而改變行為',
    run: async () => {
      const plain = await get('/this-page-does-not-exist/');
      const negotiated = await get('/this-page-does-not-exist/', MD_ACCEPT);
      if (plain.error) return plain.error;
      if (negotiated.error) return negotiated.error;
      if (plain.res.status !== negotiated.res.status) {
        return `帶 Accept 時狀態碼為 ${negotiated.res.status}，不帶時為 ${plain.res.status}`;
      }
      return null;
    },
  },
  {
    name: '靜態資產不因協商而改變型別',
    run: async () => {
      const { res, error } = await get('/favicon.png', MD_ACCEPT);
      if (error) return error;
      return contentType(res).startsWith('image/') ? null : `Content-Type 為 ${contentType(res)}`;
    },
  },
  {
    // 有則帶（SKILL.md 的措辭是 if available），所以只在協商成功時要求它是正整數。
    name: 'x-markdown-tokens 為正整數',
    run: async () => {
      const { res, error } = await get('/', MD_ACCEPT);
      if (error) return error;
      const value = res.headers.get('x-markdown-tokens');
      if (!value) return '缺少 x-markdown-tokens';
      return /^\d+$/.test(value) && Number(value) > 0 ? null : `實際為 ${value}`;
    },
  },
];

let failed = 0;
console.log(`檢查來源：${ORIGIN}\n`);

for (const check of CHECKS) {
  const problem = await check.run();
  if (problem) {
    failed++;
    console.log(`[FAIL] ${check.name}`);
    console.log(`       ${problem}`);
  } else {
    console.log(`[PASS] ${check.name}`);
  }
}

console.log();
if (failed) {
  console.log(`${failed} 項不符。`);
  console.log(
    '協商邏輯在 functions/_middleware.js。本機要重現需以 wrangler 執行（npm run preview:pages），' +
      'astro preview 不會執行 Pages Functions。',
  );
  process.exit(1);
}
console.log('全部符合預期。');
```

Step 2: 加入 npm script

在 `package.json` 的 scripts 區塊，於 `"verify:dns-aid"` 那行之後加入：

```json
    "verify:negotiation": "node scripts/verify-negotiation.mjs"
```

Step 3: 對正式站跑一次，確認腳本本身會紅

Run: `npm run verify:negotiation`
Expected: FAIL——協商尚未部署，首頁／靜態頁／深層頁三項應報 `Content-Type 為 text/html; charset=utf-8`。
「不帶 Accept 時仍回 HTML」那項的 Vary 子句也會紅。這是預期的：腳本此刻正確反映正式站沒有這個功能。

Step 4: Commit

```
git add scripts/verify-negotiation.mjs package.json
git commit -m "test(agent-markdown): 內容協商的線上驗證腳本"
```

---

### Task 8: wrangler 讓協商在本機與 CI 可測

Implements: `agent-markdown.md` #R11

Files:
- Modify: `package.json`（devDependencies、scripts）
- Modify: `.github/workflows/seo-pr.yml`（Lighthouse 步驟之後）

Interfaces:
- Consumes: `scripts/verify-negotiation.mjs`（Task 7）、`functions/_middleware.js`（Task 6）
- Produces: `npm run preview:pages`；CI 的協商驗證步驟

這一步是 spec D15 對 D1 的回應：D1 拒絕內容協商的理由之一是「風險離開 build 時、CI 擋不住」，
把 Functions 納入 CI 就是把它擋回來。

Step 1: 安裝 wrangler 並確認可無認證啟動

Run: `npm install --save-dev wrangler`
Expected: 安裝成功，`package.json` 的 devDependencies 出現 `wrangler`

Run: `npm run build && npx wrangler pages dev dist --port 8788`
Expected: 輸出含 `Ready on http://localhost:8788`，且**不要求登入 Cloudflare 帳號**
（`wrangler pages dev` 跑的是本機 workerd，不需要帳號）。確認後 Ctrl-C 結束。

若這一步要求認證，停下來回報——CI 整合需要改走別的路（例如只在部署後對 preview URL 驗證），
不要在 CI 裡塞 API token 硬闖。

Step 2: 加入 npm script

在 `package.json` 的 scripts 區塊，於 `"preview"` 那行之後加入：

```json
    "preview:pages": "wrangler pages dev dist --port 8788",
```

Step 3: 本機端到端驗證

開兩個終端。終端 A：

Run: `npm run build && npm run preview:pages`
Expected: `Ready on http://localhost:8788`

終端 B：

Run: `npm run verify:negotiation http://localhost:8788`
Expected: PASS，10 項全數通過

Run: `curl -sS -D - -o /dev/null -H "Accept: text/markdown" http://localhost:8788/about/`
Expected: 回應含 `content-type: text/markdown; charset=utf-8`、`vary: Accept`、
`x-markdown-tokens: <數字>`，且**不含** `x-robots-tag`

Run: `curl -sS -D - -o /dev/null http://localhost:8788/about/`
Expected: `content-type: text/html; charset=utf-8`

Step 4: 接上 CI

在 `.github/workflows/seo-pr.yml` 的「檢查分數門檻並寫入 Job Summary」步驟之後（檔案最末）加入：

```yaml
      # 內容協商活在 Pages Functions 裡，前面那些步驟一個都碰不到它：astro preview 不執行
      # Functions，verify:seo 只看 dist 的靜態產物。沒有這一步，協商壞掉要等部署到正式站
      # 才會被發現——而它壞掉的方式是靜默退回 HTML，站台看起來完全正常。
      - name: 啟動 wrangler pages dev（背景執行）
        run: |
          nohup npx --yes wrangler pages dev dist --port 8788 > wrangler.log 2>&1 &
          disown
          for i in $(seq 1 60); do
            if curl -sf http://localhost:8788/ > /dev/null; then
              echo "wrangler pages dev 已就緒"
              exit 0
            fi
            sleep 1
          done
          echo "::error::wrangler pages dev 60 秒內未就緒"
          cat wrangler.log
          exit 1

      - name: 驗證 Accept 內容協商
        run: npm run verify:negotiation http://localhost:8788
```

wrangler 的就緒等待給 60 秒而非 preview server 的 30 秒：它要先啟動 workerd 執行環境並 bundle
`functions/`，比單純的靜態檔伺服器慢。

Step 5: Commit

```
git add package.json package-lock.json .github/workflows/seo-pr.yml
git commit -m "test(agent-markdown): wrangler 讓內容協商在本機與 CI 可驗證"
```

---

### Task 9: 文件與站台手冊更新

Implements: `agent-markdown.md` #R7, #R4

Files:
- Modify: `public/AGENTS.md`
- Modify: `CLAUDE.md`
- Modify: `scripts/verify-seo.mjs`（AGENTS.md 的管道斷言）

Interfaces:
- Consumes: Task 6 的協商行為
- Produces: 無

`/AGENTS.md` 是給造訪本站的 agent 的取用手冊（spec R7）。新增一整條取用管道卻不寫進手冊，
等於手冊當場過期——而 R7 的斷言只檢查五個既有管道，不會發現這件事。

Step 1: 更新站台手冊

在 `public/AGENTS.md` 描述 `.md` 路徑慣例的段落之後，加入一節：

```markdown
## 內容協商（Accept: text/markdown）

除了把網址結尾的斜線換成 `.md`，你也可以直接對原網址帶 `Accept: text/markdown`：

```
curl -H "Accept: text/markdown" https://frankchen.tw/about/
```

回應為 `Content-Type: text/markdown; charset=utf-8`，並帶 `Vary: Accept` 與
`x-markdown-tokens`（token 數估算，供你決定是否抓取全文）。不帶這個標頭時一律回 HTML，
`Accept: */*` 也視為要 HTML。

兩條路徑取得的內容相同，差別只在引用：協商回應走的是正規網址，可以直接引用；
`/<path>.md` 這個網址帶 `X-Robots-Tag: noindex`，引用時請改用 frontmatter 的 `canonical`。
```

Step 2: 更新 AGENTS.md 的管道斷言

在 `scripts/verify-seo.mjs` 名為 `AGENTS.md 存在且涵蓋主要取用管道` 的 check 內，把管道清單
（`['/llms.txt', '/index.md', '/rss.xml', '/robots.txt', 'canonical']`）加入協商管道：

```js
  for (const channel of ['/llms.txt', '/index.md', '/rss.xml', '/robots.txt', 'canonical', 'Accept: text/markdown']) {
```

Step 3: 更新 CLAUDE.md

在 `CLAUDE.md` 的 Routing 小節，`/AGENTS.md` 那一項之後加入：

```markdown
- **Content negotiation:** any page URL with `Accept: text/markdown` returns that page's markdown
  variant at the same URL (`functions/_middleware.js`). HTML stays the default; `Accept: */*` gets
  HTML. The negotiated response strips `X-Robots-Tag` — that header belongs to the `/<path>.md`
  URLs only. See `docs/specs/agent-markdown.md` R11
```

在同檔 Commands 小節的 verify 清單加入：

```markdown
npm run verify:negotiation  # Accept 內容協商 on the LIVE site (or pass an origin)
```

在同檔 Commands 小節的 preview 之後加入：

```markdown
npm run preview:pages  # Preview WITH Pages Functions (wrangler) — astro preview does NOT run them
```

在 Architecture 的 Scripts 段落，把 `verify-*` 那一項補上 `page-md.mjs` 與 `md-path.mjs`：

```markdown
`scripts/lib/page-md.mjs` + `md-path.mjs`（頁面 md 變體的轉換與路徑映射，前者只在 build 時跑、
後者同時被 Pages Functions 引用所以必須零依賴）
```

在 Build constraints 小節加入一條：

```markdown
- `functions/_middleware.js` runs on every page request. `public/_routes.json` excludes
  `/_astro/`, `/fonts/`, `/og/`, `/samples/` so static assets skip the Worker. Do not add
  extension-style excludes (`/*.png`) — Cloudflare only documents greedy-prefix wildcards, and
  a mis-matched pattern silently disables negotiation for whole page sets.
```

Step 4: 驗證

Run: `npm run build && npm run verify:seo`
Expected: PASS（含更新後的 AGENTS.md 管道斷言）

Step 5: Commit

```
git add public/AGENTS.md CLAUDE.md scripts/verify-seo.mjs
git commit -m "docs(agent-markdown): 站台手冊與 CLAUDE.md 補上內容協商"
```

---

## 部署後的收尾驗證

這幾項無法在 CI 完成，需要在 PR 的 Pages preview 部署或合併後對正式站執行。

1. **協商在真實邊緣生效**

   Run: `npm run verify:negotiation https://<preview>.pages.dev`
   Expected: 10 項全數通過

2. **既有標頭沒有被中介層破壞**

   中介層對每個頁面回應都重建了一次 `Response`，`_headers` 設的 CSP、HSTS、Link 標頭都必須
   原樣保留。

   Run: `npm run verify:headers https://<preview>.pages.dev`
   Expected: 與加中介層之前相同的結果

3. **TTFB 對照**（design doc 列為推論待驗）

   Run: `for i in 1 2 3 4 5; do curl -sS -o /dev/null -w "%{time_starttransfer}\n" https://frankchen.tw/; done`
   Run: `for i in 1 2 3 4 5; do curl -sS -o /dev/null -w "%{time_starttransfer}\n" https://<preview>.pages.dev/; done`
   Expected: 兩組中位數差距在個位數毫秒。若明顯更慢，回頭用 `_routes.json` 把協商限縮到更窄的
   路徑，並把實測數字補回 design doc。

4. **Pages 專案的 Functions 額度耗盡行為設為 fail open**

   Cloudflare Dashboard → Workers & Pages → 該專案 → Settings → Functions → 確認為 fail open。
   為了 agent 的功能讓一般讀者看到錯誤頁是本末倒置。這是 dashboard 設定，repo 管不到，
   所以要人工確認一次。

5. **外部檢測**

   確認 isitagentready 的 `checks.contentAccessibility.markdownNegotiation.status` 轉為 `pass`。
