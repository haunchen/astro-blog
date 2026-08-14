# OG 圖改內容雜湊檔名 Implementation Plan

Goal: 把 `/og/*.png` 從固定檔名改成帶 PNG 輸出位元組雜湊的 `/og/<slug>.<hash>.png`，讓快取正確性不再依賴 Cloudflare zone 的 TTL 設定。

Architecture: 渲染與雜湊抽成純模組 `scripts/lib/og-image.mjs`，接線層 `src/utils/og.ts` 以 `Map<id, Promise>` memoize，三個消費端（`og:image`、BlogPosting JSON-LD 的 `image`、文章 `.md` frontmatter 的 `image`）與 `/og/[...slug].png` 端點全都向它要網址。誰先要到誰觸發渲染，build 內的順序問題因此消失，不需事後改名器、不需回寫產物。

Tech Stack: Astro v5（SSG）、satori + sharp（既有）、node:crypto、node:test、subset-font（測試用）

Spec: `docs/specs/pre-launch-infra.md`（Pending Changes 區：MODIFIED R4/R8、ADDED R12、S11、S12、D10、D11、D12）

Design: `docs/plans/2026-08-14-og-image-content-hash-design.md`

與設計文件的一處差異（刻意）：設計寫 `getOgImage` 回傳 `{ path, bytes, width, height, type }`，本計畫只回 `{ path, hash, bytes }`。理由是設計同時定案「`BaseLayout.astro` 不動」——它用 `.endsWith('.png')` 自行推導 `og:image:width/height/type`，那三個欄位不會有消費端，放了就是死碼。`hash` 則有消費端（端點的 `getStaticPaths` 要拿它組 `params.slug`）。

## Global Constraints

- 語言 zh-TW：程式碼註解、測試名稱、失敗訊息、commit message 一律正體中文（既有檔案的風格）
- 正規主機為非 www 的 `https://frankchen.tw`，任何產出不得出現 www 網址
- 禁止直接呼叫 `getCollection('posts', …)`，取文章一律走 `src/utils/posts.ts` 的 `getPublishedPosts()` / `getPublishedPostsByDateDesc()`
- TypeScript strict（`astro/tsconfigs/strict`），無 linter；風格比照鄰近檔案
- `npm test` 只跑 `scripts/lib/*.test.mjs`，glob 的雙引號由 Node 展開，不可拿掉
- `scripts/lib/` 下的模組必須是純函式、不依賴 Astro runtime（`md-export.mjs` 是同類先例）
- `public/_headers` 中任何自訂 `Cache-Control` 的規則，必須先寫 `! Cache-Control` 清掉 `/*` 的值再設定，否則 Cloudflare Pages 會合併成兩組 max-age
- `verify:headers` / `verify:robots` / `verify:assets` / `verify:negotiation` 打的是正式站，本機跑必然反映的是「部署前」的狀態，不可當成 task 的通過閘門
- 每個 task 以一次 commit 收尾，Conventional Commits 格式

---

### Task 1: OG 圖的渲染與雜湊純模組

Implements: `pre-launch-infra.md` #R4, #S12, #D12

Files:
- Create: `scripts/lib/og-image.mjs`
- Test: `scripts/lib/og-image.test.mjs`

Interfaces:
- Consumes: 無（本 task 不依賴其他 task）
- Produces:
  - `renderOgImage({ title: string, category: string, siteName: string, fonts: Array<{name, data, weight, style}> }) => Promise<{ bytes: Buffer, hash: string }>`（`hash` 為 PNG 位元組 sha256 的前 8 碼小寫十六進位）
  - `ogRouteSlug(id: string, hash: string) => string`（`<id>.<hash>`）
  - `ogImagePath(id: string, hash: string) => string`（`/og/<id>.<hash>.png`）

Step 1: 寫失敗的測試

建立 `scripts/lib/og-image.test.mjs`：

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import subsetFont from 'subset-font';
import { renderOgImage, ogImagePath, ogRouteSlug } from './og-image.mjs';

// 測試字型刻意用 node_modules 裡版本固定的 Inter，不用 src/assets/og-fonts/：
// 那個目錄被 gitignore、由 build 前的 subset-fonts 產生，CI 先跑 npm test 時還不存在。
const INTER = 'node_modules/@fontsource/inter/files/inter-latin-700-normal.woff';

