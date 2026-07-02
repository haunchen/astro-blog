# SEO 生產級收尾（seo-production-hardening）設計

- 日期：2026-07-02
- 分支：`feat/seo-production-hardening`
- 來源：上線前 SEO／網站架構全站檢查（實測 `npm run build` 產出 104 頁後對 dist 斷言）
- 關聯 spec：`docs/specs/pre-launch-infra.md`（active）、`docs/specs/site-pages.md`（active）
- 關聯 issue：清掉 #13（skip-link、og png 型別）；#15/#11（CSS 一致性）不在本批，另開

## 背景與目標

站台準備從 `astro-blog-6fk.pages.dev` 正式上線（frankchen.tw cutover 另案）。全站檢查發現 12 項生產級缺口：6 項上線前應修（空 og:image、og:type 固定 website、無 Twitter Card、giscus 佔位假 UI、首頁無 h1、首頁死連結）＋6 項建議改善（sitemap lastmod、RSS self link、RSS autodiscovery title、llms.txt 主要頁面、_headers 清理、廢棄 X-XSS-Protection）。本批一次修完並順路清 Issue #13。

**不在本批**：canonical host（www vs apex）決策與 privacy 頁網址標示——歸 frankchen.tw cutover 案（Zeabur-CF 遷移計畫待決項）；CSS 一致性技術債（#15/#11）另開批次。

## 設計

### 1. BaseLayout 社群分享 meta（核心批）

`src/layouts/BaseLayout.astro`：

- og:image fallback：`ogImage` prop 未傳時預設 `/cover.webp`，消除 `<meta property="og:image" content>` 空值（實測 /articles/、/category/*、/tag/*、/privacy-policy/、/contact-frank/、/n8n-resources/、404 皆中）。
- 新增 optional `article` prop：`{ publishedTime: Date, modifiedTime?: Date, tags?: string[] }`。有傳→`og:type=article` 並輸出 `article:published_time` / `article:modified_time` / `article:tag`（astro-seo `openGraph.article` 原生支援）；未傳→維持 `website`。`[...slug].astro` 傳入文章日期與 tags。
- Twitter Card：`twitter: { card: 'summary_large_image', title, description, image }`。無 X 帳號，不寫 site/creator handle。
- RSS autodiscovery `<link rel="alternate">` 的 title 由頁面 title 改固定 `SITE.name`。

### 2. giscus 佔位移除

`[...slug].astro` 的「giscus 留言區將在此載入」整段（`.article-comments` 區塊與對應 CSS）移除。生產環境不留佔位假 UI；留言功能之後有需求另開 feature（接 giscus 需 GitHub Discussions＋giscus app 外部設定，不併本批）。

### 3. 首頁 h1 與死連結（site-pages）

- 首頁加 visually-hidden `<h1>`（站名＋tagline），版面零變動。此為補 site-pages D18（刻意移除 hero）留下的 SEO 缺口：hero 不回歸，h1 以無障礙隱藏方式存在。
- 首頁專案卡「醫療教學模擬器 G3」的 `link: '#'` 改連 `/about/`（該頁已有完整 G3 專案段落）。

### 4. skip-to-content（清 #13）

BaseLayout `<body>` 最前加 `<a href="#main-content" class="skip-link">跳到主內容</a>`（focus 時才可見），`<slot />` 外包 `<div id="main-content" tabindex="-1">`，免逐頁改 11 個 page 檔的 `<main>`。

### 5. sitemap lastmod

`astro.config.mjs` sitemap integration 加 `serialize`。callback 只拿得到 URL，故 build 時先從 posts collection 建 `Map<pathname, date>`，命中文章 URL 填 `lastmod`（`updated ?? date`；目前 35 篇皆無 `updated`，先用 `date`），其餘頁面不填。

### 6. RSS self link

`rss.xml.ts` 加 atom namespace（`xmlns:atom`）與 `<atom:link href="{SITE.url}/rss.xml" rel="self" type="application/rss+xml"/>`（customData），消 W3C validator 警告。

### 7. llms.txt 主要頁面

「主要頁面」清單由僅首頁擴為：`/`、`/articles/`、`/category/`、`/tag/`、`/n8n-resources/`、`/about/`、`/contact-frank/`，各附一句用途說明。

### 8. _headers 清理

- 刪 `/images/*` 規則（dist 無此路徑，文章圖在 `/_astro/*` 已有 immutable 規則）。
- 刪 `X-XSS-Protection`（已廢棄，舊瀏覽器反有 side-channel 風險）。
- 補 `/cover.webp` 與 `/n8n-resources/*` 快取規則（比照既有靜態檔一天／一週策略）。

### 9. og png 型別修正（清 #13）

`src/pages/og/[...slug].png.ts` 的 `new Response(png)` Buffer 型別錯誤改 `new Response(new Uint8Array(png))`，`astro check` 歸零。

## 錯誤處理

本批全為 build-time 靜態產出，失敗即 build fail，無 runtime 錯誤面。

## 驗證策略

`npm run build` 後對 dist 斷言：

1. 任一文章頁：`og:type=article`、`article:published_time`、`twitter:card=summary_large_image`。
2. 未傳 ogImage 的頁（如 /articles/）：og:image 為 `https://frankchen.tw/cover.webp` 非空。
3. `dist/index.html`：有且僅有一個 `<h1>`；grep 不到 `href="#"`。
4. 全站 grep 不到「giscus 留言區將在此載入」。
5. `dist/sitemap-0.xml`：文章 URL 含 `<lastmod>`、列表頁不含。
6. `dist/rss.xml`：含 `atom:link` 且 `rel="self"`。
7. 每頁 `<link rel="alternate" type="application/rss+xml">` title 固定為站名。
8. `_headers`：無 X-XSS-Protection、無 /images/*。
9. `npx astro check` 通過（og png 型別歸零）。
10. skip-link：HTML 首個可 focus 元素為 skip-link，target `#main-content` 存在。

上線後以 Facebook Sharing Debugger 抽驗一篇文章＋一個列表頁（沿用 pre-launch-infra S4）。

## Spec Delta 摘要

- pre-launch-infra：MODIFIED R5（RSS self link）、R6（llms.txt 主要頁面清單）、R8（移除 X-XSS-Protection、快取規則更新）；ADDED R10（社群分享 meta 完整性）、R11（sitemap lastmod）。
- site-pages：ADDED R20（skip-to-content）、R21（首頁唯一 h1）、R22（首頁專案卡連結有效性）。
- giscus 佔位移除不入 spec（原本即無留言區 requirement），本文件記錄決策。
