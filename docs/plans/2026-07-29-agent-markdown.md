# Agent Markdown Implementation Plan

Goal: build 時為每篇非草稿文章輸出一份 `/<slug>.md`，含白名單 frontmatter 與絕對化圖片網址，並讓 AI agent 透過路徑慣例、llms.txt 與 HTML 宣告找得到。

Architecture: 新增靜態端點 `src/pages/[...slug].md.ts`，`getStaticPaths` 與文章頁同源。圖片網址不走 `import.meta.glob`（會 404），改以 Container API 渲染 `<Content/>` 後從產出的 HTML 建「檔名主幹 → `/_astro/…` 網址」對照表，再改寫原始 markdown 的相對路徑。純轉換邏輯抽到 `scripts/lib/md-export.mjs` 由既有 `npm test` 涵蓋；產物由 `verify:seo` 斷言，線上標頭由 `verify:headers` 斷言。

Tech Stack: Astro v5 靜態端點、`astro/container`（experimental Container API，RSS 已在生產使用）、`gray-matter`（既有依賴，僅用於驗證腳本）、`node:test`。

Spec: `docs/specs/agent-markdown.md`（status: draft）

Design: `docs/plans/2026-07-29-agent-markdown-design.md`

Issue: #33

## Global Constraints

- Canonical host 為非 www 的 `https://frankchen.tw`；任何情況下都不得產出 www 網址。
- 內容語言 zh-TW；程式碼註解與 commit message 用正體中文台灣用語。
- 圖片網址**不可**用 `import.meta.glob` 取 `.src`：`dist/_astro/` 的 webp 全是 `主幹.資產雜湊_轉換雜湊.webp` 兩段式轉換變體，未轉換原檔未被 emit，該路徑會讓 250 處內文圖全數 404（spec D2）。
- md 產物**不得**輸出 JSON-LD（spec D3）、**不得**曝光 `draft` 等內部欄位（spec R2）。
- md 變體不進 sitemap；`_headers` 對 md 路徑必須帶 `X-Robots-Tag: noindex`（spec D5、R5）。
- 修改 `public/_headers` 時，任何需要自訂 `Cache-Control` 的新規則都必須先寫 `! Cache-Control` 再設值，否則 Cloudflare Pages 會把 `/*` 的值與新值以逗號合併成兩組 `max-age`，瀏覽器取第一個等於新規則無效（該檔開頭已記載此陷阱）。
- 不得改動 `astro.config.mjs` 的 `vite.build.assetsInlineLimit: 0` 與 `cssCodeSplit: false`，兩者皆為 load-bearing。
- 單元測試檔必須放在 `scripts/lib/` 且以 `*.test.mjs` 結尾，否則不會被 `npm test` 的 glob 抓到。
- Commit 用 Conventional Commits，中文 subject 並帶 `(#33)`。
- 產生 commit message／PR body 一律用 bash heredoc（`-F -` / `--body-file -`），不得用 PowerShell here-string（`@'…'@`），否則字面 `@` 會混進訊息。
- 文章 frontmatter 的 schema 限制（title ≤ 60、description ≤ 160）由 zod 在 build 時強制，本次不得放寬。

---

### Task 1: markdown 匯出的純轉換函式

Implements: `agent-markdown.md` #R2, #R3

Files:
- Create: `scripts/lib/md-export.mjs`
- Test: `scripts/lib/md-export.test.mjs`

Interfaces:
- Consumes: 無（本 task 為葉節點）
- Produces:
  - `toYamlFrontmatter(fields: Record<string, string | string[] | Date | undefined>): string` — 回傳含前後 `---` 的 YAML 區塊，`undefined` 欄位略過
  - `buildImageUrlMap(html: string): Map<string, string>` — 從渲染後 HTML 建「檔名主幹 → `/_astro/…` 根相對網址」對照表
  - `rewriteImagePaths(body: string, imageUrls: Map<string, string>, origin: string): string` — 把 `./images/x.webp` 換成 `origin + 解析後網址`，找不到對應時 throw

Step 1: 寫失敗的測試

建立 `scripts/lib/md-export.test.mjs`：

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toYamlFrontmatter, buildImageUrlMap, rewriteImagePaths } from './md-export.mjs';

test('toYamlFrontmatter：字串以 JSON 逃逸輸出，全形冒號不破壞 YAML', () => {
  const yaml = toYamlFrontmatter({
    title: 'n8n x Telegram Bot：從 BotFather 到互動指令',
    description: '含「引號」與 : 冒號的描述',
  });
  assert.equal(
    yaml,
    '---\n' +
      'title: "n8n x Telegram Bot：從 BotFather 到互動指令"\n' +
      'description: "含「引號」與 : 冒號的描述"\n' +
      '---',
  );
});

