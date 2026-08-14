---
domain: pre-launch-infra
status: active
created: 2026-05-16
last_modified: 2026-08-14
---

# Pre-launch Infrastructure

部落格上線前的 SEO、爬蟲、社群分享、安全標頭與部署管線基礎建設。

## Requirements

### R1: Frontmatter 字數限制
- **Level**: MUST
- **Description**: 文章 `title` 不可超過 60 字、`description` 不可超過 160 字，違反時 `astro build` 失敗。

### R2: 全站結構化資料（Organization + WebSite）
- **Level**: MUST
- **Description**: 每個頁面（含首頁、404、文章）的 HTML `<head>` 必須注入 `Organization` 與 `WebSite` 兩段 JSON-LD，含站名、URL、logo、社群 sameAs、語言。

### R3: 文章頁結構化資料（BlogPosting + BreadcrumbList）
- **Level**: MUST
- **Description**: 文章詳細頁額外注入 `BlogPosting`（含 headline / datePublished / dateModified / image / author / mainEntityOfPage / articleSection）與 `BreadcrumbList`（首頁 → 文章 → 標題三層）JSON-LD。

### R4: 動態 OG 圖
- **Level**: MUST
- **Description**: 每篇非草稿文章在 `/og/{slug}.png` 提供 1200x630 PNG OG 圖，含分類 badge、中文標題、站名 footer。中文字型由 build-time subset 提供，僅包含實際標題用字。

### R5: RSS Feed
- **Level**: MUST
- **Description**: `/rss.xml` 提供最新 20 篇非草稿文章的 RSS 2.0 feed，全文 HTML 由 Astro Container API 渲染文章 `<Content/>` 元件產生，內文圖片解析為 image pipeline 的 `/_astro/` 最佳化資源後改寫為絕對 URL，內連同樣改寫為絕對 URL，sanitize 後輸出，含 `<language>zh-TW</language>` 與 `<atom:link rel="self">` 自我參照連結。

### R6: llms.txt
- **Level**: MUST
- **Description**: `/llms.txt` 提供 AI 友善的站點導引純文字檔，build 時從 content collection 動態產出。「主要頁面」段列出首頁、文章總覽、分類總覽、標籤總覽、n8n 相關資源、關於我、聯絡我等站台主要頁面（各附一句用途說明），「文章」段列出所有非草稿文章，每篇除 HTML 網址外並附其 markdown 變體網址（`/<slug>.md`）。

### R7: robots.txt 爬蟲分流
- **Level**: MUST
- **Description**: `/robots.txt` 明確 Allow 主流搜尋引擎、社群、AI 搜尋與即時查詢爬蟲；明確 Disallow AI 訓練類爬蟲（GPTBot / ClaudeBot / Google-Extended / CCBot / Bytespider / meta-externalagent / Applebot-Extended / cohere-training-data-crawler / DeepSeekBot）。含 `Sitemap:` 與 `Llms-txt:` 兩個 header。

### R8: 安全標頭與快取策略
- **Level**: MUST
- **Description**: 所有路徑回應含 `X-Frame-Options: DENY`、`X-Content-Type-Options: nosniff`、`Referrer-Policy: strict-origin-when-cross-origin`、`Permissions-Policy: camera=(), microphone=(), geolocation=()`；`/_astro/*` 一年 immutable（cover 與 logo 自 2026-08-14 起走 astro:assets 落在此處，見 site-pages.md #D19）、`/og/*` 一週、`/n8n-resources/*` 一週、`/rss.xml` 與 `/robots.txt`、`/llms.txt` 一小時、靜態根檔案（favicon / apple-touch-icon）一天。`.md` 路徑另回應 `Content-Type: text/markdown; charset=utf-8`、與 HTML 一致的短快取（`public, max-age=600, must-revalidate`）與 `X-Robots-Tag: noindex`；任何需自訂 `Cache-Control` 的新規則須先 `! Cache-Control` 清除 `/*` 的值再設定，避免 Cloudflare Pages 的標頭合併產生兩組 max-age。不含 `X-XSS-Protection`（已廢棄）與對不到建置輸出的 `/images/*` 規則。

