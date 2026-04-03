# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Dev server (localhost:4321)
npm run build      # Production build → dist/
npm run preview    # Preview production build
```

No test or lint commands configured.

## Architecture

Astro v5 blog with Tailwind CSS v4, TypeScript strict mode, deployed to Cloudflare Pages at frankchen.tw.

**Content Collections:** Single "posts" collection (`src/content/posts/`), Markdown with Zod schema validation. Categories are enum: n8n, flutter, devops, raspberry-pi, tools.

**Routing:**
- `/` — Homepage (hero, latest articles, categories, about)
- `/[...slug]/` — Article pages via `getStaticPaths()` from posts collection
- `/404` — Custom 404 with e-ink glitch animation
- Not yet implemented: `/articles/`, `/about/`, `/n8n-resources/`, `/category/[category]/`

**Layout:** `BaseLayout.astro` wraps all pages — handles SEO (astro-seo), font loading (@fontsource), View Transitions (ClientRouter), page transition animations.

**Key Components:**
- `Nav.astro` — Sticky nav with mobile hamburger, re-initializes on View Transitions
- `ArticleCard.astro` — Card with `featured` prop for two-column variant
- `TableOfContents.astro` — Sticky TOC with IntersectionObserver scroll tracking, filters h2-h3
- `TagBadge.astro` — Renders as `<a>` if href provided, otherwise `<span>`

## Design System

Dark e-ink aesthetic defined in `src/styles/global.css` via CSS custom properties (not tailwind.config). 完整視覺預覽見 `style-preview.html`（可直接在瀏覽器開啟，包含所有 design tokens、元件樣式與動畫效果）。

- **Fonts:** Merriweather + Noto Serif TC (body), Inter + Noto Sans TC (UI), JetBrains Mono (code)
- **Colors:** Dark navy background (#0f172a), slate text (#E2E8F0), brand blue (#0084ff) + orange (#fb923c)
- **Content widths:** 720px (content), 960px (wide), 1200px (max)
- **Animations:** einkRefresh (hover), einkEnter/einkExit (page transitions), einkGlitch (404) — all respect `prefers-reduced-motion`
- **Paper texture:** Fixed noise overlay at 0.03 opacity via `::after` pseudo-element

## Conventions

- Language: zh-TW (Traditional Chinese content)
- Markdown syntax highlighting: Shiki with "tokyo-night" theme
- Reading time calculation: word count / 400 characters
- Article pages use two-column layout: main content + sticky TOC aside
- Tailwind v4 configured via Vite plugin (not PostCSS), imported in global.css with `@import "tailwindcss"`
