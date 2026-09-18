---
domain: index-submission
status: active
created: 2026-09-18
last_modified: 2026-09-18
---

# Index Submission

文章上線或內容更新後主動通知搜尋引擎：判定哪些變動值得通知、確認變動已實際部署、
透過 IndexNow 送出，並在任何一步失敗時讓管線紅燈。

## Requirements

### R1: 該送的判定
- **Level**: MUST
- **Description**: 一篇文章在下列任一情況下必須被送出：檔案為本次新增且 `draft` 不為 true；
  檔案已存在而 `draft` 由 true 變為 false；`updated` 值前後不同。`draft` 仍為 true 的文章
  一律不送。只改內文而未動 `updated` 的變更不送。

### R2: 送出前確認部署完成
- **Level**: MUST
- **Description**: 送出前必須確認變動已實際上線——線上 `sitemap.xml` 中該網址的 `lastmod`
  等於該文章 `updated ?? date` 的 ISO 值。確認前不得送出。

### R3: 提交通道
- **Level**: MUST
- **Description**: 透過 IndexNow 單一端點送出一次，涵蓋所有參與的搜尋引擎。金鑰以站台根目錄的
  公開檔案形式提供驗證，不以 secret 形式保存。

### R4: 兩個上線路徑都要涵蓋
- **Level**: MUST
- **Description**: 人工 push 與排程翻牌這兩種文章上線路徑都必須觸發提交。

### R5: 失敗一律可見
- **Level**: MUST
- **Description**: 部署確認逾時、提交回應非 2xx（重試後仍失敗）皆須使 workflow 失敗。
  不得吞掉錯誤後以成功狀態結束。

### R6: 無事可送不算失敗
- **Level**: MUST
- **Description**: 依 R1 判定後清單為空時，流程以成功狀態結束。

### R7: Google 端不主動提交
- **Level**: MUST
- **Description**: 不對 Google 送出任何索引提交請求。Google 端的收錄訊號維持既有的
  sitemap `lastmod`。

## Scenarios

### S1: 新文章發布
- **Given**: 一篇 `draft` 不為 true 的新文章檔案
- **When**: 該檔案隨 push 進入 main
- **Then**: 該文章網址被送出
- **Implements**: #R1, #R4

### S2: 排程文章翻牌
- **Given**: 一篇已存在、`draft` 為 true 的排程文章
- **When**: 排程流程將其 `draft` 改為 false 並推送
- **Then**: 該文章網址被送出
- **Implements**: #R1, #R4

### S3: 已上線文章內容更新
- **Given**: 一篇已上線文章，其 `updated` 值被改動
- **When**: 該變更進入 main
- **Then**: 該文章網址被送出
- **Implements**: #R1

### S4: 不涉及內容的修改
- **Given**: 一篇已上線文章，內文有變動但 `updated` 未改
- **When**: 該變更進入 main
- **Then**: 不送出任何網址，流程成功結束
- **Implements**: #R1, #R6

### S5: 草稿變更
- **Given**: 一篇 `draft` 為 true 的文章被修改
- **When**: 該變更進入 main
- **Then**: 不送出該文章網址
- **Implements**: #R1

### S6: 部署尚未完成
- **Given**: 有待送網址，但線上 sitemap 的該網址 `lastmod` 尚未等於預期值
- **When**: 進入送出流程
- **Then**: 持續等待直到相符才送出；逾時則流程失敗且未送出
- **Implements**: #R2, #R5

### S7: 提交被拒
- **Given**: 有待送網址且部署已確認
- **When**: 提交端點回應非 2xx 且重試後仍失敗
- **Then**: 流程失敗
- **Implements**: #R5

## Design Decisions

### D1: 只做 IndexNow，Google 端不主動提交
- **Decision**: 不呼叫 Google Indexing API，也不透過 Search Console API 重新提交 sitemap。
- **Rationale**: Indexing API 官方只支援 `JobPosting` 與 `BroadcastEvent`，部落格文章屬官方不支援
  的灰色用法，收緊時整條失效；sitemap ping 端點 2023 年已停用；重新提交 sitemap 只是重新登記一個
  Google 本來就會定期回抓的檔案，卻要把 GCP 金鑰複製進 GitHub Secrets。「新文章被收錄了沒」由
  seo-monitor 既有的 URL Inspection 抽樣管線回答，職責不交疊。
- **Date**: 2026-09-18

### D2: 用 IndexNow 而非 Bing Webmaster API 的 SubmitUrlBatch
- **Decision**: 不重用 seo-monitor 既有的 Bing Webmaster API key。
- **Rationale**: Microsoft 官方立場是能用 IndexNow 就用 IndexNow，URL Submission API 未來可能棄用，
  且有每日 100、每月 1300 配額。IndexNow 無配額、無金鑰輪替，且其 key 設計上就是公開檔案，
  使整條管線零 secret。
- **Date**: 2026-09-18

### D3: 以 frontmatter 而非檔案 diff 判定「內容更新」
- **Decision**: 判準是 `updated` 欄位是否改變，不是檔案內容是否改變。
- **Rationale**: 與 sitemap 的 `lastmod`（`updated ?? date`）及 CLAUDE.md 的 changelog 紀律同一條線。
  錯字與排版修正本來就不該動 `updated`，也就不該告訴搜尋引擎內容變了。
- **Date**: 2026-09-18

### D4: 以 sitemap lastmod 而非 HTTP 200 判定部署完成
- **Decision**: 輪詢線上 sitemap 中該網址的 `lastmod` 是否等於預期值。
- **Rationale**: 更新既有文章時舊版本同樣回 200，判不出新版是否已上線。lastmod 判據一條規則同時
  涵蓋新文章與更新兩種情況。兩處計算規則若漂移，症狀是輪詢逾時紅燈，失敗方向安全。
- **Date**: 2026-09-18

### D5: 事件驅動而非排程比對
- **Decision**: 由 push 與排程翻牌兩個事件觸發，不做每日 cron 比對 sitemap。
- **Rationale**: IndexNow 的價值在即時；排程比對最多延遲一天，且需額外保存「上次看到的狀態」。
  兩個觸發點都要接是因為 Actions 以 `GITHUB_TOKEN` push 的 commit 不會再觸發 `on: push`。
- **Date**: 2026-09-18

### D6: 列表頁不送
- **Decision**: 只送文章網址，首頁、文章總覽、分類頁、標籤頁不送。
- **Rationale**: IndexNow 對「送了但內容沒實質變化」的網址會降低提交端信任度，列表頁靠 sitemap 已足夠。
- **Date**: 2026-09-18

### D7: 補送靠手動觸發而非重跑
- **Decision**: 提交流程獨立出一條手動觸發路徑（`indexnow.yml` 的 `workflow_dispatch`，吃一個比對起點
  參數），排程路徑送出失敗時的摘要直接指向它並印出該填的值。
- **Rationale**: 「重跑排程 workflow」補不回來——重跑時文章已翻牌，翻牌邏輯判不到到期文章，送出
  步驟被條件跳過，摘要反而印「今天沒有到期文章」且整個 job 綠燈；push 事件那條也接不走，因為
  它的比對起點就是翻牌那筆 commit 本身。沒有這條手動路徑，一次失敗等於該篇永遠送不出去，而
  介面上看不出來。R5 要的「失敗可見」若沒有可行的補救動作，可見本身沒有意義。
- **Date**: 2026-09-18

## Open Questions

## Pending Changes