### R9: CF Pages 部署
- **Level**: MUST
- **Description**: 站台部署於 Cloudflare Pages，透過 GitHub integration 連接 `haunchen/astro-blog` 的 `main` branch 自動 build。本階段使用 `*.pages.dev` 預設網域，不切自訂網域。

### R10: 社群分享 meta 完整性
- **Level**: MUST
- **Description**: 每個頁面的 `<head>` 必須有非空的 `og:image`（頁面未指定時 fallback 為站台 cover 圖）與 `twitter:card=summary_large_image`（含 title / description / image）。文章詳細頁的 `og:type` 必須為 `article` 並帶 `article:published_time`（有更新日時另帶 `article:modified_time`）與 `article:tag`；非文章頁維持 `website`。RSS autodiscovery `<link rel="alternate" type="application/rss+xml">` 的 title 固定為站名，不隨頁面變動。

### R11: sitemap 文章 lastmod
- **Level**: SHOULD
- **Description**: sitemap 中每個文章 URL 帶 `<lastmod>`（值為文章 `updated ?? date`）；非文章頁不帶 lastmod。

## Scenarios

### S1: 文章描述超過 160 字
- **Given**: 新增一篇文章的 `description` 設為 200 字
- **When**: 執行 `npm run build`
- **Then**: build 失敗、輸出 zod validation error 指明欄位與限制
- **Implements**: #R1

### S2: 首頁開啟
- **Given**: 站台已部署、訪客造訪首頁
- **When**: 檢視 HTML 原始碼
- **Then**: `<head>` 內含 `Organization` 與 `WebSite` 兩段 `<script type="application/ld+json">`
- **Implements**: #R2

### S3: 文章頁的結構化資料
- **Given**: 訪客造訪任一非草稿文章
- **When**: 檢視 HTML 原始碼
- **Then**: `<head>` 內共有四段 JSON-LD（Organization、WebSite、BlogPosting、BreadcrumbList）
- **Implements**: #R2, #R3

### S4: 社群分享預覽
- **Given**: 文章 slug = `test-markdown-rendering`
- **When**: 在 Facebook Sharing Debugger 輸入文章 URL
- **Then**: 預覽顯示 1200x630 OG 圖、中文標題正確、含分類 badge 與站名
- **Implements**: #R4

### S5: RSS 訂閱
- **Given**: 訪客使用 RSS reader 訂閱 `/rss.xml`
- **When**: reader 拉取 feed
- **Then**: 回傳最新 20 篇文章、每篇含全文 HTML、圖片為絕對 URL
- **Implements**: #R5

### S6: AI 訓練爬蟲被擋
- **Given**: GPTBot 嘗試抓取網站
- **When**: 讀取 `/robots.txt`
- **Then**: 看到 `User-agent: GPTBot` 後 `Disallow: /` 指令
- **Implements**: #R7

### S7: AI 搜尋爬蟲被允許
- **Given**: PerplexityBot 嘗試抓取網站
- **When**: 讀取 `/robots.txt`
- **Then**: 看到 `User-agent: PerplexityBot` 後 `Allow: /` 指令
- **Implements**: #R7

### S8: 安全標頭檢查
- **Given**: 站台已部署
- **When**: `curl -I https://*.pages.dev/`
- **Then**: response 含 `X-Frame-Options: DENY` 與其他安全標頭
- **Implements**: #R8

### S9: GitHub push 觸發部署
- **Given**: CF Pages GitHub integration 已連接
- **When**: push commit 到 `main` branch
- **Then**: CF Pages 自動觸發 build、成功後部署到 `*.pages.dev`
- **Implements**: #R9

### S10: RSS 內文圖指向最佳化資源
- **Given**: 一篇含內文圖的非草稿文章
- **When**: reader 拉取 `/rss.xml`
- **Then**: 該篇 `content` 內 img `src` 為 `https://frankchen.tw/_astro/<hash>.webp`，且對應檔案實際存在於建置輸出
- **Implements**: #R5

## Design Decisions

### D1: All-in-one PR、最後一次部署
- **Decision**: 6 件 infra + CF Pages 部署 bundle 為單一 feature branch、最後一次部署完整上線
- **Rationale**: 避免「半成品已上線」造成的 SEO 雜訊（Google 爬到不完整的 JSON-LD、空 OG、缺安全標頭）
- **Date**: 2026-05-16

