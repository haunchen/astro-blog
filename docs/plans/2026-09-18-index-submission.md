# 索引提交自動化 Implementation Plan

Goal: 文章新上線或內容更新後，自動透過 IndexNow 通知搜尋引擎。

Architecture: 純函式層（`scripts/lib/indexnow.mjs`）負責判定該送什麼、換算網址、解析 sitemap、組
payload，全部進 `npm test`；CLI 層（`scripts/submit-indexnow.mjs`）負責 git、輪詢線上 sitemap 確認
部署完成、POST 到 IndexNow。兩個 GitHub Actions 觸發點：一般 push 到 main，以及排程翻牌之後。

Tech Stack: Node 原生 `fetch` 與 `node --test`、`gray-matter`、`fast-xml-parser`、GitHub Actions。

Spec: `docs/specs/index-submission.md`

Design: `docs/plans/2026-09-18-index-submission-design.md`

## Global Constraints

- 正規網域是非 www：`https://frankchen.tw`。任何產出的網址一律非 www（CLAUDE.md 慣例）。
- 預期 lastmod 的計算規則必須與 `astro.config.mjs` 的 `POST_LASTMOD` 完全一致：
  `new Date(data.updated ?? data.date).toISOString()`。兩處漂移的症狀是輪詢逾時。
- `scripts/lib/*.mjs` 的測試檔一律命名 `*.test.mjs`，由 `npm test`（`node --test "scripts/lib/*.test.mjs"`）
  收集。glob 雙引號不可拿掉——那是給 Node 展開的，改成裸目錄在 Windows 會失敗。
- 純函式層不得引入 Node 專用 I/O（`node:fs`、`child_process`）：它只做資料轉換，git 與網路留在 CLI。
- 沒有 linter；TypeScript strict，但 `scripts/` 不在 `npx astro check` 的涵蓋範圍。
- 註解用繁體中文，寫「為什麼」不寫「做什麼」，與既有 `scripts/lib/*.mjs` 同風格。
- GitHub 官方 action 一律追大版本 tag（`actions/checkout@v7`、`actions/setup-node@v7`），
  理由見 `.github/workflows/seo-pr.yml` 檔頭。
- 失敗一律紅燈：部署確認逾時、IndexNow 回應非 2xx（重試後仍失敗）都必須 `exit 1`，不得吞掉。
- 「無事可送」不是失敗：待送清單為空時以成功狀態結束。
- IndexNow 的 key 是公開值，直接寫在 repo，不得放進 GitHub Secrets。
- 本次選定的 key：`a7f3c9e2b8d4416fa0c5e7d92b1f6403`（32 位 hex，符合 IndexNow 的 8–128 字元要求）。
  key 檔名與檔案內容都是這個值，兩者不一致會讓提交回 403。
- spec 的 R7（Google 端不主動提交）**不需要任何程式碼**，滿足方式是整個功能不呼叫任何 Google
  API、不引入任何 GCP 憑證。沒有 task 引用它是正確的，理由見 design doc 的 D1。任何 task 若
  出現 Google Indexing API、Search Console API 或 service account 金鑰，即為違反本約束。

---

### Task 1: 判定該送什麼與網址換算

Implements: `index-submission.md` #R1

Files:
- Create: `scripts/lib/indexnow.mjs`
- Test: `scripts/lib/indexnow.test.mjs`

Interfaces:
- Consumes: 無
- Produces:
  - `postPathToUrl(file: string, origin: string): string | null`
  - `expectedLastmod(data: Record<string, unknown>): string | null`
  - `shouldSubmit(before: object | null, after: object | null): boolean`

Step 1: 寫失敗的測試

建立 `scripts/lib/indexnow.test.mjs`：

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { postPathToUrl, expectedLastmod, shouldSubmit } from './indexnow.mjs';

const ORIGIN = 'https://frankchen.tw';

test('postPathToUrl：目錄型文章換算成帶結尾斜線的正規網址', () => {
  assert.equal(
    postPathToUrl('src/content/posts/my-post/index.md', ORIGIN),
    'https://frankchen.tw/my-post/',
  );
});

// astro.config.mjs 的 POST_LASTMOD 兩種形狀都認，這裡跟著認，否則哪天新增一篇平鋪
// 檔就會靜靜地不送。
test('postPathToUrl：平鋪型文章同樣換算得出', () => {
  assert.equal(
    postPathToUrl('src/content/posts/my-post.md', ORIGIN),
    'https://frankchen.tw/my-post/',
  );
});

// git 在 Windows 上仍回正斜線，但本機直接呼叫時可能拿到反斜線路徑。
test('postPathToUrl：反斜線路徑正常換算', () => {
  assert.equal(
    postPathToUrl('src\\content\\posts\\my-post\\index.md', ORIGIN),
    'https://frankchen.tw/my-post/',
  );
});