const INPUT = { title: 'Cache busting for OG images', category: 'devops', siteName: 'Engineer Notes' };

async function fontsFrom(source, chars) {
  const data = await subsetFont(source, chars, { targetFormat: 'woff' });
  return [{ name: 'Inter', data, weight: 700, style: 'normal' }];
}

test('renderOgImage：同一輸入連渲兩次，雜湊與位元組完全相同', async () => {
  const source = await readFile(INTER);
  const fonts = await fontsFrom(source, 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ .');
  const first = await renderOgImage({ ...INPUT, fonts });
  const second = await renderOgImage({ ...INPUT, fonts });
  assert.equal(first.hash, second.hash);
  assert.ok(first.bytes.equals(second.bytes));
  assert.match(first.hash, /^[0-9a-f]{8}$/);
});

// 這條守的是驗收條件「新增一篇文章不得改變既有文章的 OG 圖檔名」：新文章會讓
// subset-fonts 重算出內容不同的字型檔，而輸出必須不受影響。
test('renderOgImage：字型檔位元組不同但字形相同時，雜湊不變', async () => {
  const source = await readFile(INTER);
  const small = await fontsFrom(source, 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ .');
  const large = await fontsFrom(source, 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ .0123456789!?@#$%&*');
  assert.notEqual(small[0].data.length, large[0].data.length);
  const fromSmall = await renderOgImage({ ...INPUT, fonts: small });
  const fromLarge = await renderOgImage({ ...INPUT, fonts: large });
  assert.equal(fromSmall.hash, fromLarge.hash);
});

test('renderOgImage：標題改一個字，雜湊必變', async () => {
  const source = await readFile(INTER);
  const fonts = await fontsFrom(source, 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ .');
  const before = await renderOgImage({ ...INPUT, fonts });
  const after = await renderOgImage({ ...INPUT, title: `${INPUT.title}.`, fonts });
  assert.notEqual(before.hash, after.hash);
});

test('ogImagePath / ogRouteSlug：雜湊插在副檔名之前', () => {
  assert.equal(ogRouteSlug('my-post', 'deadbeef'), 'my-post.deadbeef');
  assert.equal(ogImagePath('my-post', 'deadbeef'), '/og/my-post.deadbeef.png');
});
```

Step 2: 跑測試確認失敗

Run: `node --test "scripts/lib/og-image.test.mjs"`
Expected: FAIL（`Cannot find module './og-image.mjs'`）

Step 3: 寫最小實作讓測試通過

建立 `scripts/lib/og-image.mjs`。版面樹（`ogTemplate`）從 `src/pages/og/[...slug].png.ts` 原樣搬過來，一個樣式值都不改——這次不動視覺，改了會讓全部 35 個雜湊平白翻新：

```js
/**
 * OG 圖的渲染與內容雜湊——純函式，不碰 astro 也不碰檔案系統。
 *
 * 抽出來的理由有兩個。一是可測：雜湊必須「內容沒變就不變」，而那要靠單元測試釘住，
 * 端點裡的程式碼跑不到 `npm test`。二是消費端與端點要拿到完全相同的網址，唯一保險的
 * 做法就是兩邊呼叫同一個函式（接線層見 src/utils/og.ts）。
 */
import satori from 'satori';
import sharp from 'sharp';
import { createHash } from 'node:crypto';

// satori 畫布尺寸。與 BaseLayout 宣告的 og:image:width/height 是同一組值，但不對外匯出
// ——BaseLayout 自己推導那兩個屬性，沒有消費端會 import 這裡的常數。
const OG_WIDTH = 1200;
const OG_HEIGHT = 630;

/** 檔名裡的雜湊長度，與 build-font-css.mjs 的字型雜湊一致。 */
const HASH_LENGTH = 8;

function ogTemplate({ title, category, siteName }) {
  return {
    type: 'div',
    props: {
      style: {
        width: `${OG_WIDTH}px`,
        height: `${OG_HEIGHT}px`,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '72px',
        backgroundColor: '#0f172a',
        color: '#E2E8F0',
        fontFamily: 'Noto Sans TC, Inter, sans-serif',
      },
      children: [
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              alignSelf: 'flex-start',
              padding: '8px 20px',
              backgroundColor: '#fb923c',
              color: '#0f172a',
              borderRadius: '999px',
              fontSize: '28px',
              fontWeight: 700,
            },
            children: category,
          },
        },
        {
          type: 'div',
          props: {
            style: {
              fontSize: '64px',
              fontWeight: 700,
              lineHeight: 1.3,
              color: '#F8FAFC',
              display: 'flex',
            },
            children: title,
          },
        },
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              borderTop: '2px solid #334155',
              paddingTop: '24px',
            },
            children: [
              {
                type: 'div',
                props: {
                  style: { fontSize: '28px', color: '#F8FAFC', fontWeight: 700 },
                  children: siteName,
                },
              },
              {
                type: 'div',
                props: {
                  style: { fontSize: '22px', color: '#94A3B8' },
                  children: 'frankchen.tw',
                },
              },
            ],
          },
        },
      ],
    },
  };
}

