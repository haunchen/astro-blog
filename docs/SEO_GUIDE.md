# SEO 操作指南

給未來要改這個站的人（含 AI agent）看的操作手冊，不是成果報告。成果與待辦分別見
`docs/specs/seo-perfection.md`（施工決策紀錄）與 `docs/SEO_TODO.md`（未完成事項）。

## 單一來源（SSOT）

SEO 相關設定只有兩個地方，改動前一律先看這兩個檔案，不要在個別頁面裡另開一套：

- `src/utils/site-meta.ts` — 網站層級常數（`SITE`）、JSON-LD 工廠函式
  （`ORGANIZATION_JSONLD`、`WEBSITE_JSONLD`、`PUBLISHER_JSONLD`、`collectionPageJsonLd()`）、
  `pageTitle()`（`<title>` 的品牌後綴規則）。
- `src/layouts/BaseLayout.astro` — 所有頁面共用的 `<head>` meta 輸出（astro-seo）、
  BreadcrumbList JSON-LD 組裝、字型 preload、CSP 相依的 script 寫法限制。

### 新增頁面時要傳哪些 prop

`BaseLayout` 目前接受的 props（見檔案開頭 `interface Props`）：

| prop | 必填 | 說明 |
|------|------|------|
| `title` | 是 | 一律包 `pageTitle('頁名')`，不要自己拼字串，否則品牌後綴規則會不一致 |
| `description` | 否但實務必填 | 空字串會通過 `verify:seo`（只檢查非空），但等於放棄 SERP 摘要 |
| `ogImage` | 否 | 不傳則 fallback `/cover.webp`（`BaseLayout` 內處理，不要在頁面裡重複判斷） |
| `article` | 文章頁專用 | 傳入才會輸出 `og:type=article` 與 `article:published_time` 等 |
| `jsonLd` | 否 | 該頁專屬的 JSON-LD 節點陣列；`Organization`/`WebSite` 已由 BaseLayout 自動附加，不要重複塞 |
| `breadcrumbs` | 列表頁／內頁建議傳 | 傳入才會輸出可見麵包屑與 `BreadcrumbList` JSON-LD；**不含當前頁**，當前頁名取自 `title` 去掉品牌後綴 |
| `noindex` | 404 等頁面 | 會同時關閉 `robotsExtras`（大圖預覽等指令對不索引的頁面沒有意義） |
| `preloadImage` | 首頁與文章頁的封面圖 | 只有真的是該頁 LCP 元素的圖才傳，亂加反而搶首屏頻寬 |

長度規範（Google／squirrelscan 的建議值，不是每項都有自動化擋控，見下方「目前的強制程度」）：

- **title**：30–60 字元（含品牌後綴後的完整字串）。太短沒關鍵字承載，太長會在 SERP 被截斷。
- **description**：120–160 字元。

**目前的強制程度**（如實記錄，不是每個都自動擋）：
- 文章 frontmatter 的 `description`：`.githooks/pre-commit` 擋在 commit 當下，120–160 字元硬性檢查。
- 文章 frontmatter 的 `title`：`src/content.config.ts` 的 zod schema 只擋 `max(60)`，**沒有下限檢查**，
  而且是 build 時才會擋（不是 commit 時）。新增文章時仍要自己注意下限。
- 靜態頁（`about.astro`、`category/[category].astro`、`contact-frank.astro` 等手寫頁面）的
  title/description：**完全沒有自動化長度檢查**，全靠寫的人自己數字元。改這些頁面時要手動核對長度。

麵包屑當前頁名與 `<title>` 必須是同一字串（`Breadcrumbs.astro` 元件的 prop 註解也這樣要求）——
`BaseLayout` 會自動用 `title.replace(' - ${SITE.name}', '')` 取頁名塞進 `BreadcrumbList`
最後一階，如果頁面自己組的 `pageName` 跟傳給 `<Breadcrumbs current={...}>` 的字串對不上，
可見麵包屑與結構化資料就會不一致。

## 字型管線

`scripts/build-font-css.mjs` 在 `npm run dev` / `npm run build` 前自動執行（見
`package.json` 的 `dev`/`build` script，不是 Astro integration），產出兩個 gitignore
的 build artifact：

- `src/styles/fonts.css` — 只含全站實際出現字元交集到的 `@font-face` 分片
- `public/fonts/*.woff2` — 對應的自 host 字型檔（逐分片再依實際命中字元 subset 一次）

**為什麼不能直接 `import '@fontsource/xxx/index.css'`**：那樣會把整套 unicode-range
分片全部帶進 bundle（Noto Sans TC 105 個分片、Noto Serif TC 108 個，含用不到的
cyrillic/greek/vietnamese），實測會讓主 CSS 膨脹到 284KB 且是 render-blocking（見
`docs/data/seo-baseline-2026-07-23.md` 的 Performance 43/100 主因）。裁切後的 CSS
（`build-font-css.mjs` 直接輸出，未經 Vite/Tailwind 打包前）本次實測 39.1KB；
最終 `dist/_astro/*.css` 最大者實測 58,377 bytes（約 57KB，與 spec 記錄的
「58KB」一致）。