test('postPathToUrl：非文章路徑與非 md 檔回 null', () => {
  assert.equal(postPathToUrl('src/pages/about.astro', ORIGIN), null);
  assert.equal(postPathToUrl('src/content/posts/my-post/cover.png', ORIGIN), null);
  assert.equal(postPathToUrl('docs/specs/index-submission.md', ORIGIN), null);
});

// 規則必須與 astro.config.mjs 的 POST_LASTMOD 一致：updated 優先，缺席才用 date。
test('expectedLastmod：有 updated 時以 updated 為準', () => {
  assert.equal(
    expectedLastmod({ date: new Date('2026-09-01'), updated: new Date('2026-09-18') }),
    '2026-09-18T00:00:00.000Z',
  );
});

test('expectedLastmod：沒有 updated 時落回 date', () => {
  assert.equal(expectedLastmod({ date: new Date('2026-09-01') }), '2026-09-01T00:00:00.000Z');
});

// gray-matter 對裸日期給 Date、對加引號的值給字串，兩種都要吃。
test('expectedLastmod：字串日期同樣解析得出', () => {
  assert.equal(expectedLastmod({ date: '2026-09-01' }), '2026-09-01T00:00:00.000Z');
});

test('expectedLastmod：無法解析時回 null', () => {
  assert.equal(expectedLastmod({}), null);
  assert.equal(expectedLastmod({ date: 'not-a-date' }), null);
});

test('shouldSubmit：新增的非草稿文章要送', () => {
  assert.equal(shouldSubmit(null, { date: new Date('2026-09-18') }), true);
});

test('shouldSubmit：草稿翻牌要送', () => {
  assert.equal(
    shouldSubmit({ draft: true, date: new Date('2026-09-18') }, { date: new Date('2026-09-18') }),
    true,
  );
});

test('shouldSubmit：updated 改變要送', () => {
  assert.equal(
    shouldSubmit(
      { date: new Date('2026-09-01') },
      { date: new Date('2026-09-01'), updated: new Date('2026-09-18') },
    ),
    true,
  );
});

// 錯字與排版修正本來就不該動 updated，也就不該告訴搜尋引擎內容變了。
test('shouldSubmit：只改內文而 updated 沒動的不送', () => {
  const fm = { date: new Date('2026-09-01'), updated: new Date('2026-09-10') };
  assert.equal(shouldSubmit({ ...fm }, { ...fm }), false);
});

// 草稿的網址根本不存在，送出去等於叫搜尋引擎去抓 404。
test('shouldSubmit：仍是草稿的一律不送', () => {
  assert.equal(shouldSubmit(null, { draft: true, date: new Date('2026-09-18') }), false);
  assert.equal(
    shouldSubmit({ draft: true, date: new Date('2026-09-18') }, { draft: true, updated: new Date('2026-09-18') }),
    false,
  );
});

test('shouldSubmit：被刪除的文章不送', () => {
  assert.equal(shouldSubmit({ date: new Date('2026-09-01') }, null), false);
});

// Date 與字串混用時不可因型別差異誤判成「有改動」。
test('shouldSubmit：updated 值等價但型別不同時不算改動', () => {
  assert.equal(
    shouldSubmit({ updated: '2026-09-10', date: '2026-09-01' }, { updated: new Date('2026-09-10'), date: '2026-09-01' }),
    false,
  );
});
```

Step 2: 跑測試確認失敗

Run: `node --test scripts/lib/indexnow.test.mjs`
Expected: FAIL（`Cannot find module './indexnow.mjs'`）

Step 3: 寫最小實作讓測試通過

建立 `scripts/lib/indexnow.mjs`：

```js
/**
 * IndexNow 提交的純函式：判定哪篇該送、換算網址、算預期 lastmod。
 *
 * 與 publish-scheduled.mjs、vault-post.mjs 同一個形狀——git 與網路留在 CLI，這裡只做資料
 * 轉換，才測得動。
 *
 * 設計文件：docs/plans/2026-09-18-index-submission-design.md
 */

/**
 * 文章檔案路徑 → 正規網址。
 *
 * id 的推導規則與 astro.config.mjs 的 POST_LASTMOD 逐字一致（去 base、去 /index.md 或 .md
 * 後綴）。兩邊若漂移，症狀是輪詢一個永遠不會出現在 sitemap 的網址而逾時——失敗方向安全，
 * 但仍然是白等十分鐘，所以規則刻意抄成一樣。
 *
 * 「逐字一致」也包含不替 `src/content/posts/index.md` 這種扁平檔加特例：那個形狀在 Astro
 * 眼中就是 id 為 `index` 的文章，不是首頁。站上 43 篇全是 `<slug>/index.md`，沒有這種檔，
 * 為它加一條規則只會讓兩邊的推導開始分岔。
 *
 * @param {string} file 相對於專案根的路徑，例如 `src/content/posts/my-post/index.md`
 * @param {string} origin 例如 `https://frankchen.tw`
 * @returns {string | null} 非文章檔案回 null
 */