### D2: OG 圖走 satori + sharp + subset 字型
- **Decision**: 動態 OG 圖採 satori 渲染 SVG、sharp 轉 PNG；中文字型用 build 前 subset only-used-chars 策略
- **Rationale**: 中文標題正確顯示與品牌一致性必要；subset 後字型 50-200KB，與全載 4-5MB Noto Sans TC 相比 build 時間與記憶體都可控
- **Date**: 2026-05-16

### D3: RSS 全文 HTML
- **Decision**: RSS feed 內含 sanitize 過的全文 HTML，不只放 description 摘要
- **Rationale**: RSS 原生讀者黏著度高，跳出站外閱讀體驗 > 換取 PV；35 篇規模下 RSS 檔大小可接受（~500KB）
- **Date**: 2026-05-16

### D4: robots.txt 擋訓練爬蟲、允許搜尋查詢爬蟲
- **Decision**: 採 honestmc.com.tw 相同策略，承接 [[robots-txt-爬蟲設定調研]] 2026-04-03 結論
- **Rationale**: 內容寫作成本高、不想被 LLM 拿去訓練；但允許 AI 搜尋類（OAI-SearchBot / PerplexityBot 等）有助於被 AI 搜尋引用
- **Date**: 2026-05-16

### D5: robots.txt 加 `Llms-txt:` header
- **Decision**: 在 robots.txt 末尾加 `Llms-txt: https://frankchen.tw/llms.txt`
- **Rationale**: llms.txt 原始提案沒規定此 header，主流爬蟲也沒讀；純粹為人類維運 signal、與 cablate 風格一致。爬蟲不認識的行會被忽略，無害
- **Date**: 2026-05-16

### D6: 不加 CSP header
- **Decision**: `_headers` 不寫 `Content-Security-Policy`
- **Rationale**: AdSense / Cloudflare Web Analytics / Threads embed / 未來第三方 widget 整合都會踩 CSP 坑；改用 `X-Frame-Options: DENY` 防 clickjacking 已涵蓋最大風險面，CSP 等真有具體威脅再針對性加
- **Date**: 2026-05-16

### D7: 部署用 `*.pages.dev`，不切自訂網域
- **Decision**: 本階段 CF Pages 留預設 `*.pages.dev` 網域，frankchen.tw cutover 延後
- **Rationale**: frankchen.tw 仍在 WordPress 服務 31 篇老文章，切過去等於老文章瞬間 404；要等 sync script 跑完 35 篇 + `_redirects` 寫好才能 cutover
- **Date**: 2026-05-16

### D8: 描述只設上限不設下限
- **Decision**: `description` 只設 `.max(160)`，不設 `.min(50)`
- **Rationale**: 下限會迫使作者為了過 schema 而灌水描述，傷害品質；上限是 SERP 截斷的硬約束才需要強制
- **Date**: 2026-05-16

### D9: RSS 渲染引擎改用 Container API
- **Decision**: RSS 全文改以 Astro experimental Container API（`render(post)` + `renderToString(Content)`）渲染，取代 markdown-it；連帶移除 `markdown-it` / `@types/markdown-it` 依賴
- **Rationale**: markdown-it 不認得 content collection 的相對圖片，不會觸發 image pipeline，導致 RSS 內文圖 URL 指向不存在的 `/<slug>/images/...`（404）。Container API 渲染真正的 `<Content/>`，內文圖經 image pipeline 解析為 `/_astro/<hash>.webp`，再前綴 `SITE.url` 即為可正確抓取的絕對 URL。純 markdown 無需 framework renderer（`loadRenderers([])`）
- **Date**: 2026-06-06

## Pending Changes

<!-- issue #55 / feat/og-image-content-hash（2026-08-14）。實作合併後由 finish spec sync 收進正文 -->

### MODIFIED R4: 動態 OG 圖
- **Level**: MUST
- **Description**: 每篇非草稿文章提供 1200x630 PNG OG 圖，含分類 badge、中文標題、站名 footer；中文字型由 build-time subset 提供，僅包含實際標題用字。網址改為帶內容雜湊的 `/og/{slug}.{hash}.png`（雜湊取自該圖 PNG 輸出位元組），不再是固定的 `/og/{slug}.png`；舊的固定檔名網址不保留相容路徑。