**改字型要改哪裡**：
1. `scripts/build-font-css.mjs` 的 `FAMILIES` 陣列——增刪要用的 `@fontsource` 套件與字重。
2. `src/styles/global.css` 的 `--font-serif` / `--font-sans` / `--font-mono`（約在檔案
   第 42–44 行）——CSS 變數的 font-family 堆疊要跟 `FAMILIES` 對應，否則裁切了字型檔卻
   沒人引用它。
3. 不要碰 `src/styles/fonts.css` 本身——那是產物，手動編輯會在下次 build 被覆蓋。

**已知限制**：字元集合的取樣範圍是 `src/content/**` 與 `src/**`（含 `.astro/.ts/.tsx/.js/.mjs`）。
本站全靜態、無使用者產生內容，這個集合目前就是完整值域。**若日後加入任何動態內容
（留言、使用者輸入等），未被涵蓋到的字元會 fallback 到系統字型**（`--font-*` 堆疊本身
就帶了 `Georgia, serif` / `system-ui, sans-serif` / `monospace` 等系統字型 fallback），
不會顯示豆腐字，但排版觀感會不一致，需要重新評估是否要換成完整字型或再次跑裁切。

**另一支容易搞混的腳本**：`scripts/subset-fonts.mjs` 是給 **OG 圖產生**（`satori`）用的
字型 subset，透過 Google Fonts API 的 `text=` 參數取得只含用到字元的 woff。這是完全獨立
的管線（產物是 `src/assets/og-fonts/*`，同樣 gitignore），跟上面的網頁字型 CSS 管線
`build-font-css.mjs` 沒有關係，不要把兩者的改動邏輯混在一起。這支腳本內建一個守門：
CJK 唯一字元數超過 700 會警告、超過 800 會直接 throw（Google Fonts 的 `text=`
超過約 800 個唯一字元會被靜默忽略、回傳整套字型，導致 OG 圖豆腐字但 build 仍是綠燈）。

## 結構化資料

目前輸出的型別：`Organization`、`WebSite`（全站，`BaseLayout` 自動附加）、`BreadcrumbList`
（傳了 `breadcrumbs` prop 的頁面）、`BlogPosting`（文章頁）、`CollectionPage`（列表頁）、
`ProfilePage` + `Person`（`/about/`）。

**同一個 logo 欄位，兩處寫法刻意相反**——這是最容易被「順手改成一致」搞壞的地方：

- `ORGANIZATION_JSONLD.logo`（獨立 `Organization` 節點）是**純字串 URL**。
- `PUBLISHER_JSONLD.logo`（`BlogPosting.publisher`）是 **`ImageObject`**（含 `width`/`height`）。

原因：schema.org 規格上兩種寫法都合法，但 squirrelscan 對獨立 `Organization` 節點的
`logo` 只接受字串（給 `ImageObject` 反而會被判缺欄位）；Google 的 Rich Results 驗證器
則要求 `BlogPosting.publisher` 內聯（不能用 `{ '@id': ... }` 外部參照）且 `logo` 要是
完整 `ImageObject`（純字串會被判缺 `publisher.logo`）。兩個驗證器的要求正好相反，
所以 `site-meta.ts` 裡這兩個常數分開定義，**不要合併成一個共用常數**。

加新結構化資料型別時的注意事項：
- `@id` 要跟既有的 `${SITE.url}/#org` / `${SITE.url}/#website` 命名慣例一致，
  讓不同節點間能互相參照而不是各自重複展開。
- 加完記得同步在 `scripts/verify-seo.mjs` 補一條對應的 build 後檢查（目前只對
  `BlogPosting`/`BreadcrumbList` 做欄位完整性檢查，其餘型別只驗證「JSON 可 parse」）。
- 內容要對應頁面上實際可見的東西——`about.astro` 的 `Person` 欄位每一項都取自頁面上
  已經顯示的經歷／技能／地點，沒有補未公開資訊，這是刻意的（避免結構化資料宣稱頁面上
  查證不到的內容）。

## 驗證流程

三層，由快到慢：

1. **`.githooks/pre-commit`**（commit 當下，秒級）：只檢查有 staged 變動的文章
   frontmatter 必要欄位（title/description/date/category）與 description 長度
   120–160。啟用靠 `npm install` 觸發的 `prepare` script 設定
   `git config core.hooksPath .githooks`，不是 husky。
2. **`npm run verify:seo`**（build 後，秒級，純 regex 掃 `dist/*.html`，見
   `scripts/verify-seo.mjs`）：12 條規則——每頁恰一個 `<title>`、非空
   description、canonical host 正確、非空 robots、完整 OG 四項、twitter:card、
   恰一個 `<h1>`、JSON-LD 皆可 parse、文章頁有 `BlogPosting`+`BreadcrumbList`
   且 `publisher.name`/`publisher.logo` 齊全、`sitemap.xml` 可解析且無死連結、
   `robots.txt`/`llms.txt`/`site.webmanifest` 存在、無孤兒頁。實測：104 個 HTML
   頁面、12 項規則全數通過。