/**
 * 渲染一張 OG 圖，回傳 PNG 位元組與其內容雜湊。
 *
 * 雜湊取自「輸出位元組」而非「輸入欄位」：2026-08-14 實測，satori + sharp 對同一輸入
 * 的輸出是決定性的，且與字型檔本身的位元組無關（只取決於實際用到的字形輪廓）。所以
 * 這個雜湊在範本改動時會變（輸入雜湊不會，得靠人手動 bump 版本號），在 subset 字型
 * 因新文章而重算時不會變（輸入雜湊若含字型就會全站翻新）。見 pre-launch-infra.md D12。
 *
 * @param {{ title: string, category: string, siteName: string, fonts: Array<{ name: string, data: Buffer | ArrayBuffer, weight: number, style: string }> }} input
 * @returns {Promise<{ bytes: Buffer, hash: string }>}
 */
export async function renderOgImage({ title, category, siteName, fonts }) {
  const svg = await satori(ogTemplate({ title, category, siteName }), {
    width: OG_WIDTH,
    height: OG_HEIGHT,
    fonts,
  });
  const bytes = await sharp(Buffer.from(svg)).png().toBuffer();
  return { bytes, hash: createHash('sha256').update(bytes).digest('hex').slice(0, HASH_LENGTH) };
}

/**
 * OG 圖在路由裡的 slug（`/og/[...slug].png` 的 params.slug）。
 * @param {string} id
 * @param {string} hash
 * @returns {string}
 */
export function ogRouteSlug(id, hash) {
  return `${id}.${hash}`;
}

/**
 * OG 圖的站內絕對路徑。與 ogRouteSlug 共用同一份格式定義，端點與消費端不會各寫一套。
 * @param {string} id
 * @param {string} hash
 * @returns {string}
 */
export function ogImagePath(id, hash) {
  return `/og/${ogRouteSlug(id, hash)}.png`;
}
```

Step 4: 跑測試確認通過

Run: `npm test`
Expected: PASS，`# tests 115` / `# pass 115` / `# fail 0`（原本 111 條 + 本 task 的 4 條）

Step 5: Commit

Run: `git add scripts/lib/og-image.mjs scripts/lib/og-image.test.mjs && git commit -m "feat(og): 抽出 OG 圖渲染與內容雜湊的純模組（#55）"`

---

### Task 2: 接上端點與三個消費端

Implements: `pre-launch-infra.md` #R4, #R12, #D10, #S11

（#S12「新增文章不改變既有 OG 檔名」由 Task 1 的單元測試鎖定其成立前提——字型檔位元組變動不影響輸出——本 task 不另做端到端的新增文章重建驗證。）

Files:
- Create: `src/utils/og.ts`
- Modify: `src/pages/og/[...slug].png.ts`（整檔取代）
- Modify: `src/pages/[...slug].astro`（3 處：import、`ogImage` 常數、JSON-LD `image` 與 `ogImage` prop）
- Modify: `src/pages/[...slug].md.ts`（2 處：import、frontmatter `image`）
- Modify: `scripts/verify-seo.mjs`（新增一條 check）

Interfaces:
- Consumes: Task 1 的 `renderOgImage`、`ogRouteSlug`、`ogImagePath`（`scripts/lib/og-image.mjs`）
- Produces: `getOgImage(post: Post) => Promise<{ path: string, hash: string, bytes: Buffer }>`（`src/utils/og.ts`）

Step 1: 建立接線層 `src/utils/og.ts`

