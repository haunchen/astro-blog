# OG 圖改內容雜湊檔名 — 設計

- **日期**：2026-08-14
- **來源**：issue #55（自 #35 拆出）
- **Spec**：`docs/specs/pre-launch-infra.md`（R4、R8 的 delta，見該檔 Pending Changes）

## 問題

`/og/*.png` 是固定檔名＋會變的內容。快取正確性只能靠 `_headers` 的一週 TTL 撐著，而 TTL 是
Cloudflare zone 可以覆寫的東西——2026-07-23 實際發生過：Cache Rule 把瀏覽器 TTL 一律改成一年，
`_headers` 寫的值全被蓋掉，而瀏覽器快取是 Purge Cache 清不到的。改標題之後，社群卡片在回訪者
的瀏覽器裡可以整年不更新。

cover 與 logo 已在 #35 用 astro:assets 解掉同一個問題（見 site-pages.md D19）。OG 圖不能照辦：
它不是靜態檔案，是 `src/pages/og/[...slug].png.ts` 在 build 期以 satori + sharp 產生的。

## 為什麼原本卡住

需要 OG 網址的三個消費端——`BaseLayout.astro` 的 `og:image`、`[...slug].astro` 的 BlogPosting
JSON-LD `image`、`[...slug].md.ts` 的 frontmatter `image`——都在頁面渲染時就要拿到網址，而 PNG
的位元組要到 endpoint 渲染完才存在。頁面與 endpoint 在同一次 build 內渲染，Astro 不保證順序，
所以「讀輸出位元組算雜湊、回填網址」在原本的結構下走不通。

## 實測（2026-08-14，本機）

決定設計之前先驗了 issue 點名要驗的前提。結果同時翻掉了候選方案 B、並讓輸出位元組雜湊變成
明確的優解：

| 實驗 | 結果 |
|------|------|
| 同一份字型、同一標題連渲兩次 | PNG sha256 完全相同 → satori + sharp 的輸出是決定性的 |
| subset 字型從 56,764 bytes 縮到 4,772 bytes（只留該標題用字），渲同一標題 | PNG sha256 一模一樣，連中間的 SVG 都相同 |
| 單張渲染耗時 | 約 8 ms（35 張約 0.3 秒） |

第二條是關鍵：**輸出只取決於實際用到的字形輪廓，與字型檔本身的位元組無關**。因此

- 候選 B（以輸入算雜湊）若把字型位元組算進去，每發一篇帶新字的文章就會翻新全部 35 張圖的
  檔名，直接違反驗收條件 4；若不算進去，subset 變動本來就不影響輸出，也不會漏。issue 裡
  「不算就換字型會漏掉」的疑慮只在字型**家族或版本**變更（字形輪廓真的變了）時成立，那是罕見
  事件，而且屆時 B 的另一個弱點仍在：範本改了（配色、字級、版面）雜湊不會變，得靠人手動 bump
  版本號，忘了 bump 就是本 issue 要解決的問題原樣重現。
- 輸出位元組雜湊（A 與下面採用的 C 共有的性質）天然滿足驗收條件 4：內容沒變 → 位元組沒變 →
  檔名沒變；新增文章不影響既有文章的輸出。

## 方案比較

| 方案 | 做法 | 取捨 |
|------|------|------|
| A | `astro:build:done` 事後掃 `dist/og/*.png` 改名，再回寫 `dist/**/*.html` 與 `dist/**/*.md` 的引用 | 雜湊語意正確，但多一層改名器，且必須涵蓋全部消費端產物；`pageMarkdownVariants` 也掛在 `astro:build:done`，兩個 integration 的先後順序變成新的隱形約束 |
| B | 以輸入（標題＋分類＋範本版本）算雜湊 | 實作最小，但範本變更要人手動 bump 版本號——本 issue 的問題原樣重現 |
| **C（採用）** | 渲染抽成共用模組的 memoized 函式，誰先要到誰觸發渲染，結果快取在模組層 | 雜湊來自真實輸出位元組，不需事後改名器、不需回寫產物、不需手動 bump；代價是多一層 memo 快取（35 張 × 約 32 KB ≈ 1 MB）與 dev 模式下開文章頁會順手渲一張圖（8 ms） |

C 直接繞開了「build 內無順序保證」這個原始難題：順序不重要，因為渲染由第一個要到網址的人觸發。

這個 repo 已有同形狀的寫法可以參照——`[...slug].md.ts` 的 `containerPromise` 就是模組層單例。

## 設計

### 核心模組

`scripts/lib/og-image.mjs`（純函式、零 astro 依賴，比照 `md-export.mjs` 的定位）：

- `renderOgImage({ title, category, siteName, fonts })` → `{ bytes, hash }`。satori 版面樹與
  sharp 轉檔從現有 endpoint 整段搬進來，`hash` 為 PNG 位元組 sha256 的前 8 碼（長度與
  `build-font-css.mjs` 的字型雜湊一致）。
