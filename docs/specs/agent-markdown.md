---
domain: agent-markdown
status: active
created: 2026-07-29
last_modified: 2026-08-15
---

# Agent Markdown

對 AI agent 供應文章的原生 markdown 表示：build 時為每篇非草稿文章輸出一份 `.md` 變體，
含白名單 frontmatter 與絕對化的圖片網址，並透過路徑慣例、llms.txt、HTML 宣告與 HTTP
`Link` 標頭讓 agent 找得到。
首頁另有一份 `/index.md`（站台入口的 markdown 表示，契約與文章不同，見 R6），
其餘頁面亦各有一份 markdown 變體（見 R10），
並以 `/AGENTS.md` 供應一份取用手冊（見 R7）。
發現管道由淺至深分四層：HTML／llms.txt（R4）、HTTP `Link` 標頭（R8）、DNS 記錄（R9）、
同一網址的 `Accept` 內容協商（R11）。

## Requirements

### R1: 文章 markdown 變體
- **Level**: MUST
- **Description**: 每篇非草稿文章在 `/<slug>.md` 提供一份 markdown 表示，內容為文章原始
  markdown 正文（程式碼區塊、表格、標題階層原樣保留），前置一段 YAML frontmatter。
  草稿文章不得產出 md。首頁另有專屬變體，契約見 R6；其餘頁面（關於、分類、標籤等）
  走另一條產出管線，見 R10。

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
- **Description**: agent 可透過三種途徑得知 md 變體存在——路徑慣例（頁面網址去掉結尾斜線
  後加 `.md`，適用全站頁面而非僅文章）、llms.txt 中每篇文章附帶的 md 連結、頁面 `<head>`
  內的 `<link rel="alternate" type="text/markdown">`。llms.txt 宣告的 md 連結須與實際產物一致。

  本需求之外另有第四條管道：同一網址的 `Accept` 內容協商（R11）。四條管道由淺至深為
  路徑慣例／llms.txt／HTML 宣告、HTTP `Link` 標頭（R8）、DNS 記錄（R9）、內容協商（R11）。

### R5: md 端點的回應標頭
- **Level**: MUST
- **Description**: 本需求適用於**直接請求 `.md` 路徑**：回應
  `Content-Type: text/markdown; charset=utf-8`；快取策略與 HTML 頁面一致；
  帶 `X-Robots-Tag: noindex`。md 變體不進 sitemap。

  協商回應（R11，走正規網址）的標頭契約與前者刻意不同：
  - `Content-Type: text/markdown; charset=utf-8`（相同）
  - **不得**帶 `X-Robots-Tag: noindex`。該標頭的用途是防 `/<slug>.md` 與 `/<slug>/`
    被判重複內容；協商回應走的是正規網址本身，帶上它等於要求搜尋引擎不要收錄頁面本體
  - HTML 與 markdown 兩種回應皆須帶 `Vary: Accept`
  - 有能力計算時帶 `x-markdown-tokens`

### R6: 首頁 markdown 變體
- **Level**: MUST
- **Description**: `/index.md` 提供首頁的 markdown 表示，內容涵蓋站台簡介、最新文章、
  分類與篇數、作者簡介與專案作品，並指向 `/articles/` 與 `/llms.txt` 取得完整清單。
  frontmatter 為 `title`、`description`、`canonical`、`image` 四欄——首頁不是文章，
  不套用 R2 的欄位契約（無 `date`／`category`／`tags`）。`canonical` 指向 `https://frankchen.tw/`。
  首頁 HTML 須以 `<link rel="alternate" type="text/markdown" href="/index.md">` 宣告它。
  頁面文案（標題、描述、關於我、專案）與 HTML 首頁共用同一份來源，不得各自維護副本。

### R7: 站台層級的 AGENTS.md
- **Level**: MUST
- **Description**: `/AGENTS.md` 提供造訪本站的 agent 一份取用手冊：`.md` 變體的路徑
  慣例、frontmatter 欄位契約、正規主機與結尾斜線慣例、抓取政策的指向、引用規範。
  內容須為非空 markdown，且至少涵蓋 `/llms.txt`、`/index.md`、`/rss.xml`、
  `/robots.txt` 與 canonical 引用規範五個取用管道。
  與 repo 根目錄的 `AGENTS.md`（coding agent 用）是兩份不同文件，內容不得混用。