```ts
import { readFile } from 'node:fs/promises';
import { ogImagePath, renderOgImage } from '../../scripts/lib/og-image.mjs';
import { CATEGORY_LABEL, SITE } from './site-meta';
import type { Post } from './posts';

export interface OgImage {
  /** `/og/<id>.<hash>.png` */
  path: string;
  hash: string;
  bytes: Buffer;
}

/**
 * OG 圖的單一取得管道。
 *
 * 三個消費端（og:image、BlogPosting JSON-LD 的 image、文章 .md 變體的 frontmatter image）
 * 與 /og/[...slug].png 端點全都走這裡，網址因此不可能各算各的。
 *
 * 為什麼是 memoize 而不是「先產圖再渲染頁面」：消費端在頁面渲染時就要網址，PNG 位元組
 * 卻要到端點渲染完才存在，而兩者在同一次 build 內沒有順序保證。改成誰先要到誰觸發渲染、
 * 結果快取在模組層之後，順序不再重要（見 pre-launch-infra.md D10）。
 *
 * 快取的是 Promise 不是結果：同一篇被併發要兩次時，存結果會讓兩邊都撲空而渲染兩次。
 * 正確性不依賴這層快取——同一輸入的輸出位元組完全相同，快取失效只會多花 8 毫秒。
 */
const cache = new Map<string, Promise<OgImage>>();

let fontsPromise: Promise<Parameters<typeof renderOgImage>[0]['fonts']> | undefined;

function getFonts() {
  return (fontsPromise ??= Promise.all([
    readFile('src/assets/og-fonts/noto-sans-tc-subset.woff'),
    readFile('src/assets/og-fonts/inter-bold.woff'),
  ]).then(([notoSansTC, inter]) => [
    { name: 'Noto Sans TC', data: notoSansTC, weight: 700, style: 'normal' },
    { name: 'Inter', data: inter, weight: 700, style: 'normal' },
  ]));
}

export function getOgImage(post: Post): Promise<OgImage> {
  const cached = cache.get(post.id);
  if (cached) return cached;

  const pending = (async () => {
    const { bytes, hash } = await renderOgImage({
      title: post.data.title,
      category: CATEGORY_LABEL[post.data.category] ?? post.data.category,
      siteName: SITE.name,
      fonts: await getFonts(),
    });
    return { path: ogImagePath(post.id, hash), hash, bytes };
  })();

  cache.set(post.id, pending);
  return pending;
}
```

畫布尺寸常數留在 `og-image.mjs` 內部、不經由這裡外流：`BaseLayout.astro` 自己推導
`og:image:width/height`，沒有消費端會 import 它們（同 plan 檔頭不回傳 width/height/type 的理由）。

Step 2: 端點整檔取代 `src/pages/og/[...slug].png.ts`

原本的 satori 版面樹已在 Task 1 搬進 `scripts/lib/og-image.mjs`，這裡不留副本：

```ts
import type { APIRoute, GetStaticPaths } from 'astro';
import { ogRouteSlug } from '../../../scripts/lib/og-image.mjs';
import { getOgImage } from '../../utils/og';
import { getPublishedPosts } from '../../utils/posts';
import type { Post } from '../../utils/posts';

/**
 * 文章的 OG 圖。渲染與雜湊在 scripts/lib/og-image.mjs，接線與快取在 src/utils/og.ts——
 * 這個端點只負責把「已經算好的那張圖」放到它的雜湊網址上。
 */
export const getStaticPaths: GetStaticPaths = async () => {
  const posts = await getPublishedPosts();
  return Promise.all(
    posts.map(async (post) => {
      const { hash } = await getOgImage(post);
      return { params: { slug: ogRouteSlug(post.id, hash) }, props: { post } };
    }),
  );
};

export const GET: APIRoute = async ({ props }) => {
  const { post } = props as { post: Post };
  // getStaticPaths 已經渲染過同一篇，這裡命中快取，不會再渲染一次。
  const { bytes } = await getOgImage(post);
  return new Response(new Uint8Array(bytes), { headers: { 'Content-Type': 'image/png' } });
};
```

Step 3: 改 `src/pages/[...slug].astro` 三處

3a. import 區塊，在 `posts` 那行之後加一行：

```astro
import { getPublishedPosts, getPublishedPostsByDateDesc } from '../utils/posts';
import { getOgImage } from '../utils/og';
```

3b. `const canonicalURL = ...` 那行之後加：

