# 索引提交自動化 — 設計

日期：2026-09-18
Domain：`index-submission`

## 問題

新文章上線或既有文章內容更新後，搜尋引擎要靠自己回來爬才會知道。希望改成主動通知。

## 前提查證：Google 沒有可用的官方路徑

「自動送 Google Search Console 索引」這件事嚴格說不存在官方做法：

- Google Indexing API 官方只支援帶 `JobPosting` 與 `BroadcastEvent` 結構化資料的頁面，部落格
  文章不在支援範圍。API 不驗 schema，照打會回 200 並排進佇列——WordPress 生態的 Rank Math
  Instant Indexing 等外掛走的正是這條灰色路徑，但 Google 官方不背書，收緊時整條失效。
- Sitemap 的 ping 端點 2023 年 6 月已停用，Bing 亦同。老外掛的「發布後 ping 搜尋引擎」現在是空打。
- Search Console API 的 `PUT sitemaps` 是官方允許的，但 sitemap 網址本身沒變，等於重新登記一次
  Google 本來就會定期回來抓的檔案。

Bing 這邊相反，IndexNow 就是官方路徑，且一次提交 Yandex、Seznam、Naver 同步收到。

因此本功能範圍收斂為：**只做 IndexNow，Google 端不動**。

## 決策脈絡

### Google 端不打 Indexing API

灰色路徑的實測回報通常是數小時內收錄，但官方不支援、需要 GCP service account 金鑰、隨時可能失效。
選擇不碰，Google 端維持靠 sitemap 的 `lastmod`（現況已正確：`updated ?? date`）。

### Google 端也不重新提交 sitemap

初判是「養一組 service account 換一個弱動作，YAGNI 該砍」，但該前提有誤——seo-monitor 專案
（`~/obsidian-vault/20-Side/seo-monitor/`）已有專用 SA `seo-monitor@n8n-tool-456512`，且 frankchen.tw
已把它加為 GSC 委任擁有者，邊際成本只是多呼叫一支 API，不是多養一套金鑰。

即使如此仍決定不做：金鑰在本機與 .102 的 n8n，GitHub Actions 要用就得複製第三份進 Secrets，
而換到的只是「重新登記一次 sitemap」。相對地，「新文章到底被 Google 收錄了沒」這個真正想知道的
問題，seo-monitor 既有的 URL Inspection 每日抽樣管線（n8n workflow `SEOGSCINSPECT001`）已經在答。
兩個專案職責不交疊。

### Bing 端不用既有的 Webmaster API key

seo-monitor 已有 Bing Webmaster API key 在用（四支端點每日跑），它自己就有 `SubmitUrlBatch`
端點，直覺上該重用。但不：Microsoft 官方立場是能用 IndexNow 就用 IndexNow，URL Submission API
未來可能棄用，且有每日 100、每月 1300 的配額。IndexNow 沒有配額、沒有金鑰輪替。

更重要的是 IndexNow 的 key 本身就是公開的（要放在站台根目錄讓搜尋引擎抓得到才算驗證通過），
所以整條管線零 secret——這正是它適合跑在 GitHub Actions 的理由。

### 觸發架構：事件驅動而非排程

比較過三條路：

| 方案 | 取捨 |
|------|------|
| Actions 事件驅動（採用） | 即時、精準，跟既有 Actions + `scripts/lib/` 純函式測試同一套 |
| 每日 cron 比對線上 sitemap | 實作最簡、涵蓋所有上線路徑，但最多延遲一天（IndexNow 的價值正是即時），且要存狀態檔 |
| 等 Cloudflare 部署完成通知 | 時機最準，但 CF 通知 webhook 無法帶自訂 header，打不進 GitHub `repository_dispatch`，要另架接收端 |

## 架構

### 元件

- `scripts/lib/indexnow.mjs` — 純函式層，進 `npm test`
  - 從「舊 frontmatter、新 frontmatter」判定一篇文章是否該送
  - 檔案路徑 → 正規網址
  - 預期 lastmod 計算（與 `astro.config.mjs` 的 `POST_LASTMOD` 同規則：`new Date(updated ?? date).toISOString()`）
  - sitemap XML 解析
  - IndexNow payload 組裝
- `scripts/submit-indexnow.mjs` — CLI 層，負責 git、網路、輪詢，不測
- `public/<key>.txt` — IndexNow key 檔，內容即 key 值，直接寫在 repo
- `.github/workflows/indexnow.yml` — `on: push`，branches 限 `main`，paths 限 `src/content/posts/**`
- `publish-scheduled.yml` 加一步 — 在既有「Commit 並 push」之後呼叫同一支腳本

不做 reusable workflow：共用的只有一個步驟，包成 `workflow_call` 等於為了一行多養一個檔。

### 資料流

