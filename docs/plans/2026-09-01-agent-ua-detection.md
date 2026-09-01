# agent UA 偵測（第一階段）Implementation Plan

Goal: 在既有的 `functions/_middleware.js` 加一條即時取用型 agent 的 UA 白名單判斷，命中時只加 `x-agent-detected` 標頭並把 `User-Agent` 併進 `Vary`，其餘行為完全不變。

Architecture: UA 判斷做成「裝飾既有出口」而非新增控制流分支——在既有的「這是不是頁面」閘門之後算一次 `detectAgent(request)`，把既有的 `withVaryOnAccept(response)` 改寫成 `withVaryAndDetection(response, agent)`，四條出口的內容一字不動、只有標頭多兩項。連帶把 `functions/` 納入型別檢查（範圍化的 `functions/tsconfig.json`，不動根 tsconfig），並新增一支對執行中站台發真實請求的驗證腳本。

Tech Stack: Cloudflare Pages Functions（JavaScript + JSDoc）、`@cloudflare/workers-types`（純型別 devDependency）、TypeScript `checkJs`、Node 內建 `fetch`（驗證腳本）、wrangler（`npm run preview:pages`）

Spec: `docs/specs/agent-markdown.md`（`## Pending Changes` 的 R12、D17-D19、S13-S15）

Design: `docs/plans/2026-09-01-agent-ua-detection-design.md`

Context: 專案無 `CONTEXT.md`

## Global Constraints

以下每一條都是專案級硬約束，每個 task 的需求隱含包含本節。

- **不得新增 `wrangler.toml`**。Pages 專案一旦有設定檔，Cloudflare 會拿它當建置與執行設定的唯一來源、蓋掉後台設定。這也是本案不用 `wrangler types` 產生型別、改用 `@cloudflare/workers-types` 的原因。
- **`astro preview` 不執行 Pages Functions**。任何要驗證 middleware 的動作一律用 `npm run preview:pages`（wrangler，port 8788），且必須先 `npm run build`。
- **`public/_headers` 這次一個字都不改**。若日後有人在本案範圍內想改它：一律整檔 Write 不做字串手術（它是 CF 累加式匹配，同標頭多條規則命中會逗號串接而瀏覽器只認第一個），且改 CSP 必須同步改 `scripts/verify-headers.mjs` 的 `EXPECTED_CSP_DIRECTIVES`（那支刻意不自動解析）。本次不動 CSP，所以 `EXPECTED_CSP_DIRECTIVES` 不需同步。
- **`public/_routes.json` 這次不改**。它的排除清單（`/_astro/*`、`/fonts/*`、`/og/*`、`/samples/*`）是「哪些路徑根本不進 Worker」的唯一來源；middleware 內只管「進來了的請求裡哪些是頁面」，兩邊不重疊，不得在 Function 內重複維護一份路徑排除清單（spec D19）。
- **不得直接呼叫 `getCollection('posts')`**，一律走 `src/utils/posts.ts`。（本案不碰 content collection，列此為完整性。）
- **驗證腳本一律不寫死文章 slug**。文章會改名或下架，寫死的路徑遲早 404，屆時看起來像功能壞了、其實是檢查本身過期。比照 `scripts/verify-headers.mjs` 與 `scripts/verify-negotiation.mjs`，從線上 `llms.txt` 的第一個 `.md` 網址回推。
- **`src/pages/llms.txt.ts` 前段不得新增完整的 `.md` 範例網址**。`verify-headers.mjs`、`verify-negotiation.mjs` 與本案新增的 `verify-agent-ua.mjs` 三支都取「llms.txt 第一個 `.md` 網址」當受測文章，前段補一個 `/index.md` 之類的連結會讓三支同時報假紅燈。
- **零行為變更是本階段的硬條件**（spec R12）。命中與否都不得改變回應的狀態碼、內容與 `Content-Type`；既有 Accept 協商契約（R11、MODIFIED R5、情境 S10-S12）在任何 UA 下皆須維持原行為。
- **白名單只收即時取用型**（`Claude-User`、`ChatGPT-User`、`Perplexity-User`），不得收 `Claude-SearchBot`、`OAI-SearchBot` 等索引型（spec D18）。
- **不做第二階段的 307 重導**。本次範圍只到偵測與標頭為止。
- 語言：所有程式碼註解、腳本輸出、commit message 一律正體中文（台灣用語）。註解寫「為什麼」不寫「做什麼」，比照 `functions/_middleware.js` 與 `scripts/verify-*.mjs` 的既有密度。
- Lighthouse 分數在 CI 上擺幅可超過 20 分，紅燈先重跑、連續兩次才查根因（本案不影響效能，列此以免誤判）。

---

### Task 1: functions/ 的型別防線

Implements: `agent-markdown.md` #R12（前置：讓 R12 的實作從出生就被型別檢查守住）