### R8: HTTP 層的發現標頭
- **Level**: MUST
- **Description**: 站台所有內容頁（一律以帶結尾斜線的路徑供應）的回應須帶 `Link` 標頭
  （RFC 8288），宣告本站的機器可讀資源：`/AGENTS.md`（`rel="describedby"`）、
  `/llms.txt`（`rel="index"`）、`/rss.xml`（`rel="alternate"`）。首頁另含 `/index.md`
  （`rel="alternate"`，`type="text/markdown"`）——該項為首頁專屬，不得出現在其他頁面。
  靜態資產（`/_astro/`、`/fonts/`、圖片等）的回應不得帶此標頭。文章的 `/<slug>.md`
  不在此標頭的宣告範圍內，其 md 宣告仍走 R4 的既有管道。

  本需求與 R4 是補強關係而非取代：R4 的三種途徑都要求 agent 先取得並解析 HTML 或 llms.txt，
  R8 讓一個 HEAD 請求即可取得指路標。

### R9: DNS 層的 agent 入口宣告
- **Level**: MUST
- **Description**: `_index._agents.<正規主機>` 提供一筆 ServiceMode 記錄，宣告本網域對 agent
  的入口主機、連接埠與 ALPN。TargetName 須為可用公開憑證連線的主機名（不得含底線）且該主機
  確實服務中。

  記錄**不得**宣告本站未實際提供的 agent 協定端點——`_a2a._agents`、`_mcp._agents` 等名稱維持
  不存在，直到本站真的有對應端點為止。

  記錄內容只使用已由 IANA 註冊的 SvcParamKey，不使用尚待配號的實驗性 key。本站機器可讀資源的
  清單不在 DNS 重述，由 R8 的 `Link` 標頭承擔——DNS 層只回答「入口在哪」。

  本需求與 R4、R8 是同一條線的三層：R4 要求 agent 先解析 HTML 或 llms.txt，R8 讓一個 HEAD
  請求拿到指路標，R9 讓 agent 在建立連線之前就知道入口位置。

  發布該記錄的區域須經 DNSSEC 簽章，使驗證型解析器回傳可驗證的資料。

  DNS 記錄不在 repo，zone 是唯一事實來源；本需求的守門人是 `npm run verify:dns-aid`。

### R10: 全站頁面的 markdown 變體
- **Level**: MUST
- **Description**: 除文章（R1）與首頁（R6）之外的所有 HTML 頁面——關於、聯絡、隱私權、
  n8n 資源、文章總覽、分類索引與各分類、標籤索引與各標籤——皆須提供 markdown 表示，
  路徑為該頁網址去掉結尾斜線後加 `.md`（`/tag/n8n/` → `/tag/n8n.md`）。
  frontmatter 比照 R6 的非文章欄位集（`title`、`description`、`canonical`、`image`），
  不套用 R2 的文章契約。

  本需求與 R1、R6 分屬不同產出管線，這是刻意的：文章與首頁有手寫來源（原始 markdown、
  共用文案常數），品質高於任何通用轉換；其餘頁面的內容住在版面裡，沒有可抄的來源。
  兩條管線不得為了「統一」而合併——合併的方向只能是讓文章 md 退化成轉換產物。

  每個 HTML 頁面都必須有對應的 md 產物，缺任一份即為建置失敗。這條是硬要求而非盡力而為：
  R11 的協商在找不到 md 時會退回 HTML，缺漏因此是靜默的。

### R11: Accept 內容協商
- **Level**: MUST
- **Description**: 對站台任一頁面網址發出的請求，若 `Accept` 明確含 `text/markdown`，
  回應該頁的 markdown 表示；否則回應 HTML。HTML 為預設，不得因協商而改變一般瀏覽器的行為。
  協商回應使用原網址、狀態碼 200，不得改以重導向達成。

  「明確含」不包含 `text/markdown;q=0`——依 RFC 9110，qvalue 0 代表明確不接受，
  該請求視同未要求 markdown 而回應 HTML（見 D16）。

  無對應 md 產物的路徑（404 頁、靜態資產）須退回 HTML／原有行為，不得因協商而產生新的 404。

  協商能力的存在不取代 R4 的既有管道：路徑慣例仍須獨立可用。

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

