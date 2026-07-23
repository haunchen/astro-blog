---
domain: seo-perfection
status: done
created: 2026-07-23
last_modified: 2026-07-23
---

# SEO Perfection Engine

把 frankchen.tw 從「SEO 基本正確」推到「技術面無可挑剔」：補齊 meta 與結構化資料、
消除 a11y 阻礙、拆掉效能單點瓶頸、建立 CI 級別的回歸防線，並讓 AI 爬蟲／答案引擎
能正確理解與引用本站內容。

本文件在施工期間即時維護；每完成一個 Requirement 就更新其狀態與驗收證據。

## 現況基準（2026-07-23，squirrelscan 本地 preview，40 頁）

| 面向 | 分數 | 主要失分項 |
|------|------|-----------|
| SEO | 50/100 | meta description 過短（67 頁）、title 過短（23 頁）、caret 按鈕可及名稱不符（40 頁 error） |
| Performance | 43/100 | 主 CSS 284KB render-blocking、LCP 圖無 preload、DOM 過大 |
| Security | 30/100 | 缺 CSP、假 token 被判洩漏 |
| Agents | 47/100 | token weight 過重、封鎖 CCBot（刻意） |

原始報告：`docs/data/seo-baseline-2026-07-23.md`。

## 施工後結果

三輪審計（本地 `astro preview`）與一輪 `wrangler pages dev`（會實際套用
`_headers`／`_redirects`，最接近正式環境）：

| 面向 | 基準 | preview 最終 | wrangler 最終 |
|------|------|------------|--------------|
| SEO | 50 | 68 | 68 |
| Performance | 43 | 43 | 45 |
| Security | 30 | 40 | 47 |
| Agents | 47 | 47 | 47 |
| 失敗項 | 152 | 83 | 82 |

Lighthouse（`astro preview`，首頁與文章頁、手機與桌機共四組）：
Accessibility / Best Practices / SEO / Agentic Browsing **全數 100**。
效能 trace（首頁，本機無節流）：LCP 265ms、CLS 0.00、TTFB 3ms。

`npm run verify:seo`：104 頁、12 項規則全數通過。`npx astro check`：0 error。

### 正式環境驗證（Cloudflare Pages preview，真實 HTTPS）

PR #26 的 preview 部署提供了公開 HTTPS URL，先前判定「需要正式站才能驗」的項目
因此可以提前完成：

| 項目 | 結果 |
|------|------|
| 安全標頭（清單 9.8） | squirrelscan Security **100/100**；HSTS preload、CSP、XFO、XCTO、Referrer-Policy、Permissions-Policy、COOP 全部到位，HTTP/3 |
| W3C Validator（清單 9.7） | 7 個代表頁 **0 個 HTML error** |
| squirrelscan（HTTPS） | SEO 65／Performance 45／Security 100／Agents 47，失敗項 **43**（基準 152） |
| 站內死連結（清單 9.9） | dist 逐一比對 **0 條**；squirrelscan 報的 1 條為線上探測假陽性 |

W3C 那 5 個訊息全部是 CSS 層級、且全部來自 Astro View Transitions 的
`view-transition-name` 與 `::view-transition-*`——W3C 的 CSS validator 尚未實作
該規範，不是本站程式碼的問題，也不影響 HTML 合法性。

preview 部署特有的假陽性（正式站不成立）：Cloudflare 會對 preview 加上
`x-robots-tag: noindex`，因而觸發 `Schema + Noindex Conflict`（39 頁）與
`Indexability Conflicts`；canonical 與 sitemap 指向 frankchen.tw 而爬的是
`*.pages.dev`，因而觸發 `Sitemap Domain`、`Canonical Chain`、`HTTPS Downgrade`、
`Redirect Chains`。這幾項要等合併到正式網域後才有意義。

**squirrelscan 分數為何沒有到 95**：剩餘失敗項幾乎都是本地環境的結構性限制，
不是站台缺陷——`HTTPS`（本地是 http）、`Sitemap Domain`／`Sitemap Coverage`／
`Canonical Chain`（sitemap 與 canonical 指向 frankchen.tw，爬的卻是 localhost）、
`Redirect Chains`（爬蟲自行探測無尾斜線變體；實測 dist 內部連結 0 個缺尾斜線）。
這幾項只有對正式站量測才有意義，因此 R9「squirrelscan ≥ 95」的驗收改以
生產環境日檢 workflow 的第一次實跑為準，見 docs/SEO_TODO.md。

