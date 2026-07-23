# AGENTS.md

給 coding agent 看的專案指南。人類開發者的完整慣例見 `CLAUDE.md`（本檔不重複
抄錄，僅摘要與指路）。

## 技術棧

Astro v5（靜態輸出）＋ Tailwind CSS v4（透過 Vite plugin，非 PostCSS）＋
TypeScript strict mode。部署到 Cloudflare Pages（`https://frankchen.tw`）。
內容全為 Markdown（`src/content/posts/`），單一 collection，zod schema 驗證。

## 常用指令

```bash
npm run dev          # 開發伺服器（會先跑字型裁切，見下方）
npm run build         # 正式建置 → dist/
npm run preview       # 預覽 build 產物
npm run verify:seo    # build 後的靜態 SEO 驗證（12 條規則，需先 build）
npm run fonts         # 手動重跑字型裁切（scripts/build-font-css.mjs）
npx astro check       # TypeScript / Astro 型別檢查
```

`dev` / `build` 前會自動跑 `scripts/build-font-css.mjs`（產出 gitignore 的
`src/styles/fonts.css` 與 `public/fonts/*`），不需要手動介入；只有改字型設定
時才需要碰這支腳本，見 `docs/SEO_GUIDE.md`「字型管線」一節。

沒有設定 lint 指令。

## 目錄結構

```
src/
  content/posts/     Markdown 文章，schema 見 src/content.config.ts
  pages/             路由；[...slug].astro 是文章頁，category/tag 下有列表頁
  layouts/           BaseLayout.astro 是唯一 layout，所有 SEO head meta 都在這
  components/        Nav / Footer / ArticleCard / Breadcrumbs / JsonLd 等
  utils/site-meta.ts SITE 常數與 JSON-LD 工廠函式，SEO 的單一來源
  styles/global.css  design tokens（CSS 變數），Tailwind v4 於此 @import
scripts/             build-font-css.mjs（網頁字型裁切）、subset-fonts.mjs
                     （OG 圖字型，用 satori）、verify-seo.mjs（build 後驗證）
docs/
  SEO_GUIDE.md       改動 SEO 相關內容前必讀
  SEO_TODO.md        已知未完成事項
  specs/, data/       施工 spec 與稽核基準快照
.github/workflows/    seo-pr.yml（PR 稽核）、seo-daily.yml（正式站日檢）
.githooks/pre-commit  文章 frontmatter 快速檢查（commit 時擋）
```

## 程式碼慣例

完整慣例（Design System、命名、View Transitions、字型堆疊等）見專案根目錄
`CLAUDE.md`，不在此重複；重點只列 agent 容易踩到的：

- Tailwind v4 設定在 `astro.config.mjs` 的 vite plugin，不是 `tailwind.config.*`。
- Design tokens 是 `src/styles/global.css` 的 CSS 變數，不要在元件裡寫死顏色／
  字型／間距數值。
- 語言：zh-TW（正體中文台灣用語），所有內容與 UI 文案皆同。

## 寫文章時的 frontmatter 規範

```yaml
title: string        # 必填，不可超過 60 字（zod schema 擋，見 src/content.config.ts）
date: date            # 必填
updated: date         # 選填，有修訂時填
description: string   # 必填，120–160 字元 —— 這是硬性要求
category: enum        # 必填，n8n | flutter | devops | raspberry-pi | tools
tags: string[]         # 選填，預設空陣列
cover: image           # 必填（image() helper）
draft: boolean         # 選填，預設 false
```

**`description` 的 120–160 字元範圍是硬性要求**：`.githooks/pre-commit` 會在
commit 時檢查所有 staged 的文章 frontmatter，字數不在範圍內會直接擋下
commit（連同 title/description/date/category 缺漏一起擋）。`title` 只有
`max(60)` 由 zod 在 build 時擋，沒有自動化下限檢查，寫的時候仍要自己抓
30 字以上。

## 改動前必讀

任何涉及 meta/head、JSON-LD、sitemap、robots、字型、CSP 或頁面 props 的改動，
**先讀 `docs/SEO_GUIDE.md`**——裡面記錄了每個決策背後「為什麼」，包含容易被
順手改壞的地方（例如 `Organization.logo` 是字串但 `BlogPosting.publisher.logo`
是 `ImageObject`，兩者刻意相反）。改完務必跑 `npm run build && npm run verify:seo`
確認沒有回歸。
