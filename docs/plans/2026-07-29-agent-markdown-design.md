# 供應 Markdown 給 AI agent — 設計

- 日期：2026-07-29
- Issue：#33
- Domain spec：`docs/specs/agent-markdown.md`（新開，draft）
- 連帶 delta：`docs/specs/pre-launch-infra.md` R6、R8

## 目標

讓 AI agent（Claude Code、ChatGPT 等）取用本站文章時拿到乾淨的 markdown 而非 HTML，
實際降低 token 成本。成功標準由站主定為「agent 抓文章真的省 token」，以文章頁為戰場，
`/about`、`/tag/*` 等十餘個 .astro 頁不在範圍內——agent 幾乎不會拿它們當內容來源。

非目標：與 Cloudflare Markdown for Agents 全站等價、讓 squirrelscan 的
`ax/markdown-response` 停止警告（那是不計分的 Recommendation，做給報表看沒有意義）。

## 方案選擇

三案評估後選方案一。

**方案一（採用）：build 時輸出靜態 `.md` 變體。** 產物全靜態、零 runtime，風險留在
build 時、CI 擋得住，而且它同時是方案二的前置——方案二的 Function 只是去 fetch 這批產物。

**方案二（延後）：方案一 + Pages Functions 內容協商。** 同一 URL 判
`Accept: text/markdown` 回 md，agent 零成本、與 CF 官方行為一致。延後的理由是三個
未量化的風險：Pages 的 `_middleware` 會攔下所有請求（含靜態資產），要自行限制路徑；
`Vary: Accept` 在 CF Pages 的快取分流行為無人實測，賭錯的後果是 agent 拿到 HTML 或
瀏覽器拿到 md；本 repo 從此多一個 CI 防線涵蓋不到的部署面向（`verify:seo` 讀 dist、
`verify:headers` 打正式站，都驗不到 Function 的分支行為）。

正確的補做時機是方案一上線後，從 CF Analytics 看 `/*.md` 的請求數與 user agent——
有真實流量才談要不要為「不看宣告的 agent」補協商層，那時 `Vary: Accept` 也才有得驗。

**方案三（否決）：`llms-full.txt` 單檔全文。** 服務的是「整站理解」而非「單篇省 token」，
與成功標準方向相反——抓一篇卻要吞 35 篇的 token。

### 既有 Worker 幫不上忙（查證結果）

issue 原文列為待確認的「現有 Worker `redirect-handler` 是否需要一併調整」已查證：
worker 原碼在 `haunchen/cf-worker-redirect-handler`，`wrangler.toml` 只綁
`blog.frankchen.tw/*` 一條 route，apex 的 `frankchen.tw/*` 已於 2026-07-22 cutover 移除，
檔案內並註明「切勿加回來」。正式站請求根本不經過這支 worker，因此方案二若要做，
仍是在 astro-blog 這個 Pages 專案從零引入 Functions，不是改既有 worker。

（附帶發現，不在本次範圍：該 repo 的 README 仍停在 cutover 前，描述導向 www 與
n8nmanager 的規則，`worker.js` 裡都已刪除。）

## 架構

### 路由

`src/pages/[...slug].md.ts` 靜態端點，`getStaticPaths` 與 `[...slug].astro` 同源
（`getCollection('posts', ({ data }) => !data.draft)`），輸出 `/<slug>.md`，
目前 35 支；draft 那篇自動不產。與 `[...slug].astro` 輸出的 `/<slug>/index.html`
副檔名不同，不衝突。

### 圖片路徑解析（本設計的關鍵風險點）

正文 250 處 `![](./images/foo.webp)` 與 frontmatter `cover` 都是相對於 md 檔的路徑，
直接輸出會讓 agent 拿到一份圖全掛的文件。

**不能用 `import.meta.glob` 取 `.src`。** 實測 `dist/_astro/` 的 445 張 webp 全部是
`主幹.資產雜湊_轉換雜湊.webp` 兩段式檔名（image service 轉換後的變體），未經轉換的
原檔沒有被 emit。`import.meta.glob` 給的 `.src` 指向單段雜湊的原檔網址，在 dist 裡
不存在，35 篇的圖會全數 404。

**採用：沿用 RSS 的 Container API 路徑（spec `pre-launch-infra` D9 的既有決策）。**
每篇 `render(post)` 後以 container 渲成 HTML，從中掃出所有 `/_astro/(主幹).雜湊.webp`，
建一張「檔名主幹 → 已解析網址」對照表，再把 raw `entry.body` 的
`./images/主幹.副檔名` 換成 `SITE.url` 開頭的絕對網址。

以主幹對應而非出現順序對應：同一張圖在文中重複引用不會錯位；對照表逐篇建立，
跨文章的同名檔案不會互相汙染。

正文除圖片網址外不做任何改寫——程式碼區塊、表格、標題階層原樣輸出。這正是「原生 md」
相對 CF 通用轉換器的品質優勢。

### frontmatter 契約

白名單輸出：`title`、`description`、`date`、`updated`（有才輸出）、`category`、
`tags`、`canonical`（指回 `https://frankchen.tw/<slug>/` 的 HTML 正本）、`image`。

`draft` 不輸出：它是內部狀態，且能產出 md 的本來就都不是草稿，曝光只會讓 agent
誤以為存在草稿版本。