Files:
- Create: `functions/tsconfig.json`
- Modify: `package.json`（devDependency + script）
- Modify: `functions/_middleware.js`（只加 JSDoc，不改任何執行邏輯）
- Modify: `.github/workflows/seo-pr.yml`（新增一個 step）

Interfaces:
- Produces: npm script `check:functions`（`tsc --noEmit -p functions/tsconfig.json`），Task 2 會再跑一次；`functions/_middleware.js` 內的 `MiddlewareContext` typedef，Task 2 沿用

背景（執行者需要知道的既有狀況，已實測）：
- `npx tsc --noEmit` 目前 exit 0，但那是因為根 tsconfig 沒開 `checkJs`——`.js` 檔只被載入不被檢查。
- 全域加 `--checkJs` 會噴 361 個錯，其中只有 7 個在 `functions/`，其餘散在 `astro.config.mjs` 與 `scripts/**`。所以不能動根 tsconfig，要範圍化。
- `scripts/lib/md-path.mjs`（被 middleware import）在 `checkJs` 下是乾淨的，會隨 import 進入程式，不需要改它。
- 根 `tsconfig.json` 目前只有一行 `extends: "astro/tsconfigs/strict"`。Astro base 的 `include` 用 `${configDir}`，在 `functions/tsconfig.json` extends 之後會解析成 `functions/`，範圍剛好就是要的，不必自己重寫 `include`。

Step 1: 安裝型別套件

Run:
```
npm install --save-dev @cloudflare/workers-types@^5.20260901.1
```

Expected: `package.json` 的 `devDependencies` 出現 `"@cloudflare/workers-types": "^5.20260901.1"`，`package-lock.json` 同步更新。這是純型別套件，沒有 runtime 產物，不會進 Worker bundle。

Step 2: 建立 `functions/tsconfig.json`

```json
{
  "extends": "../tsconfig.json",
  "compilerOptions": {
    "checkJs": true,
    "lib": ["ES2022"],
    "types": ["@cloudflare/workers-types"]
  }
}
```

三個選項各自的理由，寫進 commit message 而非檔案（tsconfig 不支援註解以外的說明，而 JSON with comments 在此不必要）：
- `checkJs`：根 tsconfig 不能開（全域 361 錯），範圍化到 `functions/` 只需處理 7 個。
- `lib: ["ES2022"]`：不設的話 TS 會依 `target: ESNext` 自動帶進 `lib.dom`，`Response`／`Headers` 會同時來自 DOM 與 workers-types 而打架；拿掉 DOM 之後，用到 `document`／`window` 這類 Worker 沒有的全域也會被擋下。
- `types`：只載入 workers-types，不自動吃 `node_modules/@types/**`。

Step 3: 為 `functions/_middleware.js` 補 JSDoc（不改執行邏輯）

3a. 在 `import { pagePathToMdPath } from '../scripts/lib/md-path.mjs';` 這行之後、`estimateTokens` 的註解區塊之前，插入一段空行與 typedef：

```js
/**
 * 這支中介層實際用到的 context 欄位。
 *
 * 刻意不用 workers-types 的 `PagesFunction<Env>`：那個名稱跨大版本未必穩定，而本檔
 * 只用得到 context 的三個欄位，寫成 typedef 反而把「這支到底依賴什麼」講清楚了。
 * `Request`／`Response`／`Fetcher` 這幾個核心型別才是從 workers-types 來的。
 *
 * @typedef {{
 *   request: Request,
 *   next: () => Promise<Response>,
 *   env: { ASSETS: Fetcher },
 * }} MiddlewareContext
 */
```

3b. `estimateTokens` 的註解區塊結尾補參數。把

```js
 * 粗略係數，讓 agent 有個量級可以決定要不要抓全文。CF 原生方案的同名標頭一樣是估算值。
 */
function estimateTokens(text) {
```

改成

```js
 * 粗略係數，讓 agent 有個量級可以決定要不要抓全文。CF 原生方案的同名標頭一樣是估算值。
 *
 * @param {string} text
 * @returns {number}
 */
function estimateTokens(text) {
```

3c. `wantsMarkdown` 目前沒有註解區塊。把

```js
function wantsMarkdown(request) {
```

改成

```js
/**
 * @param {Request} request
 * @returns {boolean}
 */
function wantsMarkdown(request) {
```

（只要 `request` 有型別，函式內 `part`、`p` 三個 callback 參數會自動推導成 `string`，不必逐一標註。）

3d. `withVaryOnAccept` 的註解區塊結尾補參數。把

```js
 * 逐一比對既有值而不是無條件 append：重複 append 會讓標頭在多次經手後累積成
 * `Accept, Accept, Accept`。
 */
function withVaryOnAccept(response) {
```

改成

```js
 * 逐一比對既有值而不是無條件 append：重複 append 會讓標頭在多次經手後累積成
 * `Accept, Accept, Accept`。
 *
 * @param {Response} response
 * @returns {Response}
 */
function withVaryOnAccept(response) {
```