export function postPathToUrl(file, origin) {
  if (typeof file !== 'string') return null;
  const normalized = file.replace(/\\/g, '/');
  if (!normalized.startsWith('src/content/posts/')) return null;
  if (!normalized.endsWith('.md')) return null;
  const id = normalized
    .replace(/^src\/content\/posts\//, '')
    .replace(/\/index\.md$/, '')
    .replace(/\.md$/, '');
  if (id === '') return null;
  return `${origin}/${id}/`;
}

/**
 * 把一個 frontmatter 日期值正規化成 ISO 字串。
 *
 * gray-matter 對裸日期給 Date、對加引號的值給字串，兩種都會出現在既有 43 篇裡。
 *
 * @param {unknown} raw
 * @returns {string | null}
 */
function toIso(raw) {
  if (raw === undefined || raw === null) return null;
  if (!(raw instanceof Date) && typeof raw !== 'string') return null;
  const d = raw instanceof Date ? raw : new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * 這篇在 sitemap 裡應該長什麼樣的 lastmod。
 *
 * 規則就是 astro.config.mjs 的 `new Date(data.updated ?? data.date)`。這個值是「部署完成了
 * 沒」的判據——比對線上 sitemap 的同名欄位。
 *
 * @param {Record<string, unknown>} data frontmatter 物件
 * @returns {string | null}
 */
export function expectedLastmod(data) {
  return toIso(data?.updated ?? data?.date);
}

/**
 * 這篇該不該送出索引提交。
 *
 * 判準是 frontmatter 而不是檔案 diff：錯字與排版修正本來就不該動 `updated`（見 CLAUDE.md
 * 的 changelog 紀律），也就不該告訴搜尋引擎內容變了。
 *
 * @param {Record<string, unknown> | null} before 上一版 frontmatter，新檔為 null
 * @param {Record<string, unknown> | null} after 現況 frontmatter，已刪除為 null
 * @returns {boolean}
 */
export function shouldSubmit(before, after) {
  if (after === null || after === undefined) return false;
  if (after.draft === true) return false;
  if (before === null || before === undefined) return true;
  if (before.draft === true) return true;
  // 型別正規化後再比：Date 與等價字串混用時直接比值會誤判成有改動。
  return toIso(before.updated) !== toIso(after.updated);
}
```

Step 4: 跑測試確認通過

Run: `node --test scripts/lib/indexnow.test.mjs`
Expected: PASS，15 tests

Step 5: Commit

```bash
git add scripts/lib/indexnow.mjs scripts/lib/indexnow.test.mjs
git commit -m "feat(indexnow): 該送的判定與網址換算純函式"
```

---

### Task 2: sitemap 解析與 payload 組裝

Implements: `index-submission.md` #R2, #R3

Files:
- Modify: `scripts/lib/indexnow.mjs`（追加兩個匯出，不動 Task 1 既有內容）
- Test: `scripts/lib/indexnow.test.mjs`（追加測試，不動既有測試）

Interfaces:
- Consumes: Task 1 的 `scripts/lib/indexnow.mjs`（同一個檔案，追加匯出）
- Produces:
  - `parseSitemapLastmods(xml: string): Map<string, string | null>`
  - `buildIndexNowPayload({ host: string, key: string, urls: string[] }): { host, key, keyLocation, urlList }`

Step 1: 寫失敗的測試

在 `scripts/lib/indexnow.test.mjs` **檔尾追加**（import 那行改成同時引入新函式）：

把檔首的 import 改為：

```js
import {
  postPathToUrl,
  expectedLastmod,
  shouldSubmit,
  parseSitemapLastmods,
  buildIndexNowPayload,
} from './indexnow.mjs';
```

檔尾追加：

```js
const SITEMAP_XML = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<url><loc>https://frankchen.tw/</loc></url>
<url><loc>https://frankchen.tw/my-post/</loc><lastmod>2026-09-18T00:00:00.000Z</lastmod></url>
<url><loc>https://frankchen.tw/other-post/</loc><lastmod>2026-09-01T00:00:00.000Z</lastmod></url>
</urlset>`;

test('parseSitemapLastmods：取出每個網址的 lastmod', () => {
  const map = parseSitemapLastmods(SITEMAP_XML);
  assert.equal(map.get('https://frankchen.tw/my-post/'), '2026-09-18T00:00:00.000Z');
  assert.equal(map.get('https://frankchen.tw/other-post/'), '2026-09-01T00:00:00.000Z');
});

// 沒有 lastmod 的節點要拿得到 null 而不是 undefined——呼叫端拿 undefined 分不出
// 「這個網址不在 sitemap 裡」與「在但沒有 lastmod」。
test('parseSitemapLastmods：缺 lastmod 的節點回 null', () => {
  assert.equal(parseSitemapLastmods(SITEMAP_XML).get('https://frankchen.tw/'), null);
});

test('parseSitemapLastmods：不存在的網址回 undefined', () => {
  assert.equal(parseSitemapLastmods(SITEMAP_XML).get('https://frankchen.tw/nope/'), undefined);
});

// fast-xml-parser 對單一節點不給陣列而給物件，不處理的話首篇文章上線那天會整個解析不到。
test('parseSitemapLastmods：只有一個 url 節點時仍解析得出', () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<url><loc>https://frankchen.tw/only/</loc><lastmod>2026-09-18T00:00:00.000Z</lastmod></url>
</urlset>`;
  assert.equal(parseSitemapLastmods(xml).get('https://frankchen.tw/only/'), '2026-09-18T00:00:00.000Z');
});