### S6: agent 取得首頁的 markdown 表示
- **Given**: 站台已部署
- **When**: 請求 `https://frankchen.tw/index.md`
- **Then**: 回應 200、`Content-Type: text/markdown; charset=utf-8`，frontmatter 含
  `title`／`description`／`canonical`／`image` 且 `canonical` 為 `https://frankchen.tw/`；
  首頁 HTML 內含指向它的 `<link rel="alternate" type="text/markdown">`
- **Implements**: #R6

### S7: agent 從站台取得取用手冊
- **Given**: 站台已部署
- **When**: 請求 `https://frankchen.tw/AGENTS.md`
- **Then**: 回應 200、`Content-Type: text/markdown; charset=utf-8`，內容為非空 markdown，
  且涵蓋六個取用管道：`/llms.txt`、`/index.md`、`/rss.xml`、`/robots.txt`、canonical
  引用規範，與 `Accept: text/markdown` 內容協商（R11）
- **Implements**: #R7

### S8: agent 以 HEAD 請求取得指路標
- **Given**: 站台已部署
- **When**: 分別請求首頁、任一文章頁與任一字型檔的回應標頭
- **Then**: 首頁的 `Link` 含上述四個目標且 rel 正確；文章頁含三個目標（不含 `/index.md`）；
  字型檔無 `Link` 標頭。比對以 `(target, rel)` 集合進行，出現未預期的 link-value 即為失敗
- **Implements**: #R8

### S9: agent 從 DNS 取得入口且無虛假宣告
- **Given**: 站台已部署
- **When**: 以 DNS-over-HTTPS 查詢 `_index._agents.frankchen.tw` 的 ServiceMode 記錄，
  並對其 TargetName 主機發出 HEAD 請求，另查 `_a2a._agents` 與 `_mcp._agents`
- **Then**: `_index` 回傳至少一筆 priority ≠ 0 的記錄，TargetName 為 `frankchen.tw.`（無底線），
  SvcParams 含 `alpn`，且回應帶已驗證的 DNSSEC 狀態；對該主機的 HEAD 回應 200 且帶 `Link` 標頭；
  `_a2a._agents` 與 `_mcp._agents` 兩個名稱皆不存在。

  兩項實作約束，皆出自實測而非推論：記錄以 presentation format 或 RFC 3597 wire format 回傳
  都須判定成功——解析器不得因序列化格式而漏判（不同 DoH 供應者、以及同一供應者對自動產生與
  手動建立的記錄，格式並不一致）。「名稱不存在」不得只認 NXDOMAIN——本 zone 啟用 DNSSEC 後
  Cloudflare 走 compact denial of existence（RFC 9824），不存在的名稱回 NOERROR 加一筆帶
  `NXNAME` 的 NSEC，只認 NXDOMAIN 會讓這一項在名稱確實不存在時系統性誤報
- **Implements**: #R9

### S10: agent 以 Accept 取得同一網址的 markdown
- **Given**: 站台已部署
- **When**: 對首頁與任一文章頁帶 `Accept: text/markdown` 發出請求
- **Then**: 回應 200、`Content-Type: text/markdown; charset=utf-8`、帶 `Vary: Accept`，
  body 為該頁的 markdown 表示；同一網址不帶該標頭時回應 `Content-Type: text/html`
- **Implements**: #R11

### S11: 協商回應不得要求搜尋引擎略過本體
- **Given**: 站台已部署
- **When**: 對任一文章頁帶 `Accept: text/markdown` 請求並檢視回應標頭
- **Then**: 回應**不含** `X-Robots-Tag`；同一篇文章的 `/<slug>.md` 直接請求則仍含 `noindex`
- **Implements**: #R5

### S12: 無 markdown 表示的路徑不因協商而壞掉
- **Given**: 站台已部署
- **When**: 對不存在的路徑與任一靜態資產帶 `Accept: text/markdown` 請求
- **Then**: 行為與不帶該標頭時一致（404 頁仍為 404 HTML、資產仍為原本的型別），
  不得出現因協商而新產生的 404
- **Implements**: #R11

## Design Decisions