test('toYamlFrontmatter：Date 輸出為純日期，陣列輸出為 flow sequence', () => {
  const yaml = toYamlFrontmatter({
    date: new Date('2026-01-04T00:00:00Z'),
    tags: ['n8n', 'Telegram'],
  });
  assert.equal(yaml, '---\ndate: 2026-01-04\ntags: ["n8n", "Telegram"]\n---');
});

test('toYamlFrontmatter：undefined 欄位整行略過，空陣列仍輸出', () => {
  const yaml = toYamlFrontmatter({ title: 'a', updated: undefined, tags: [] });
  assert.equal(yaml, '---\ntitle: "a"\ntags: []\n---');
});

test('buildImageUrlMap：從 img src 取出檔名主幹對應的建置網址', () => {
  const html =
    '<p><img src="/_astro/botfather-official-page.C7-xNNd-_Z2bLlVd.webp" alt="a"></p>' +
    '<p><img src="/_astro/create-bot-flow.BueJL9Xk_o7PA.webp" alt="b"></p>';
  const map = buildImageUrlMap(html);
  assert.equal(map.get('botfather-official-page'), '/_astro/botfather-official-page.C7-xNNd-_Z2bLlVd.webp');
  assert.equal(map.get('create-bot-flow'), '/_astro/create-bot-flow.BueJL9Xk_o7PA.webp');
  assert.equal(map.size, 2);
});

test('buildImageUrlMap：同一主幹有多個變體時取第一個出現的', () => {
  const html =
    '<img src="/_astro/cover.DVAoR-xQ_1aYFIQ.webp" srcset="/_astro/cover.DVAoR-xQ_ZzzRAt.webp 400w">';
  const map = buildImageUrlMap(html);
  assert.equal(map.get('cover'), '/_astro/cover.DVAoR-xQ_1aYFIQ.webp');
  assert.equal(map.size, 1);
});

test('rewriteImagePaths：相對路徑換成絕對網址，其餘內容不動', () => {
  const map = new Map([['step-one', '/_astro/step-one.AbCdEfGh_1x2y3z.webp']]);
  const body = '前言\n\n![步驟一](./images/step-one.webp)\n\n結語 https://example.com/x.webp';
  assert.equal(
    rewriteImagePaths(body, map, 'https://frankchen.tw'),
    '前言\n\n![步驟一](https://frankchen.tw/_astro/step-one.AbCdEfGh_1x2y3z.webp)\n\n結語 https://example.com/x.webp',
  );
});

test('rewriteImagePaths：對照表缺項時拋錯而非默默留下壞路徑', () => {
  assert.throws(
    () => rewriteImagePaths('![x](./images/missing.webp)', new Map(), 'https://frankchen.tw'),
    /missing/,
  );
});
```

Step 2: 跑測試確認失敗

Run: `npm test`
Expected: FAIL，訊息為 `Cannot find module ... md-export.mjs`

Step 3: 寫最小實作讓測試通過

建立 `scripts/lib/md-export.mjs`：

```js
/**
 * 文章 markdown 變體（/<slug>.md）的純轉換工具。
 *
 * 為什麼圖片網址要從「渲染後的 HTML」反推，而不是直接 import 圖檔：
 * Astro 的 image service 會把內文圖轉成 `主幹.資產雜湊_轉換雜湊.webp` 這種
 * 兩段式檔名的變體，未經轉換的原檔根本不會被 emit 到 dist。用 import.meta.glob
 * 取到的 `.src` 是單段雜湊的原檔網址，在 dist 裡不存在——250 處內文圖會全數 404。
 * 渲染一次 <Content/> 再從 HTML 抓 src，拿到的才是實際會被部署的那個網址。
 */