test('parseSitemapLastmods：空 urlset 回空 Map', () => {
  const xml = '<?xml version="1.0" encoding="UTF-8"?><urlset></urlset>';
  assert.equal(parseSitemapLastmods(xml).size, 0);
});

test('buildIndexNowPayload：keyLocation 指向站台根目錄的 key 檔', () => {
  const payload = buildIndexNowPayload({
    host: 'frankchen.tw',
    key: 'a7f3c9e2b8d4416fa0c5e7d92b1f6403',
    urls: ['https://frankchen.tw/my-post/'],
  });
  assert.deepEqual(payload, {
    host: 'frankchen.tw',
    key: 'a7f3c9e2b8d4416fa0c5e7d92b1f6403',
    keyLocation: 'https://frankchen.tw/a7f3c9e2b8d4416fa0c5e7d92b1f6403.txt',
    urlList: ['https://frankchen.tw/my-post/'],
  });
});
```

Step 2: 跑測試確認失敗

Run: `node --test scripts/lib/indexnow.test.mjs`
Expected: FAIL（`parseSitemapLastmods is not a function`）

Step 3: 寫最小實作讓測試通過

在 `scripts/lib/indexnow.mjs` 檔首加入 import（放在檔頭註解之後、`postPathToUrl` 之前）：

```js
import { XMLParser } from 'fast-xml-parser';
```

檔尾追加：

```js
/**
 * 解析 sitemap.xml，取出 loc → lastmod 的對照。
 *
 * `parseTagValue: false` 讓所有值維持字串：預設會嘗試把標籤內容轉成數字，而 lastmod 的
 * 比對是字串相等，型別一飄就永遠對不上。
 *
 * 缺 lastmod 的節點給 null 而非 undefined——呼叫端靠 `undefined` 分辨「這個網址還沒出現在
 * sitemap 裡」，兩者混在一起就判不出部署到底完成了沒。
 *
 * @param {string} xml
 * @returns {Map<string, string | null>}
 */
export function parseSitemapLastmods(xml) {
  const parsed = new XMLParser({ parseTagValue: false }).parse(xml);
  const nodes = parsed?.urlset?.url;
  // fast-xml-parser 對單一節點給物件而非陣列，全站只有一篇文章時會踩到。
  const list = Array.isArray(nodes) ? nodes : nodes ? [nodes] : [];
  const map = new Map();
  for (const node of list) {
    if (typeof node?.loc !== 'string') continue;
    map.set(node.loc, node.lastmod === undefined ? null : String(node.lastmod));
  }
  return map;
}

/**
 * 組出 IndexNow 的提交 body。
 *
 * keyLocation 明確給出而不是讓對方去猜：雖然放在根目錄時可以省略，寫出來才能在回 403 時
 * 一眼看出腳本以為金鑰在哪裡。
 *
 * @param {{ host: string, key: string, urls: string[] }} input
 * @returns {{ host: string, key: string, keyLocation: string, urlList: string[] }}
 */
