# Agent 發現用的 Link 回應標頭 Implementation Plan

Goal: 讓本站所有 HTML 頁面的回應帶 RFC 8288 的 `Link` 標頭，宣告 `/AGENTS.md`、`/llms.txt`、
`/rss.xml`（首頁另含 `/index.md`）這幾份既有的機器可讀產物，讓 agent 一個 HEAD 請求就拿得到
指路標，而靜態資產的回應不受影響。

Architecture: 純設定 + 驗證腳本，不動任何 Astro 原始碼。`public/_headers` 新增 `/` 與 `/*/`
兩個區塊（Cloudflare 的 splat 是貪心且跨斜線的完整比對，`/*/` 因此剛好切開帶結尾斜線的頁面
與不帶斜線的靜態資產）。由於 repo 無 wrangler、`astro preview` 也不套用 `_headers`，這個比對
行為在本機驗不到，因此把 Link 標頭的解析抽成純函式做單元測試，並在 `scripts/verify-headers.mjs`
補上正向與反向兩種斷言，對線上站（或 Pages preview URL）執行。

Tech Stack: Cloudflare Pages `_headers`、Node.js `node:test`、既有的 `scripts/verify-headers.mjs`

Spec: `docs/specs/agent-markdown.md`（#R8 / #S8 / #D10，位於 `## Pending Changes`）

Design: `docs/plans/2026-08-03-agent-link-headers-design.md`

**與 design doc 的一處偏離（刻意）**：design 的「異動範圍」寫兩個檔（`public/_headers`、
`scripts/verify-headers.mjs`），本 plan 多一個 `scripts/lib/link-header.mjs`（+ 測試）。理由：
RFC 8288 的值解析有真實邊界（引號內的逗號、URI 內的逗號、參數大小寫、多值 rel），而本功能
的其餘部分在合併前完全無法自動驗證——解析器若不抽出來測，這個 PR 沒有任何一行受 CI 保護。
`scripts/lib/*.test.mjs` 是 repo 既有的測試位置（`npm test` 已在跑），零新基礎設施。

## Global Constraints

- 正規主機是 **non-www**（`https://frankchen.tw`）。任何內容、標頭、腳本預設值都不得出現 www URL。
- 回應與註解語言為 zh-TW（正體中文台灣用語）。程式碼識別字維持英文。
- `public/_headers` 對**同一個標頭**是「合併」不是「覆蓋」：多條規則命中同一路徑時，值會以逗號
  串接。本次新增的兩個區塊互不重疊（首頁只吻合 `/`），但仍不可倚賴合併行為湊出首頁那四條。
- 同一個 `_headers` 區塊內重複寫同名標頭的行為 Cloudflare 沒有明文，**禁止**用多行 `Link:`；
  四個 link-value 必須寫成單行逗號分隔（RFC 8288 明文允許）。
- `scripts/verify-headers.mjs` 的期望值**刻意不從 `public/_headers` 自動解析**——那樣兩邊會一起
  錯，就失去對照的意義。期望值寫死在腳本裡，改 `_headers` 時人工同步。
- `npm test` 的 glob 是 `node --test "scripts/lib/*.test.mjs"`，雙引號由 **Node** 展開不是 shell；
  新測試檔必須放在 `scripts/lib/` 且以 `.test.mjs` 結尾才會被跑到。
- 專案無 linter。ESM（`package.json` 的 `"type": "module"`），一律用 `import`／`export`。
- 不得修改 `.github/workflows/`：`verify:headers` 打的是線上站，PR 階段沒有對應的 origin，
  維持人工執行的定位。
- 不得修改 `public/AGENTS.md`、`src/` 下任何檔案、`verify-seo.mjs`。

---

### Task 1: Link 標頭值解析器

Implements: `agent-markdown.md` #R8

Files:
- Create: `scripts/lib/link-header.mjs`
- Test: `scripts/lib/link-header.test.mjs`

