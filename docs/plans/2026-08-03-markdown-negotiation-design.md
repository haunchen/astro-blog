# Accept 內容協商：同一網址供應 markdown 表示

- 日期：2026-08-03
- Domain：`agent-markdown`（brownfield delta，新增 R10 / R11 / S10-S12 / D12-D15，並推翻 D1）
- 起因：isitagentready 的 `markdownNegotiation` 檢測 fail——本站對 `Accept: text/markdown`
  仍回 `Content-Type: text/html`

## 現況實測

```
$ curl -sS -D - -o /dev/null -H "Accept: text/markdown" https://frankchen.tw/
HTTP/1.1 200 OK
Content-Type: text/html; charset=utf-8
Cache-Control: public, max-age=600, must-revalidate
cf-cache-status: DYNAMIC
```

文章頁同樣結果。兩個觀察，後面都會用到：

1. 協商確實沒有實作——這是 D1 的既有決策，不是漏掉。
2. `cf-cache-status: DYNAMIC`。Pages 的 HTML 本來就沒有進 Cloudflare 邊緣快取。

## 為什麼推翻 D1

D1（2026-07-29）決定「只做靜態 md 變體，不做內容協商」，兩個理由：

- **「需引入本 repo 目前沒有的 runtime 層，風險離開 build 時、CI 擋不住」**——這條仍然成立，
  本設計是正面接受它，並用 wrangler 進 CI 把風險拉回 CI（見「驗證策略」）。
- **「`Vary: Accept` 在 CF Pages 的快取分流行為無實測依據，賭錯的後果是 agent 拿到 HTML 或
  瀏覽器拿到 md」**——這條的前提已被上面的實測推翻。HTML 頁面是 `DYNAMIC`，沒有邊緣快取
  可以被污染，賭注不存在。剩下的是瀏覽器與中間層快取，那正是 `Vary: Accept` 的標準用途。

D1 同時寫了「靜態變體同時是內容協商的前置產物，日後補做不需重寫」。這次就是那個日後：
35 篇文章的 `.md` 與 `/index.md` 一份都不用改。

D1 標記為 superseded 而非刪除——它的兩個理由一個被實測推翻、一個被補上對策，這個變化過程
本身是紀錄的價值所在。

## 方案比較

本站 zone 為 **Cloudflare Free 方案**，這砍掉了兩條路：

| 方案 | 結論 |
|---|---|
| Cloudflare 原生 Markdown for Agents | **不可用**。僅 Pro / Business / Enterprise / SSL for SaaS。升級為 20 USD/月 |
| Cloudflare Snippets | **不可用**。Pro 起（Free 無此功能） |
| zone 的 URL Rewrite Transform Rule | **不採用**。見下 |
| Pages Functions middleware | **採用** |

即使升級到 Pro，官方方案也不是本站要的東西：它在邊緣做通用 HTML→md 轉換，會附 JSON-LD
（D3 刻意排除的東西），而本站文章 md 是原始 markdown 原樣輸出——程式碼區塊、表格、標題階層
都是作者手寫的那一份。同一份內容會出現兩套互相打架的 md 表示。付費買到品質更差的結果。

URL Rewrite 的硬傷是無法處理「沒有 md 變體的路徑」：規則依 `Accept` 把 `/about/` 重寫到
`/about.md`，該產物不存在時是 404，而不是退回 HTML。加上規則活在 zone 不在 repo（與 R9 的
DNS 記錄同一種漂移病），且 `_headers` 給 `.md` 的 `X-Robots-Tag: noindex` 會原封不動帶到
正規網址的回應上——見下節，那是這整個功能唯一會造成實質傷害的失誤。

## 架構

三個新增部件，兩條互不干涉的 md 產出管線。

### 1. 全站頁面的 md 產物（build 後處理）

`astro build` 之後跑 `scripts/build-page-md.mjs`：掃描 `dist/**/*.html`，抽出主內容區
（剔除 nav、TOC、footer），以 turndown 轉 markdown，前置一段從 HTML `<meta>` 抽出的
frontmatter，寫入對應路徑。

