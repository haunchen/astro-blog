---
domain: site-pages
status: active
created: 2026-06-26
last_modified: 2026-06-26
---

# Site Pages

部落格的非文章型頁面與全站導覽：關於我、文章總覽、分類頁、隱私權政策，以及分類資料的單一來源。

## Requirements

### R1: 關於我頁
- **Level**: MUST
- **Description**: `/about/` 呈現自我介紹、工作經歷、專案經歷、作品集、聯絡資訊五類內容；聯絡 email 為 `frank@frankchen.tw`。頁面不顯示 cover 橫幅主視覺（cover 僅作 og:image，見 #R2）。

### R2: 關於我頁結構化資料與社群圖
- **Level**: SHOULD
- **Description**: `/about/` 的 `<head>` 注入 `Person`/`ProfilePage` JSON-LD（含 jobTitle、skills、社群 sameAs），且 `og:image` 為 `cover.webp`。

### R3: 文章總覽頁
- **Level**: MUST
- **Description**: `/articles/` 列出全部非草稿文章，依發布日期由新到舊排序，頂部含分類導覽列；不分頁、無 client 端篩選。

### R4: 分類頁
- **Level**: MUST
- **Description**: 每個「至少有一篇非草稿文章」的分類在 `/category/{slug}/` 提供頁面，列出該分類文章並顯示正確篇數；沒有文章的分類不產生頁面。

### R5: 分類導覽一致性
- **Level**: SHOULD
- **Description**: `/articles/` 與每個 `/category/` 頁共用同一條分類導覽列，連結「全部」與每個有效分類，當前項目以 active 樣式標示。

### R6: 分類顯示單一來源
- **Level**: MUST
- **Description**: 分類的 slug 與顯示名稱由單一有序清單定義，供首頁分類卡、文章總覽、分類頁共用；文章篇數一律由 content collection 即時計算，不寫死。

### R7: 首頁分類卡正確性
- **Level**: MUST
- **Description**: 首頁分類卡連到有效的 `/category/{slug}/`（不得出現 `/category/deployment/` 之類無對應 enum 的死連結），且顯示即時文章篇數。

### R8: 隱私權政策頁貼合站台現況
- **Level**: MUST
- **Description**: `/privacy-policy/` 僅描述本靜態站實際成立的資料處理方式；不含留言、Gravatar、登入/密碼重設、使用者註冊等本站不存在的功能段落；網站網址標示為 `https://www.frankchen.tw`、聯絡 `frank@frankchen.tw`。

### R9: 導覽無死連結
- **Level**: MUST
- **Description**: 全站 Nav 不含指向未實作頁面的連結（移除 `/n8n-resources/`）；Nav 與 Footer 的其餘連結皆有對應頁面。

### R10: 聯絡頁
- **Level**: MUST
- **Description**: `/contact-frank/` 提供站內聯絡頁，列出聯絡 email（`frank@frankchen.tw`，mailto 連結）、地點與社群連結；採無後端靜態頁、不含可送出的表單。`/about/` 的聯絡連結指向此站內頁（非外部 WordPress 頁）。

## Scenarios

### S1: 造訪關於我頁
- **Given**: 站台已部署
- **When**: 訪客造訪 `/about/`
- **Then**: 看到自我介紹／工作經歷／專案經歷／作品集／聯絡五類內容，聯絡 email 為 frank@frankchen.tw（頁面不顯示 cover 橫幅）
- **Implements**: #R1

### S2: 關於我頁社群分享
- **Given**: 訪客在社群分享 `/about/` URL
- **When**: 檢視 HTML `<head>`
- **Then**: `og:image` 指向 `cover.webp`，且含 `Person`/`ProfilePage` JSON-LD
- **Implements**: #R2

### S3: 文章總覽排序
- **Given**: collection 有多篇非草稿文章
- **When**: 訪客造訪 `/articles/`
- **Then**: 全部非草稿文章依日期由新到舊列出，頂部有分類導覽列
- **Implements**: #R3, #R5

### S4: 分類頁產出與計數
- **Given**: `devops` 分類有 N 篇非草稿文章、某分類有 0 篇
- **When**: 執行 `npm run build`
- **Then**: 產出 `/category/devops/` 並顯示 N 篇；0 篇的分類不產生頁面
- **Implements**: #R4, #R6

### S5: 首頁分類卡連結
- **Given**: 訪客在首頁點任一分類卡
- **When**: 連結被開啟
- **Then**: 導向有效的 `/category/{slug}/`（非 404），且卡片數字等於該分類即時篇數
- **Implements**: #R6, #R7