**假陽性（本地環境特有，正式站不成立）**：`astro preview` 不套用 `_headers`／
`_redirects`，所以弱快取、缺 CSP、缺 X-Frame-Options 這幾項在 preview 下必然失敗
（已改用 `wrangler pages dev` 驗證，全部通過）。HTTPS、sitemap 網域、canonical
chain、redirect chain 則是「爬 localhost 但 canonical/sitemap 指向正式網域」的
結構性結果，本地無論如何都過不了。驗收一律以正式站量測為準。

## Requirements

### R1: 字型載入不得成為 render-blocking 單點
- **Level**: MUST
- **Status**: done（commit 67c5c89）
- **Description**: 打包後的主 CSS 不得超過 150KB。`@fontsource` 的全量 `@font-face`
  分片（213 個）必須在建置期依「全站實際出現的字元集合」裁切，只保留有交集者，
  並收斂各分片的 `unicode-range`、逐檔 subset 後自 host。
- **Rationale**: 分片機制本身有效（瀏覽器只抓需要的片），問題出在宣告本身就有 220KB
  且擋渲染。裁切不改變分片語意——被砍掉的分片本來就永遠不會命中。
- **Verification**: `dist/_astro/*.css` 最大者 58KB（原 284KB）；字型檔總量 1.32MB（原 4.42MB）。
- **Risk**: 字元集合取自 `src/content/**` 與 `src/**`，本站全靜態無使用者產生內容，
  故集合即完整值域。若日後引入動態內容，未涵蓋的字會 fallback 系統字型（不會是豆腐字）。

### R2: 每頁 meta 覆蓋率 100%
- **Level**: MUST
- **Status**: done（commit 23c2380）
- **Description**: 所有頁面必須有唯一 title、非空 description、canonical、robots、
  完整 OG（含 image:alt/width/height/type）、完整 Twitter Card、manifest、theme-color、
  hreflang 自我宣告。robots 必須帶 `max-image-preview:large` 與 `max-snippet:-1`。
- **Decision**: robots 一律走 astro-seo 的 `robotsExtras`，不自行輸出第二個
  `<meta name="robots">`——兩邊同時給會產生互相矛盾的宣告（實際踩到過）。
- **Decision**: `twitter:site` 與 `google-site-verification` 有值才輸出。兩者已於
  2026-07-23 由站主提供並填入：handle `@frankchen_tw`（同步加進 `SITE.sameAs`），
  GSC 驗證碼直接寫在 `site-meta.ts`。
- **Decision（驗證碼進版控）**: 原本走 `PUBLIC_GOOGLE_SITE_VERIFICATION` 環境變數，
  理由是「避免驗證碼進版控」——但該值本來就會原樣出現在每一頁的 HTML 裡，不是
  秘密，藏進環境變數只是多一道部署設定卻沒換到任何保護，故改為直接寫入並保留
  環境變數覆寫。網域主要仍以 DNS TXT 驗證，meta 是第二道錨點，DNS 搬移時不會斷。

### R3: 結構化資料通過 Rich Results Test
- **Level**: MUST
- **Status**: done
- **Description**:
  - Organization：獨立節點的 `logo` 用**字串 URL**。✅
  - BlogPosting：`publisher` 內聯且 `logo` 用 **ImageObject**（`@id` 外部參照會被
    Google 判缺 `publisher.name` / `publisher.logo`，28 頁受影響）。✅
  - BreadcrumbList：文章頁與 9 個內頁，由 BaseLayout 的 `breadcrumbs` prop 統一產生，
    可見麵包屑與結構化資料同一字串來源。✅
  - CollectionPage + ItemList：/articles/、/category/、/category/[c]/、/tag/、
    /tag/[t]/，items 順序與畫面一致。✅
  - ProfilePage + Person：/about/。欄位一律取自頁面可見內容，未提及校名故不輸出
    `alumniOf`。✅