3e. `onRequest` 目前沒有註解區塊。把

```js
export const onRequest = async (context) => {
```

改成

```js
/** @param {MiddlewareContext} context */
export const onRequest = async (context) => {
```

Step 4: 加 npm script

在 `package.json` 的 `scripts` 中，`"test"` 那一行之後加入：

```json
    "check:functions": "tsc --noEmit -p functions/tsconfig.json",
```

Step 5: 跑型別檢查確認通過

Run: `npm run check:functions`
Expected: 無輸出、exit 0

Step 6: 證明這道檢查真的看得到那支檔案（防止 include 範圍寫錯而形同虛設）

暫時把 Step 3c 加的整個註解區塊刪掉（只留 `function wantsMarkdown(request) {`），再跑：

Run: `npm run check:functions`
Expected: FAIL，輸出含
```
functions/_middleware.js(??,??): error TS7006: Parameter 'request' implicitly has an 'any' type.
```

確認看到這行之後，把 Step 3c 的註解區塊加回去，再跑一次 `npm run check:functions` 確認回到 exit 0。

Step 7: 確認沒有波及根 tsconfig

Run: `npx tsc --noEmit`
Expected: 無輸出、exit 0（與動工前一致）

Step 8: 接進 CI

在 `.github/workflows/seo-pr.yml` 中，找到

```yaml
      - name: 單元測試（WP 遷移工具鏈）
        run: npm test

      - name: 建置
        run: npm run build
```

把它改成

```yaml
      - name: 單元測試（WP 遷移工具鏈）
        run: npm test

      # functions/ 的型別檢查。根 tsconfig 刻意沒開 checkJs——全域開會噴 361 個錯，
      # 其中只有 7 個在 functions/，其餘散在 astro.config.mjs 與 scripts/**。所以邊緣
      # 中介層的型別檢查是靠 functions/tsconfig.json 範圍化撐著，而範圍化的設定沒有
      # 東西會自動跑它。沒有這一步，那份設定形同不存在。
      # 位置與 npm test 同一個理由：fail fast，不必等 build 與 Lighthouse 跑完。
      - name: functions/ 型別檢查
        run: npm run check:functions

      - name: 建置
        run: npm run build
```

Step 9: Commit

```
git add package.json package-lock.json functions/tsconfig.json functions/_middleware.js .github/workflows/seo-pr.yml
git commit
```

commit message：
```
build(functions): 把 Pages Functions 納入型別檢查

根 tsconfig 沒開 checkJs，functions/_middleware.js 的型別檢查等於零
（實測 7 個 implicit any，含 request／context／response 三個核心參數）。
全域開 checkJs 會噴 361 個錯、其中只有 7 個在 functions/，所以改為
functions/tsconfig.json 範圍化：checkJs + lib 去掉 DOM + types 只吃
@cloudflare/workers-types。

不用 wrangler types 產型別——那要 wrangler.toml，會讓 CF 拿設定檔當
建置與執行設定的唯一來源並蓋掉後台。

npm run check:functions 接進 seo-pr.yml，位置在 npm test 之後 build 之前。
```

---

### Task 2: UA 偵測與驗證腳本

Implements: `agent-markdown.md` #R12, #D17, #D18, #D19, #S13, #S14, #S15

Files:
- Create: `scripts/verify-agent-ua.mjs`
- Modify: `functions/_middleware.js`
- Modify: `package.json`（script）
- Modify: `.github/workflows/seo-pr.yml`（新增一個 step）

Interfaces:
- Consumes: Task 1 的 `MiddlewareContext` typedef 與 `npm run check:functions`
- Produces: middleware 內的 `detectAgent(request): string | null` 與 `withVaryAndDetection(response, agent): Response`（後者取代 Task 1 標註過的 `withVaryOnAccept(response)`）；npm script `verify:agent-ua`

背景（執行者需要知道的既有控制流）：`functions/_middleware.js` 的 `onRequest` 有四條出口——(1) 非 GET/HEAD 直接 `next()`；(2) `pagePathToMdPath(url.pathname) === null`（不是頁面）直接 `next()`；(3) `!wantsMarkdown(request)` 走 `withVaryOnAccept(await next())`；(4) Accept 命中 markdown 時回 md 產物（找不到產物時退回 (3)）。UA 判斷只作用於 (3)(4)，(1)(2) 維持原樣——靜態資產與 `.md` 路徑本身連 UA 標頭都不必讀，也不得帶 `x-agent-detected`。

Step 1: 寫失敗的測試——新增 `scripts/verify-agent-ua.mjs`