```
dist/about/index.html        → dist/about.md
dist/articles/index.html     → dist/articles.md
dist/category/n8n/index.html → dist/category/n8n.md
dist/tag/<tag>/index.html    → dist/tag/<tag>.md
```

涵蓋約 70 份產物（58 個 tag 頁 + 5 個分類頁 + tag/category 索引 + articles + about +
contact-frank + privacy-policy + n8n-resources）。

**為什麼不比照 `index.md.ts` 逐頁寫 route**：那要新增 9 支 `.md.ts`，其中 `about.astro`
（544 行）、`n8n-resources.astro`（301 行）、`contact-frank.astro`（131 行）、
`privacy-policy.astro`（77 行）的文案全寫在 `.astro` 版面裡。照 D8 的教訓，不先把文案抽到
共用來源就會漂移，而那種漂移不會讓 build 失敗，只會讓 agent 拿到過期內容。抽上千行版面文案
的成本遠高於這個功能的價值。build 後處理的單一事實來源是最終 HTML，結構上不可能漂移。

**文章與首頁不走這條管線**，維持現況：那兩者有手寫的高品質來源（原始 markdown、`HOME` 常數），
通用轉換是退步。因此本站有兩條 md 產出管線並存，spec 必須寫明，否則後續維護者會想統一它們。

附帶收穫：R4 的「路徑慣例」原本只對文章成立，現在全站成立——agent 把任何頁面網址的結尾斜線
換成 `.md` 都拿得到東西。

### 2. 內容協商（`functions/_middleware.js`）

```
請求進來
  ├─ Accept 不含 text/markdown → next()，回 HTML（補 Vary: Accept）
  └─ Accept 含 text/markdown
       ├─ 映射路徑：/ → /index.md；/x/ → /x.md；/x/y/ → /x/y.md
       ├─ md 產物存在 → 200 + text/markdown + Vary: Accept + x-markdown-tokens
       └─ 不存在（404 頁、直接打靜態資產）→ 退回 HTML，不製造新的 404
```

HTML 是預設，只有明確要求 `text/markdown` 才切換——瀏覽器的 `Accept` 不含這個 type，不受影響。

### 3. `_routes.json`

加了 Functions 之後所有請求預設都會觸發 invocation。用 `exclude` 排掉 `/_astro/*`、
`/fonts/*`、`/og/*`、`/samples/*` 與 `.md` / `.txt` / `.xml` 等本身就不是 HTML 的路徑，
讓靜態資產不計費也不繞道。頁面請求無法避開這層。

Pages 的 Functions 額度耗盡行為必須設 **fail open**（照常供應靜態資產）。為了 agent 的功能
讓一般讀者看到錯誤頁是本末倒置。

## 標頭契約：兩種回應要分清楚

這是本設計最容易出錯的地方，spec 要寫死。

| | 直接請求 `/<path>.md` | 協商回應（正規網址 + `Accept: text/markdown`） |
|---|---|---|
| `Content-Type` | `text/markdown; charset=utf-8` | 同左 |
| `X-Robots-Tag` | `noindex`（防重複內容） | **必須不帶** |
| `Vary` | 不需要 | `Accept` |
| `x-markdown-tokens` | 不需要 | 有則帶 |

`noindex` 那條是給 `/<slug>.md` 這個獨立網址用的，防它與 `/<slug>/` 被判重複內容。協商回應
走的是正規網址本身，若把 `noindex` 一起帶出去，等於對著文章本體的網址叫搜尋引擎不要收錄。
`_headers` 的 `/*.md` 規則不會命中正規網址，但 middleware 若用 `env.ASSETS.fetch` 取 md 產物
再原封轉發，那組標頭就會跟著出來——所以要顯式剝除，並且要有反向斷言守著。

HTML 回應也要帶 `Vary: Accept`。Cloudflare 邊緣對 `Accept-Encoding` 以外的 `Vary` 不做快取
分流，但目標客戶是瀏覽器與中間層快取，不是 CF 邊緣（HTML 是 `DYNAMIC`，本來就不在那裡）。

## 驗證策略

### 先修的地雷：verify-seo 的 md 集合假設