### MODIFIED R8: 安全標頭與快取策略
- **Description**: `/og/*` 的快取自一週改為一年 immutable（`public, max-age=31536000, immutable`），與 `/_astro/*` 同級。其餘條目不變。

### ADDED R12: OG 圖網址的單一來源與可解析性
- **Level**: MUST
- **Description**: OG 圖的網址只能有一個產生來源；三個消費端（`og:image` meta、BlogPosting JSON-LD 的 `image`、文章 `.md` 變體 frontmatter 的 `image`）對同一篇文章必須得到完全相同的網址，且該網址在建置產物中對應到實際存在的檔案。網址退化回不帶雜湊的固定檔名時必須被驗證腳本擋下。

### ADDED S11: 內容未變時重複建置
- **Given**: 文章內容、分類與 OG 圖範本皆未變動
- **When**: 連續執行兩次 `npm run build`
- **Then**: 每篇文章的 OG 圖檔名完全相同
- **Implements**: #R4

### ADDED S12: 新增一篇文章
- **Given**: 站上已有 N 篇已發佈文章
- **When**: 新增第 N+1 篇文章（其標題引入新的中文字元，使 subset 字型檔內容改變）後重新建置
- **Then**: 既有 N 篇文章的 OG 圖檔名不變
- **Implements**: #R4

### ADDED D10: OG 圖以共用模組的 memoized 渲染取得輸出位元組雜湊
- **Decision**: 渲染與雜湊抽成 `scripts/lib/og-image.mjs`（純函式），`src/utils/og.ts` 以 `Map<id, Promise>` memoize 並供三個消費端與 OG endpoint 共用；endpoint 的 `getStaticPaths` 由該函式算出帶雜湊的路徑，`GET` 回傳快取的位元組
- **Rationale**: 消費端在頁面渲染時就要網址，PNG 位元組卻要到 endpoint 渲染完才存在，而兩者在同一次 build 內無順序保證。改成「誰先要到誰觸發渲染、結果快取在模組層」後順序不再重要。相對於 `astro:build:done` 事後改名（要回寫 HTML 與 `.md` 兩種產物、且與同樣掛在該 hook 的 `pageMarkdownVariants` 產生先後順序約束），這條路不需要回寫任何產物；相對於以輸入算雜湊，不需要人手動 bump 範本版本號。正確性不依賴模組單例：2026-08-14 實測 satori + sharp 對同一輸入的 PNG 位元組完全相同，單例失效只會多渲染幾次（每張約 8 ms），不會產生不一致的網址
- **Date**: 2026-08-14

### ADDED D11: 不為舊的固定檔名 OG 網址保留 301
- **Decision**: 切換後 `/og/{slug}.png` 直接 404，不加 `_redirects` 條目、不雙份輸出
- **Rationale**: OG 圖網址的唯一來源是頁面的 `og:image` meta，社群爬蟲重抓即取得新網址（cover/logo 是站台級識別圖、可能被外部直接引用，故 #35 為它們留了 301，情況不同）。且 301 只保護切換當下那一批固定檔名網址——之後每次標題變更同樣會讓舊雜湊網址消失，而 301 涵蓋不了，等於為一次性過渡永久背一層機械
- **Date**: 2026-08-14

### ADDED D12: 字型位元組不進入雜湊輸入
- **Decision**: OG 圖雜湊一律取自 PNG 輸出位元組，不以「標題＋分類＋範本版本＋字型」等輸入組合計算
- **Rationale**: 2026-08-14 實測，把 subset 字型從 56,764 bytes 縮到 4,772 bytes（只留該標題用字）後，同一標題的 PNG sha256 與 SVG 完全相同——輸出只取決於實際用到的字形輪廓，與字型檔位元組無關。因此把字型算進輸入會過度失效（每發一篇帶新字的文章就翻新全部檔名，違反 #S12），不算進去則遇到字型家族／版本更換時漏掉；輸出位元組雜湊兩種情況都正確
- **Date**: 2026-08-14
