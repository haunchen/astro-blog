# Agent 發現用的 Link 回應標頭（RFC 8288）

- 日期：2026-08-03
- Domain：`agent-markdown`（brownfield delta，新增 R8 / S8 / D10）
- 起因：isitagentready 掃描回報「No Link headers found on homepage」

## 背景與查證

外部檢測建議在首頁加上 `Link: </.well-known/api-catalog>; rel="api-catalog"`。逐一查證來源後，
這個建議的字面做法不適用於本站：

- **RFC 8288** 定義的是 `Link` HTTP 標頭的格式（`Link: </path>; rel="..."`），本質上是把 HTML
  `<link>` 的關係搬到 HTTP 層。價值在於 agent 一個 HEAD 請求就拿得到指路標，不必下載並解析 HTML。
- **RFC 9727** 定義 `api-catalog` 這個 link relation 與 well-known URI，但它有硬性要求：目標文件
  **必須**是 `application/linkset+json`（RFC 9264）格式的 API 清單。本站是純靜態內容部落格，沒有 API。
- **isitagentready 的 SKILL.md** 接受的 rel 為 `api-catalog`、`service-desc`、`service-doc`、
  `describedby` 四者其一，只要首頁回應帶 Link 標頭指向可發現資源即判 pass。

因此本設計取「只宣告既有資源」的方向：站上已經有 `/AGENTS.md`、`/llms.txt`、`/index.md`、
`/rss.xml` 四份機器可讀產物，缺的只是在 HTTP 層宣告。不新增任何內容檔案、不編造 API 概念。
`describedby` 既是語意最準的關係，也剛好是檢測認可的四個 rel 之一，通行證與正確性重合。

## 外部前提查證

A 案（`/` + `/*/ ` 兩條規則）整個建立在 Cloudflare Pages 的 glob 語意上，先查文件再定案：

- 「a splat pattern — signified by an asterisk (`*`) — will greedily match all characters」——貪心、跨斜線。
- 「You may only include a single splat in the URL」——每個 pattern 只准一個 splat。
- 「An incoming request which matches multiple rules' URL patterns will inherit all rules' headers」，
  同名標頭「the values are joined with a comma separator」。

`/*/ ` 因此展開成「以 `/` 開頭、以 `/` 結尾」的完整比對：`/category/n8n/` 吻合、`/_astro/x.js`
不吻合。A 案成立。

但**同一區塊內寫多行 `Link:` 的行為文件沒有明講**，所以四個 link-value 寫成單行逗號分隔
（RFC 8288 本來就允許），不賭合併語意。

## 資源對照與關係選擇

| 目標 | rel | 理由 |
|---|---|---|
| `/AGENTS.md` | `describedby` | IANA 定義為「指向描述本資源的資源」。這份手冊講的就是「怎麼取用本站」，語意精準；同時是檢測認可的 rel |
| `/llms.txt` | `index` | IANA 定義「Refers to an index」。llms.txt 是全站文章索引，不是本站的替代表示，用 `alternate` 會說謊 |
| `/index.md` | `alternate` + `type="text/markdown"` | 首頁同一份內容的另一種表示，與 HTML `<head>` 既有宣告同義，只是換到 HTTP 層 |
| `/rss.xml` | `alternate` + `type="application/rss+xml"` | 與 `BaseLayout.astro` 既有的 `<link rel="alternate">` 一致 |

落地成兩個 `_headers` 區塊。首頁四條全給，其餘頁面三條——`/index.md` 是首頁專屬的表示，
掛在文章頁上是錯的：

```
/
  Link: </AGENTS.md>; rel="describedby"; type="text/markdown", </index.md>; rel="alternate"; type="text/markdown", </llms.txt>; rel="index"; type="text/plain", </rss.xml>; rel="alternate"; type="application/rss+xml"

/*/
  Link: </AGENTS.md>; rel="describedby"; type="text/markdown", </llms.txt>; rel="index"; type="text/plain", </rss.xml>; rel="alternate"; type="application/rss+xml"
```

首頁只吻合 `/` 那一條（`/*/ ` 的 splat 即使能吻合空字串，pattern 也會是 `//` 而非 `/`），
因此四條必須完整寫在 `/` 區塊裡，不能倚賴與 `/*/ ` 的合併。