### D1: 只做靜態 md 變體，不做內容協商（superseded by D15）
- **Status**: superseded（2026-08-03，見 D15）
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

  這個做法把「檔名主幹」當成圖片的唯一識別，因此有已知的失效模式：位元組完全
  相同的兩個圖檔會被建置流程依內容去重、只 emit 一份，落敗的那個檔名主幹因此
  不在對照表裡，會使 build 失敗（fail-fast，不會產出壞產物；2026-07-29 實際發生
  過一次，解法是刪掉重複檔改引用同一份）。同理，同一篇文章裡同名不同副檔名的
  兩張圖（如 `diagram.png` 與 `diagram.webp`）會撞成同一個鍵而**靜默**取到第一張
  的網址，這一種目前沒有斷言擋得住
- **Date**: 2026-07-29

### D3: 不輸出 JSON-LD
- **Decision**: 刻意偏離 Cloudflare Markdown for Agents 規格，md 文末不附 JSON-LD
  fenced code block
- **Rationale**: CF 附 JSON-LD 是因為它在做通用 HTML 轉換、沒有別的地方拿得到結構化
  資料；本站 frontmatter 已帶同樣的 title、description、date、category，再附一份
  BlogPosting 是重複計費，而本功能的全部意義就是省 token
- **Date**: 2026-07-29

### D4: `image` 用 OG 圖而非文章封面
- **Decision**: frontmatter 的 `image` 指向 `/og/<slug>.<hash>.png`（雜湊取自該圖 PNG
  輸出位元組，見 `pre-launch-infra.md` 的 R4/R12、D10）
- **Rationale**: CF 規格的 frontmatter `image` 本就從 `<meta property="og:image">` 抽，
  用 OG 圖才是對齊；封面圖在文章頁走 `<Image>` 的四尺寸 srcset，要在端點複製那套解析
  得多接一層 image service 呼叫。原本「OG 圖則是固定路徑、零成本」的理由自 2026-08-15
  起不成立——網址依賴 `getOgImage()` 的一次 memoized 渲染才算得出來，不再是字串組裝
- **Date**: 2026-07-29（網址形狀與成本敘述於 2026-08-15 更新）

### D5: md 變體加 `X-Robots-Tag: noindex`
- **Decision**: `_headers` 對 `.md` 路徑加 `noindex`，md 亦不進 sitemap
- **Rationale**: `/<slug>.md` 與 `/<slug>/` 內容相同，有被當獨立頁收錄的重複內容風險；
  md 非 HTML 塞不了 `<link rel="canonical">`，`Link: rel="canonical"` 又需逐篇 35 條
  規則，`noindex` 一條規則即可。代價是 AI 搜尋爬蟲不會索引 md 版，但它們本就在抓
  HTML 正本，兩條路不衝突
- **Date**: 2026-07-29

### D6: 補首頁 md 變體，而不是改做內容協商
- **Decision**: 新增 `/index.md` 靜態變體，D1 的「不做內容協商」維持不變
- **Rationale**: 起因是 SEO 日檢的 `ax/markdown-response` 持續警告——該規則只探首頁，
  而 R1 原本把首頁排除在外，所以 35 篇文章的 md 全部到位它仍然看不到。規則本身
  二擇一即可（內容協商或 `.md` 變體），補靜態變體是兩者中風險低的那個，也不必推翻
  D1 已經評估過的快取分流風險。實測方式是本機 build + preview，用
  `squirrelscan audit --rule-include ax --max-pages 1` 分別打 localhost 與正式站對照，
  兩邊差異恰好只有 `markdown-response` 一條（2026-07-31）。

  這條規則是 recommendation-only、不計分，所以真正的理由是第二個：agent 想知道
  「這站是什麼」時，先前只能吃首頁 HTML，而同一份日檢的 `ax/token-weight` 正好在說
  首頁可見文字不到 HTML 的 15%
- **Date**: 2026-07-31

### D7: 首頁 md 不套用 R2 的 frontmatter 契約
- **Decision**: `/index.md` 只輸出 `title`／`description`／`canonical`／`image`，
  verify-seo 也把它從文章 md 的斷言集合中排除、另立兩條檢查
- **Rationale**: `date`／`category`／`tags` 對一個入口頁沒有意義，硬湊值只是為了讓
  同一組斷言跑得過而編造資料。verify-seo 原本用 `dist/**/*.md` 全域掃描當作「文章 md
  的集合」，這個假設在首頁 md 出現後就不再成立，是靜默失效的來源——若不排除，
  `canonical` 那條會期待 `https://frankchen.tw/index/`，而 llms.txt 對應檢查會判它
  「產物未被宣告」