Interfaces:
- Consumes: 無
- Produces: `parseLinkHeader(value: string | null | undefined): Array<{ target: string, rel: string | null }>`
  ——Task 2 的 `scripts/verify-headers.mjs` 會 `import { parseLinkHeader } from './lib/link-header.mjs'`
  並把回傳陣列轉成 `` `${target} ${rel}` `` 字串集合來比對。

Step 1: 寫失敗的測試

建立 `scripts/lib/link-header.test.mjs`，內容如下：

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseLinkHeader } from './link-header.mjs';

test('parseLinkHeader：單一 link-value 取出 target 與 rel', () => {
  const links = parseLinkHeader('</AGENTS.md>; rel="describedby"; type="text/markdown"');
  assert.deepEqual(links, [{ target: '/AGENTS.md', rel: 'describedby' }]);
});

test('parseLinkHeader：逗號分隔的多個 link-value 全部取出', () => {
  const links = parseLinkHeader(
    '</AGENTS.md>; rel="describedby"; type="text/markdown", ' +
      '</llms.txt>; rel="index"; type="text/plain", ' +
      '</rss.xml>; rel="alternate"; type="application/rss+xml"',
  );
  assert.deepEqual(links, [
    { target: '/AGENTS.md', rel: 'describedby' },
    { target: '/llms.txt', rel: 'index' },
    { target: '/rss.xml', rel: 'alternate' },
  ]);
});

test('parseLinkHeader：引號內的逗號不切開 link-value', () => {
  const links = parseLinkHeader('</a>; rel="alternate"; title="x, y", </b>; rel="index"');
  assert.deepEqual(links, [
    { target: '/a', rel: 'alternate' },
    { target: '/b', rel: 'index' },
  ]);
});

test('parseLinkHeader：角括號內的逗號不切開 link-value', () => {
  const links = parseLinkHeader('</a,b>; rel="alternate", </c>; rel="index"');
  assert.deepEqual(links, [
    { target: '/a,b', rel: 'alternate' },
    { target: '/c', rel: 'index' },
  ]);
});

test('parseLinkHeader：參數名與 rel 值一律正規化為小寫', () => {
  const links = parseLinkHeader('</a>; REL="Describedby"');
  assert.deepEqual(links, [{ target: '/a', rel: 'describedby' }]);
});

test('parseLinkHeader：rel 多值以空白分隔，展開成多筆', () => {
  const links = parseLinkHeader('</a>; rel="alternate index"');
  assert.deepEqual(links, [
    { target: '/a', rel: 'alternate' },
    { target: '/a', rel: 'index' },
  ]);
});

test('parseLinkHeader：未加引號的 rel 值一樣取得到', () => {
  const links = parseLinkHeader('</a>; rel=describedby');
  assert.deepEqual(links, [{ target: '/a', rel: 'describedby' }]);
});

test('parseLinkHeader：缺 rel 的 link-value 回報 rel 為 null 而非被略過', () => {
  const links = parseLinkHeader('</a>; type="text/markdown"');
  assert.deepEqual(links, [{ target: '/a', rel: null }]);
});

test('parseLinkHeader：同名參數重複時取第一個（RFC 8288）', () => {
  const links = parseLinkHeader('</a>; rel="index"; rel="alternate"');
  assert.deepEqual(links, [{ target: '/a', rel: 'index' }]);
});

test('parseLinkHeader：空值與缺值回傳空陣列', () => {
  assert.deepEqual(parseLinkHeader(''), []);
  assert.deepEqual(parseLinkHeader(null), []);
  assert.deepEqual(parseLinkHeader(undefined), []);
});
```

Step 2: 跑測試確認失敗

Run: `npm test`

Expected: FAIL——`scripts/lib/link-header.mjs` 不存在，node:test 會以
`Cannot find module ... link-header.mjs` 讓該檔全部測試失敗。既有 33 個測試仍應通過。

Step 3: 寫最小實作讓測試通過

建立 `scripts/lib/link-header.mjs`，內容如下：

```js
/**
 * 解析 HTTP `Link` 標頭（RFC 8288）的值。
 *
 * 用途只有一個：讓 scripts/verify-headers.mjs 能把線上站回傳的 Link 標頭拆成
 * `(target, rel)` 的集合來比對。為什麼不能用 `value.includes('rel="describedby"')`
 * 那種整串比對——理由與同檔案 parseCsp 的註解完全一樣：
 *   (a) link-value 的順序改變（語意相同）會誤報失敗；
 *   (b) 更嚴重——zone 層若偷偷多塞一條指向別處的 link，includes 仍然為真，
 *       完全偵測不到。而 verify-headers 存在的唯一理由就是偵測 zone 層的靜默竄改。
 *
 * 刻意只取 target 與 rel：type 之類的參數錯了不影響 agent 取得資源，納入比對只會讓
 * 斷言對無關的改動變敏感。
 */