```js
/**
 * 驗證即時取用型 agent 的 UA 偵測（見 docs/specs/agent-markdown.md R12、情境 S13-S15）。
 *
 * 為什麼需要這支：偵測邏輯活在 Cloudflare Pages Functions 裡，`astro preview` 不執行它，
 * `verify:seo` 只看 dist 的靜態產物。而它壞掉的方式是靜默的——標頭沒出現，站台看起來
 * 完全正常。
 *
 * 反向斷言與正向斷言同等重要：判準寫太寬的退化同樣靜默（站台功能完全正常，只是每位
 * 讀者的每個頁面回應都多背一個標頭，還會把索引型爬蟲一起認成即時取用型）。
 *
 * 用法：
 *   node scripts/verify-agent-ua.mjs                      # 檢查 https://frankchen.tw
 *   node scripts/verify-agent-ua.mjs http://localhost:8788 # 檢查本機 wrangler
 *
 * 任一項不符即 exit 1。
 */

const ORIGIN = (process.argv[2] ?? 'https://frankchen.tw').replace(/\/$/, '');

/**
 * 白名單：即時取用型 agent（spec D18）。第二欄是命中時 `x-agent-detected` 應回的名稱。
 *
 * UA 字串取各家公開文件的長相，重點在中段的 `<名稱>/<版本>` 那一節——判準綁的是那個，
 * 前後綴不影響命中。
 */
const ALLOWED = [
  [
    'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Claude-User/1.0; +claude-user@anthropic.com)',
    'Claude-User',
  ],
  [
    'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ChatGPT-User/1.0; +https://openai.com/bot)',
    'ChatGPT-User',
  ],
  [
    'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Perplexity-User/1.0; +https://perplexity.ai/perplexity-user)',
    'Perplexity-User',
  ],
];

/**
 * 明確不該命中的 UA。
 *
 * 索引型（SearchBot 類）是這一組的重點：第二階段會把命中者導向帶 `X-Robots-Tag: noindex`
 * 的 `/<slug>.md`，把它們認進來等於自斷收錄（spec D18）。最後一條是判準本身的邊界——
 * `Claude-UserAgent` 只是前綴相同，正規式結尾若少了版本斜線就會誤中。
 */
const REJECTED = [
  [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
    '瀏覽器',
  ],
  ['curl/8.7.1', '一般 HTTP 客戶端'],
  [
    'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Claude-SearchBot/1.0; +claude-searchbot@anthropic.com)',
    'Claude-SearchBot（索引型）',
  ],
  [
    'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; OAI-SearchBot/1.0; +https://openai.com/searchbot)',
    'OAI-SearchBot（索引型）',
  ],
  ['Mozilla/5.0 (compatible; Claude-UserAgent/1.0)', '只是前綴相同的 UA'],
];

const AGENT_UA = ALLOWED[0][0];

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

function varyTokens(res) {
  return (res.headers.get('vary') ?? '')
    .split(',')
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * 從線上 llms.txt 取一篇真實文章的 md 變體路徑，推回它的 HTML 網址。
 *
 * 不寫死 slug 的理由與 scripts/verify-negotiation.mjs 的同名函式完全相同：文章可能
 * 改名或下架，寫死遲早 404，屆時看起來像偵測壞了、其實是檢查本身過期。
 *
 * 取「第一個」.md 網址的前提也一樣——llms.txt 前段刻意不寫出完整的 .md 範例網址，
 * 所以第一個必然落在文章清單裡。改 src/pages/llms.txt.ts 前段時要一併看本檔、
 * verify-negotiation.mjs 與 verify-headers.mjs 三支。
 */
async function resolveArticlePath() {
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
  let mdPath;
  try {
    mdPath = new URL(match[0]).pathname;
  } catch {
    return { error: `llms.txt 宣告的 .md 網址無法解析：${match[0]}` };
  }
  return { mdPath, htmlPath: mdPath.replace(/\.md$/, '/') };
}

const checks = [];

const article = await resolveArticlePath();

if (article.htmlPath) {
  for (const [ua, name] of ALLOWED) {
    checks.push({
      name: `${name} 命中且行為不變（${article.htmlPath}）`,
      run: async () => {
        const { res, error } = await get(article.htmlPath, { 'User-Agent': ua });
        if (error) return error;
        const problems = [];
        if (res.status !== 200) problems.push(`狀態碼 ${res.status}`);
        // 零行為變更（spec R12）：命中不得改變回應型別。
        if (!contentType(res).startsWith('text/html')) {
          problems.push(`Content-Type 為 ${contentType(res) || '（無）'}，應仍是 HTML`);
        }
        const detected = res.headers.get('x-agent-detected');
        if (detected !== name) problems.push(`x-agent-detected 為 ${detected ?? '（無）'}`);
        const vary = varyTokens(res);
        if (!vary.includes('accept')) problems.push(`Vary 缺 Accept（實際 ${vary.join(', ') || '（無）'}）`);
        if (!vary.includes('user-agent')) {
          problems.push(`Vary 缺 User-Agent（實際 ${vary.join(', ') || '（無）'}）`);
        }
        return problems.length ? problems.join('｜') : null;
      },
    });
  }

  for (const [ua, label] of REJECTED) {
    checks.push({
      name: `${label} 不命中（${article.htmlPath}）`,
      run: async () => {
        const { res, error } = await get(article.htmlPath, { 'User-Agent': ua });
        if (error) return error;
        const problems = [];
        const detected = res.headers.get('x-agent-detected');
        if (detected) problems.push(`不應有 x-agent-detected，實際為 ${detected}`);
        const vary = varyTokens(res);
        if (vary.includes('user-agent')) {
          problems.push(`Vary 不應含 User-Agent，實際為 ${vary.join(', ')}`);
        }
        // 反向斷言不能只驗「沒有多的東西」——既有的 Vary: Accept 也不能被這次改動弄丟。
        if (!vary.includes('accept')) problems.push(`Vary 缺 Accept（實際 ${vary.join(', ') || '（無）'}）`);
        return problems.length ? problems.join('｜') : null;
      },
    });
  }

  // 作用範圍：只有頁面路徑會被偵測（spec R12、D19）。這幾個路徑都不以斜線結尾，
  // pagePathToMdPath 回傳 null，中介層應在讀 UA 之前就已放行。
  for (const path of ['/favicon.png', '/llms.txt', '/sitemap.xml', article.mdPath]) {
    checks.push({
      name: `非頁面路徑不被偵測（${path}）`,
      run: async () => {
        const { res, error } = await get(path, { 'User-Agent': AGENT_UA });
        if (error) return error;
        const detected = res.headers.get('x-agent-detected');
        if (detected) return `不應有 x-agent-detected，實際為 ${detected}`;
        if (varyTokens(res).includes('user-agent')) {
          return `Vary 不應含 User-Agent，實際為 ${res.headers.get('vary')}`;
        }
        return null;
      },
    });
  }

  checks.push({
    // 這一條守的是 spec D17：偵測若寫成 early-return 分支而不是裝飾，同時送
    // Accept: text/markdown 的 agent 會從拿到 markdown 退回拿到 HTML。
    name: `命中 agent 時既有的 Accept 協商契約不變（${article.htmlPath}）`,
    run: async () => {
      const { res, body, error } = await get(article.htmlPath, {
        'User-Agent': AGENT_UA,
        Accept: 'text/markdown',
      });
      if (error) return error;
      const problems = [];
      if (res.status !== 200) problems.push(`狀態碼 ${res.status}`);
      if (res.redirected) problems.push('回應經由重導向達成（應在原網址完成）');
      if (!contentType(res).startsWith('text/markdown')) {
        problems.push(`Content-Type 為 ${contentType(res) || '（無）'}`);
      }
      // 協商回應走正規網址，帶 noindex 等於對頁面本體下架（spec D14）。
      if (res.headers.get('x-robots-tag')) {
        problems.push(`不應有 X-Robots-Tag，實際為 ${res.headers.get('x-robots-tag')}`);
      }
      if (!body.startsWith('---')) problems.push('內容未以 YAML frontmatter 開頭');
      if (res.headers.get('x-agent-detected') !== 'Claude-User') {
        problems.push(`x-agent-detected 為 ${res.headers.get('x-agent-detected') ?? '（無）'}`);
      }
      return problems.length ? problems.join('｜') : null;
    },
  });
} else {
  // 靜默跳過等於這一整批斷言不存在——解析失敗要明確算一項 FAIL，而不是少印幾行。
  checks.push({ name: '可從 llms.txt 取得文章頁路徑（供全部斷言使用）', run: async () => article.error });
}

let failed = 0;
console.log(`檢查來源：${ORIGIN}\n`);

for (const check of checks) {
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
    'UA 偵測在 functions/_middleware.js。本機要重現需以 wrangler 執行（npm run preview:pages），' +
      'astro preview 不會執行 Pages Functions。',
  );
  process.exit(1);
}
console.log('全部符合預期。');
```