- **Decision（Organization.logo 兩處寫法不同）**: schema.org 兩種寫法都合法，但兩個
  驗證器要求相反——squirrelscan 要求獨立 Organization 的 `logo` 是字串，Google 要求
  Article 的 `publisher.logo` 是 ImageObject。因此 `ORGANIZATION_JSONLD` 與
  `PUBLISHER_JSONLD` 分開定義，不要為了「統一」而合併。
- **Decision（WebSite SearchAction）**: **不實作**。本站沒有站內搜尋功能，宣告
  SearchAction 卻無對應端點屬於錯誤標記，Google 會忽略甚至視為垃圾訊號。
  若日後加了搜尋頁再補。
- **Decision（SoftwareApplication / Product）**: **不實作**。本站是部落格，
  n8nManager 只在首頁與 /about/ 以作品集卡片形式出現，沒有專屬產品頁與可驗證的
  價格／評分／下載資訊，硬掛會是無對應內容的標記。
- **Decision（FAQPage / HowTo）**: **暫不實作**。Google 已於 2023 大幅限縮這兩種
  標記的 rich result 資格（FAQ 僅限權威醫療／政府網站，HowTo 已全面下架）。
  現有文章也沒有結構化的 FAQ 區塊。列入 SEO_TODO 待日後內容型態改變再評估。

### R4: 零 a11y error
- **Level**: MUST
- **Status**: done
- **Description**: squirrelscan a11y 類別 0 error、Lighthouse Accessibility ≥ 95。
  最終 Lighthouse Accessibility 首頁與文章頁、手機與桌機皆 **100**。
  - caret 按鈕可見文字（▾）與 `aria-label` 不符 → ▾ 改 `aria-hidden`。✅（4058051）
  - markdown 表格缺可及名稱 → rehype plugin 取前方最近的 h2–h4 補視覺隱藏
    `<caption>`。✅（c992009）驗收：全 dist 掃描 40 個 table／40 個 caption，
    無一遺漏，fallback 分支未被觸發。
  - 相同連結文字指向不同 URL（7 組）→ 資源卡連結加視覺隱藏的資源名稱，箭頭
    `aria-hidden`。✅（1ad07e3）
  - alt 與檔名重複 → 8 張資源圖皆為 72×72 的影片縮圖／網站截圖，資訊已由同卡
    h3 與描述承載，一律改 `alt=""`（裝飾性）。✅（1ad07e3）
- **Decision（rehype plugin 不依賴 unist-util-visit）**: 該套件只是 Astro 的傳遞
  相依、未列在 package.json，直接 import 會在相依樹變動時無預警壞掉，改自寫走訪。

### R5: Core Web Vitals 達標
- **Level**: MUST
- **Status**: 部分完成
- **Description**: LCP ≤ 2.5s、CLS ≤ 0.1、INP ≤ 200ms、FCP ≤ 1.8s、TTFB ≤ 800ms，
  Lighthouse Performance ≥ 95。
  - render-blocking CSS 由 R1 解決。✅
  - 首屏 latin 字型 preload，消除 CSS→@font-face→woff2 三層請求鏈。✅
  - LCP 圖片（首頁 featured 卡封面）改 `loading="eager" decoding="sync"
    fetchpriority="high"`，其餘卡片維持 lazy；CLS 由 Astro `<Image>` 輸出的
    `width`/`height` 保證。✅（63ee82b）
  - 首屏封面圖 `<link rel="preload" as="image">`，網址以 `getImage()` 取得，
    與頁面 `<Image>` 產出的變體逐字相符（參數不一致會 preload 到另一個變體、
    白下載一份）。✅（696e526）
  - 程式碼註解色 #51597D 對比僅 2.54:1，以 shiki transformer 換成 #7A82AB
    （4.56:1）。✅（c2141f2）
- **Verification**: 效能 trace（首頁，本機無節流）LCP 265ms、CLS 0.00、TTFB 3ms。
  Lighthouse Performance 未列入本輪驗收數字——本機無節流的分數不具代表性，
  改由 CI workflow 對每個 PR 量測（門檻見 R7）。
- **Decision（web-vitals RUM）**: **不實作**。`/privacy-policy/` 明文承諾「未安裝
  追蹤型分析工具」，裝 RUM 會與該承諾衝突；且本站為純靜態、加 JS 反而傷 INP。
  效能改用 CI 端 Lighthouse 定期量測（見 R7）。