- **Date**: 2026-07-31

### D8: 首頁文案抽到 `site-meta.ts` 的 `HOME`
- **Decision**: 標題、描述、OG 圖、關於我文案與專案清單從 `index.astro` 內聯搬到
  `HOME`，HTML 首頁與 `/index.md` 都讀同一份
- **Rationale**: 兩個路由要輸出同一個頁面的兩種表示，各留一份副本就沒有東西擋得住
  「改了 HTML 忘了改 md」——那種漂移不會讓 build 失敗，只會讓 agent 拿到過期的站台
  介紹。與 `CATEGORIES`／`HEADER_NAV` 已經在做的事情同一套路
- **Date**: 2026-07-31

### D9: 站台的 AGENTS.md 寫「怎麼取用本站」，不是「怎麼建置本 repo」
- **Decision**: `public/AGENTS.md` 供應給造訪者的是內容取用手冊；repo 根目錄那份
  維持 coding agent 用途，兩者不互相複製
- **Rationale**: 起因同樣是日檢——`ax/agents-md` 探測站台上的 `/AGENTS.md`、
  `/agents.md`、`/.well-known/agents.md`、`/docs/AGENTS.md` 四個位址，但它期待的
  內容是 repo 層的 build／test 指令。照它的字面做，等於把「怎麼跑 npm test」publish
  給每個讀者，而會從網址找建置指令的 coding agent 對一個個人部落格趨近於零。

  查證後 `AGENTS.md` 這個檔名底下其實有兩種東西：repo 根目錄那份出自 OpenAI Codex
  團隊（2025），現由 Agentic AI Foundation 治理，Codex／Cursor／Copilot／Jules 等
  都讀；站台根目錄那份是另一條線，Shopify 自 2026-05 起為每間店自動產生，源頭是
  Google 的 Universal Commerce Protocol，內容是「怎麼搜尋、怎麼加購物車、怎麼結帳」。
  squirrelscan 要的是把前者的內容放到後者的位置。

  本站取後者的角色、換掉領域：不是「怎麼下單」而是「怎麼取用內容」。這樣寫出來的
  文件本身有價值——`.md` 路徑慣例、frontmatter 欄位、`.md` 帶 noindex 所以引用要用
  canonical、non-www 與結尾斜線——先前散在 llms.txt、robots.txt、`_headers` 與本
  spec 裡，agent 沒有一個地方一次看得到。實測（2026-07-31）以這種內容供應，
  `ax/agents-md` 一樣通過：該規則只檢查非空、是 markdown、不是 HTML 錯誤頁

  抓取政策一節刻意只指向 `/robots.txt` 而不重列 user-agent 名單：robots.txt 與
  Cloudflare zone 的清單本來就不同步（`public/_headers` 的註解已記載這件事），
  在第三個地方再抄一份只是多一個會過期的副本
- **Date**: 2026-07-31

### D10: 宣告既有資源，不做 api-catalog
- **Decision**: 以 `describedby`／`index`／`alternate` 指向站上既有的四份產物，不新增
  `/.well-known/api-catalog`；作用範圍以 `/` 與 `/*/` 兩條 `_headers` 規則表達，不掛在 `/*`
- **Rationale**: 起因是 isitagentready 掃描回報首頁無 Link 標頭，建議加 `rel="api-catalog"`。
  但 RFC 9727 對 `api-catalog` 有硬性要求——目標文件必須是 `application/linkset+json`
  （RFC 9264）格式的 API 清單，而本站是純靜態內容部落格，沒有 API。照字面做等於把內容端點
  當 API 稱呼，並且多一份要維護、會與 llms.txt 漂移的副本。該檢測接受的四個 rel 中
  `describedby` 本來就是語意最準的那個（IANA：指向描述本資源的資源），通行證與正確性重合。

  作用範圍選 `/` + `/*/` 而非 `/*`：Cloudflare 文件載明 splat 為貪心且跨斜線比對，`/*/` 因此
  等同「以 `/` 開頭、以 `/` 結尾」，剛好切開帶結尾斜線的頁面與不帶斜線的靜態資產。掛在 `/*`
  會讓每個字型、圖片、JS 回應都多背約 200 bytes，首頁一次載入 30+ 個子資源，等於為了給 agent
  看的東西讓每位讀者多付流量。代價是這個比對行為在本機驗不到（repo 無 wrangler，
  `astro preview` 不套用 `_headers`），只能在 Pages preview 部署上實測；因此
  `verify-headers.mjs` 必須同時有正向斷言（頁面有）與反向斷言（字型檔沒有），否則比對過頭
  時會靜默退化成 `/*` 而無人察覺

  四個 link-value 寫成單行逗號分隔而非多行 `Link:`：Cloudflare 文件說明的是「多條**規則**
  命中時同名標頭以逗號串接」，同一區塊內重複寫同名標頭的行為未有明文，不賭
