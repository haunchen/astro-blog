# Header / Footer 改版設計

日期：2026-06-28
分支：`feat/header-footer-redesign`
Domain：`site-pages`（brownfield delta）

## 背景與目標

把 Astro 站的 header 與 footer 改成貼近原 WordPress 站（www.frankchen.tw）的設計：

- Header：頂部高版型，左＝圓形頭像＋標題＋副標，右＝水平 nav（首頁／關於我／n8n 相關資源／文章▾／聯絡我），文章帶下拉。
- Footer：左＝頭像＋標題＋描述＋社群圖示，右＝兩欄策展連結，底部置中 copyright。

「大標題」實際文字使用者另行討論，本次以原站字串當 placeholder，並抽到 `site-meta` 由單一來源管理。

## 線上 WP 站盤點（連結對應）

已存在於 Astro（重新接線即可）：

- 首頁 `/`、關於我 `/about/`（WP `/personal/`）、文章 `/articles/`（WP `/archives/`）、聯絡我 `/contact-frank/`、隱私權 `/privacy-policy/`
- 分類：n8n→`/category/n8n/`、devops→`/category/devops/`、flutter→`/category/flutter/`、raspberry-pi→`/category/raspberry-pi/`

需新建（本次範圍）：

- `/n8n-resources/`：原站是 7 區塊策展目錄（教學文章／模板分享／推薦學習資源／推薦進階應用／推薦模板／推薦 Line 社群／官方資源）。**本次只做最小 stub**，完整內容另開 feature。
- Tag 路由：footer「n8n 模板」→ `/tag/模板/`（schema 已有 `tags`，「模板」tag 有 3 篇）。

## 決策摘要

- 連結處理：選 option 3（補做缺頁），但 `/n8n-resources/` 完整版另案、本次放 stub。
- Header 捲動行為：頂部高版，捲離頂部後**收合成精簡 sticky bar**。
- 文章下拉：**照原圖固定 3 項**策展清單（n8n 相關文章／Flutter 開發／Raspberry Pi），與 `CATEGORIES` 顯示名解耦。
- Tag：**全生**（每個有非草稿文章的 tag 都生頁），另加 `/tag/` **文字雲**總覽頁。

## Header 設計

### 桌機高版型（約 96–104px）

```
( 頭像 )  法蘭克｜不典型的軟體工程師          首頁  關於我  n8n 相關資源  文章▾  聯絡我
          探索軟體世界，紀錄開發點滴
```

- 左：圓形頭像（`/logo.webp`）＋標題（連 `/`）＋副標。
- 右：水平 nav，沿用設計系統色／字。

### 捲動收合（sticky）

- header `position: sticky; top:0` 常駐。
- 頁面頂端放一個 sentinel `<div>`，用 IntersectionObserver 偵測是否捲離頂部；捲離後在 header 加 `.scrolled`。
- `.scrolled` 透過 CSS 過渡成精簡列：小 logo ＋小標題＋ nav，隱藏副標與大頭像，高度降到約 56px。過渡採 einkRefresh 的 steps 風格。
- View Transitions：`astro:after-swap` 重新初始化（同現有 Nav 做法）。

### 文章下拉（▾，固定 3 項策展）

- 桌機 hover／focus-within 展開面板：
  - n8n 相關文章 → `/category/n8n/`
  - Flutter 開發 → `/category/flutter/`
  - Raspberry Pi → `/category/raspberry-pi/`
- 父項「文章」本身連 `/articles/`。
- 可及性：用 `<button aria-expanded>` 控制，focus-within 可鍵盤操作。

### 手機（≤768px）

- 收成漢堡；展開為直列，文章區把 3 個分類當子項列出。
- 沿用現有 active 高亮（`isActive`）。

### Nav 連結集（全部可達，符合 R9）

首頁 `/`、關於我 `/about/`、n8n 相關資源 `/n8n-resources/`、文章 `/articles/`（下拉分類）、聯絡我 `/contact-frank/`。

## Footer 設計（比照原圖）

```
( 頭像 ) 法蘭克｜不典型的軟體工程師          n8n 自動化        n8n 學習資源
         從只會寫程式，到跨領域學習電路、製程、       n8n 模板          關於我
         架站。在這裡分享實戰經驗、踩坑紀錄與        WordPress 架站    聯絡我
         自動化模板。                          App 應用開發      隱私權政策
         (Threads)(IG)(GitHub)(LinkedIn)(✉)
─────────────────────────────────────────────────
                 Copyright © 2025–2026 法蘭克
```