/** `/_astro/<主幹>.<雜湊>.<副檔名>`；主幹不含 `/`，避免比對越界到上一層路徑。 */
const ASTRO_ASSET_RE = /\/_astro\/([^"'\s?/]+?)\.[A-Za-z0-9_-]+\.(?:webp|png|jpe?g|avif|gif|svg)/g;

/** markdown 內指向同目錄 images/ 的相對引用。 */
const RELATIVE_IMAGE_RE = /\.\/images\/([^\s)"']+)/g;

/**
 * 依欄位型別輸出 YAML frontmatter。
 *
 * 字串一律走 JSON.stringify：站上標題大量使用全形冒號與引號，裸寫進 YAML 會在
 * 冒號處解析失敗；JSON 的雙引號字串恰好是合法的 YAML 雙引號純量，逃逸規則相容。
 *
 * @param {Record<string, string | string[] | Date | undefined>} fields
 * @returns {string}
 */
export function toYamlFrontmatter(fields) {
  const lines = ['---'];
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    if (value instanceof Date) {
      lines.push(`${key}: ${value.toISOString().slice(0, 10)}`);
    } else if (Array.isArray(value)) {
      lines.push(`${key}: [${value.map((v) => JSON.stringify(v)).join(', ')}]`);
    } else {
      lines.push(`${key}: ${JSON.stringify(value)}`);
    }
  }
  lines.push('---');
  return lines.join('\n');
}

/**
 * 從渲染後的 HTML 建「檔名主幹 → 建置後網址」對照表。
 *
 * 以主幹（不含雜湊與副檔名）當鍵而非出現順序：同一張圖在文中重複引用不會錯位。
 * 同主幹出現多次（例如 srcset 的多個尺寸）時取第一個，也就是 `src` 上那個預設候選。
 *
 * @param {string} html
 * @returns {Map<string, string>}
 */
export function buildImageUrlMap(html) {
  /** @type {Map<string, string>} */
  const map = new Map();
  for (const match of html.matchAll(ASTRO_ASSET_RE)) {
    if (!map.has(match[1])) map.set(match[1], match[0]);
  }
  return map;
}

/**
 * 把正文的相對圖片路徑換成絕對網址。
 *
 * 對照表缺項時直接拋錯：這代表某張圖沒有進 image pipeline，靜默留下壞路徑等於
 * 供應一份圖全掛的文件給 agent，寧可讓 build 當場失敗。
 *
 * @param {string} body 文章原始 markdown（不含 frontmatter）
 * @param {Map<string, string>} imageUrls
 * @param {string} origin 例如 https://frankchen.tw
 * @returns {string}
 */
export function rewriteImagePaths(body, imageUrls, origin) {
  return body.replace(RELATIVE_IMAGE_RE, (match, file) => {
    const stem = String(file).replace(/\.[^.]+$/, '');
    const resolved = imageUrls.get(stem);
    if (!resolved) {
      throw new Error(
        `markdown 匯出找不到 ${match} 對應的建置產物（檔名主幹「${stem}」不在 image pipeline 的輸出裡）`,
      );
    }
    return origin + resolved;
  });
}
```

Step 4: 跑測試確認通過

Run: `npm test`
Expected: PASS，總測試數為原本 26 加上本檔 7 項

Step 5: Commit

```bash
git add scripts/lib/md-export.mjs scripts/lib/md-export.test.mjs
git commit -F - <<'EOF'
feat(md-export): 加入 markdown 變體的純轉換函式與測試 (#33)

三支純函式，供 /<slug>.md 端點使用：
- toYamlFrontmatter：字串走 JSON.stringify 逃逸，全形冒號標題不會炸 YAML
- buildImageUrlMap：從渲染後 HTML 建「檔名主幹 → /_astro 網址」對照表
- rewriteImagePaths：改寫相對圖片路徑，對照表缺項直接拋錯不留壞連結

放 scripts/lib/ 是為了被既有 npm test 的 glob 涵蓋，不必為 TS 另接執行器。
EOF
```

---

### Task 2: `/<slug>.md` 靜態端點

Implements: `agent-markdown.md` #R1, #R2, #R3

Files:
- Create: `src/pages/[...slug].md.ts`

Interfaces:
- Consumes: `toYamlFrontmatter`、`buildImageUrlMap`、`rewriteImagePaths`，由 `scripts/lib/md-export.mjs` 匯出，簽名見 Task 1 的 Produces
- Produces: build 產物 `dist/<slug>.md`（35 支），供 Task 3 的 llms.txt 宣告、Task 4 的 `_headers` 規則與 Task 5 的 verify:seo 斷言對照

Step 1: 建立端點

建立 `src/pages/[...slug].md.ts`：

```ts
import type { APIRoute, GetStaticPaths } from 'astro';
import type { CollectionEntry } from 'astro:content';
import { getCollection, render } from 'astro:content';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { loadRenderers } from 'astro:container';
import { SITE } from '../utils/site-meta';
import {
  buildImageUrlMap,
  rewriteImagePaths,
  toYamlFrontmatter,
} from '../../scripts/lib/md-export.mjs';

/**
 * 文章的 markdown 變體，給 AI agent 直接取用（見 docs/specs/agent-markdown.md）。
 *
 * 正文原樣輸出，只改寫圖片路徑——程式碼區塊、表格、標題階層都保持原始 markdown，
 * 這正是「原生 md」相對於通用 HTML→MD 轉換器的品質優勢。
 */
export const getStaticPaths: GetStaticPaths = async () => {
  const posts = await getCollection('posts', ({ data }) => !data.draft);
  return posts.map((post) => ({ params: { slug: post.id }, props: { post } }));
};

// container 建一次就好：35 條路徑共用，逐篇重建只是重複付出載入 renderer 的成本。
let containerPromise: Promise<AstroContainer> | undefined;
function getContainer(): Promise<AstroContainer> {
  containerPromise ??= loadRenderers([]).then((renderers) => AstroContainer.create({ renderers }));
  return containerPromise;
}

export const GET: APIRoute = async ({ props }) => {
  const { post } = props as { post: CollectionEntry<'posts'> };

  // 渲染真正的 <Content/>：內文圖經 image pipeline 解析為 /_astro/<雜湊>.webp，
  // 這是唯一拿得到「實際會被部署的那個圖片網址」的途徑（見 md-export.mjs 檔頭）。
  const { Content } = await render(post);
  const container = await getContainer();
  const html = await container.renderToString(Content);

  const body = rewriteImagePaths(post.body ?? '', buildImageUrlMap(html), SITE.url);

  // 白名單：draft 等內部欄位不輸出。image 用 OG 圖而非文章封面——CF 的規格本就
  // 從 og:image 抽這個欄位，且封面在文章頁是四尺寸 srcset，要複製那套解析得多接
  // 一層 image service 呼叫，OG 圖則是固定路徑。
  const frontmatter = toYamlFrontmatter({
    title: post.data.title,
    description: post.data.description,
    date: post.data.date,
    updated: post.data.updated,
    category: post.data.category,
    tags: post.data.tags,
    canonical: `${SITE.url}/${post.id}/`,
    image: `${SITE.url}/og/${post.id}.png`,
  });

  return new Response(`${frontmatter}\n\n${body}\n`, {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
};
```

Step 2: 建置

Run: `npm run build`
Expected: build 成功，結尾顯示頁數由 104 增加為 139（多出 35 支 md）

Step 3: 確認產物數量與草稿未外流

Run: `ls dist/*.md | wc -l && ls dist/test-markdown-rendering.md 2>&1 | tail -1`
Expected: 第一行為 `35`；第二行為找不到檔案的錯誤訊息（`test-markdown-rendering` 是唯一的草稿，不該有 md）

Step 4: 確認圖片已絕對化且指向真實產物

Run:
```bash
grep -c "https://frankchen.tw/_astro/" dist/n8n-telegram-bot-notification-tutorial.md && \
grep -c "\./images/" dist/n8n-telegram-bot-notification-tutorial.md; \
node -e "const fs=require('fs');const t=fs.readFileSync('dist/n8n-telegram-bot-notification-tutorial.md','utf8');const m=[...t.matchAll(/https:\/\/frankchen\.tw(\/_astro\/[^\s)\"']+)/g)];const bad=m.filter(x=>!fs.existsSync('dist'+x[1]));console.log('圖片引用',m.length,'壞連結',bad.length)"
```
Expected: 第一個 `grep -c` 印出大於 0 的數字；第二個 `grep -c` 印出 `0` 並以非零狀態結束（grep 找不到即回 1，屬預期）；node 那行印出 `圖片引用 <n> 壞連結 0`

Step 5: 確認 frontmatter 可被 YAML 解析

Run:
```bash
node -e "const m=require('gray-matter');const fs=require('fs');const g=require('glob');let n=0;for(const f of g.globSync('dist/*.md')){const d=m(fs.readFileSync(f,'utf8')).data;if(!d.title||!d.canonical||!d.image||d.draft!==undefined)throw new Error(f);n++}console.log('frontmatter 全數可解析且欄位正確：',n)"
```
Expected: `frontmatter 全數可解析且欄位正確： 35`

Step 6: Commit

```bash
git add src/pages/'[...slug].md.ts'
git commit -F - <<'EOF'
feat(agent-markdown): 每篇非草稿文章輸出 /<slug>.md 變體 (#33)

新增靜態端點 src/pages/[...slug].md.ts，getStaticPaths 與文章頁同源，
draft 自動不產。內容為文章原始 markdown，只改寫圖片路徑，程式碼區塊、
表格、標題階層原樣保留。

frontmatter 走白名單（title/description/date/updated/category/tags/
canonical/image），不輸出 draft 等內部欄位，也不附 JSON-LD——frontmatter
已帶同樣的欄位，再附一份 BlogPosting 等於重複計費，而這個功能的意義就是省 token。

圖片沿用 RSS 的 Container API 路徑（pre-launch-infra D9）：渲染 <Content/>
後從 HTML 反推「檔名主幹 → /_astro 網址」。不能改用 import.meta.glob 取 .src，
那會指向未被 emit 的單段雜湊原檔，250 處內文圖會全數 404。
EOF
```

---

### Task 3: 發現管道（llms.txt 宣告 + HTML alternate 連結）

Implements: `agent-markdown.md` #R4；`pre-launch-infra.md` MODIFIED #R6

Files:
- Modify: `src/pages/llms.txt.ts:23-50`（`lines` 陣列的「主要頁面」段之前插入說明段）、`src/pages/llms.txt.ts:56-60`（逐篇輸出加 md 網址）
- Modify: `src/layouts/BaseLayout.astro:15-51`（Props 與解構）、`src/layouts/BaseLayout.astro:183-188`（輸出 link 標籤）
- Modify: `src/pages/[...slug].astro:87-99`（傳入 markdownVariant）

Interfaces:
- Consumes: Task 2 產出的 `/<slug>.md` 路徑規則（文章網址去掉結尾斜線後加 `.md`）
- Produces: `dist/llms.txt` 內每篇文章附帶 `https://frankchen.tw/<slug>.md`；文章頁 HTML 內 `<link rel="alternate" type="text/markdown" href="/<slug>.md">`。Task 5 的 verify:seo 交叉比對這兩者

Step 1: llms.txt 加入 markdown 說明段

在 `src/pages/llms.txt.ts` 的 `lines` 陣列中，把「## 主要頁面」那段之前插入新段落。將原本這段：

```ts
    '',
    '## 主要頁面',
```

改為：

```ts
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
```

Step 2: llms.txt 逐篇附上 md 網址

將 `src/pages/llms.txt.ts` 中這段：

```ts
      lines.push(
        `- [${p.data.title}](${SITE.url}/${p.id}/): ${p.data.description}（發布日期：${formatDate(p.data.date)}）`,
      );
```

改為：

```ts
      lines.push(
        `- [${p.data.title}](${SITE.url}/${p.id}/): ${p.data.description}（發布日期：${formatDate(p.data.date)}；Markdown：${SITE.url}/${p.id}.md）`,
      );
```

Step 3: BaseLayout 支援 markdown 變體宣告

在 `src/layouts/BaseLayout.astro` 的 `interface Props` 內，於 `preloadImage` 欄位之後加入：

```ts
  /**
   * 該頁 markdown 變體的路徑（例如 `/some-slug.md`）。
   * 傳入才輸出 <link rel="alternate" type="text/markdown">——只有文章有 md 變體，
   * 其餘頁面沒有對應產物，亂宣告等於給 agent 一個 404。
   */
  markdownVariant?: string;
```

在下方的解構中，把：

```ts
  preloadImage,
} = Astro.props;
```

改為：

```ts
  preloadImage,
  markdownVariant,
} = Astro.props;
```

在 `<link rel="alternate" hreflang="x-default" href={canonicalURL.href} />` 之後加入：

```astro
    {markdownVariant && (
      <link rel="alternate" type="text/markdown" href={markdownVariant} />
    )}
```

Step 4: 文章頁傳入變體路徑

在 `src/pages/[...slug].astro` 的 `<BaseLayout>` 開標籤內，於 `breadcrumbs={crumbs}` 之後加入：

```astro
  markdownVariant={`/${post.id}.md`}
```

Step 5: 建置並驗證兩條管道

Run:
```bash
npm run build && \
grep -c "Markdown：https://frankchen.tw/" dist/llms.txt && \
grep -o '<link rel="alternate" type="text/markdown" href="[^"]*"' dist/n8n-telegram-bot-notification-tutorial/index.html
```
Expected: `35`；以及 `<link rel="alternate" type="text/markdown" href="/n8n-telegram-bot-notification-tutorial.md"`

Step 6: 確認非文章頁沒有誤宣告

Run: `grep -l 'type="text/markdown"' dist/about/index.html dist/index.html 2>&1 | tail -1`
Expected: 沒有任何檔案被列出（grep 無結果並以非零狀態結束，屬預期）

Step 7: Commit

```bash
git add src/pages/llms.txt.ts src/layouts/BaseLayout.astro src/pages/'[...slug].astro'
git commit -F - <<'EOF'
feat(agent-markdown): llms.txt 與文章頁宣告 markdown 變體 (#33)

三條發現管道裡的後兩條（第一條是路徑慣例本身，不需程式碼）：
- llms.txt 新增「給 AI agent 的 Markdown 版本」段說明路徑規則，並在每篇
  文章條目末端附上該篇 md 網址
- BaseLayout 新增選用的 markdownVariant prop，傳入才輸出
  <link rel="alternate" type="text/markdown">；文章頁傳入，其餘頁面不傳，
  避免宣告出不存在的產物

llms.txt 的說明段刻意不寫完整範例網址：verify-seo 會把該檔內所有
https://frankchen.tw/*.md 視為宣告過的產物逐一比對，範例會被當成不存在的文章。
EOF
```

---

### Task 4: md 端點的回應標頭與線上驗證

Implements: `agent-markdown.md` #R5；`pre-launch-infra.md` MODIFIED #R8

Files:
- Modify: `public/_headers`（檔尾新增 `/*.md` 區塊）
- Modify: `scripts/verify-headers.mjs:228-256`（新增 `resolveMarkdownPath`）、`scripts/verify-headers.mjs:257-268`（掛上三項檢查）

Interfaces:
- Consumes: Task 2 產出的 `/<slug>.md` 路徑、Task 3 在 llms.txt 宣告的 md 網址（`resolveMarkdownPath` 從線上 llms.txt 取受測路徑）
- Produces: 無下游相依

Step 1: `_headers` 新增 md 規則

在 `public/_headers` 檔尾（`/rss.xml` 區塊之後）加入：

```
# 文章的 Markdown 變體（供 AI agent 取用，見 docs/specs/agent-markdown.md）。
# 快取與 HTML 頁面同一組：md 與 HTML 是同一份內容的兩個表示，新鮮度不該不一樣。
# 依本檔開頭記載的合併規則，這裡必須先 `! Cache-Control` 清掉 /* 的值再設回，
# 否則會變成 `max-age=600, must-revalidate, max-age=600...` 兩組 max-age。
#
# X-Robots-Tag: noindex 是防重複內容：/<slug>.md 與 /<slug>/ 內容相同，而 md 不是
# HTML、塞不了 <link rel="canonical">，frontmatter 的 canonical 欄位搜尋引擎也不認，
# 唯一表達得了的地方就是這個標頭。代價是 AI 搜尋爬蟲不會索引 md 版，但它們本來
# 就在抓 HTML 正本，兩條路不衝突。
/*.md
  ! Cache-Control
  Cache-Control: public, max-age=600, must-revalidate
  Content-Type: text/markdown; charset=utf-8
  X-Robots-Tag: noindex
```

Step 2: verify-headers 取得受測的 md 路徑

在 `scripts/verify-headers.mjs` 的 `resolveFontPath` 函式之後、`let failed = 0;` 之前，加入：

```js
/**
 * 從線上 llms.txt 取一個 md 變體路徑當受測對象。
 *
 * 為什麼不寫死某篇文章的 slug：文章可能改名或下架，寫死的路徑總有一天會 404，
 * 屆時看起來像標頭壞了，其實是檢查本身過期。從 llms.txt 取則永遠指向線上站
 * 當下真的有宣告的那批 md——順帶也驗證了「宣告管道確實存在」。
 */
async function resolveMarkdownPath() {
  let text;
  try {
    const res = await fetch(`${ORIGIN}/llms.txt`, { redirect: 'follow' });
    if (!res.ok) return { error: `llms.txt 請求回應 ${res.status}` };
    text = await res.text();
  } catch (err) {
    return { error: `llms.txt 請求失敗：${err.message}` };
  }
  const match = text.match(/https:\/\/[^\s)）]+\.md/);
  if (!match) return { error: 'llms.txt 未宣告任何 .md 變體網址' };
  try {
    return { path: new URL(match[0]).pathname };
  } catch {
    return { error: `llms.txt 宣告的 .md 網址無法解析：${match[0]}` };
  }
}
```

Step 3: 掛上三項檢查

在 `scripts/verify-headers.mjs` 中，把字型檢查那段之後、`for (const check of checks)` 迴圈之前，插入：

```js
const markdownPath = await resolveMarkdownPath();
if (markdownPath.path) {
  checks.push(
    {
      path: markdownPath.path,
      header: 'content-type',
      name: `Markdown 變體的 Content-Type（${markdownPath.path}）`,
      verify: (v) =>
        v?.toLowerCase().startsWith('text/markdown') ? null : `實際為 ${v ?? '（無）'}`,
    },
    {
      path: markdownPath.path,
      header: 'cache-control',
      name: 'Markdown 變體的快取與 HTML 一致',
      verify: (v) =>
        v === 'public, max-age=600, must-revalidate' ? null : `實際為 ${v ?? '（無）'}`,
    },
    {
      path: markdownPath.path,
      header: 'x-robots-tag',
      name: 'Markdown 變體帶 noindex（防重複內容收錄）',
      verify: (v) => (v?.toLowerCase().includes('noindex') ? null : `實際為 ${v ?? '（無）'}`),
    },
  );
} else {
  checks.push({
    path: '/llms.txt',
    name: '可從 llms.txt 取得 Markdown 變體路徑',
    staticProblem: markdownPath.error,
  });
}
```

Step 4: 對正式站執行，確認新檢查已接上且如預期尚未生效

Run: `npm run verify:headers`
Expected: 既有項目全 PASS；新增項目出現一行 `[FAIL] 可從 llms.txt 取得 Markdown 變體路徑`，原因為 `llms.txt 未宣告任何 .md 變體網址`。**這是正確的預期結果**——正式站尚未部署本分支，llms.txt 還是舊版。腳本以 exit 1 結束亦屬預期。

若要在部署前確認規則本身無誤，可對本地 preview 執行（`npm run preview` 後另開一個終端跑 `node scripts/verify-headers.mjs http://localhost:4321`）；但 Astro 的 preview server 不解析 `_headers`，標頭項仍會 FAIL，`_headers` 的真正驗證只能在部署後對正式站進行。

Step 5: Commit

```bash
git add public/_headers scripts/verify-headers.mjs
git commit -F - <<'EOF'
feat(agent-markdown): md 變體的回應標頭與線上驗證 (#33)

_headers 新增 /*.md：Content-Type: text/markdown; charset=utf-8、與 HTML
同組的短快取、X-Robots-Tag: noindex。依該檔開頭記載的合併陷阱，新規則先
`! Cache-Control` 清掉 /* 的值再設回，否則會產生兩組 max-age。

noindex 是防重複內容：/<slug>.md 與 /<slug>/ 內容相同，md 不是 HTML 塞不了
canonical link，只有標頭能表達。

verify-headers 新增三項對應檢查，受測路徑從線上 llms.txt 取第一個 md 網址而
非寫死 slug——文章改名時寫死的路徑會 404，看起來像標頭壞了其實是檢查過期。

註：CF Pages 的 _headers 是否支援 /*.md 這種副檔名萬用字元沒有實測依據，
部署後要看這三項的實際結果；若不支援，退路是改用 /md/<slug>.md 目錄形式。
EOF
```

---

### Task 5: 建置產物的靜態斷言與文件同步

Implements: `agent-markdown.md` #R1, #R2, #R3, #R4

Files:
- Modify: `scripts/verify-seo.mjs:13-17`（import 加 gray-matter）、`scripts/verify-seo.mjs:106-125`（蒐集 md 產物與來源草稿狀態）、`scripts/verify-seo.mjs` 檔尾「輸出報告」之前（新增六項檢查）
- Modify: `CLAUDE.md`（Routing 清單、Scripts 段、npm test 的測試數）

Interfaces:
- Consumes: Task 2 的 `dist/<slug>.md`、Task 3 的 `dist/llms.txt` 宣告
- Produces: 無下游相依

Step 1: verify-seo 加入 gray-matter

把 `scripts/verify-seo.mjs` 的：

```js
import { globSync } from 'glob';
import { XMLParser } from 'fast-xml-parser';
```

改為：

```js
import { globSync } from 'glob';
import { XMLParser } from 'fast-xml-parser';
import matter from 'gray-matter';
```

Step 2: 蒐集 md 產物與來源草稿狀態

在 `scripts/verify-seo.mjs` 的 `articlePathnames` 區塊之後、`const results = [];` 之前，加入：

```js
// ---------------------------------------------------------------------------
// Markdown 變體（agent-markdown spec）：產物與來源的草稿狀態
// ---------------------------------------------------------------------------

const mdBySlug = new Map(
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

const ORIGIN_RE_SOURCE = SITE_ORIGIN.replace(/\./g, '\\.');
const MD_ASSET_RE = new RegExp(`${ORIGIN_RE_SOURCE}(/_astro/[^\\s)"']+)`, 'g');
const MD_DECLARED_RE = new RegExp(`${ORIGIN_RE_SOURCE}/([^\\s)）]+)\\.md`, 'g');
const MD_REQUIRED_KEYS = ['title', 'description', 'date', 'category', 'tags', 'canonical', 'image'];
```

Step 3: 新增六項檢查

在 `scripts/verify-seo.mjs` 的「輸出報告」註解區塊之前，加入：

```js
// ---------------------------------------------------------------------------
// Markdown 變體
// ---------------------------------------------------------------------------

check('每篇非草稿文章都有對應的 .md 變體', (failures) => {
  for (const { id, draft } of sourcePosts) {
    if (draft) continue;
    if (!mdBySlug.has(id)) failures.push({ page: `/${id}.md`, reason: '缺少 markdown 變體' });
  }
});

check('草稿文章不得產出 .md 變體', (failures) => {
  for (const { id, draft } of sourcePosts) {
    if (draft && mdBySlug.has(id)) {
      failures.push({ page: `/${id}.md`, reason: '草稿不應輸出 markdown 變體' });
    }
  }
});

check('.md 變體不得殘留來源的相對圖片路徑', (failures) => {
  for (const [slug, text] of mdBySlug) {
    if (text.includes('./images/')) {
      failures.push({ page: `/${slug}.md`, reason: '仍含 ./images/ 相對路徑，agent 抓不到圖' });
    }
  }
});

// 這條是主防線：擋掉「圖片網址看起來對、實際指向沒被 emit 的檔案」這個
// 最容易復發的錯誤（改用 import.meta.glob 取 .src 就會全面觸發）。
check('.md 變體引用的建置資產都真的存在', (failures) => {
  for (const [slug, text] of mdBySlug) {
    for (const match of text.matchAll(MD_ASSET_RE)) {
      if (!existsSync(path.join(DIST, match[1]))) {
        failures.push({ page: `/${slug}.md`, reason: `引用的資產不存在：${match[1]}` });
      }
    }
  }
});

check('.md 變體的 frontmatter 可解析、欄位齊全且不外洩內部欄位', (failures) => {
  for (const [slug, text] of mdBySlug) {
    let data;
    try {
      ({ data } = matter(text));
    } catch (err) {
      failures.push({ page: `/${slug}.md`, reason: `frontmatter 解析失敗：${err.message}` });
      continue;
    }
    for (const key of MD_REQUIRED_KEYS) {
      if (data[key] === undefined) {
        failures.push({ page: `/${slug}.md`, reason: `frontmatter 缺少 ${key}` });
      }
    }
    if ('draft' in data) {
      failures.push({ page: `/${slug}.md`, reason: 'frontmatter 不應曝光 draft 欄位' });
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

check('llms.txt 宣告的 .md 連結與實際產物一一對應', (failures) => {
  const llmsPath = path.join(DIST, 'llms.txt');
  if (!existsSync(llmsPath)) {
    failures.push({ page: '/llms.txt', reason: '檔案不存在' });
    return;
  }
  const llms = readFileSync(llmsPath, 'utf8');
  const declared = new Set([...llms.matchAll(MD_DECLARED_RE)].map((m) => m[1]));
  for (const slug of mdBySlug.keys()) {
    if (!declared.has(slug)) failures.push({ page: '/llms.txt', reason: `未宣告 ${slug}.md` });
  }
  for (const slug of declared) {
    if (!mdBySlug.has(slug)) {
      failures.push({ page: '/llms.txt', reason: `宣告了不存在的 ${slug}.md` });
    }
  }
});
```

Step 4: 跑驗證確認全數通過

Run: `npm run build && npm run verify:seo`
Expected: 所有規則皆 `[PASS]`，結尾為「全數通過」，其中包含上面六項新規則

Step 5: 反向驗證新規則真的會攔截

暫時把 `src/pages/[...slug].md.ts` 的 `rewriteImagePaths(post.body ?? '', buildImageUrlMap(html), SITE.url)` 改成 `post.body ?? ''`（不改寫圖片路徑），然後：

Run: `npm run build && npm run verify:seo`
Expected: `[FAIL] .md 變體不得殘留來源的相對圖片路徑`（35 個問題）。確認後把該行改回原樣，重跑 `npm run build && npm run verify:seo` 確認回到全數通過。

Step 6: 同步 CLAUDE.md

先取得實際測試數：

Run: `npm test 2>&1 | grep -E "^# (tests|pass)"`
Expected: 印出 `# tests <n>` 與 `# pass <n>`，兩者相同

把 `CLAUDE.md` 的：

```
npm test           # 26 unit tests covering the WordPress migration toolchain (scripts/lib/)
```

改為（`<n>` 換成上一步印出的實際數字）：

```
npm test           # <n> unit tests covering scripts/lib/ (WordPress migration toolchain + markdown export)
```

把 Routing 清單中的：

```
- `/og/[...slug].png` — OG images generated at build time (satori + sharp)
```

改為：

```
- `/og/[...slug].png` — OG images generated at build time (satori + sharp)
- `/[...slug].md` — Markdown variant of every published post for AI agents (whitelisted frontmatter,
  absolute image URLs, `X-Robots-Tag: noindex`). See `docs/specs/agent-markdown.md`
```

把 Scripts 段的：

```
**Scripts:** `build-font-css` + `subset-fonts` (font pipeline, run by dev/build), `migrate-wp` +
`scripts/lib/*` (one-off WordPress WXR importer, the part under test), `build-manifest`, `verify-*`.
```

改為：

```
**Scripts:** `build-font-css` + `subset-fonts` (font pipeline, run by dev/build), `migrate-wp` +
`scripts/lib/*` (one-off WordPress WXR importer, the part under test), `scripts/lib/md-export.mjs`
(pure transforms behind `/[...slug].md`, also under test), `build-manifest`, `verify-*`.
```

Step 7: Commit

```bash
git add scripts/verify-seo.mjs CLAUDE.md
git commit -F - <<'EOF'
test(agent-markdown): verify:seo 加六條 md 變體斷言並同步 CLAUDE.md (#33)

全部讀 dist/：
- 非草稿文章數與 .md 數相等、草稿不得有 md
- md 內不得殘留 ./images/
- md 引用的 /_astro/ 資產在 dist 裡真的存在
- frontmatter 可解析、必要欄位齊全、不外洩 draft、canonical 值正確
- llms.txt 宣告的 md 連結與實際產物一一對應

第四條是主防線，直接擋掉「網址看起來對、實際指向沒被 emit 的檔案」——
改用 import.meta.glob 取 .src 就會全面觸發。已反向驗證：拿掉端點的圖片改寫
後重建，第三條如期 FAIL 並列出 35 個問題。

CLAUDE.md 同步 Routing 清單、Scripts 段與測試數。
EOF
```

---

## 部署後待辦（不屬於本計畫的 task，merge 後執行）

1. 對正式站跑 `npm run verify:headers`，確認 `/*.md` 的三項標頭檢查轉為 PASS。若 Content-Type 或 noindex 未生效，代表 CF Pages 的 `_headers` 不支援副檔名萬用字元，退路是把端點改為 `/md/<slug>.md` 目錄形式以取得可用的 `/md/*` 規則（設計文件已記載此退路）。
2. 一段時間後從 CF Analytics 觀察 `/*.md` 的請求數與 user agent，作為是否補做內容協商（設計文件的方案二）的依據。