- **Date**: 2026-08-03

### D11: 只發 `_index`、用已註冊參數、記錄型別取 HTTPS
- **Decision**: 於 `_index._agents.frankchen.tw` 發一筆 `HTTPS 1 frankchen.tw. alpn="h2,http/1.1"
  port=443`；不發 `_a2a`／`_mcp`，不使用實驗性 SvcParamKey，不加 `mandatory`；DNSSEC 另案評估
- **Rationale**: 起因是 isitagentready 掃描回報 dnsAid 找不到 well-known entrypoint 記錄。
  但 DNS-AID 的用途是把 AI agent 發布到 DNS，而本站是純靜態內容部落格、沒有任何 agent 端點
  （同一份掃描的 `a2aAgentCard`／`mcpServerCard` 也是 fail，那是實情不是疏漏）。照字面發滿三條
  等於宣告不存在的服務，agent 連過來會撲空，比沒有記錄更糟——與 D10 對 api-catalog 的判斷同構，
  一樣取「只宣告既有資源」。

  draft §3.2 對 `_index` 沒有強制任何 SvcParamKey（「protocols and schemas are out of scope」），
  只要求 TargetName 存在且不含底線。`alpn`／`port` 是 RFC 9460 已註冊的 key 且值為實情；
  draft 專屬的 `well-known`／`cap` 等五個 key 全部 pending IANA、連數字都還沒配，自挑私有號等於
  發明只有自己看得懂的語意。不加 `mandatory` 是因為它要求不認得該 key 的 client 整筆丟棄記錄，
  而這條記錄存在的目的正是要被成熟度不一的 agent 看見。

  型別取 HTTPS(65) 而非 SVCB(64)：RFC 9460 定義的 HTTPS 本就是 https-scheme 的特化型，而本站
  入口確實是 HTTPS 端點；SKILL.md 原文亦為「SVCB records, or HTTPS records for HTTPS endpoints」。

  （原本另有一條理由「CF DoH 只把 HTTPS 轉成 presentation format、SVCB 回 wire format」，
  **2026-08-03 記錄實建後證實為誤**：當初取樣的是 `cloudflare.com` 那筆 CF 對 proxied 名稱
  **自動產生**的記錄，只有 CF 自己合成的才轉 presentation format；**手動建立**的記錄兩種型別
  都回 RFC 3597 wire format。選型別的結論不變，但驗證端必須自行解 wire format——實測
  isitagentready 解得了它並完整認可本記錄，我們的腳本原本解不了、於是在記錄正確時誤報四項
  FAIL，已補上解析器。詳見 design doc 的兩節「更正」。）

  同一個掃描器還會查 `TXT _index._agents`（`txtIndexEntryCount` 是它的判定欄位之一），一樣不發：
  TXT 不在 draft 的任何一節裡，是掃描器自己的擴充、格式無規格可循；而 TXT 唯一能塞的內容
  （資源清單或入口路徑）正是 R8 的 `Link` 標頭與 `/AGENTS.md` 已經在講的事，多一份就多一個
  不經 build、不經 code review 的漂移副本。

  DNSSEC 原判斷為「不納入、獨立評估」（draft 對無 TLSA 的記錄只是 SHOULD，而 .tw 的 DS 要上傳到
  註冊商，設錯的後果是全站 DNS 解析失敗，量級遠大於一條發現記錄的好處）。**2026-08-03 記錄實建後
  改為納入**：實測 isitagentready 對本記錄的每一欄都認可（`validServiceMode: true`、
  `validationIssues: []`、`serviceRecordCount: 1`），但 `status` 仍為 `fail`，訊息是
  「records found, but DNSSEC was not validated」——它把 DNSSEC 當通行的必要條件而非加分項，
  是達成本案目的的唯一路徑。風險評估未變，只是不再有替代方案。連帶把 DNSSEC 從腳本的
  「印出但不計入失敗」升為正式斷言。注意這是為通過該檢測而做，**draft 本身仍只要求 SHOULD**