/**
 * 把標頭值切成一個個 link-value。
 *
 * 逗號是 link-value 的分隔符，但它也可能合法地出現在角括號內的 URI（`</a,b>`）
 * 或引號字串內（`title="x, y"`），直接 split(',') 會把單一 link-value 切碎。
 */
function splitLinkValues(value) {
  const parts = [];
  let current = '';
  let inAngle = false;
  let inQuote = false;

  for (let i = 0; i < value.length; i++) {
    const ch = value[i];

    if (inQuote) {
      // quoted-pair：反斜線逃逸的下一個字元原樣帶過，避免 \" 被當成引號結束
      if (ch === '\\' && i + 1 < value.length) {
        current += ch + value[i + 1];
        i++;
        continue;
      }
      if (ch === '"') inQuote = false;
      current += ch;
      continue;
    }

    if (ch === '"') inQuote = true;
    else if (ch === '<') inAngle = true;
    else if (ch === '>') inAngle = false;
    else if (ch === ',' && !inAngle) {
      parts.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  parts.push(current);

  return parts.map((part) => part.trim()).filter(Boolean);
}

/**
 * 把單一 link-value 的參數段切成一條條 link-param。
 * 分號同樣可能出現在引號字串內，不能直接 split(';')。
 */
function splitParams(text) {
  const parts = [];
  let current = '';
  let inQuote = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuote) {
      if (ch === '\\' && i + 1 < text.length) {
        current += ch + text[i + 1];
        i++;
        continue;
      }
      if (ch === '"') inQuote = false;
      current += ch;
      continue;
    }

    if (ch === '"') inQuote = true;
    else if (ch === ';') {
      parts.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  parts.push(current);

  return parts.map((part) => part.trim()).filter(Boolean);
}

/** 取出 link-param 的值：引號字串去引號並還原逃逸，token 則原樣。 */
function unquote(raw) {
  if (raw.length >= 2 && raw.startsWith('"') && raw.endsWith('"')) {
    return raw.slice(1, -1).replace(/\\(.)/g, '$1');
  }
  return raw;
}

/**
 * @param {string | null | undefined} value 標頭原值
 * @returns {Array<{ target: string, rel: string | null }>}
 *   rel 為多值（`rel="alternate index"`）時展開成多筆；
 *   缺 rel 的 link-value 回 `rel: null`（而非略過），讓呼叫端能把它當成未預期的項目報出來。
 */
export function parseLinkHeader(value) {
  if (!value) return [];

  const links = [];
  for (const raw of splitLinkValues(value)) {
    const matched = raw.match(/^<([^>]*)>(.*)$/s);
    if (!matched) continue;

    const target = matched[1].trim();
    let rel = null;
    for (const param of splitParams(matched[2])) {
      const eq = param.indexOf('=');
      if (eq === -1) continue;
      // RFC 8288：同名參數重複出現時只有第一個生效
      if (param.slice(0, eq).trim().toLowerCase() !== 'rel' || rel !== null) continue;
      rel = unquote(param.slice(eq + 1).trim()).toLowerCase();
    }

    if (rel === null) {
      links.push({ target, rel: null });
      continue;
    }
    for (const single of rel.split(/\s+/).filter(Boolean)) {
      links.push({ target, rel: single });
    }
  }
  return links;
}
```

Step 4: 跑測試確認通過

Run: `npm test`

Expected: PASS——原有 33 個測試加上本檔 10 個測試全部通過（`# pass 43`、`# fail 0`）。

Step 5: Commit

Run:
```bash
git add scripts/lib/link-header.mjs scripts/lib/link-header.test.mjs
git commit -F - <<'EOF'
feat(agent-markdown): Link 標頭值的解析器

verify-headers 要偵測的是 zone 層對標頭的靜默竄改，因此不能用 includes
比對——多塞一條指向別處的 link 時 includes 仍為真。抽成純函式解析成
(target, rel) 集合，並涵蓋引號內逗號、URI 內逗號、多值 rel 等邊界。

Implements: agent-markdown #R8
EOF
```

---

### Task 2: `_headers` 規則與線上站斷言

Implements: `agent-markdown.md` #R8, #S8

Files:
- Modify: `public/_headers`（在檔案末尾、`/*.md` 區塊之後追加）
- Modify: `scripts/verify-headers.mjs`（五處插入，見下方各 Step）

Interfaces:
- Consumes: `parseLinkHeader(value)` from `scripts/lib/link-header.mjs`
  ——回傳 `Array<{ target: string, rel: string | null }>`，rel 已小寫化、多值已展開
- Produces: 無（終端 task）

Step 1: 追加 `_headers` 規則

在 `public/_headers` **檔案最末尾**（現有 `/*.md` 區塊的 `X-Robots-Tag: noindex` 那行之後）
追加一個空行，再貼上以下內容：

```
# ── agent 發現用的 Link 標頭（RFC 8288，見 docs/specs/agent-markdown.md R8）────────────
# 把 /AGENTS.md、/llms.txt、/rss.xml、/index.md 這幾份既有的機器可讀產物搬到 HTTP 層宣告，
# agent 一個 HEAD 請求就拿得到指路標，不必先下載並解析 HTML。內容本身沒有新增，只是多一個
# 宣告管道。
#
# 為什麼是 `/` 與 `/*/` 兩條，而不是掛在本檔開頭的 `/*`：Cloudflare 的 splat 是貪心且跨斜線
# 的完整比對，`/*/` 因此等同「以 / 開頭、以 / 結尾」——本站所有頁面都帶結尾斜線
# （/about/、/category/n8n/、/<slug>/），所有靜態資產都不帶（/_astro/x.js、/fonts/x.woff2、
# /og/x.png、/<slug>.md）。掛在 `/*` 會讓每個字型、圖片、JS 回應都多背約 200 bytes，而首頁
# 一次載入 30+ 個子資源——等於為了給 agent 看的東西讓每位讀者多付流量。
#
# 首頁只吻合 `/` 這一條（`/*/` 的 splat 就算能吃空字串，pattern 也會是 `//` 而不是 `/`），
# 所以四個 link-value 必須完整寫在這裡，不能倚賴與下面那條規則的合併。
#
# 為什麼四個擠成一行，而不是寫四行 `Link:`：本檔開頭記載的合併規則講的是「多條*規則*命中
# 同一路徑時，同名標頭的值以逗號串接」，同一個區塊內重複寫同名標頭的行為 Cloudflare 沒有
# 明文。RFC 8288 本來就允許單一標頭放多個逗號分隔的 link-value，走有明文的那條路。
#
# rel 的選擇都是 IANA 已註冊的關係，不是為了通過外部檢測而編的：AGENTS.md 描述「怎麼取用
# 本站」故 describedby；llms.txt 是全站文章索引故 index（用 alternate 會說謊，它不是本站的
# 替代表示）；rss.xml 與 index.md 才是替代表示。刻意不做 RFC 9727 的 api-catalog——那要求
# 目標必須是 application/linkset+json 的 API 清單，而本站沒有 API。
#
# 文章的 /<slug>.md 刻意不進這裡：那要逐篇 35 條規則、每發一篇新文都得改這個檔，正是
# spec D5 當初拒絕逐篇 `Link: rel="canonical"` 的同一個理由。文章的 md 宣告留在 HTML <head>。
#
# 這兩條規則的比對行為在本機驗不到（repo 無 wrangler、astro preview 不套用本檔），
# 只能靠 Pages preview 或正式站；scripts/verify-headers.mjs 因此同時有正向斷言（頁面要有）
# 與反向斷言（字型檔不能有）——少了反向那條，比對過頭時會靜默退化成 `/*` 而無人察覺。
/
  Link: </AGENTS.md>; rel="describedby"; type="text/markdown", </index.md>; rel="alternate"; type="text/markdown", </llms.txt>; rel="index"; type="text/plain", </rss.xml>; rel="alternate"; type="application/rss+xml"

/*/
  Link: </AGENTS.md>; rel="describedby"; type="text/markdown", </llms.txt>; rel="index"; type="text/plain", </rss.xml>; rel="alternate"; type="application/rss+xml"
```

注意：`/*/` 與 `/` 這兩行**不可有行尾空白**，`Link:` 那兩行必須各自維持單行（不要折行）。

Step 2: 在 `scripts/verify-headers.mjs` 加入 import 與期望常數

找到檔案開頭這一行：

```js
const ORIGIN = (process.argv[2] ?? 'https://frankchen.tw').replace(/\/$/, '');
```

在它的**前面**插入：

```js
import { parseLinkHeader } from './lib/link-header.mjs';

```

接著找到 `EXPECTED_CSP_DIRECTIVES` 陣列的結尾（`'upgrade-insecure-requests',` 之後的 `];` 那行），
在其**後面**插入以下內容：

```js

// 期望的 Link 標頭內容，同樣直接對照 public/_headers（理由見上方註解）。
// 站台層級三條每個 HTML 頁面都該有；/index.md 是首頁專屬——它是首頁這一頁的替代表示，
// 出現在文章頁上是錯的，所以下方比對用的是「集合完全相等」而非「包含」。
const EXPECTED_LINKS_SITE_WIDE = [
  ['/AGENTS.md', 'describedby'],
  ['/llms.txt', 'index'],
  ['/rss.xml', 'alternate'],
];
const EXPECTED_LINKS_HOME = [...EXPECTED_LINKS_SITE_WIDE, ['/index.md', 'alternate']];

/**
 * 產生一個比對 Link 標頭的 verify 函式。
 *
 * 比對的是 `(target, rel)` 集合而非字串包含：順序無關，而且多出來的 link-value 一定會被
 * 報出來——zone 層若注入一條指向別處的 link，包含式比對抓不到（見 parseCsp 的同一段理由）。
 */
function verifyLinks(expected) {
  return (value) => {
    if (!value) return '沒有 Link 標頭';
    const actual = new Set(
      parseLinkHeader(value).map(({ target, rel }) => `${target} rel=${rel ?? '（缺 rel）'}`),
    );
    const wanted = new Set(expected.map(([target, rel]) => `${target} rel=${rel}`));

    const problems = [];
    const missing = [...wanted].filter((key) => !actual.has(key));
    const extra = [...actual].filter((key) => !wanted.has(key));
    if (missing.length) problems.push(`缺少：${missing.join('、')}`);
    if (extra.length) {
      problems.push(`多出未預期的 link-value：${extra.join('、')}（可能是 zone 層規則注入）`);
    }
    return problems.length ? `${problems.join('｜')}｜實際收到：${value}` : null;
  };
}
```

Step 3: 加入首頁與內頁的正向斷言

找到 `CHECKS` 陣列中最後一個項目——即 `Cache-Control 只有一組 max-age` 的那段 `.map(...)`，
它以下列三行結尾：

```js
  })),
];
```

把這兩行改成（在 `];` 之前插入兩個新檢查）：

```js
  })),
  {
    path: '/',
    header: 'link',
    name: '首頁的 Link 標頭（四份機器可讀產物）',
    verify: verifyLinks(EXPECTED_LINKS_HOME),
  },
  {
    path: '/about/',
    header: 'link',
    name: '內頁的 Link 標頭（不含首頁專屬的 /index.md）',
    verify: verifyLinks(EXPECTED_LINKS_SITE_WIDE),
  },
];
```

Step 4: 加入深層頁面的解析函式

找到 `resolveMarkdownPath()` 函式的結尾——它的最後三行是：

```js
  } catch {
    return { error: `llms.txt 宣告的 .md 網址無法解析：${match[0]}` };
  }
}
```

在其**後面**插入以下函式：

```js