`image` 用既有 OG 圖 `/og/<slug>.png` 而非文章封面。CF 官方規格的 frontmatter `image`
本就從 `<meta property="og:image">` 抽，用 OG 圖才是對齊；封面圖在文章頁走 `<Image>`
的四尺寸 srcset，要在端點複製那套解析得多接一層 image service 呼叫，OG 圖則是固定路徑。

YAML 字串一律以 `JSON.stringify` 輸出。站上標題大量使用全形冒號與引號，裸寫進 YAML
會在冒號處解析失敗；JSON 雙引號字串恰為合法的 YAML 雙引號純量，逃逸規則相容。

### 發現管道

1. 路徑慣例 `/<slug>.md` 本身——這是事實慣例（Cloudflare docs、Anthropic docs 皆如此
   供應），會抓 md 的 agent 多半直接試著加 `.md`，不等宣告。效力最高且零工程。
2. llms.txt 逐篇多附一個 md 網址。成本近乎零、檔案完全可控。
3. 文章頁 head 的 `<link rel="alternate" type="text/markdown">`。今日採用率最低
   （agent 得先抓了 HTML 才看得到），列為未來保險，不當主力。

HTTP `Link:` header 不做：`_headers` 是靜態檔、每篇 href 不同，等於要在 build 時生成
35 條規則，維護成本與收益不成比例。

### 標頭

`_headers` 新增 `/*.md` 一條：

- `Content-Type: text/markdown; charset=utf-8`
- `Cache-Control: public, max-age=600, must-revalidate`——與 HTML 同步。md 與 HTML 是
  同一份內容的兩個表示，新鮮度不該不同。依檔內已記載的合併陷阱，必須先 `! Cache-Control`
  清掉 `/*` 的值再設，否則會產生兩組 max-age。
- `X-Robots-Tag: noindex`

CF Pages 的 `_headers` 是否支援 `/*.md` 這種副檔名萬用字元無實測依據，上線後由
`verify:headers` 打正式站確認。

### 重複內容處理

`/<slug>.md` 與 `/<slug>/` 內容相同，有被搜尋引擎當獨立頁收錄的風險。md 不是 HTML，
塞不了 `<link rel="canonical">`，frontmatter 的 `canonical` 欄位搜尋引擎也不認，
唯一能表達的地方是 HTTP header。

`Link: rel="canonical"` 每篇值不同、要 35 條規則；`X-Robots-Tag: noindex` 一條
`/*.md` 即可。採用後者（站主 2026-07-29 拍板）。代價是 robots.txt 明確 Allow 的那批
AI 搜尋爬蟲不會把 md 版納入索引——但它們本來就在抓 HTML 正本，兩條路不衝突。
不加的風險是搜尋結果出現一份無樣式、無導覽的純文字版與正式文章打對台。

sitemap 不收 md，沿用既有 `filter` 排除 tag 頁的作法。

## 測試策略

純函式抽到 `scripts/lib/md-export.mjs`（frontmatter 序列化、圖片路徑改寫），自動被既有
`npm test` 的 glob（`scripts/lib/*.test.mjs`）涵蓋，不必動 test script 也不必為 TS
另接執行器。先例：`rehype-table-caption.mjs` 即由 `astro.config.mjs` 從 `scripts/lib/` import。

`verify:seo` 新增六條（全部讀 dist）：

1. 非草稿文章數與 `.md` 數相等
2. 草稿不得有對應 md
3. md 內不得殘留 `./images/`
4. md 內每個 `/_astro/` 圖片網址在 dist 裡真的存在
5. frontmatter 區塊可解析且必要欄位齊全
6. llms.txt 列出的 md 連結與實際產物一一對應

第 4 條是主防線——直接擋掉上述 404 地雷，日後若有人把圖片解析改回 `import.meta.glob`，
CI 當場紅燈。

`verify:headers`（正式站）新增三項：`/*.md` 的 Content-Type、Cache-Control、
`X-Robots-Tag: noindex`。這層只能部署後跑，也只有它驗得到副檔名萬用字元是否生效。

## 建置成本（2026-07-29 本機實測）

| 情境 | 總時間 | astro build | 影像處理 |
|---|---|---|---|
| 冷建（清 `node_modules/.astro`） | 21 s | 10.78 s | 5.25 s／410 張 |
| 熱建 | 16 s | 4.52 s | 0.115 s（快取全中） |

CF Pages 上限：build timeout 20 分鐘、Free 每月 500 次 build、單一部署 20,000 檔、
單檔 25 MiB。現況 dist 為 705 檔 19 MB。

新增的 35 次 `render()` 跑在同一次 build 內，屆時影像快取已熱，只做 markdown→HTML
與網址抽取，無 sharp 工作，增量約一兩秒。檔案數 705 → 740。建置時間不構成約束。

## 風險與未決

- `_headers` 的 `/*.md` 萬用字元支援性未實測，上線後以 `verify:headers` 確認；
  若不支援，退路是改用目錄形式（如 `/md/<slug>.md`）換得可用的 `/md/*` 規則。
- Container API 仍是 Astro experimental API。RSS 自 2026-06-06 起已在生產使用，
  風險與既有面相同，不新增暴露。
- 方案二的 `Vary: Accept` 快取分流待日後有流量數據再評估，本次不做。