Step 2: 加 npm script

在 `package.json` 的 `scripts` 中，`"verify:negotiation"` 那一行之後加入：

```json
    "verify:agent-ua": "node scripts/verify-agent-ua.mjs"
```

（注意 `"verify:negotiation"` 目前是 `scripts` 物件的最後一項、沒有結尾逗號，加新項時要補上。）

Step 3: 跑測試確認失敗

Run:
```
npm run build
npm run preview:pages
```
另開一個終端機：
```
npm run verify:agent-ua http://localhost:8788
```

Expected: FAIL。三條 ALLOWED 斷言都因 `x-agent-detected 為（無）` 與 `Vary 缺 User-Agent` 而紅，最後那條協商斷言也因 `x-agent-detected 為（無）` 而紅；REJECTED 與非頁面路徑那幾條會綠（現在還沒有任何東西會加那個標頭）。exit 1。

Step 4: 寫最小實作

4a. 在 `functions/_middleware.js` 中，於 `estimateTokens` 函式之後、`wantsMarkdown` 之前插入白名單與偵測函式：

```js
/**
 * 即時取用型 AI agent 的 UA 白名單（spec R12、D18）。
 *
 * 只放代使用者即時抓取的 agent。刻意不放 Claude-SearchBot／OAI-SearchBot 這類索引型：
 * 它們是為了建索引而來，而第二階段會把命中者導向帶 X-Robots-Tag: noindex 的
 * /<slug>.md，等於自斷收錄。honestmc-website 有一份 12 個 AI 代理的白名單，但那份是
 * 為「被索引」設計的，目的相反——名單可以參考，用途不可照抄。
 *
 * 正規式結尾的 `\/` 綁的是版本斜線（實際 UA 長相為 `Claude-User/1.0`）。少了它，
 * `Claude-UserAgent` 這種只是前綴相同的字串也會命中。
 */
const AGENT_UA = [
  { name: 'Claude-User', pattern: /Claude-User\//i },
  { name: 'ChatGPT-User', pattern: /ChatGPT-User\//i },
  { name: 'Perplexity-User', pattern: /Perplexity-User\//i },
];

/**
 * 認出請求是不是白名單內的即時取用型 agent。
 *
 * 回傳命中的名稱而非整串 UA：x-agent-detected 要回答的只有「是誰」，把請求者送來的
 * 原始字串原封回顯出去沒有必要。
 *
 * @param {Request} request
 * @returns {string | null} 命中的 agent 名稱，未命中為 null
 */
function detectAgent(request) {
  const ua = request.headers.get('user-agent');
  if (!ua) return null;
  return AGENT_UA.find(({ pattern }) => pattern.test(ua))?.name ?? null;
}
```