/**
 * 從線上 sitemap 取一個路徑深度 ≥ 2 的頁面（例如 /category/n8n/）當受測對象。
 *
 * 為什麼非要深層頁面不可：`_headers` 的 `/*/` 規則能涵蓋全站，前提是 Cloudflare 的 splat
 * 真的跨斜線比對。這個假設只在深層路徑上會露餡——若 splat 其實不跨斜線，/about/ 照樣有
 * 標頭，/category/n8n/ 卻沒有，只驗一層的頁面完全看不出來。
 *
 * 為什麼不寫死 /category/n8n/：category enum 是會變的（改名或下架就 404），屆時看起來像
 * 標頭壞了，其實是檢查本身過期。從 sitemap 取則永遠指向線上站當下真的有的頁面。
 */
async function resolveNestedPagePath() {
  let xml;
  try {
    const res = await fetch(`${ORIGIN}/sitemap.xml`, { redirect: 'follow' });
    if (!res.ok) return { error: `sitemap.xml 請求回應 ${res.status}` };
    xml = await res.text();
  } catch (err) {
    return { error: `sitemap.xml 請求失敗：${err.message}` };
  }
  for (const match of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
    let pathname;
    try {
      pathname = new URL(match[1].trim()).pathname;
    } catch {
      continue;
    }
    if (pathname.endsWith('/') && pathname.split('/').filter(Boolean).length >= 2) {
      return { path: pathname };
    }
  }
  return { error: 'sitemap.xml 沒有任何深度 ≥ 2 的頁面網址' };
}
```

