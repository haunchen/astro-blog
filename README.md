# frankchen.tw

個人技術部落格，記錄 n8n 自動化、Flutter 開發、DevOps、Raspberry Pi 與各種工具的實作筆記。

Built with [Astro](https://astro.build/) v5, styled with [Tailwind CSS](https://tailwindcss.com/) v4, deployed on [Cloudflare Pages](https://pages.cloudflare.com/).

## Tech Stack

- **Framework:** Astro v5 (Static Site Generation)
- **Styling:** Tailwind CSS v4 + custom design tokens
- **Typography:** Merriweather, Inter, JetBrains Mono, Noto Sans/Serif TC
- **SEO:** astro-seo, @astrojs/sitemap
- **Syntax Highlighting:** Shiki (tokyo-night)

## Getting Started

```bash
npm install
npm run dev       # http://localhost:4321
npm run build     # Production build → dist/
npm run preview   # Preview production build
```

## Project Structure

```
src/
├── components/       # Astro components (Nav, ArticleCard, TagBadge, etc.)
├── content/posts/    # Markdown articles (content collection)
├── layouts/          # BaseLayout with SEO, fonts, View Transitions
├── pages/            # Route pages (index, [...slug], 404)
└── styles/           # Global CSS with design tokens and E-ink animations
```

## Design

深色 e-ink 風格，以階梯式動畫模擬電子紙刷新效果。紙張紋理疊加層營造閱讀質感，所有動畫皆尊重 `prefers-reduced-motion` 設定。

完整視覺預覽：直接在瀏覽器開啟 [`style-preview.html`](style-preview.html)，包含所有 design tokens、元件樣式與動畫效果展示。