4b. 把 `withVaryOnAccept` 整個函式（含其註解區塊，即 Task 1 改完後從 `/**` 到 `}` 的整段）換成：

```js
/**
 * 統一收尾：合併 Vary，並在命中白名單 agent 時標記 x-agent-detected（spec R12）。
 *
 * 兩種回應都要帶 `Vary: Accept`：Cloudflare 邊緣對 Accept-Encoding 以外的 Vary 不做快取
 * 分流，但這個標頭的對象是瀏覽器與中間層快取——同一個客戶端先後以不同 Accept 取同一個
 * 網址時，沒有 Vary 就會拿到快取裡的另一種表示。命中 agent 時再加 User-Agent，同理。
 *
 * 逐一比對既有值而不是無條件 append：重複 append 會讓標頭在多次經手後累積成
 * `Accept, Accept, Accept`；而整個 set 掉又會蓋掉 asset 回應可能已帶的 Accept-Encoding。
 *
 * UA 偵測做成「裝飾既有出口」而不是新增一條分支，是為了守住 R12 的零行為變更：若命中
 * 就 early-return next()，一個同時送 Accept: text/markdown 的 agent 會從拿到 markdown
 * 退回拿到 HTML（spec D17）。
 *
 * @param {Response} response
 * @param {string | null} agent detectAgent() 的結果
 * @returns {Response}
 */
function withVaryAndDetection(response, agent) {
  const headers = new Headers(response.headers);
  const existing = headers.get('Vary');
  const values = existing ? existing.split(',').map((v) => v.trim().toLowerCase()) : [];
  if (!values.includes('*')) {
    const missing = (agent ? ['Accept', 'User-Agent'] : ['Accept']).filter(
      (token) => !values.includes(token.toLowerCase()),
    );
    if (missing.length > 0) {
      headers.set('Vary', existing ? `${existing}, ${missing.join(', ')}` : missing.join(', '));
    }
  }
  if (agent) headers.set('x-agent-detected', agent);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
```

4c. 在 `onRequest` 內，把

```js
  const pageMdPath = pagePathToMdPath(url.pathname);
  if (pageMdPath === null) return next();

  if (!wantsMarkdown(request)) return withVaryOnAccept(await next());
```

改成

```js
  const pageMdPath = pagePathToMdPath(url.pathname);
  if (pageMdPath === null) return next();

  // UA 偵測放在「這是不是頁面」閘門之後：靜態資產、.md 路徑本身與 404.html 連 UA 標頭
  // 都不必讀，也不得帶 x-agent-detected（spec R12 的作用範圍與 R11 相同）。
  const agent = detectAgent(request);

  if (!wantsMarkdown(request)) return withVaryAndDetection(await next(), agent);
```

4d. 把 `onRequest` 內剩下兩處 `withVaryOnAccept(...)` 補上第二個引數：

```js
  if (!asset.ok) return withVaryOnAccept(await next());
```
改成
```js
  if (!asset.ok) return withVaryAndDetection(await next(), agent);
```

以及檔案最後一行的