Step 5: 加入反向斷言與深層頁檢查

找到主流程中處理 `fontPath` 的這一段：

```js
const fontPath = await resolveFontPath();
if (fontPath.path) {
  checks.push({
    path: fontPath.path,
    header: 'cache-control',
    name: `字型長期 immutable 快取（${fontPath.path}）`,
    verify: (v) =>
      v?.includes('immutable') && /max-age=\d{7,}/.test(v) ? null : `實際為 ${v ?? '（無）'}`,
  });
} else {
  checks.push({ path: '/', name: '首頁可取得字型 preload 路徑', staticProblem: fontPath.error });
}
```

把它整段替換成：

```js
const fontPath = await resolveFontPath();
if (fontPath.path) {
  checks.push(
    {
      path: fontPath.path,
      header: 'cache-control',
      name: `字型長期 immutable 快取（${fontPath.path}）`,
      verify: (v) =>
        v?.includes('immutable') && /max-age=\d{7,}/.test(v) ? null : `實際為 ${v ?? '（無）'}`,
    },
    // 反向斷言：Link 標頭只該掛在 HTML 頁面上。`_headers` 的 `/*/` 若因為 Cloudflare 的
    // 比對語意與文件不同而吻合過頭，站台功能完全正常、外部檢測照樣通過，只是每位讀者的
    // 每一個子資源都默默多背 200 bytes——沒有這條斷言，這種退化不會有任何跡象。
    {
      path: fontPath.path,
      header: 'link',
      name: `靜態資產不帶 Link 標頭（${fontPath.path}）`,
      verify: (v) => (v ? `不應有 Link 標頭，實際為 ${v}` : null),
    },
  );
} else {
  checks.push({ path: '/', name: '首頁可取得字型 preload 路徑', staticProblem: fontPath.error });
}

const nestedPath = await resolveNestedPagePath();
if (nestedPath.path) {
  checks.push({
    path: nestedPath.path,
    header: 'link',
    name: `深層頁面的 Link 標頭（${nestedPath.path}，驗 splat 跨斜線）`,
    verify: verifyLinks(EXPECTED_LINKS_SITE_WIDE),
  });
} else {
  checks.push({
    path: '/sitemap.xml',
    name: '可從 sitemap 取得深層頁面路徑',
    staticProblem: nestedPath.error,
  });
}
```

Step 6: 跑既有單元測試確認沒弄壞東西

Run: `npm test`

Expected: PASS（`# pass 43`、`# fail 0`）。本 task 不新增單元測試——`_headers` 與
`verify-headers.mjs` 都是對線上站生效的東西，沒有本機可測的表面。

Step 7: 對正式站跑驗證，確認新斷言真的會抓

Run: `npm run verify:headers`

Expected: **exit 1，且恰好是下列三項 FAIL**（此時 `_headers` 尚未部署，正式站當然還沒有
Link 標頭）：

- `[FAIL] 首頁的 Link 標頭（四份機器可讀產物）` → `/ → 沒有 Link 標頭`
- `[FAIL] 內頁的 Link 標頭（不含首頁專屬的 /index.md）` → `/about/ → 沒有 Link 標頭`
- `[FAIL] 深層頁面的 Link 標頭（...）` → `沒有 Link 標頭`

同時這兩項必須 **PASS**：

- `[PASS] 靜態資產不帶 Link 標頭（/fonts/...woff2）`——反向斷言在部署前就該通過，
  部署後也必須維持通過
- 其餘所有既有檢查（CSP、HSTS、快取等）維持原本結果不變

這一步的意義是證明正向斷言不是永遠通過的空殼。**若三項正向斷言在部署前就 PASS，代表斷言
寫錯了（或 zone 層已有 Link 標頭），必須停下來查清楚，不可繼續。**

若執行環境無法連外（fetch 全數失敗），把本步驟記為「未執行」寫進報告，不可當作通過。

Step 8: Commit

Run:
```bash
git add public/_headers scripts/verify-headers.mjs
git commit -F - <<'EOF'
feat(agent-markdown): 頁面回應加上 agent 發現用的 Link 標頭

/ 與 /*/ 兩條規則涵蓋所有帶結尾斜線的頁面，靜態資產不受影響；首頁另含
/index.md。四個 link-value 單行逗號分隔，不賭同區塊多行同名標頭的合併語意。