export function buildIndexNowPayload({ host, key, urls }) {
  return {
    host,
    key,
    keyLocation: `https://${host}/${key}.txt`,
    urlList: urls,
  };
}
```

Step 4: 跑測試確認通過

Run: `node --test scripts/lib/indexnow.test.mjs`
Expected: PASS，21 tests

測試裡的 lastmod 字面值不是編的：2026-09-18 對線上 `https://frankchen.tw/sitemap.xml` 實跑過
這份解析，54 筆全部解得出，而且值的形狀確實是 `2026-09-18T00:00:00.000Z` 的字串——與
`expectedLastmod()` 的產出逐字相同。部署判據成立這件事在寫 CLI 之前就已驗證過。

Step 5: Commit

```bash
git add scripts/lib/indexnow.mjs scripts/lib/indexnow.test.mjs
git commit -m "feat(indexnow): sitemap lastmod 解析與 payload 組裝"
```

---

### Task 3: key 檔與 CLI

Implements: `index-submission.md` #R2, #R3, #R5, #R6

Files:
- Create: `public/a7f3c9e2b8d4416fa0c5e7d92b1f6403.txt`
- Create: `scripts/submit-indexnow.mjs`
- Modify: `package.json`（`scripts` 區塊加一行）

Interfaces:
- Consumes: Task 1、2 的 `scripts/lib/indexnow.mjs` — `postPathToUrl(file, origin)`、
  `expectedLastmod(data)`、`shouldSubmit(before, after)`、`parseSitemapLastmods(xml)`、
  `buildIndexNowPayload({ host, key, urls })`
- Produces: `node scripts/submit-indexnow.mjs --base <ref>` 這支 CLI，供 Task 4、5 的 workflow 呼叫

Out of scope（這個 task 刻意不做）：
- 不呼叫任何 Google API、不引入 GCP 憑證（Global Constraints 的 R7 約束）
- 不為這支 CLI 寫測試——git 與網路留在 CLI 層是刻意的分界，可測的邏輯都已在 Task 1、2
- 不抽 reusable workflow、不加 feature flag、不加 `--force` 之類的繞過開關

Step 1: 建立 key 檔

`public/a7f3c9e2b8d4416fa0c5e7d92b1f6403.txt`，內容是單一行（不加結尾換行以外的任何東西）：

```
a7f3c9e2b8d4416fa0c5e7d92b1f6403
```

檔名（去掉 `.txt`）與內容必須逐字相同，不一致 IndexNow 會回 403。

這個檔不需要任何 `_headers` 或 `_routes.json` 設定：`functions/_middleware.js` 對不以斜線結尾的
路徑會在 `pagePathToMdPath` 回 null 時直接 `next()`，內容協商攔不到它。

Step 2: 寫 CLI

建立 `scripts/submit-indexnow.mjs`：