```js
  return withVaryOnAccept(new Response(body, { status: 200, headers }));
```
改成
```js
  return withVaryAndDetection(new Response(body, { status: 200, headers }), agent);
```

4e. 更新 `withVaryOnAccept` 在 `onRequest` 內註解中的名稱。把

```js
  // Vary 交給 withVaryOnAccept() 統一合併，不在這裡直接 set：asset.headers 可能已帶
```
改成
```js
  // Vary 交給 withVaryAndDetection() 統一合併，不在這裡直接 set：asset.headers 可能已帶
```

Step 5: 跑型別檢查

Run: `npm run check:functions`
Expected: 無輸出、exit 0

Step 6: 跑測試確認通過

先停掉 Step 3 開著的 wrangler，重新建置並啟動（`preview:pages` 服務的是 `dist/`，但 `functions/` 是即時讀取；為求乾淨仍重跑一次 build）：

```
npm run build
npm run preview:pages
```
另開終端機：
```
npm run verify:agent-ua http://localhost:8788
```
Expected: PASS，全部斷言綠燈、exit 0

Step 7: 確認既有協商 12 項沒被打破

同一個 wrangler 仍開著：
```
npm run verify:negotiation http://localhost:8788
```
Expected: 全部 PASS、exit 0（與動工前完全相同）

Step 8: 接進 CI

在 `.github/workflows/seo-pr.yml` 檔尾，把

```yaml
      - name: 驗證 Accept 內容協商
        run: npm run verify:negotiation http://localhost:8788
```

改成

```yaml
      - name: 驗證 Accept 內容協商
        run: npm run verify:negotiation http://localhost:8788

      # 與上一步同一個理由：UA 偵測也活在 Pages Functions 裡，前面的步驟一個都碰不到它。
      # 這支的反向斷言（瀏覽器 UA、索引型 SearchBot、只是前綴相同的 UA 都不得命中）
      # 比正向斷言更重要——判準寫寬的退化是靜默的。
      - name: 驗證 agent UA 偵測
        run: npm run verify:agent-ua http://localhost:8788
```

Step 9: Commit

```
git add functions/_middleware.js scripts/verify-agent-ua.mjs package.json .github/workflows/seo-pr.yml
git commit
```

commit message：
```
feat(functions): 偵測即時取用型 agent 的 UA（第一階段）

命中 Claude-User／ChatGPT-User／Perplexity-User 時加 x-agent-detected
並把 User-Agent 併進 Vary，其餘一律照舊。零行為變更，不做 307。

做成裝飾既有出口而不是新增分支：若命中就 early-return next()，同時送
Accept: text/markdown 的 agent 會從拿到 markdown 退回拿到 HTML。
withVaryOnAccept 因此改名 withVaryAndDetection 並多收一個 agent 參數，
未命中時的行為與改動前逐字等價。

不放 SearchBot 類——第二階段會導向帶 noindex 的 .md，把索引型認進來
等於自斷收錄。

路徑範圍沿用既有的 pagePathToMdPath 閘門，不另立 SKIP_PATH：那條會與
public/_routes.json 的排除清單重複維護，而且涵蓋得比既有閘門還少。

新增 scripts/verify-agent-ua.mjs 並接進 seo-pr.yml 的 wrangler 那一段。
```

---

### Task 3: verify-headers 的反向斷言

Implements: `agent-markdown.md` #R12（反向要求：非白名單 UA 的回應不得出現 `x-agent-detected`）

Files:
- Modify: `scripts/verify-headers.mjs`

Interfaces:
- Consumes: Task 2 上線後的 `x-agent-detected` 行為
- Produces: 無（純斷言）

為什麼要有這一條，而不是靠 Task 2 的腳本就好：`verify-agent-ua.mjs` 在 PR CI 上打的是本機 wrangler，那裡沒有 zone 層規則；`verify-headers.mjs` 是打正式站、進每日排程的那一支，抓得到 zone 的 Transform Rules 意外注入標頭這類本機看不到的狀況。理由與該檔既有的「字型檔不得帶 `Link`」反向斷言同構。

Step 1: 加入斷言

在 `scripts/verify-headers.mjs` 的 `CHECKS` 陣列中，找到最後一項（`/about/` 的 Link 檢查）：

```js
  {
    path: '/about/',
    header: 'link',
    name: '內頁的 Link 標頭（不含首頁專屬的 /index.md）',
    verify: verifyLinks(EXPECTED_LINKS_SITE_WIDE),
  },
];
```

改成