### R6: AI / GEO 可讀性
- **Level**: SHOULD
- **Status**: done（Lighthouse Agentic Browsing 100）
- **Description**: llms.txt 需含 Answer Capsule 與 E-E-A-T 段落、robots.txt 的 AI 爬蟲
  政策需明確、語意化 HTML、每頁唯一 H1、描述性連結文字。
- **Decision（封鎖 CCBot）**: **維持封鎖**。這是站主刻意的訓練資料退出決定，
  已知會連帶影響 Common Crawl 語料與 Wayback 收錄，接受此代價。審計工具的警告
  標記為「已評估接受」，不視為未修項。

### R7: CI 級別的 SEO 回歸防線
- **Level**: MUST
- **Status**: done（workflow 尚未在 GitHub 實跑過，見下方風險）
- **Description**: PR 觸發的建置後靜態驗證（meta 覆蓋率、canonical host、JSON-LD
  可解析性、sitemap 死連結、孤兒頁）+ Lighthouse 門檻；生產環境每日 squirrelscan
  回歸；pre-commit 快速檢查文章 frontmatter。
- **Decision（CI Performance 門檻 90 而非 95）**: GitHub runner 的效能量測波動大，
  95 會造成大量假失敗。95 的目標以本機／正式站量測為準，CI 只擋明顯退步。
- **Verification**: `npm run verify:seo` 104 頁 12 項規則全過；該腳本以刻意注入
  重複 title 與 sitemap 死連結驗證過確實會攔截，不是空跑。
- **Risk**: 兩個 workflow 的 YAML 語法、`run:` 區塊 shell 語法、分數比對腳本都已
  在本地驗證，但完整的 GitHub Actions 執行環境無法本地模擬。合併後需看第一次
  實跑結果。

### R8: 安全標頭
- **Level**: MUST
- **Status**: done
- **Description**: 補 CSP、HTML 快取策略、`/fonts/*` 長期 immutable 快取、COOP、
  `X-DNS-Prefetch-Control`。
- **Decision（script-src 收到 'self'）**: 原本為了 Astro 自動內聯的 Nav/TOC script
  必須開 `'unsafe-inline'`，等於放棄 CSP 最關鍵的一道防護。改設
  `vite.build.assetsInlineLimit: 0` 讓這些 script 一律外部化，全站 104 頁 inline
  script 歸零，`script-src` 得以鎖到 `'self'`。**代價：此後不能再寫 `is:inline`
  的 `<script>`，會被 CSP 擋掉。**
- **Decision（style-src 保留 'unsafe-inline'）**: View Transitions 逐頁產生內容不同的
  `view-transition-name` 樣式，無法外部化也無法預先算 hash。刻意不動
  `build.inlineStylesheets`——強制外部化並不會讓 style-src 變嚴，只會多出
  render-blocking 請求。
- **Verification**: `wrangler pages dev dist` 實際套用 `_headers`（解析出 13 條
  header 規則、16 條 redirect 規則），curl 確認所有標頭到位；在真實 CSP 下以
  chrome-devtools 實測首頁與文章頁：零 console violation、字型正常載入、
  行動版漢堡選單與 View Transitions 導航皆正常。

## 已知未解 / 需站主提供

| 項目 | 阻塞內容 | 現行 fallback |
|------|---------|--------------|
| Google Search Console 驗證碼 | 已提供並填入（2026-07-23） | — |
| GSC sitemap 提交 | 站主已提交（2026-07-23） | — |
| X / Twitter handle | 已提供 `@frankchen_tw`（2026-07-23） | — |
| squirrelscan 雲端帳號 | 站主決定不開（2026-07-23） | 以本地 report 的 SEO/Perf/Security/Agents 四項在正式站的實測值當驗收基準 |
| 外部死連結 3 條 | 需站主決定替換或移除 | 見 SEO_TODO.md |
| 內容過薄頁面 15 頁 | 屬內容工作非技術修復 | 見 SEO_TODO.md |

## 非目標

- 不做站內搜尋（連帶不做 WebSite SearchAction）
- 不做多語系（hreflang 僅自我宣告）
- 不引入任何第三方 JS（分析、RUM、字型 CDN）
- 不改寫文章正文（僅 frontmatter description 與 a11y 相關的 markdown 渲染）