```astro
const canonicalURL = new URL(`/${post.id}/`, SITE.url).href;

// OG 圖網址帶內容雜湊，只能由 getOgImage 給——JSON-LD 與 og:image 共用同一個值。
const ogImage = await getOgImage(post);
```

3c. `blogPosting` 物件內的 `image` 與 `<BaseLayout>` 的 `ogImage` prop：

```astro
  image: `${SITE.url}${ogImage.path}`,
```

```astro
  ogImage={ogImage.path}
```

（原本分別是 `image: \`${SITE.url}/og/${post.id}.png\`,` 與 `ogImage={\`/og/${post.id}.png\`}`。）

Step 4: 改 `src/pages/[...slug].md.ts` 兩處

4a. import 區塊：

```ts
import { getPublishedPosts } from '../utils/posts';
import { getOgImage } from '../utils/og';
```

4b. `toYamlFrontmatter({ ... })` 內的 `image` 欄位：

```ts
    image: `${SITE.url}${(await getOgImage(post)).path}`,
```

（原本是 `image: \`${SITE.url}/og/${post.id}.png\`,`。上方那段「OG 圖則是固定路徑」的註解保留，它講的是「用 OG 圖而非封面」這個選擇，與檔名帶不帶雜湊無關。）

Step 5: `scripts/verify-seo.mjs` 新增一條 check

插在 `check('每頁恰有一個非空 twitter:card', ...)` 這條之前：

```js
// OG 圖網址帶內容雜湊（pre-launch-infra.md R4、R12），三個消費端（這裡的 og:image、
// BlogPosting JSON-LD 的 image、.md 變體 frontmatter 的 image）必須算出同一個網址。
// md 那側已由「.md 變體 frontmatter 的 image 指向存在的檔案」涵蓋，這條補上 HTML 側。
//
// 格式與存在性兩件事都要驗：只驗存在的話，退化回固定檔名 /og/<slug>.png 時檔案照樣
// 存在（端點會產出它），快取正確性卻已經默默倒退回本 issue 修掉的狀態。
const OG_HASHED_RE = /^\/og\/(.+)\.[0-9a-f]{8}\.png$/;

check('文章頁的 og:image 為帶內容雜湊的檔名且檔案存在', (failures) => {
  for (const { pathname, html } of pages) {
    if (!articlePathnames.has(pathname)) continue;
    const value = requireSingleTag(failures, pathname, findMetaByAttr(html, 'property', 'og:image'), 'og:image');
    if (value === null) continue;
    let imagePath;
    try {
      imagePath = decodeURIComponent(new URL(value, `${SITE_ORIGIN}/`).pathname);
    } catch {
      failures.push({ page: pathname, reason: `og:image 不是合法 URL：${value}` });
      continue;
    }
    if (!OG_HASHED_RE.test(imagePath)) {
      failures.push({ page: pathname, reason: `og:image 應為 /og/<slug>.<8 碼雜湊>.png，實際為 ${imagePath}` });
      continue;
    }
    if (!existsSync(path.join(DIST, imagePath.replace(/^\//, '')))) {
      failures.push({ page: pathname, reason: `og:image 指向不存在的檔案：${imagePath}` });
    }
  }
});
```

Step 6: 建置並驗證

Run: `npm run build && npm run verify:seo`
Expected: build 成功；`verify:seo` 印出「36 項規則，全數通過」，其中含 `[PASS] 文章頁的 og:image 為帶內容雜湊的檔名且檔案存在`

Step 7: 驗三個消費端算出同一個網址

Run:
```bash
ls dist/og | head -3
grep -o 'property="og:image" content="[^"]*"' dist/cloudflare-cache-rules-wordpress/index.html
grep -o '"image":"[^"]*og[^"]*"' dist/cloudflare-cache-rules-wordpress/index.html
grep -n '^image:' dist/cloudflare-cache-rules-wordpress.md
```
Expected: `dist/og/` 下的檔名形如 `cloudflare-cache-rules-wordpress.<8 碼>.png`，後三個指令印出的網址雜湊完全一致

Step 8: 驗收條件 4（連續兩次 build 檔名不變）

Run:
```bash
ls dist/og | sort > /tmp/og-run1.txt && npm run build >/dev/null 2>&1 && ls dist/og | sort > /tmp/og-run2.txt && diff /tmp/og-run1.txt /tmp/og-run2.txt && echo STABLE
```
Expected: 印出 `STABLE`（diff 無輸出）