- **Date**: 2026-08-03

### D12: 頁面 md 走 build 後處理，不逐頁寫 route
- **Decision**: 以建置後掃描產物 HTML 轉出頁面 md，不比照 `/index.md` 為九個頁面各寫一支路由
- **Rationale**: 逐頁寫路由的前提是文案有共用來源可讀，但關於（544 行）、n8n 資源（301 行）、
  聯絡（131 行）、隱私權（77 行）的文案全寫在版面裡。照 D8 的教訓，不先抽出共用來源就會漂移，
  而那種漂移不會讓建置失敗、只會讓 agent 拿到過期內容；抽上千行版面文案的成本遠高於本功能
  的價值。以最終 HTML 為單一來源，結構上不可能漂移
- **Date**: 2026-08-03

### D13: 自建協商層，不升級方案也不用 zone 規則
- **Decision**: 協商邏輯寫在 repo 內的邊緣中介層；不啟用 Cloudflare 原生的 Markdown for
  Agents，也不用 zone 的 URL 重寫規則
- **Rationale**: 本站 zone 為 Free 方案，原生功能（Pro 起）與 Snippets（Pro 起）都用不到。
  但即使升級也不會採用它：原生方案在邊緣做通用 HTML→md 轉換並附 JSON-LD（D3 刻意排除的東西），
  而本站文章 md 是作者手寫的原始 markdown，會變成兩套互相打架的表示——付費買到品質更差的結果。
  zone 重寫規則的硬傷是無法在缺 md 時退回 HTML（會 404），且規則活在 zone 不在 repo，
  與 R9 同一種漂移病
- **Date**: 2026-08-03

### D14: 協商回應顯式剝除 noindex
- **Decision**: 協商回應必須主動移除 `X-Robots-Tag`，並以反向斷言守著
- **Rationale**: 這是本功能唯一會造成實質傷害的失誤模式。md 產物本身帶 `noindex`（D5），
  協商層若取出產物原封轉發，該標頭會跟著出現在正規網址的回應上，等於對文章本體下架指令。
  正向斷言（協商有回 md）擋不住它，必須另立反向斷言
- **Date**: 2026-08-03

### D15: D1 標記 superseded
- **Decision**: D1「不做內容協商」失效，但保留原文並標記 superseded
- **Rationale**: D1 的兩個理由現在一個被實測推翻、一個被補上對策。快取分流那條的前提不成立
  ——實測正式站 HTML 頁面為 `cf-cache-status: DYNAMIC`，本來就沒有邊緣快取可以被污染，
  D1 擔心的賭注不存在。runtime 層那條仍然成立，因此把邊緣中介層納入本機與 CI 的可測範圍，
  把風險拉回 CI。D1 當初寫的「靜態變體同時是內容協商的前置產物，日後補做不需重寫」已兌現：
  既有的文章與首頁 md 一份都不用改
- **Date**: 2026-08-03

### D16: `q=0` 視同不要 markdown，但不做完整 qvalue 排序
- **Decision**: 協商層判斷 `text/markdown` 的 qvalue 是否為 0，是則回 HTML；除此之外
  不實作 RFC 9110 的偏好排序，也不解析 `*/*` 與 `text/*` 的 q 值
- **Rationale**: `q=0` 是唯一一種「客戶端明確說不要、實作卻給了」的情況，代價是把明確拒絕
  讀成明確要求，值得處理。完整排序則沒有回報：本站同一網址只有 HTML 與 markdown 兩種表示，
  而 HTML 是預設，排序結果影響不到最終選擇，實作一套完整的 q 值比較只是多一段沒有斷言
  守著的邏輯。畸形 q 值（解不出數字）一律落回 HTML，方向與 R11 的「不確定就給 HTML」一致
- **Date**: 2026-08-13