```js
  {
    path: '/about/',
    header: 'link',
    name: '內頁的 Link 標頭（不含首頁專屬的 /index.md）',
    verify: verifyLinks(EXPECTED_LINKS_SITE_WIDE),
  },
  // 反向斷言：x-agent-detected 只該出現在白名單內的即時取用型 agent 的回應上
  // （docs/specs/agent-markdown.md R12）。本腳本用 Node 的預設 fetch 發請求，
  // 不在白名單裡，所以這裡出現該標頭只有兩種可能：middleware 的 UA 判準寫太寬，
  // 或 zone 層有規則在注入標頭。兩種都該紅。
  //
  // 正向斷言在 scripts/verify-agent-ua.mjs，但那支在 PR CI 上打的是本機 wrangler，
  // 那裡沒有 zone 層規則；本檔是打正式站、進每日排程的那一支。理由與上方
  // 「靜態資產不帶 Link 標頭」那條反向斷言同構——少了它，判準寫寬的退化會是靜默的：
  // 站台功能完全正常，只是每位讀者的每個頁面回應都多背一個標頭。
  {
    path: '/',
    header: 'x-agent-detected',
    name: '一般請求不帶 x-agent-detected（UA 判準未寫寬）',
    verify: (v) => (v ? `不應有 x-agent-detected，實際為 ${v}` : null),
  },
];
```

Step 2: 對正式站跑一次確認綠燈

Run: `npm run verify:headers`
Expected: 新增的那一項 `[PASS] 一般請求不帶 x-agent-detected（UA 判準未寫寬）`，其餘各項與動工前相同（`HTML 有 ETag 或 Last-Modified` 仍是 `[已知例外]`，不計入失敗），exit 0

注意：此時 Task 2 尚未部署到正式站，所以這一項在正式站上必然是綠的。它真正的價值在 Task 2 上線之後——那時若判準寫寬，隔天的日檢就會紅。

Step 3: 對本機 wrangler 跑一次，確認在 Task 2 已生效的環境下也綠

wrangler 仍需開著（`npm run build` + `npm run preview:pages`）：

Run: `npm run verify:headers http://localhost:8788`
Expected: `一般請求不帶 x-agent-detected（UA 判準未寫寬）` 為 PASS。

本機環境沒有 zone 層規則，`_headers` 由 wrangler 套用，所以其他項目未必全綠（例如 HSTS、CSP 在正式站可能被 zone 調整過）——**這一步只看新增的那一項**，其餘不符不算本 task 的失敗，也不要為了讓它們變綠而改動任何既有斷言。

Step 4: Commit

```
git add scripts/verify-headers.mjs
git commit
```

commit message：
```
test(verify-headers): 加 x-agent-detected 的反向斷言

正向斷言在 verify-agent-ua.mjs，但那支在 PR CI 上打本機 wrangler，
沒有 zone 層規則。本檔打正式站、進每日排程，補上「一般請求不得帶
x-agent-detected」這一條，才抓得到判準寫寬或 zone 注入標頭。

理由與既有的「靜態資產不帶 Link 標頭」同構：判準寫寬的退化是靜默的
——站台功能完全正常，只是每位讀者的每個頁面回應都多背一個標頭。
```

---

## 本次不做（範圍外，已在設計文件記錄）

- **第二階段的 307 重導**。等 UA 確實出現且 Vary 分流雙向實測通過才做。屆時的優先序是 Accept 優先於 UA（設計文件有完整理由）。
- **接 sink 累積長期 UA 統計**（n8n webhook 或寫進 `analytics` db 的 cf schema）。Free 方案的 `httpRequestsAdaptiveGroups` 只查得到 1 天是既有限制，本案不處理。
- **`public/_headers` 與 `public/_routes.json` 的任何改動**。
- **把 `detectAgent` 抽成 `scripts/lib/` 的純函式模組並加單元測試**。`md-path.mjs` 之所以住在那裡是因為它有三個消費端；`detectAgent` 只有一個，抽出去只是多一個檔案。它的邊界行為（`Claude-UserAgent` 不得命中）由 `verify-agent-ua.mjs` 的 REJECTED 那組守住。

## 上線後才做得完的收尾（不在本次 task 內）

1. **Claude 對 frankchen.tw 送什麼 UA**：站主在 Claude 對話裡貼一個自家文章網址讓 `web_fetch` 打一次，當天用 CF GraphQL 的 `httpRequestsAdaptiveGroups` 查那一分鐘的 UA（Free 方案只留 1 天）。
2. **Vary 分流雙向實測**：merge 上線後在**正式站**跑，不是 `npm run preview:pages`（本機 workerd 沒有邊緣快取層，兩個方向都會假綠燈）。瀏覽器先／agent 先各一輪。
3. **回寫文件**：vault `20-Side/astro-blog/agent-md-UA分流方案_20260730.md` 的 frontmatter `status` 更新，補「第一階段已上線」與 Vary 實測結果，並更正該檔第 97 行的「新建 `functions/_middleware.ts`」與「第一階段換到可觀測訊號」兩處；專案 MEMORY 的 open issues 同步。
4. **spec 併入**：`docs/specs/agent-markdown.md` 的 `## Pending Changes` 在上線且實測完成後併進正文。