Step 9: Commit

Run: `git add src/utils/og.ts "src/pages/og/[...slug].png.ts" "src/pages/[...slug].astro" "src/pages/[...slug].md.ts" scripts/verify-seo.mjs && git commit -m "feat(og): OG 圖網址改帶內容雜湊，三個消費端共用同一來源（#55）"`

---

### Task 3: 快取層與文件

Implements: `pre-launch-infra.md` #R8, #R12, #D11

Files:
- Modify: `public/_headers`（`/og/*` 的 TTL 與兩處註解）
- Modify: `scripts/verify-headers.mjs`（OG 斷言與其函式註解）
- Modify: `CLAUDE.md`（測試數量、路由說明、Scripts 段）

Interfaces:
- Consumes: Task 2 產出的 `/og/<slug>.<hash>.png` 網址格式
- Produces: 無（本 task 不被後續 task 依賴）

Step 1: 改 `public/_headers` 的 `/og/*` 規則

把

```
/og/*
  ! Cache-Control
  Cache-Control: public, max-age=604800
```

改成

```
# OG 圖：檔名帶 PNG 輸出位元組的內容雜湊（/og/<slug>.<hash>.png），內容一變檔名就變，
# 因此與 /_astro/* 同級吃一年 immutable。這樣快取正確性不再依賴 zone 的 Cache Rule
# ——2026-07-23 那次把瀏覽器 TTL 覆寫成一年的事件再發生一次也不會有人拿到舊圖。
/og/*
  ! Cache-Control
  Cache-Control: public, max-age=31536000, immutable
```

Step 2: 改 `public/_headers` 下方那段已過期的註解

把

```
# /og/*.png 仍是固定檔名（見上面 /og/* 那條）。那批圖由 satori 在 build 期產生，
# 雜湊化的做法還沒定案（讀輸出位元組那條路走不通，頁面與 endpoint 在同一次 build 內
# 渲染且無順序保證），追蹤在 issue #55。
```

改成

```
# /og/*.png 已於 2026-08-14 改為內容雜湊檔名（issue #55）。「頁面與 endpoint 在同一次
# build 內渲染且無順序保證」這個卡點的解法不是排順序，而是把渲染抽成共用模組的 memoized
# 函式：誰先要到網址誰觸發渲染，順序因此不重要（見 docs/specs/pre-launch-infra.md D10）。
# 舊的固定檔名網址不保留 301——它只保護得了切換當下那一批，之後每次改標題照樣產生
# 涵蓋不到的舊網址（D11）。
```

Step 3: 改 `scripts/verify-headers.mjs` 的 OG 斷言

把

```js
  // OG 圖的一週 TTL。從同一篇文章的 og:image 取路徑——不寫死 slug 的理由見
  // resolveOgImagePath，而要釘住實值的理由見上面那組靜態圖示的註解。
  const ogImagePath = await resolveOgImagePath(markdownPath.path.replace(/\.md$/, '/'));
  if (ogImagePath.path) {
    checks.push({
      path: ogImagePath.path,
      header: 'cache-control',
      name: `OG 圖的瀏覽器 TTL 為 604800 秒（${ogImagePath.path}）`,
      verify: (v) => (v === 'public, max-age=604800' ? null : `實際為 ${v ?? '（無）'}`),
    });
  } else {
```

改成

```js
  // OG 圖的一年 immutable，外加「網址真的帶雜湊」這道反向斷言。從同一篇文章的 og:image
  // 取路徑——不寫死 slug 的理由見 resolveOgImagePath，而要釘住實值的理由見上面那組
  // 靜態圖示的註解。
  //
  // 兩條缺一不可：只驗 TTL 的話，程式碼哪天退化回固定檔名，一年 immutable 反而變成
  // 比原本一週更嚴重的災難（改標題後社群卡片在回訪者瀏覽器裡凍一整年），而斷言照樣綠燈。
  const ogImagePath = await resolveOgImagePath(markdownPath.path.replace(/\.md$/, '/'));
  if (ogImagePath.path) {
    checks.push(
      {
        path: ogImagePath.path,
        header: 'content-type',
        name: `OG 圖網址帶內容雜湊且可取得（${ogImagePath.path}）`,
        verify: (v) =>
          !/^\/og\/.+\.[0-9a-f]{8}\.png$/.test(ogImagePath.path)
            ? '網址未帶 8 碼內容雜湊，快取正確性又退回只能靠 TTL 撐著'
            : v?.startsWith('image/png')
              ? null
              : `Content-Type 實際為 ${v ?? '（無）'}`,
      },
      {
        path: ogImagePath.path,
        header: 'cache-control',
        name: `OG 圖吃到一年 immutable（${ogImagePath.path}）`,
        verify: (v) =>
          v?.includes('immutable') && /max-age=\d{7,}/.test(v) ? null : `實際為 ${v ?? '（無）'}`,
      },
    );
  } else {
```