3. **`npx astro check`**：TypeScript / Astro 型別檢查，跟 SEO 內容無關，但能擋下
   `BaseLayout` props 傳錯型別這類低級錯誤。

CI 對應：
- `.github/workflows/seo-pr.yml`：任何 PR 都跑（刻意不限分支，SEO 相關改動不一定
  來自特定分支）。流程是 build → `verify:seo` → 起 preview server → 對首頁／文章列表／
  關於我／一篇文章頁樣本跑 Lighthouse，門檻 SEO=100、Accessibility≥95、
  Best Practices=100、**Performance≥90（不是 95）**——因為 GitHub 共用 runner 的
  CPU/IO 效能波動大，95 會造成大量假失敗，90 是務實下限，真正的效能回歸要看
  Lighthouse 分數的趨勢而不是單次卡死。
- `.github/workflows/seo-daily.yml`：每日對**正式站** `https://frankchen.tw` 跑
  `squirrelscan audit --offline`，報告寫入 Job Summary 並上傳 artifact（保留 30 天）。
  `--offline` 只關雲端功能（渲染／報告發佈／額度檢查），本地稽核本體（SEO/Performance/
  Security/Agents 四項分數）不受影響。

**本地跑 squirrelscan 時，哪些失敗是假陽性（不用追）**：本地用 `astro preview`
（`localhost:4321`）稽核時，`public/_headers` 與 `public/_redirects` 完全不生效——
那是 Cloudflare Pages 專屬的設定檔，`astro preview` 不會讀取。因此以下項目在本地
一定會失敗，**驗收一律以正式站或 CI 的 headers 檢查為準**：
- Sitemap Domain（本地 sitemap 內是 `https://frankchen.tw/...`，但爬蟲從
  `http://localhost:4321` 出發，兩者網域對不上）
- Canonical Chain / redirect chain（`_redirects` 的轉址規則不生效）
- HTTPS 未啟用（本地本來就是 http）
- 快取策略偏弱（`_headers` 的 `Cache-Control` 規則不生效）
- CSP 缺失、缺 `X-Frame-Options` 等安全標頭（同樣是 `_headers` 沒生效）

## CSP

`public/_headers` 的 `Content-Security-Policy` 已把 `script-src` 收緊到 `'self'`
（不含 `unsafe-inline`）。實務影響：

- **不可以再寫 `<script is:inline>`**（或任何會被 Astro 判定為需要保留內聯的 script）——
  會被瀏覽器依 CSP 擋掉，不會執行也不會出現 build 錯誤，只會在瀏覽器 console 出現
  CSP 違規訊息，很容易漏掉。
- 正常寫法：像 `src/components/Nav.astro` 那樣寫普通 `<script>`（不加 `is:inline`）。
  `astro.config.mjs` 設了 `vite.build.assetsInlineLimit: 0`，Astro 會把這類 hoisted
  script 打包成外部檔案（同源，`script-src 'self'` 放行），而不是內聯進 HTML。
  全站掃描結果是 0 個 inline script，才能把 CSP 鎖到最嚴。
- JSON-LD（`<script type="application/ld+json">`，見 `JsonLd.astro`）雖然寫了
  `is:inline`，但**不受 `script-src` 管控**——瀏覽器不會把 `application/ld+json`
  當可執行腳本解析，所以這裡的 `is:inline` 不是問題，不要誤以為要一併改掉。
- `style-src` 仍保留 `'unsafe-inline'`：Astro View Transitions（`ClientRouter`）會
  逐頁產生內容不同的 `view-transition-name` 樣式並內聯輸出，無法外部化也無法預先
  算 hash，這是留 `unsafe-inline` 的唯一原因；CSP 真正的防護關鍵面 `script-src`
  已收緊，風險可接受。

## 刻意不做的事

以下幾項經過評估後決定不實作，避免後人重新提案前先看這裡：

- **WebSite SearchAction**：本站沒有站內搜尋功能，宣告 SearchAction 卻沒有對應端點
  是錯誤標記，Google 會忽略甚至視為垃圾訊號。真的加了搜尋頁再補。
- **SoftwareApplication / Product**：n8nManager 只在首頁與 `/about/` 以作品集卡片
  形式出現，沒有專屬產品頁、沒有可驗證的價格／評分／下載資訊，硬掛會是無對應內容的
  標記。
- **FAQPage / HowTo**：Google 已於 2023 大幅限縮這兩種標記的 rich result 資格
  （FAQ 僅限權威醫療／政府網站，HowTo 已全面下架），現有文章也沒有結構化的 FAQ
  區塊，加了拿不到任何 SERP 增益。
- **web-vitals RUM**：`/privacy-policy/` 明文承諾「未安裝追蹤型分析工具」，裝 RUM
  會與該承諾衝突；本站為純靜態輸出，多一支監控 JS 反而傷 INP。效能改用 CI 端
  Lighthouse 定期量測（見上方「驗證流程」）。

（以上決策的完整背景見 `docs/specs/seo-perfection.md` 對應 Requirement；未完成、
待補的事項見 `docs/SEO_TODO.md`。）