- `ogImagePath(id, hash)` → `/og/<id>.<hash>.png`。

`src/utils/og.ts`（接線層）：

- `getOgImage(post)` → `{ path, bytes, width, height, type }`。
- 以 `Map<string, Promise<...>>` 依 `post.id` memoize。**快取的是 Promise 不是結果**，否則同一篇
  被併發要兩次會渲染兩次。
- 負責讀 `src/assets/og-fonts/*.woff`、接 `CATEGORY_LABEL` 與 `SITE.name`。

`src/pages/og/[...slug].png.ts` 縮成兩件事：`getStaticPaths` 對每篇已發佈文章（經
`getPublishedPosts()`）呼叫 `getOgImage` 取 `path`，拆出 `<id>.<hash>` 當 `params.slug`；
`GET` 回傳快取的 `bytes`。

**正確性不依賴模組單例**。實測已證實同輸入的 PNG 位元組完全相同，所以就算 Vite 在某個情境下給了
兩份模組實例，兩邊算出的雜湊也一樣——單例失效的後果只是多渲染幾次，不是網址不一致。這條性質是
選 C 的安全底線，不是附帶好處。

### 消費端

三處各改一行，都改成取 `getOgImage(post)` 回傳的 `path`（需要絕對網址的地方照舊套 `SITE.url`）：

- `src/pages/[...slug].astro`：BlogPosting JSON-LD 的 `image`、傳給 BaseLayout 的 `ogImage` prop
- `src/pages/[...slug].md.ts`：frontmatter 的 `image`

`BaseLayout.astro` 不動：它用 `ogImagePath.endsWith('.png')` 分流 `og:image:width/height/type`，
雜湊插在副檔名之前，這條分流照樣成立。

### 快取層

- `public/_headers` 的 `/og/*`：`max-age=604800` → `max-age=31536000, immutable`，與 `/_astro/*`
  同級；該區塊「雜湊化尚未定案」的註解換成定案後的理由。
- `public/_routes.json` 的 `/og/*` 排除不動。

改完之後 `/og/*` 的快取正確性不再依賴任何 dashboard 設定：zone 再把瀏覽器 TTL 覆寫成一年，也不會
有人拿到舊圖。這正是 cover/logo 走 astro:assets 得到的同一個性質。

### 舊網址

不留相容路徑，舊的 `/og/<slug>.png` 直接 404。

理由：OG 圖網址的唯一來源是頁面的 `og:image` meta，社群爬蟲重抓就拿到新網址（不像 cover/logo 是
站台級識別圖、可能被外部直接引用，那兩個在 #35 有 301）。更關鍵的是 301 只能保護切換當下那一批
固定檔名網址——之後每次改標題，舊雜湊網址一樣會消失，而 301 涵蓋不了（它只認得固定檔名那一個
來源）。為一次性過渡永久背一層自動產生 `_redirects` 的機械，不划算。

### 測試與退化防線

`scripts/lib/og-image.test.mjs`（納入 `npm test`）：

1. 同輸入連渲兩次，`hash` 相同
2. 同一份來源字型做出大小不同的兩個 subset，渲同一標題 `hash` 仍相同（驗收條件 4 的根本前提）
3. 標題改一個字，`hash` 必變
4. `ogImagePath` 的格式為 `/og/<id>.<hash8>.png`

測試字型用 `node_modules` 裡版本固定的 Inter woff 當來源，**不碰 `src/assets/og-fonts/`**——那個
目錄被 gitignore、由 build 前的 `subset-fonts` 產生，CI 若先跑 `npm test` 就還不存在。

`scripts/verify-seo.mjs` 補一條：每個文章頁 HTML 的 `og:image` 必須是 `/og/<slug>.<hash8>.png`
格式，且該檔在 `dist/` 真的存在。md 那側已有「`.md` 變體 frontmatter 的 image 指向存在的檔案」
涵蓋，兩條合起來就是「三個消費端算出的網址一致且指得到東西」。

`scripts/verify-headers.mjs`：OG TTL 的實值斷言從 604800 改成 31536000 ＋ `immutable`；比照既有的
logo 斷言補「OG 網址必須帶雜湊」，退化成固定檔名時線上當場紅燈。`resolveOgImagePath` 檔頭那段
「雜湊化還沒定案」的註解一併更新。

## 驗收（沿用 #35 / #55）

1. `verify:seo` 全過，雜湊檔名能被解析到實際輸出的檔案
2. `og:image` 指向的 URL 實際回 200，且 `og:image:width`/`height`/`type` 仍與該張圖相符
3. Rich Results Test 對文章頁仍通過
4. 連續兩次 build 內容未變時檔名不變；新增一篇文章不改變既有文章的 OG 圖檔名

## 不做

- 舊固定檔名網址的 301 或雙份輸出（理由見上）
- OG 圖範本本身的視覺調整（與本次無關）
- `favicon.png` / `apple-touch-icon.png` 的雜湊化（#35 已判定例外：瀏覽器與部分爬蟲直接抓慣例路徑）