verify-headers 補三項正向斷言（首頁／內頁／深層頁）與一項反向斷言（字型檔
不得有 Link）。反向那條是關鍵：/*/ 若比對過頭會靜默退化成 /*，站台完全
正常、外部檢測照樣過，只有每位讀者默默多付流量。

Implements: agent-markdown #R8, #S8
EOF
```

---

## 部署後驗收（不是 task，需要 PR preview URL 或已合併的正式站）

以下三步無法由 implementer 在本機完成，開 PR 後依序執行：

1. **Pages preview 部署完成後**，對 preview URL 跑：
   `npm run verify:headers -- https://<hash>.astro-blog.pages.dev`
   全部項目應 PASS。若「深層頁面」那項 FAIL 而「內頁」PASS，代表 Cloudflare 的 splat 不跨
   斜線，`/*/` 只涵蓋一層——此時要改用逐層列舉（`/*/`、`/*/*/`）或退回 design doc 記載的
   C 案（掛 `/*`），並回頭更新 spec D10。
2. **合併並部署到正式站後**，對正式站跑 `npm run verify:headers`，全部 PASS。這一步是在驗
   zone 層有沒有覆寫或加料——`verify-headers.mjs` 開頭記載的 2026-07-23 CSP 事故就是這樣發生的。
   注意 `_headers` 屬 HTML 短快取範圍，邊緣快取可能有數分鐘空窗（見 commit 5bb38cf 記載）。
3. **外部檢測**：`curl -X POST https://isitagentready.com/api/scan -H 'content-type: application/json' -d '{"url":"https://frankchen.tw"}'`
   確認 `checks.discoverability.linkHeaders.status` 為 `"pass"`。這是本次工作的起因，但不是
   驗收的主體——前兩步才是。