```js
#!/usr/bin/env node
/**
 * IndexNow 提交：把這次新上線或內容有更新的文章網址通知搜尋引擎。
 *
 * 一次 POST，Bing、Yandex、Seznam、Naver 都會收到。Google 不在其中——它沒有給一般文章的
 * 官方提交路徑，理由見設計文件。
 *
 * 送出前會先等線上 sitemap 反映出新的 lastmod，確認 Cloudflare Pages 的部署真的完成了。
 * 不等的話，搜尋引擎收到通知馬上來抓，拿到的會是舊版或 404。
 *
 * 失敗一律 exit 1：壞掉的只是這一次通知，文章本身早就上線了，重跑 workflow 即可補送。
 *
 * 設計文件：docs/plans/2026-09-18-index-submission-design.md
 *
 * 用法：
 *   node scripts/submit-indexnow.mjs --base <ref>     比對 <ref>..HEAD 的文章變動並送出
 *   node scripts/submit-indexnow.mjs --base <ref> --dry-run   只印清單，不等部署也不送
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import matter from 'gray-matter';
import {
  postPathToUrl,
  expectedLastmod,
  shouldSubmit,
  parseSitemapLastmods,
  buildIndexNowPayload,
} from './lib/indexnow.mjs';

const ORIGIN = 'https://frankchen.tw';
const HOST = 'frankchen.tw';
const KEY = 'a7f3c9e2b8d4416fa0c5e7d92b1f6403';
const ENDPOINT = 'https://api.indexnow.org/IndexNow';

const POLL_INTERVAL_MS = 15_000;
const POLL_TIMEOUT_MS = 10 * 60_000;
/** 首次加三次重試。只對 429 與 5xx 生效。 */
const MAX_ATTEMPTS = 4;

const USAGE = `用法：
  node scripts/submit-indexnow.mjs --base <ref>            比對 <ref>..HEAD 並送出
  node scripts/submit-indexnow.mjs --base <ref> --dry-run  只印清單，不等部署也不送`;

function parseArgs(argv) {
  const args = { base: null, dryRun: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--base') args.base = argv[++i] ?? null;
    else if (a === '--dry-run') args.dryRun = true;
    else if (a === '--help' || a === '-h') args.help = true;
    else throw new Error(`未知參數：${a}`);
  }
  return args;
}

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
}

/**
 * 確認 base ref 在本地真的可解析。
 *
 * `github.event.before` 在 force push 之後可能指向一個已經不可達的物件，而 `git diff` 對
 * 未知 ref 的錯誤訊息跟「這個 ref 沒有那個檔案」長得很像。先驗一次，拿不到就退回 HEAD~1
 * 並明說——退回的結果最多是少送或多送一篇，但沉默的失敗會讓整條管線看起來是綠的。
 */
function resolveBase(base) {
  if (base) {
    try {
      git(['rev-parse', '--verify', `${base}^{commit}`]);
      return base;
    } catch {
      console.warn(`base ref 無法解析：${base}，退回 HEAD~1`);
    }
  }
  return 'HEAD~1';
}

/** 這次變動到的文章檔案。`--diff-filter=d` 排除刪除——被刪的文章沒有網址可送。 */
function changedPostFiles(base) {
  const out = git([
    'diff',
    '--name-only',
    '--diff-filter=d',
    base,
    'HEAD',
    '--',
    'src/content/posts',
  ]);
  return out
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.endsWith('.md'));
}

/** 上一版的 frontmatter。檔案在 base 不存在（新增）時回 null。 */
function frontmatterAt(ref, file) {
  let raw;
  try {
    raw = git(['show', `${ref}:${file}`]);
  } catch {
    return null;
  }
  return matter(raw).data;
}

/** 工作區現況的 frontmatter。 */
function frontmatterNow(file) {
  if (!fs.existsSync(file)) return null;
  return matter(fs.readFileSync(file, 'utf8')).data;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 抓線上 sitemap。
 *
 * 帶 cache-busting query 與 no-cache：不破快取的話可能整整十分鐘都在讀 Cloudflare 邊緣的
 * 同一份舊副本，然後逾時紅燈——而部署其實早就好了。
 */
async function fetchSitemap() {
  const res = await fetch(`${ORIGIN}/sitemap.xml?cb=${Date.now()}`, {
    headers: { 'Cache-Control': 'no-cache' },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`抓取 sitemap 失敗：HTTP ${res.status}`);
  return res.text();
}

/**
 * 等到線上 sitemap 的 lastmod 與預期相符。
 *
 * 判據不用「網址回 200」：更新既有文章時舊版本同樣回 200，判不出新版上線沒。lastmod 一條
 * 規則同時涵蓋新文章與更新兩種情況。
 */
async function waitForDeployment(targets) {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  let pending = targets;
  for (;;) {
    const lastmods = parseSitemapLastmods(await fetchSitemap());
    pending = pending.filter((t) => lastmods.get(t.url) !== t.lastmod);
    if (pending.length === 0) return;
    if (Date.now() >= deadline) {
      const lines = pending.map((t) => `  ! ${t.url}　預期 lastmod ${t.lastmod}`).join('\n');
      throw new Error(`等待部署逾時（${POLL_TIMEOUT_MS / 60_000} 分鐘），未送出：\n${lines}`);
    }
    console.log(`等待部署……仍有 ${pending.length} 篇未反映到 sitemap`);
    await sleep(POLL_INTERVAL_MS);
  }
}

/**
 * 送出。
 *
 * 2xx 皆視為成功，202 也算——那只代表 key 還在驗證佇列裡，提交本身已經收下。
 * 429 與 5xx 是暫時性，指數退避重試；400／403／422 是打錯了，重試沒有意義。
 */
async function submit(payload) {
  let delay = 2_000;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(payload),
    });
    if (res.ok) return res.status;
    const retryable = res.status === 429 || res.status >= 500;
    if (!retryable || attempt === MAX_ATTEMPTS) {
      const body = await res.text().catch(() => '');
      throw new Error(`IndexNow 提交失敗：HTTP ${res.status} ${body}`.trim());
    }
    console.warn(`IndexNow 回 ${res.status}，${delay / 1000} 秒後重試（第 ${attempt} 次）`);
    await sleep(delay);
    delay *= 2;
  }
}

function writeSummary(lines) {
  const file = process.env.GITHUB_STEP_SUMMARY;
  if (!file) return;
  fs.appendFileSync(file, `${lines.join('\n')}\n`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(USAGE);
    return;
  }

  const base = resolveBase(args.base);
  const files = changedPostFiles(base);
  console.log(`比對 ${base}..HEAD，文章檔案變動 ${files.length} 個`);

  const targets = [];
  for (const file of files) {
    const url = postPathToUrl(file, ORIGIN);
    if (url === null) continue;
    const after = frontmatterNow(file);
    if (!shouldSubmit(frontmatterAt(base, file), after)) continue;
    const lastmod = expectedLastmod(after);
    if (lastmod === null) {
      // schema 要求 date 必填，走到這裡代表 frontmatter 形狀出乎預期。不能當成「沒事」
      // 跳過——那篇正是這次要通知的文章。
      throw new Error(`算不出預期 lastmod（缺 date？）：${file}`);
    }
    targets.push({ url, lastmod });
  }

  if (targets.length === 0) {
    console.log('沒有需要送出的文章');
    writeSummary(['## IndexNow', '- 結果：沒有需要送出的文章']);
    return;
  }

  console.log(`待送 ${targets.length} 篇：`);
  for (const t of targets) console.log(`  + ${t.url}`);

  if (args.dryRun) {
    console.log('dry-run，未等待部署也未送出');
    return;
  }

  await waitForDeployment(targets);
  const status = await submit(
    buildIndexNowPayload({ host: HOST, key: KEY, urls: targets.map((t) => t.url) }),
  );
  console.log(`已送出，IndexNow 回 HTTP ${status}`);
  writeSummary([
    '## IndexNow',
    `- 結果：已送出 ${targets.length} 篇（HTTP ${status}）`,
    ...targets.map((t) => `  - ${t.url}`),
  ]);
}

main().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
```

