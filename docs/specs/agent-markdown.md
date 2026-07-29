---
domain: agent-markdown
status: draft
created: 2026-07-29
last_modified: 2026-07-29
---

# Agent Markdown

對 AI agent 供應文章的原生 markdown 表示：build 時為每篇非草稿文章輸出一份 `.md` 變體，
含白名單 frontmatter 與絕對化的圖片網址，並透過路徑慣例、llms.txt 與 HTML 宣告讓 agent 找得到。

## Requirements

### R1: 文章 markdown 變體
- **Level**: MUST
- **Description**: 每篇非草稿文章在 `/<slug>.md` 提供一份 markdown 表示，內容為文章原始
  markdown 正文（程式碼區塊、表格、標題階層原樣保留），前置一段 YAML frontmatter。
  草稿文章不得產出 md。文章以外的頁面（首頁、關於、分類、標籤等）不在範圍內。

### R2: frontmatter 契約
- **Level**: MUST
- **Description**: frontmatter 為白名單欄位：`title`、`description`、`date`、`updated`
  （文章有才輸出）、`category`、`tags`、`canonical`、`image`。`canonical` 指向該文
  HTML 正本的絕對網址；`image` 為該文 OG 圖的絕對網址。內部欄位（如 `draft`）不得曝光。
  所有字串值須以合法 YAML 逃逸輸出，含全形冒號與引號的標題不得使 frontmatter 解析失敗。

### R3: 圖片網址可解析
- **Level**: MUST
- **Description**: md 正文內不得殘留相對於原始檔的圖片路徑（`./images/...`）；所有圖片
  引用須為絕對網址，且指向的資源在部署產物中確實存在、可被匿名抓取。

### R4: 發現管道
- **Level**: MUST
- **Description**: agent 可透過三種途徑得知 md 變體存在——路徑慣例（HTML 網址加 `.md`）、
  llms.txt 中每篇文章附帶的 md 連結、文章頁 `<head>` 內的
  `<link rel="alternate" type="text/markdown">`。llms.txt 宣告的 md 連結須與實際產物一致。

### R5: md 端點的回應標頭
- **Level**: MUST
- **Description**: `.md` 路徑回應 `Content-Type: text/markdown; charset=utf-8`；
  快取策略與 HTML 頁面一致；帶 `X-Robots-Tag: noindex`。md 變體不進 sitemap。

## Scenarios

### S1: agent 依慣例抓取 md
- **Given**: 文章 slug 為 `n8n-telegram-bot-notification-tutorial`
- **When**: agent 對 `https://frankchen.tw/n8n-telegram-bot-notification-tutorial.md` 發出請求
- **Then**: 回應 200、`Content-Type: text/markdown; charset=utf-8`，內容為該文的
  frontmatter 加原始 markdown 正文
- **Implements**: #R1, #R5

### S2: md 內的圖片可被抓取
- **Given**: 任一含內文圖的文章的 md 變體
- **When**: 逐一請求正文中的圖片網址
- **Then**: 全部回應 200，且 md 內不含任何 `./images/` 字串
- **Implements**: #R3

### S3: 草稿不外流
- **Given**: 某篇文章 frontmatter 標記 `draft: true`
- **When**: 執行 `npm run build`
- **Then**: 產物中不存在該文的 `.md`，llms.txt 亦不含其 md 連結
- **Implements**: #R1, #R4

### S4: 含全形標點的標題
- **Given**: 文章標題含全形冒號與引號
- **When**: 以 YAML 解析器讀取其 md 變體的 frontmatter
- **Then**: 解析成功，`title` 值與文章原標題逐字相同
- **Implements**: #R2

### S5: 搜尋引擎不收錄 md 變體
- **Given**: 站台已部署
- **When**: 請求任一 `.md` 路徑並檢視回應標頭
- **Then**: 含 `X-Robots-Tag: noindex`；且 sitemap.xml 不含任何 `.md` 網址
- **Implements**: #R5

## Design Decisions

### D1: 只做靜態 md 變體，不做內容協商
- **Decision**: build 時輸出 `.md` 靜態產物，不以 Pages Functions 判斷
  `Accept: text/markdown` 回應同一 URL
- **Rationale**: 靜態產物的風險全留在 build 時，CI 擋得住，正式站行為可預測；內容協商
  需引入本 repo 目前沒有的 runtime 層，且 `Vary: Accept` 在 CF Pages 的快取分流行為
  無實測依據，賭錯的後果是 agent 拿到 HTML 或瀏覽器拿到 md。靜態變體同時是內容協商的
  前置產物，日後補做不需重寫。既有的 `redirect-handler` worker 只綁 `blog.frankchen.tw/*`，
  apex 請求不經過它，無法降低這層成本
- **Date**: 2026-07-29

### D2: 圖片網址走 Container API 解析，不用 `import.meta.glob`
- **Decision**: 以 `render(post)` + container 渲出 HTML，從中建「檔名主幹 → 已解析網址」
  對照表，再改寫原始 markdown 的相對圖片路徑
- **Rationale**: 實測 `dist/_astro/` 的 445 張 webp 全為 `主幹.資產雜湊_轉換雜湊.webp`
  兩段式檔名（image service 轉換後的變體），未轉換的原檔未被 emit；`import.meta.glob`
  取得的 `.src` 指向不存在的單段雜湊網址，會造成全站內文圖 404。Container API 是
  `pre-launch-infra` D9 為 RSS 建立的既有機制，沿用不新增技術面
- **Date**: 2026-07-29

### D3: 不輸出 JSON-LD
- **Decision**: 刻意偏離 Cloudflare Markdown for Agents 規格，md 文末不附 JSON-LD
  fenced code block
- **Rationale**: CF 附 JSON-LD 是因為它在做通用 HTML 轉換、沒有別的地方拿得到結構化
  資料；本站 frontmatter 已帶同樣的 title、description、date、category，再附一份
  BlogPosting 是重複計費，而本功能的全部意義就是省 token
- **Date**: 2026-07-29

### D4: `image` 用 OG 圖而非文章封面
- **Decision**: frontmatter 的 `image` 指向 `/og/<slug>.png`
- **Rationale**: CF 規格的 frontmatter `image` 本就從 `<meta property="og:image">` 抽，
  用 OG 圖才是對齊；封面圖在文章頁走 `<Image>` 的四尺寸 srcset，要在端點複製那套解析
  得多接一層 image service 呼叫，OG 圖則是固定路徑、零成本
- **Date**: 2026-07-29

### D5: md 變體加 `X-Robots-Tag: noindex`
- **Decision**: `_headers` 對 `.md` 路徑加 `noindex`，md 亦不進 sitemap
- **Rationale**: `/<slug>.md` 與 `/<slug>/` 內容相同，有被當獨立頁收錄的重複內容風險；
  md 非 HTML 塞不了 `<link rel="canonical">`，`Link: rel="canonical"` 又需逐篇 35 條
  規則，`noindex` 一條規則即可。代價是 AI 搜尋爬蟲不會索引 md 版，但它們本就在抓
  HTML 正本，兩條路不衝突
- **Date**: 2026-07-29

## Pending Changes

<!-- Brownfield delta 放這裡，finish spec sync 時清除 -->
