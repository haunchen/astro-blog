# frankchen.tw

個人技術部落格，記錄 n8n 自動化、Flutter 開發、DevOps、Raspberry Pi 與各種工具的實作筆記。

Built with [Astro](https://astro.build/) v5, styled with [Tailwind CSS](https://tailwindcss.com/) v4, deployed on [Cloudflare Pages](https://pages.cloudflare.com/).

## Tech Stack

- **Framework:** Astro v5 (Static Site Generation)
- **Styling:** Tailwind CSS v4 + custom design tokens
- **Typography:** Merriweather, Inter, JetBrains Mono, Noto Sans/Serif TC（建置時自動子集化）
- **SEO:** astro-seo, @astrojs/sitemap, JSON-LD 結構化資料
- **OG 圖：** satori + sharp，建置時為每篇非草稿文章產生
- **Syntax Highlighting:** Shiki (tokyo-night)

## Getting Started

```bash
npm install
npm run dev       # http://localhost:4321
npm run build     # Production build → dist/
npm run preview   # Preview production build
```

`npm install` 會透過 `prepare` script 啟用 `.githooks/pre-commit`，在 commit 當下檢查文章
frontmatter 的必要欄位，不需要另外裝 husky。

## 測試與驗證

```bash
npm test             # 單元測試（WordPress 遷移工具鏈，26 項）
npm run verify:seo   # 靜態 SEO 斷言，需先 npm run build
```

另有三支驗證腳本**直接打正式站**，用來檢查 Cloudflare zone 層設定是否覆寫了 repo 的意圖
（這類問題不會讓 build 變紅，只能對線上實測）：

```bash
npm run verify:headers   # HTTP 安全標頭
npm run verify:robots    # robots.txt
npm run verify:assets    # 頁面引用的靜態資產是否真的取得到
```

預設目標是 https://frankchen.tw，可用 `npm run verify:headers -- <origin>` 換成其他來源。

CI 方面，每個 PR 會跑 `npm test` + build + `verify:seo` + Lighthouse，另有每日排程的 squirrelscan 稽核。

## Project Structure

```
src/
├── components/       # Astro 元件（Nav、Footer、ArticleCard、TableOfContents 等）
├── content/posts/    # Markdown 文章（content collection，Zod 驗證）
├── data/             # 靜態資料（n8n 資源清單等）
├── layouts/          # BaseLayout：SEO、字型、View Transitions
├── pages/            # 路由（index、[...slug]、articles、category、tag、og 等）
└── styles/           # 全域 CSS：design tokens 與 e-ink 動畫

scripts/              # 字型管線、WP 遷移工具、verify-* 驗證腳本
public/               # _headers、_redirects、robots.txt、字型與圖片
docs/                 # specs、plans、部署與 SEO 文件
```

文章 frontmatter 受 Zod schema 約束，違反會讓 build 失敗而非只是警告：標題 ≤ 60 字、
描述 ≤ 160 字、`category` 限 n8n / flutter / devops / raspberry-pi / tools、封面圖必填。

## Design

深色 e-ink 風格，以階梯式動畫模擬電子紙刷新效果。紙張紋理疊加層營造閱讀質感，所有動畫皆尊重 `prefers-reduced-motion` 設定。

完整視覺預覽：直接在瀏覽器開啟 [`style-preview.html`](style-preview.html)，包含所有 design tokens、元件樣式與動畫效果展示。