Step 4: 改 `scripts/verify-headers.mjs` 的 `resolveOgImagePath` 函式註解

把該函式 JSDoc 裡的這段

```
 * OG 圖目前仍是固定檔名 /og/<slug>.png，快取正確性因此完全靠 `_headers` 的一週 TTL
 * 撐著——而 2026-07-23 踩過的正是 zone Cache Rule 把它覆寫成一年，改標題後社群卡片
 * 整年不更新。雜湊化還沒定案（issue #35 的 og 部分），在那之前這條斷言就是唯一的
 * 退化偵測管道。
```

改成

```
 * OG 圖自 2026-08-14 起為 /og/<slug>.<hash>.png（issue #55），雜湊取自 PNG 輸出位元組。
 * 因此下面的斷言不只驗 TTL，也驗網址形狀——形狀退化回固定檔名時，一年 immutable 會
 * 讓 2026-07-23 那次的災情（改標題後社群卡片整年不更新）變得更嚴重而非更輕。
```

Step 5: 改 `CLAUDE.md` 三處

5a. Commands 段裡 `npm test` 那個 code block 的測試數量與涵蓋範圍註解：

```
npm test           # 115 unit tests covering scripts/lib/ (WordPress migration toolchain + markdown
                    # export + DNS-AID parsing/evaluation + page-md.mjs page→markdown conversion +
                    # md-path.mjs path mapping + og-image.mjs OG rendering/hashing)
```

5b. 路由說明（原 `- \`/og/[...slug].png\` — OG images generated at build time (satori + sharp)`）：

```
- `/og/[...slug].png` — OG images generated at build time (satori + sharp). Filenames carry a
  content hash of the PNG bytes (`/og/<slug>.<hash>.png`) so they can take the same one-year
  immutable cache as `/_astro/*`; the URL comes from `getOgImage()` in `src/utils/og.ts`, which
  every consumer (og:image, BlogPosting JSON-LD, `.md` frontmatter) and the endpoint itself share
```

5c. Scripts 段，在 `md-path.mjs` 那組之後、`build-manifest` 之前補一句：

```
`scripts/lib/og-image.mjs` (pure satori+sharp OG rendering and content hashing, under test;
wired up by `src/utils/og.ts`, which memoizes per post so page render and the OG endpoint never
render the same image twice),
```

Step 6: 確認沒有殘留的舊網址寫法

Run:
```bash
grep -rn '/og/${post.id}' src scripts CLAUDE.md
grep -n 'max-age=604800' public/_headers
```
Expected: 第一條無輸出（三個消費端都已改走 `getOgImage`）；第二條只剩 `/n8n-resources/*` 與 `/samples/*` 兩行

Step 7: 全套本機驗證

Run: `npm test && npm run build && npm run verify:seo`
Expected: 測試 115 全過；build 成功；`verify:seo` 36 項全過

不要跑 `npm run verify:headers`：它打的是正式站，本次改的 TTL 要部署後才生效，本機跑必然 FAIL，那是預期而非退化。

Step 8: Commit

Run: `git add public/_headers scripts/verify-headers.mjs CLAUDE.md && git commit -m "chore(og): OG 圖改吃一年 immutable 並補雜湊形狀斷言（#55）"`

---

## 部署後才做得完的收尾

以下三項在合併部署後才驗得到，不屬於任何 task 的通過條件：

1. `npm run verify:headers` — OG 圖回 `public, max-age=31536000, immutable`、網址帶雜湊
2. `npm run verify:assets` — 線上頁面引用的資產（含新的 OG 網址）皆回 200
3. Rich Results Test 對任一文章頁仍通過（驗收條件 3）
