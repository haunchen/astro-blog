# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Dev server (localhost:4321), regenerates font CSS first
npm run build      # build-font-css → subset-fonts → astro build → dist/
npm run preview    # Preview production build
```

```bash
npm test           # 26 unit tests covering the WordPress migration toolchain (scripts/lib/)
```

The glob in the `test` script is double-quoted on purpose so **Node** expands it, not the shell —
this is what Node's own docs recommend for portability. Passing the bare directory
(`node --test scripts/lib/`) fails on Windows.

Verification scripts:

```bash
npm run verify:seo       # Static SEO assertions against dist/ — run AFTER npm run build
npm run verify:headers   # HTTP headers of the LIVE site
npm run verify:robots    # robots.txt of the LIVE site
npm run verify:assets    # Static assets referenced by LIVE pages actually resolve
```

`verify:headers` / `verify:robots` / `verify:assets` hit **https://frankchen.tw (production)** by default —
they exist precisely because Cloudflare zone-level rules can override what the repo says, so pointing them
at localhost defeats their purpose. Override the origin with `npm run verify:headers -- https://other-origin`.

No linter is configured. TypeScript is strict; `@astrojs/check` is installed for `npx astro check`
(not wired to an npm script).

## Architecture

Astro v5 blog with Tailwind CSS v4, TypeScript strict mode, deployed to Cloudflare Pages at frankchen.tw
(cutover from WordPress/Zeabur on 2026-07-19).

**Content Collections:** Single "posts" collection (`src/content/posts/`), Markdown via the glob loader,
Zod-validated. Schema enforces SEO limits that will fail the build, not warn:
`title` ≤ 60 chars, `description` ≤ 160 chars, `category` enum (n8n, flutter, devops, raspberry-pi, tools),
`cover` is a required `image()`. Optional: `updated`, `tags`, `draft`.

**Routing:**
- `/` — Homepage (hero, latest articles, categories, about)
- `/[...slug]/` — Article pages via `getStaticPaths()` from posts collection
- `/articles/` — Timeline of all posts, grouped by year
- `/about/`, `/contact-frank/`, `/n8n-resources/`, `/privacy-policy/` — Standalone pages
- `/category/` + `/category/[category]/` — Category index and per-category listing
- `/tag/` + `/tag/[tag]/` — Tag index and per-tag listing
- `/404` — Custom 404 with e-ink glitch animation
- `/og/[...slug].png` — OG images generated at build time (satori + sharp)
- `/rss.xml`, `/llms.txt`, `/sitemap.xml`

**Sitemap:** `@astrojs/sitemap` always emits `sitemap-index.xml` + `sitemap-0.xml`; a custom
`sitemapAsSingleFile` integration in `astro.config.mjs` renames the single shard to `/sitemap.xml`
and drops the index. It **throws if the shard count is ever ≠ 1** rather than silently losing URLs.
Per-tag pages are excluded from the sitemap by a `filter` (low index value, duplicates article content);
`/tag/` itself stays in.

**Layout:** `BaseLayout.astro` wraps all pages — handles SEO (astro-seo), font loading, View Transitions
(ClientRouter), page transition animations.

**Key Components:** `Nav`, `Footer`, `Breadcrumbs`, `SocialIcons`, `JsonLd`, `ArticleCard`,
`ArticleTimeline`, `CategoryGrid`, `ResourceCard`, `TableOfContents`, `TagBadge`. Worth knowing:
- `Nav.astro` — Sticky nav with mobile hamburger, re-initializes on View Transitions
- `ArticleCard.astro` — Card with `featured` prop for two-column variant
- `TableOfContents.astro` — Sticky TOC with IntersectionObserver scroll tracking, filters h2-h3
- `TagBadge.astro` — Renders as `<a>` if href provided, otherwise `<span>`

**Build constraints (do not change casually — each is load-bearing):**
- `vite.build.assetsInlineLimit: 0` keeps every script external so the CSP in `public/_headers` can stay
  `script-src 'self'`. Raising it inlines `Nav.astro`'s script and CSP kills the menu at runtime.
- `vite.build.cssCodeSplit: false` merges all CSS into one file — trades ~1.7 KB for 4 fewer round trips
  on the homepage. Revisit only if total CSS grows well beyond its current ~15 KB gzipped.
- A Shiki transformer rewrites tokyo-night's comment color `#51597D` → `#7A82AB` for WCAG AA contrast.

**Scripts:** `build-font-css` + `subset-fonts` (font pipeline, run by dev/build), `migrate-wp` +
`scripts/lib/*` (one-off WordPress WXR importer, the part under test), `build-manifest`, `verify-*`.

**Redirects:** `public/_redirects` holds path-level 301s (old WP slugs, sitemap filenames, subdomain
handoffs). The www → non-www redirect lives in **Cloudflare zone config, not in this repo**. Same for
some header and AI-crawler rules — `public/robots.txt` and `public/_headers` are requests, the zone is
enforcement, and the two lists do not sync. Verify with `verify:headers` / `verify:robots` against the
live site rather than reading the files.

**CI:** `.github/workflows/seo-pr.yml` runs `npm test` + build + `verify:seo` + Lighthouse on every PR;
`seo-daily.yml` runs a scheduled squirrelscan audit. `.githooks/pre-commit` (enabled by `npm install`
via the `prepare` script) validates frontmatter on staged posts only — seconds-fast, no build.

**Docs:** `docs/specs/` (feature specs), `docs/plans/` (dated design + implementation pairs),
`docs/data/` (SEO baselines), `docs/deployment.md`, `docs/SEO_GUIDE.md`, `docs/SEO_TODO.md`.

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
- Canonical host is **non-www** (`site: 'https://frankchen.tw'`). Never emit www URLs in content,
  sitemaps, or internal links.