### S6: 隱私權政策內容
- **Given**: 訪客造訪 `/privacy-policy/`
- **When**: 閱讀內容
- **Then**: 不出現留言/Gravatar/登入/註冊等本站沒有的功能描述，網址標示為 https://www.frankchen.tw
- **Implements**: #R8

### S7: 導覽列無死連結
- **Given**: 站台已部署
- **When**: 檢視任一頁的 Nav
- **Then**: 不含 `/n8n-resources/` 連結，其餘連結皆可達
- **Implements**: #R9

### S8: 造訪聯絡頁
- **Given**: 站台已部署
- **When**: 訪客造訪 `/contact-frank/` 或從 `/about/` 點聯絡連結
- **Then**: 看到聯絡 email（mailto）、地點與社群連結，無可送出的表單
- **Implements**: #R10

## Design Decisions

### D1: 分類顯示採有序單一來源清單
- **Decision**: 在 `site-meta.ts` 以有序 `CATEGORIES`（slug + 口語 label）取代分散的 `CATEGORY_LABEL`，供首頁／總覽／分類頁共用
- **Rationale**: 消除首頁寫死 label/href（`/category/deployment/`）與 `CATEGORY_LABEL`（'DevOps'）兩套不一致；篇數即時計算避免過時數字
- **Date**: 2026-06-26

### D2: cover.webp 放 public/ 當 OG（不在頁面顯示）
- **Decision**: `cover.webp` 置於 `public/`，當 /about/ 與首頁的 og:image，不走 astro:assets；不在 /about/ 頁面內顯示 cover 橫幅（原 hero 橫幅已移除，僅留標題與 tagline）
- **Rationale**: 已是 1200×630 webp，免再優化；OG 需穩定絕對 URL，public/ 最直接。cover 視覺橫幅依使用者意見移除，保留 OG 供社群分享預覽
- **Date**: 2026-06-26

### D3: 分類頁只為有文章的分類產 path
- **Decision**: `getStaticPaths` 僅輸出至少有一篇非草稿文章的分類
- **Rationale**: 避免空分類頁與首頁連到 404
- **Date**: 2026-06-26

### D4: 文章總覽不做 client 篩選、不分頁
- **Decision**: `/articles/` 純時序列表 + 連到分類頁的導覽列，不做 client 端即時篩選、不分頁
- **Rationale**: 35 篇規模單頁可承載；純 SSG 利於 SEO 且維護簡單；分類過濾交給 /category/ 頁
- **Date**: 2026-06-26

### D5: 隱私權政策貼合靜態站、不照搬 WordPress
- **Decision**: 改寫 WordPress 預設政策，移除留言/Gravatar/登入/註冊段落，明述本站不主動蒐集個資、未掛分析
- **Rationale**: 原文描述本站不存在的功能；已 grep 確認無 analytics/gtag，照搬會失真
- **Date**: 2026-06-26

### D6: 聯絡 email 統一 frank@frankchen.tw
- **Decision**: /about/ 聯絡 email 採 `frank@frankchen.tw`，與 `site-meta.ts` 一致，不用 portfolio 的 gmail
- **Rationale**: 全站單一聯絡信箱，避免多版本
- **Date**: 2026-06-26

### D7: 不做 /n8n-resources/，Nav 移除其連結
- **Decision**: 本次不實作 `/n8n-resources/`（repo 無現成素材），並從 Nav 移除該連結
- **Rationale**: 不留死連結；待有素材再另開設計
- **Date**: 2026-06-26

### D8: 聯絡頁採無後端靜態頁
- **Decision**: `/contact-frank/` 以 email + 社群 + 地點的靜態頁呈現，不接表單後端（不引入 Web3Forms/Turnstile 等服務與金鑰）
- **Rationale**: 純靜態 CF Pages 下表單後端需第三方服務與金鑰、Turnstile 還需 server 驗證；現階段以 email 為主聯絡管道即足夠，避免維護負擔。日後若要表單功能再另開設計
- **Date**: 2026-06-26

### D9: 作品集 n8nManager 維持外部 WordPress 連結
- **Decision**: `/about/` 作品集的 n8nManager 連結維持指向 `https://www.frankchen.tw/n8nmanager`（外部 WordPress 既有頁），不收斂成 `SITE.url`
- **Rationale**: 該頁是 WordPress 站既有的產品介紹頁、Astro 站無此路由；`SITE.url`（`https://frankchen.tw`，非 www）改寫會指向不存在的 Astro 路由變死連結。與 /contact-frank/（改建站內頁）刻意做不同處理：contact 頁有等價內容可內建，n8nmanager 無
- **Date**: 2026-06-26