`verify-seo.mjs` 現在用 `dist/**/*.md` 全域掃描當作「文章 md 的集合」。D7 已經因為 `/index.md`
出現而打破過一次，這回一次多 70 份頁面 md，同一個地方會再破一次，而且是靜默的：`canonical`
那條會期待 `https://frankchen.tw/tag/n8n/index/`，llms.txt 對應檢查會判每份頁面 md「產物未被
宣告」。

**第一步不是加新斷言，是把那個集合拆成文章 md / 首頁 md / 頁面 md 三類**，各套各自的契約。

### 三層驗證

1. **單元測試**（`npm test`，`scripts/lib/`）：HTML→md 的純轉換函式、frontmatter 生成、
   路徑映射（`/` → `/index.md`、`/tag/x/` → `/tag/x.md`）。
2. **build 時**（`verify:seo`）：dist 裡每個 HTML 頁面都必須有對應 md，缺一個就失敗。
   這條是硬斷言——middleware 找不到 md 時會退回 HTML，等於協商靜默失效，沒有這條就沒人知道。
3. **正式站**（新增 `verify:markdown-negotiation`）：打 `Accept: text/markdown` 斷言
   `Content-Type`、`Vary: Accept`、**不帶** `X-Robots-Tag`、body 確為 markdown；反向斷言
   不帶該 header 時仍回 HTML。

### 補上 D1 擔心的那個空窗

middleware 在本機驗不到——`astro preview` 不執行 Functions，`_headers` 也不套用（D10 已記載
同一種病）。本設計把 **wrangler 裝成 devDependency**，以 `wrangler pages dev` 讓 middleware
在本機與 CI 都跑得起來。多一個依賴，換 D1 真正在乎的東西：風險留在 CI，不留到正式站。

### Lighthouse 不受影響（已查證）

`seo-pr.yml` 的 Lighthouse 打 `http://localhost:4321/`（`astro preview`），Pages Functions
不在那條路徑上，門檻 85 的四頁分數不會因這個 worker 改變。

真實使用者那邊會多一層邊緣執行，但：middleware 只讀一個 header、不匹配就 `next()`，無子請求
無額外往返；HTML 本來就是 `DYNAMIC`、每次回源，加這層不改變回源次數。**這是推論不是實測**，
plan 階段要排一步對照：先量正式站現在的 TTFB 當基準，Pages preview 部署後同樣打法再量。
若差距超過個位數毫秒，回頭談用 `_routes.json` 把協商限縮到更窄的路徑。

## 已知風險

- **轉換品質**：turndown 對 `about.astro` 那種重版面的頁面輸出好不好，未實測。緩解是 build 時
  加下限斷言（產物非空、含 `# ` 標題、長度不低於某個門檻），但「讀起來好不好」擋不住。
- **turndown 是新依賴**：build 時依賴，不進 client bundle，不影響 CSP 與效能預算。
- **主內容區的選擇器**：抽 `<main>` 的邏輯與 `BaseLayout.astro` 的結構耦合。版面改結構時
  轉換會靜默劣化——這是上面那條下限斷言真正要擋的東西。
- **70 份新產物的 sitemap 與 llms.txt**：md 不進 sitemap（R5 既有規則，`.md` 都不進），
  llms.txt 是否宣告頁面 md 留待 plan 決定（傾向不宣告，llms.txt 的定位是文章索引）。

## Spec delta 摘要（寫入 `docs/specs/agent-markdown.md` 的 Pending Changes）

- ADDED R10：全站頁面的 md 變體（build 後處理管線、frontmatter 契約、與文章／首頁管線的分工）
- ADDED R11：Accept 內容協商（HTML 為預設、映射規則、找不到 md 時退回 HTML）
- MODIFIED R4：路徑慣例從文章擴及全站；內容協商列為第四條發現管道
- MODIFIED R5：區分「直接請求 `.md`」與「協商回應」兩種標頭契約
- ADDED S10 / S11 / S12：協商成功、協商回應不帶 noindex、無 md 路徑退回 HTML
- ADDED D12-D15；D1 標記 superseded