- 左區：圓形頭像＋標題＋描述段落，下方一排社群圖示。
- 社群圖示（5 個 inline SVG）：Threads／Instagram／GitHub／LinkedIn／Email，來源 = `SITE.sameAs` 四 URL ＋ `mailto:SITE.email`（單一來源）。
- 兩欄策展連結（沿用原圖文字標籤）：
  - 欄一：n8n 自動化→`/category/n8n/`、n8n 模板→`/tag/模板/`、WordPress 架站→`/category/devops/`、App 應用開發→`/category/flutter/`
  - 欄二：n8n 學習資源→`/n8n-resources/`、關於我→`/about/`、聯絡我→`/contact-frank/`、隱私權政策→`/privacy-policy/`
- Copyright：`Copyright © 2025–{當前年} 法蘭克`，結束年用 build 時 `getFullYear()`（起始 2025），底部置中、上方分隔線。
- 手機：欄位堆疊、社群列換行、copyright 置中。

## Tag 路由

### `src/pages/tag/[tag].astro`（個別 tag 頁，全生）

- `getStaticPaths` 掃所有非草稿文章的不重複 tag，每個 tag 生一頁。
- 重用 `ArticleTimeline`（年份分組時間軸）列出該 tag 文章，頁頂「標籤：{tag}（N 篇）」＋回 `/tag/` 連結（與 `/category/{slug}/` 回鏈 `/category/` 模式一致）。
- 路徑編碼：連結用 `encodeURIComponent(tag)` 對應，避免中文／特殊字（`Let's Encrypt`、`v0.dev`、`NFC門禁卡` 等）路徑不一致；`Astro.params.tag` 取回為解碼值。

### `src/pages/tag/index.astro`（`/tag/` 文字雲總覽）

- 列出全部 tag，以文字雲呈現：字級依該 tag 篇數分級（建議 3–4 個尺寸 tier，依篇數區間決定），各 tag 連 `/tag/{tag}/`。
- 篇數一律由 content collection 即時計算。

### SEO

- 預設全生、可索引。已知薄內容頁多（多數 tag 僅 1 篇）；若日後在意可加 noindex 或調整門檻（本次不處理）。

## `/n8n-resources/` stub

- `src/pages/n8n-resources.astro`：最小但真實 — 標題「n8n 相關資源」＋一句簡介（沿用原站「整理自己實戰過的內容…」）＋少量真連結（n8n 文章 `/category/n8n/`、模板 `/tag/模板/`），標註「完整資源整理持續更新中」。
- 目的：讓 header「n8n 相關資源」與 footer「n8n 學習資源」不死連結。完整 7 區塊策展頁 = 下一個 feature。

## 單一來源與元件

### `src/utils/site-meta.ts` 新增

- 顯示字串：`SITE.title`／`SITE.subtitle`／`SITE.description`（暫用原站字串；`SITE.name` 暫留給 OG/JSON-LD，與顯示標題的對齊列入「大標題」討論）。
- `SOCIAL`：由 `sameAs` 四 URL ＋ `mailto:email` 推出，含 icon key（threads／instagram／github／linkedin／email）。
- `HEADER_NAV`：含文章下拉 3 項策展清單。
- `FOOTER_COLS`：兩欄策展連結。

### 元件

- `Nav.astro`：改寫成完整 header（高版＋收合＋下拉＋手機）。
- `Footer.astro`：改寫（品牌＋描述＋社群＋兩欄＋copyright）。
- `SocialIcons.astro`（新）：inline SVG 品牌圖示，由 `SOCIAL` 驅動。
- 新頁：`pages/tag/[tag].astro`、`pages/tag/index.astro`、`pages/n8n-resources.astro`。

## 測試策略（本專案無 test runner）

- `npm run build` 須過（tag `getStaticPaths`、無死連結）。
- Chrome 抽驗：
  - 桌機高版 ↔ 捲動收合精簡 bar
  - 文章下拉 3 項、手機漢堡子項
  - footer 五社群圖示連對、兩欄連結全可達、copyright 年份
  - `/tag/` 文字雲、`/tag/模板/` 時間軸與回鏈
  - `/n8n-resources/` stub
  - 全站無死連結
- dev 流程末端 Gemini review。

## 未決 / 後續

- 「大標題」實際文字與 `SITE.name` 對齊（使用者另議）。
- `/n8n-resources/` 完整策展頁（另開 feature，從 WP 移植 7 區塊）。
- tag 頁薄內容 SEO（如需再加 noindex／門檻）。