**文章頁的 `/<slug>.md` 不進 Link 標頭**：那要逐篇 35 條規則、每發一篇新文就得改 `_headers`，
正是既有 spec D5 當初拒絕逐篇 `rel="canonical"` 的同一個理由。文章頁的 md 宣告維持在 HTML `<head>`。

## 為何不是其他兩種作用範圍

- **只寫 `/`（僅首頁）**：改動最小也夠過檢測，但 agent 實際上多半從搜尋結果直接落到某篇文章，
  那裡什麼都沒有。
- **掛在既有的 `/*`**：一條規則涵蓋全站，不必賭 glob 行為，但每個字型、圖片、JS 回應都會多背
  約 200 bytes。首頁一次載入 30+ 個子資源，等於為了給 agent 看的東西讓每位讀者多付流量。

## 驗證策略

本 repo 沒有 wrangler，`astro preview` 也不套用 `_headers`——`/*/ ` 的比對行為**在本機無論如何
驗不到**，只能靠 Cloudflare Pages 的 PR preview 部署。`verify-headers.mjs` 已經吃 origin 參數
（`node scripts/verify-headers.mjs <origin>`），這條路是現成的。

要防的四種失效模式，前三種都會靜默通過任何「標頭存在嗎」式的檢查：

1. **`/*/ ` 完全沒吻合任何頁面**（語法寫錯，或 CF 比對語意與文件不同）→ 退化成只有首頁有標頭。
   斷言：文章頁與 `/about/` 必須有 Link。
2. **`/*/ ` 吻合過頭，連資產都掛上**（若 CF 實際做前綴比對而非完整比對）→ 檢測照樣 pass、站也
   正常，只是每位讀者默默多付流量，退化成 `/*` 而沒有任何跡象。
   斷言：字型檔路徑必須**沒有** Link 標頭。**這條反向斷言是本方案存在的全部意義，缺了它整個
   選擇就沒有守門人。**
3. **zone 層覆寫或加料** — `verify-headers.mjs` 開頭記載的 2026-07-23 事故（CSP 在正式站被砍到
   只剩一條指令）證明這不是假想。斷言方式照抄 CSP 那條的教訓：把 Link 值解析成 `(target, rel)`
   集合來比對，不用 `includes`——用 includes 的話 zone 層若多塞一條指向別處的 link，檢查仍為真。
4. **首頁的 `/index.md` 那條掉了**（多規則合併導致重複或順序異常）→ 集合比對順便涵蓋。

CI 不動：`seo-pr.yml` 目前跑 `npm test` + build + `verify:seo` + Lighthouse，全部針對建置產物，
不含 `verify:headers`（它打的是線上站，PR 階段沒有對應的 origin）。Link 標頭的驗證維持
「人工在 preview URL 上跑一次、合併後再對正式站跑一次」，與現有 `verify:headers` / `verify:robots`
的定位一致。

外部檢測本身只能在部署後以 `POST https://isitagentready.com/api/scan` 對正式站驗證，
無法本地模擬。這是驗收的最後一步，不是開發過程中的迴圈。

## 異動範圍

- `public/_headers` — 新增 `/` 與 `/*/ ` 兩個區塊，附註解說明「單行逗號分隔而非多行」的理由，
  以及 `/*/ ` 為何吻合頁面卻不吻合資產。
- `scripts/verify-headers.mjs` — 新增 Link 值解析器（拆成 `(target, rel)` 集合）與四項斷言：
  首頁四條齊全、文章頁三條齊全、字型檔無 Link（沿用既有的 `resolveFontPath()`）、無未預期的
  多餘 link-value。
- `docs/specs/agent-markdown.md` — Pending Changes 寫入 R8 / S8 / D10。

**不動的**：`public/AGENTS.md` 不加說明——會讀 AGENTS.md 的 agent 已經知道全部資源了，Link 標頭
正是給沒讀它的 agent 用的，兩邊寫同一件事只是多一個會過期的副本（既有 D9 對 robots.txt 已做過
同樣判斷）。CI 設定、`verify-seo.mjs`、任何 Astro 原始碼皆不動。

## 與既有需求的關係

R8 與既有 R4「發現管道」是補強不是取代：R4 列的三種途徑（路徑慣例、llms.txt、HTML `<head>`）
全部要求 agent 先取得並解析 HTML 或 llms.txt，R8 讓一個 HEAD 請求就拿得到指路標。R4 文字不動。
