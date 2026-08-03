# AGENTS.md

給 coding agent 看的專案指南。人類開發者的完整慣例見 `CLAUDE.md`（本檔不重複
抄錄，僅摘要與指路）。

> 注意：本檔與 `public/AGENTS.md` 是兩份不同的東西，別改錯。那一份會被部署到
> `https://frankchen.tw/AGENTS.md`，是給**造訪網站**的 agent 看的內容取用手冊
> （路徑慣例、frontmatter 契約、引用規範），與開發這個 repo 無關。

## 技術棧

Astro v5（靜態輸出）＋ Tailwind CSS v4（透過 Vite plugin，非 PostCSS）＋
TypeScript strict mode。部署到 Cloudflare Pages（`https://frankchen.tw`）。
內容全為 Markdown（`src/content/posts/`），單一 collection，zod schema 驗證。

本 repo 原本純靜態輸出，2026-08 起因 Accept 內容協商（見 `docs/specs/agent-markdown.md`）
多了一層 runtime：`functions/_middleware.js`（Cloudflare Pages Functions），這是本 repo
第一次有 build 之外會在請求時執行的程式碼。`astro preview` **不會**執行 Pages Functions，
改動 `functions/`、`public/_headers`、`public/_routes.json` 或 `BaseLayout.astro` 的宣告
結構時，這條路徑在本機用 `npm run preview` 預設看不見，要驗必須用 `npm run preview:pages`
（見下方常用指令）。

## 常用指令

```bash
npm run dev          # 開發伺服器（會先跑字型裁切，見下方）
npm run build         # 正式建置 → dist/
npm run preview       # 預覽 build 產物（astro preview，不執行 Pages Functions）
npm run preview:pages # 預覽 build 產物 + Pages Functions（wrangler pages dev），驗內容協商用這支
npm test              # scripts/lib/ 的單元測試（WordPress 匯入工具鏈 + markdown 匯出 + DNS-AID 解析／評估）
npm run verify:seo    # build 後的靜態 SEO 驗證（需先 build）
npm run fonts         # 手動重跑字型裁切（scripts/build-font-css.mjs）
npx astro check       # TypeScript / Astro 型別檢查
```

`npm test` 的 glob **刻意加了雙引號**，要讓 Node 自己展開而不是 shell 展開（這是
Node 官方文件建議的可攜寫法）。拿掉引號、或改傳目錄（`node --test scripts/lib/`）
在 Windows 上會失敗，不要「順手修正」。

另有五支打**正式站**（而非 localhost）的驗證腳本：`verify:headers`、`verify:robots`、
`verify:assets`、`verify:dns-aid`、`verify:negotiation`。前三支存在的理由是 Cloudflare
zone 層規則會覆寫 repo 裡的設定——`public/_headers` 與 `public/robots.txt` 是請求，
zone 才是執行——所以指向 localhost 等於讓這些檢查失去意義。`verify:dns-aid` 則是驗證
zone 上的 DNS-AID 記錄（`_index._agents.<host>`）還在、還是對的：DNS 記錄完全不在 repo，
沒有版控也沒有 code review，這支腳本是唯一會在記錄被改壞或刪掉時叫出來的東西。
`verify:negotiation` 驗證 Accept 內容協商（見上方「技術棧」一節的 runtime 層）——
它預設也是打正式站，但因為協商邏輯活在本機 `astro preview` 不會執行的 Pages Functions
裡，要在本機驗證得先 `npm run preview:pages` 起 wrangler，再指向它：
`npm run verify:negotiation http://localhost:8788`。
要換來源用 `npm run verify:headers -- https://其他來源`。

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
                     （OG 圖字型，用 satori）、verify-*.mjs（build 後與正式站驗證，
                     含 verify-dns-aid.mjs 驗 zone 上的 DNS-AID 記錄）
  lib/               migrate-wp、markdown 匯出、DNS-AID 解析／評估、頁面路徑↔md
                     路徑映射（md-path.mjs）的純函式，npm test 的對象
functions/
  _middleware.js     Accept 內容協商（Cloudflare Pages Functions，本 repo 唯一的
                     runtime 層；復用 scripts/lib/md-path.mjs 算頁面的 md 路徑）
public/
  AGENTS.md          ← 給造訪網站的 agent，不是這一份
  _headers, _redirects, robots.txt, _routes.json（Pages Functions 的路徑排除清單）
docs/
  SEO_GUIDE.md       改動 SEO 相關內容前必讀
  SEO_TODO.md        已知未完成事項
  deployment.md      部署與 Cloudflare 設定
  specs/             功能規格（動到既有行為時要一起更新）
  plans/             日期成對的設計與實作計畫
  data/              SEO 基準快照
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
- `astro.config.mjs` 的 `vite.build.assetsInlineLimit: 0` 與 `cssCodeSplit: false`
  是 load-bearing 的，不要當成待最佳化的設定。前者一旦調高會把 `Nav.astro` 的
  script 內聯，`public/_headers` 的 CSP（`script-src 'self'`）就會在執行期把選單
  打死——build 不會報錯，只有真的在瀏覽器點下去才會發現。
- 站台層級的共用資料（分類、導覽、首頁文案、JSON-LD）集中在
  `src/utils/site-meta.ts`，沿用單一來源，不要在頁面裡另抄一份。
- 正規主機是 **non-www**。內容、sitemap、站內連結都不得出現 www 網址。

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