Step 3: 加 npm script

在 `package.json` 的 `scripts` 區塊，`"publish:scheduled"` 那行之後加一行：

```json
    "submit:indexnow": "node scripts/submit-indexnow.mjs",
```

Step 4: 跑 dry-run 確認整條路徑接得起來

Run: `npm run submit:indexnow -- --base HEAD~1 --dry-run`
Expected: 印出「比對 HEAD~1..HEAD，文章檔案變動 0 個」與「沒有需要送出的文章」，exit 0。
（目前分支上的 commit 都只動 `docs/`，所以清單為空是正確結果。）

Step 5: 跑既有測試確認沒破壞既有行為

Run: `npm test`
Expected: PASS，全部測試綠

Step 6: Commit

```bash
git add public/a7f3c9e2b8d4416fa0c5e7d92b1f6403.txt scripts/submit-indexnow.mjs package.json
git commit -m "feat(indexnow): key 檔與提交 CLI"
```

---

### Task 4: push 觸發的 workflow

Implements: `index-submission.md` #R4

Files:
- Create: `.github/workflows/indexnow.yml`

Interfaces:
- Consumes: Task 3 的 `node scripts/submit-indexnow.mjs --base <ref>`
- Produces: 無（終端消費者）

Step 1: 建立 workflow

建立 `.github/workflows/indexnow.yml`：

```yaml
name: IndexNow 提交

# paths 限文章目錄：元件、樣式、設定的改動不會改變任何文章的 lastmod，送出去只會消耗
# 提交端的信任度。branches 限 main 是因為只有 main 會部署到線上，而這支腳本會去比對線上
# sitemap——在別的分支跑必然逾時。
on:
  push:
    branches: [main]
    paths:
      - 'src/content/posts/**'

# 不取消進行中的：這支會花上幾分鐘等部署，被後一次 push 取消掉的話前一批網址就永遠沒送。
concurrency:
  group: ${{ github.workflow }}
  cancel-in-progress: false

jobs:
  submit:
    runs-on: ubuntu-latest

    steps:
      # 官方 action 追大版本 tag 的理由見 seo-pr.yml 檔頭，不在這裡重複。
      #
      # fetch-depth: 0 是必要的——預設只抓一個 commit，`git show <before>:<file>` 會直接
      # 失敗，於是每一篇都被當成新增而全部送出。
      - uses: actions/checkout@v7
        with:
          fetch-depth: 0

      - uses: actions/setup-node@v7
        with:
          node-version-file: '.nvmrc'
          cache: 'npm'

      - name: 安裝依賴
        run: npm ci

      # 刻意沒有 continue-on-error：逾時或提交被拒都需要人知道。失敗不影響已上線的文章，
      # 重跑這支 workflow 就能補送。
      - name: 送出 IndexNow
        run: node scripts/submit-indexnow.mjs --base "${{ github.event.before }}"
```

Step 2: 驗證 YAML 可解析

Run: `node -e "const{readFileSync}=require('fs');const s=readFileSync('.github/workflows/indexnow.yml','utf8');if(!s.includes('fetch-depth: 0'))throw new Error('缺 fetch-depth');console.log('ok')"`
Expected: 印出 `ok`

Step 3: Commit

```bash
git add .github/workflows/indexnow.yml
git commit -m "ci(indexnow): push 到 main 時送出索引提交"
```

---

### Task 5: 排程翻牌接上提交，並更新專案文件