```
Actions 取得變動的 src/content/posts/** 檔案
  → 逐檔以 git show <base>:<path> 取上一版 frontmatter，對照工作區現況
  → 判定該送的網址清單
  → 清單為空 → 正常結束（非失敗）
  → 清單非空 → 輪詢線上 sitemap.xml 直到部署完成
  → POST api.indexnow.org/IndexNow
  → 寫 Job Summary
```

### 為什麼兩個觸發點都要接

Actions 用預設 `GITHUB_TOKEN` push 出去的 commit 不會再觸發 `on: push`（GitHub 的防遞迴設計）。
只接 push 事件的話，排程翻牌的文章永遠送不出去。

`indexnow.yml` 的 checkout 需要 `fetch-depth: 0`——預設只抓一個 commit，`git show HEAD~1:` 會直接失敗。
base 取 `github.event.before`；`publish-scheduled.yml` 那邊取翻牌 commit 的父節點。

### 該送的判定

三種情況任一成立就送：

1. 檔案在這次 diff 中新增，且 `draft` 不為 true（一般發文）
2. 檔案早已存在，`draft` 從 true 變成 false（排程翻牌）
3. `updated` 前後不同（內容更新）

`draft` 仍為 true 的一律不送——草稿的網址根本不存在，送出去等於叫搜尋引擎抓 404。

以 frontmatter 而非檔案 diff 為判準，是為了跟 sitemap 的 `lastmod` 與 CLAUDE.md 的 changelog 紀律
對齊：錯字與排版修正本來就不該動 `updated`，也就不該消耗提交配額、不該告訴搜尋引擎內容變了。

### 等待部署完成

不看「網址回 200」——更新既有文章時舊版本也回 200，判不出新版上線沒。改看線上 `sitemap.xml`：
輪詢直到該網址的 `lastmod` 等於預期值，一條規則同時涵蓋「新文章出現在 sitemap」與「舊文章的新版
已部署」。抓取時帶 cache-busting query 與 `Cache-Control: no-cache`，否則可能一直讀到 Cloudflare
邊緣的舊副本。

每 15 秒輪詢一次，上限 10 分鐘。

### 送出

單一 POST 到 `api.indexnow.org/IndexNow`，body 帶 `host`、`key`、`keyLocation`、`urlList`。
送一次，Bing、Yandex、Seznam、Naver 都收到，不必逐家送。

## 錯誤處理

一律紅燈，不吞。

| 情況 | 處理 |
|------|------|
| 輪詢逾時（10 分鐘） | exit 1 |
| 2xx（含 202） | 成功。202 只代表 key 還在驗證佇列，提交本身已收下 |
| 429、5xx | 暫時性，指數退避重試三次，仍失敗則 exit 1 |
| 400、403、422 | 打錯了，不重試，直接 exit 1 |

紅燈的實際後果有限：失敗不影響已上線的文章，Cloudflare 部署早在送出之前就完成，壞的只是這一次
通知。GitHub 上留一筆紅燈，重跑該 workflow 即可補送。

## 測試策略

`scripts/lib/indexnow.test.mjs`，與既有 15 支測試同一套 `node --test`。測純函式：

- 三種該送：新增非草稿檔、草稿翻牌、`updated` 變動
- 三種不該送：仍是草稿、只改內文沒動 `updated`、非文章檔案
- 檔案路徑 → 網址換算
- 預期 lastmod 與 `astro.config.mjs` 同規則
- sitemap XML 解析
- payload 組裝

網路與 git 留在 CLI 層，不測。

## 範圍外

- **列表頁不送**（首頁、`/articles/`、分類頁、標籤頁）。IndexNow 對「送了但內容沒實質變化」的
  網址會降低提交端信任度，列表頁靠 sitemap 就夠。
- **Google 端不動**。收錄狀況由 seo-monitor 既有的 URL Inspection 管線觀測。
- **不新增 verify 腳本**。key 檔若被誤刪，IndexNow 會回 403，紅燈就抓到了。

## 與既有結構的相容性

- `functions/_middleware.js` 對不以斜線結尾的路徑直接 `next()`（`pagePathToMdPath` 回 null），
  所以 `public/<key>.txt` 不會被內容協商攔截。
- 預期 lastmod 的計算規則與 `astro.config.mjs` 的 `POST_LASTMOD` 是同一條，兩處若漂移，輪詢會
  永遠等不到而逾時紅燈——失敗方向是安全的。

## 參考

- [Google Indexing API 官方說明](https://developers.google.com/search/apis/indexing-api/v3/using-api)
- [IndexNow 導入說明（Bing Webmaster Tools）](https://www.bing.com/indexnow/getstarted)
- [Rank Math Instant Indexing](https://rankmath.com/wordpress/plugin/instant-indexing/)
- seo-monitor 專案記憶：`~/obsidian-vault/20-Side/seo-monitor/MEMORY.md`