Implements: `index-submission.md` #R4

Files:
- Modify: `.github/workflows/publish-scheduled.yml`（`actions/checkout` 步驟加 `fetch-depth`；
  「Commit 並 push」步驟之後插入提交步驟）
- Modify: `CLAUDE.md`（Commands、Scripts、CI 三處）

Interfaces:
- Consumes: Task 3 的 `node scripts/submit-indexnow.mjs --base <ref>`
- Produces: 無（終端消費者）

Step 1: 讓排程 workflow 拿得到父節點

`.github/workflows/publish-scheduled.yml` 裡「安裝依賴」之前的 checkout 步驟目前是：

```yaml
      - uses: actions/checkout@v7
```

改成：

```yaml
      # fetch-depth: 2 是為了最後一步的 IndexNow 提交——它要 `git show HEAD~1:<file>` 取
      # 翻牌前的 frontmatter。depth 1 其實也行得通（HEAD~1 正是這一步 checkout 出來、
      # blob 完整在本機的那顆 commit），但那要靠 shallow clone 的實作細節成立；明寫 2 把
      # 「讀得到父節點的檔案」變成顯式保證，多抓一顆 commit 的成本可忽略。
      - uses: actions/checkout@v7
        with:
          fetch-depth: 2
```

Step 2: 在 push 之後加提交步驟

`.github/workflows/publish-scheduled.yml` 的「Commit 並 push」步驟之後、「寫入 Job Summary」
步驟之前，插入：

```yaml
      # 必須在這裡呼叫，不能靠 indexnow.yml 的 push 事件接力：Actions 以預設 GITHUB_TOKEN
      # push 出去的 commit 不會觸發其他 workflow（GitHub 的防遞迴設計），只接 push 事件的話
      # 排程文章永遠送不出去。
      #
      # 這一步會等 Cloudflare Pages 把剛 push 的內容部署完成，花上幾分鐘是正常的。
      - name: 送出 IndexNow
        if: steps.changes.outputs.changed == 'true'
        run: node scripts/submit-indexnow.mjs --base HEAD~1
```

Step 3: 更新 CLAUDE.md

三處改動。

第一處，`## Commands` 區塊的 `npm test` 說明（目前寫「185 unit tests」的那段），把測試數字改成
`npm test` 實際輸出的 pass 數，並在括號內的清單末尾補上一項：

```
+ indexnow.mjs 該送的判定/網址換算/sitemap lastmod 解析/payload 組裝
```

第二處，`**Scripts:**` 段落末尾，`build-manifest`、`verify-*` 之前插入：

```
`submit-indexnow`（CLI — 把這次新上線或 `updated` 有變的文章網址送出 IndexNow；判定與換算邏輯
在 `scripts/lib/indexnow.mjs`，純函式、under test。送出前會輪詢線上 sitemap 確認 Cloudflare
Pages 部署完成——判據是該網址的 `lastmod` 等於 `updated ?? date`，與 `astro.config.mjs` 的
`POST_LASTMOD` 同一條規則。IndexNow 的 key 放在 `public/<key>.txt`，是公開值不是 secret），
```

第三處，`**CI:**` 段落，在 `publish-scheduled.yml` 那句之後補上：

```
`indexnow.yml` 在文章推上 main 時送出索引提交，`publish-scheduled.yml` 翻牌後也會自己呼叫同一
支腳本（Actions 用 `GITHUB_TOKEN` push 的 commit 不會觸發 `on: push`）。Google 端刻意不做主動
提交——它沒有給一般文章的官方路徑，理由見 `docs/specs/index-submission.md` D1。
```

Step 4: 跑完整測試與 dry-run

Run: `npm test`
Expected: PASS

Run: `npm run submit:indexnow -- --base HEAD~1 --dry-run`
Expected: exit 0

Step 5: Commit

```bash
git add .github/workflows/publish-scheduled.yml CLAUDE.md
git commit -m "ci(indexnow): 排程翻牌後送出提交，並更新專案文件"
```

---

## 驗收

全部 task 完成後，在 PR 合併到 main 之前先手動驗一次 key 檔與提交通道——這是唯一無法在本地
驗證、且錯了會靜默失敗的一環（key 檔沒部署上去，IndexNow 一律回 403）：

1. PR 合併、Cloudflare Pages 部署完成後，確認 `https://frankchen.tw/a7f3c9e2b8d4416fa0c5e7d92b1f6403.txt`
   回 200 且內容就是該 key。
2. 下一篇文章上線時，看 Actions 的 Job Summary 是否列出送出的網址與 HTTP 狀態。
3. 數日後到 Bing Webmaster Tools 的 IndexNow 頁面確認提交有被收下。
