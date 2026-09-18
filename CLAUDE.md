# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev            # Dev server (localhost:4321), regenerates font CSS first
npm run build          # build-font-css → subset-fonts → astro build → dist/
npm run preview        # Preview production build
npm run preview:pages  # Preview WITH Pages Functions (wrangler) — astro preview does NOT run them
```

`preview:pages` pins `--compatibility-date=2026-06-26` to match the Pages project's dashboard setting.
Without it wrangler infers *today's* date, so local and CI would run the middleware under different
runtime semantics than production. If the dashboard value changes, change it here too — the repo has
no `wrangler.toml` on purpose (a Pages config file would override the dashboard as the source of
truth for build and runtime settings, which is a bigger change than this one flag).

```bash
npm test           # 211 unit tests covering scripts/lib/ (WordPress migration toolchain + markdown
                    # export incl. changelog blockquote + DNS-AID parsing/evaluation +
                    # page-md.mjs page→markdown conversion +
                    # md-path.mjs path mapping + og-image.mjs OG rendering/hashing +
                    # publish-scheduled.mjs 排程發布判定/frontmatter 改寫 +
                    # vault-post.mjs vault→repo 轉換與 --publish-at 日期驗證 +
                    # indexnow.mjs 該送的判定/網址換算/sitemap lastmod 解析/payload 組裝 +
                    # post-id.mjs 文章路徑→id 推導，astro.config.mjs 與 indexnow.mjs 共用)
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
npm run verify:dns-aid   # DNS-AID records (_index._agents.<host>) on the LIVE zone
npm run verify:negotiation  # Accept content negotiation on the LIVE site (or pass an origin)
npm run verify:agent-ua  # Agent UA detection (x-agent-detected / Vary) on the LIVE site (or pass an origin)
```

`verify:headers` / `verify:robots` / `verify:assets` / `verify:dns-aid` / `verify:negotiation` /
`verify:agent-ua` hit **https://frankchen.tw (production)** by default — they exist precisely
because Cloudflare zone-level rules (and, for `verify:dns-aid`, the zone's DNS records themselves)
can override or simply not exist in what the repo says, so pointing them at localhost defeats
their purpose. Override the origin with `npm run verify:headers -- https://other-origin`.

No linter is configured. TypeScript is strict; `@astrojs/check` is installed for `npx astro check`
(not wired to an npm script). `npx astro check` does not cover `functions/`, though — the root
tsconfig doesn't enable `checkJs` (turning it on globally surfaces 361 errors, only 7 of them
actually in `functions/`), so that edge middleware's type checking runs off a scoped
`functions/tsconfig.json` instead, via `npm run check:functions`.

## Architecture

Astro v5 blog with Tailwind CSS v4, TypeScript strict mode, deployed to Cloudflare Pages at frankchen.tw
(cutover from WordPress/Zeabur on 2026-07-19).

**Content Collections:** Single "posts" collection (`src/content/posts/`), Markdown via the glob loader,
Zod-validated. Schema enforces SEO limits that will fail the build, not warn:
`title` ≤ 60 chars, `description` ≤ 160 chars, `category` enum (n8n, flutter, devops, raspberry-pi, tools,
hardware), `cover` is a required `image()`. Optional: `updated`, `tags`, `draft`, `publishAt` (scheduled
publish date — when set, `draft` must also be `true`, enforced by a schema `.refine()`; on the day it's
due, `publish-scheduled` flips `draft` off and rewrites `date` to this value), `changelog` (see
**Updating a published post** below — three `.refine()`s tie it to `updated` and `date`).

Never call `getCollection('posts', …)` directly — go through `getPublishedPosts()` /
`getPublishedPostsByDateDesc()` in `src/utils/posts.ts`. The `!data.draft` predicate used to be
copy-pasted at 15 call sites (pages, listings, RSS, llms.txt, OG images, md variants) with nothing
to catch a new endpoint that forgot it; only the md endpoints have a draft-leak assertion in
`verify-seo`. One rule, one place.

**Routing:**
- `/` — Homepage (hero, latest articles, categories, about)
- `/[...slug]/` — Article pages via `getStaticPaths()` from posts collection
- `/articles/` — Timeline of all posts, grouped by year
- `/about/`, `/contact-frank/`, `/n8n-resources/`, `/privacy-policy/` — Standalone pages
- `/category/` + `/category/[category]/` — Category index and per-category listing
- `/tag/` + `/tag/[tag]/` — Tag index and per-tag listing
- `/404` — Custom 404 with e-ink glitch animation
- `/og/[...slug].png` — OG images generated at build time (satori + sharp). Filenames carry a
  content hash of the PNG bytes (`/og/<slug>.<hash>.png`) so they can take the same one-year
  immutable cache as `/_astro/*`; the URL comes from `getOgImage()` in `src/utils/og.ts`, which
  every consumer (og:image, BlogPosting JSON-LD, `.md` frontmatter) and the endpoint itself share
- `/[...slug].md` — Markdown variant of every published post for AI agents (whitelisted frontmatter,
  absolute image URLs, `X-Robots-Tag: noindex`). See `docs/specs/agent-markdown.md`
- `/index.md` — Markdown variant of the homepage. Different contract from the post variants
  (no `date`/`category`/`tags`); `verify-seo` checks it separately. Homepage copy lives in
  `HOME` (`src/utils/site-meta.ts`) so the HTML page and the `.md` never drift apart
- `/AGENTS.md` (`public/AGENTS.md`) — how-to-consume manual for agents *visiting the site*:
  `.md` path convention, frontmatter contract, canonical/citation rules. **Not the same file
  as the repo-root `AGENTS.md`**, which is the coding-agent guide (vendor-neutral `CLAUDE.md`)
- **Content negotiation:** any page URL with `Accept: text/markdown` returns that page's markdown
  variant at the same URL (`functions/_middleware.js`). HTML stays the default; `Accept: */*` gets
  HTML. The negotiated response strips `X-Robots-Tag` — that header belongs to the `/<path>.md`
  URLs only. See `docs/specs/agent-markdown.md` R11
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
- `vite.build.assetsInlineLimit: 0` keeps every script external. `script-src` in `public/_headers` is
  **no longer** `'self'` only — it also carries `'unsafe-inline'` because Google AdSense requires it
  (see `docs/specs/monetization.md` D5), so raising the limit would not actually break at runtime today;
  CSP would let an inlined `Nav.astro` script through either way. Keep the setting anyway: it's the
  discipline that lets any future CSP tightening (or a per-path middleware override, also discussed in
  D5) start from "every script is already external" instead of first having to find and re-externalize
  whatever crept in.
- `vite.build.cssCodeSplit: false` merges all CSS into one file — trades ~1.7 KB for 4 fewer round trips
  on the homepage. Revisit only if total CSS grows well beyond its current ~15 KB gzipped.
- A Shiki transformer rewrites tokyo-night's comment color `#51597D` → `#7A82AB` for WCAG AA contrast.
- `vite.define.__OG_FONT_DIR__` injects the absolute path of `src/assets/og-fonts/` at compile time,
  because `src/utils/og.ts` has no other reliable anchor: a cwd-relative path assumes the process
  always starts at the repo root, and `import.meta.url` resolves against `dist/chunks/` once the
  module is bundled (verified — it fails with ENOENT). `astro.config.mjs` is not bundled, so its
  `import.meta.url` is the one stable anchor. The ambient `declare const` must live in `src/env.d.ts`,
  never in a `.ts` file — `define` is a textual substitution and would rewrite the declaration itself
  into a syntax error that surfaces only as a dev-server dependency-scan failure.
- `functions/_middleware.js` runs on every page request. `public/_routes.json` excludes
  `/_astro/`, `/fonts/`, `/og/`, `/samples/` so static assets skip the Worker. Do not add
  extension-style excludes (`/*.png`) — Cloudflare only documents greedy-prefix wildcards, and
  a mis-matched pattern silently disables negotiation for whole page sets.

**Scripts:** `build-font-css` + `subset-fonts` (font pipeline, run by dev/build), `migrate-wp` +
`scripts/lib/*` (one-off WordPress WXR importer, the part under test), `scripts/lib/md-export.mjs`
(pure transforms behind `/[...slug].md`, also under test), `scripts/lib/page-md.mjs` + `md-path.mjs`
(page-markdown-variant conversion + path mapping — `page-md.mjs` converts a built page's HTML into
its markdown variant and only runs at build time; `md-path.mjs` has three consumers — the build
integration, `functions/_middleware.js` at request time, and `BaseLayout.astro` — so it must stay
zero-dependency), `scripts/lib/og-image.mjs` (pure satori+sharp OG rendering and content hashing, under test;
wired up by `src/utils/og.ts`, which memoizes per post so page render and the OG endpoint never
render the same image twice), `publish-scheduled` (CLI — daily-run script that flips due scheduled
posts from draft; the judging/rewriting logic lives in `scripts/lib/publish-scheduled.mjs`, pure
functions under test), `sync-from-vault` (CLI — pulls tutorials from the Obsidian vault into
`src/content/posts/`; dry-run by default, `--apply` writes, and **adds only, never overwrites**.
`--publish-at YYYY-MM-DD` lands a post as a scheduled draft — it requires `--slug`, rejects past
dates, and forces `draft: true` regardless of the vault's `content_status`, because the schema
refine demands `publishAt` and `draft: true` come as a pair. The vault's `updated` is dropped for
anything landing as a draft — it means "last edited in Obsidian", not "revised after publication"
(see **Updating a published post**). Transform logic is in
`scripts/lib/vault-post.mjs`, pure functions under test),
`submit-indexnow`（CLI — 把這次新上線或 `updated` 有變的文章網址送出 IndexNow；判定與換算邏輯
在 `scripts/lib/indexnow.mjs`，純函式、under test。送出前會輪詢線上 sitemap 確認 Cloudflare
Pages 部署完成——判據是該網址的 `lastmod` 等於 `updated ?? date`，與 `astro.config.mjs` 的
`POST_LASTMOD` 同一條規則。IndexNow 的 key 放在 `public/<key>.txt`，是公開值不是 secret），`build-manifest`,
`verify-*`.

**Redirects:** `public/_redirects` holds path-level 301s (old WP slugs, sitemap filenames, subdomain
handoffs). The www → non-www redirect lives in **Cloudflare zone config, not in this repo**. Same for
some header and AI-crawler rules — `public/robots.txt` and `public/_headers` are requests, the zone is
enforcement, and the two lists do not sync. Verify with `verify:headers` / `verify:robots` against the
live site rather than reading the files.

**CI:** `.github/workflows/seo-pr.yml` runs `npm test` + `check:functions` + build + `verify:seo` +
Lighthouse + `verify:agent-ua` (the last against a `wrangler pages dev` instance started in the
job, since agent UA detection lives in Pages Functions, which `astro preview` doesn't execute)
on every PR;
`seo-daily.yml` runs a scheduled squirrelscan audit; `publish-scheduled.yml` runs daily to flip due
scheduled posts from draft and push the commit.
`indexnow.yml` 在文章推上 main 時送出索引提交，`publish-scheduled.yml` 翻牌後也會自己呼叫同一
支腳本（Actions 用 `GITHUB_TOKEN` push 的 commit 不會觸發 `on: push`）。Google 端刻意不做主動
提交——它沒有給一般文章的官方路徑，理由見 `docs/specs/index-submission.md` D1。
`.githooks/pre-commit` (enabled by `npm install`
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

## Updating a published post

`updated` means one thing only: **a post that readers have already seen has changed.** It is not a
"last touched" timestamp. A post that isn't live yet has no previous version to be updated from, so
an unpublished post must never carry `updated` — however much it was rewritten while being drafted.
A schema `.refine()` fails the build on `draft: true` + `updated`.

That distinction is exactly what `sync-from-vault` got wrong until 2026-09-18: the vault's own
`updated` field means "when I last edited this note", so a post drafted over six months landed
carrying its writing history as if it were a revision. `vault-post.mjs` now emits `updated` only
when the post lands published.

Any content change to a post that **is** already live gets a `changelog` entry — no exceptions for
"small" fixes. Set `updated` at the same time:

```yaml
updated: 2026-09-18
changelog:
  - date: 2026-09-18
    note: "補上原生 Windows 支援（v2.1.234 起）與相關差異"
```

`note` answers **what got updated**, not what the update says — the latter is the article's job.
It's capped at 60 chars to force one sentence; if it doesn't fit, the detail belongs in the body.
Newest entry first.

Three schema `.refine()`s fail the build rather than warn: `updated` must equal the first entry's
date, entries must run newest-to-oldest, and no entry may predate `date`. Without them the field
would be decoration — the header prints "更新於 X" from `updated` while the block prints Y, and
nothing would catch it.

The block renders above the body via `ArticleChangelog.astro`, and `changelogToMarkdown()` puts the
same thing at the top of the `.md` variant (spec R1). It stays out of the `.md` frontmatter on
purpose: R2's whitelist is a contract, and this is content, not metadata.

Typo-only or formatting-only edits that change no claim don't need an entry — but when in doubt,
add one. A reader who can't tell whether a fact was revised is the failure this prevents.

A `changelog` on an unpublished post is the same mistake as an `updated` on one, and the two
refines already make it impossible: a changelog needs a matching `updated`, and a draft can't have
one. Nothing to disclose to readers who haven't read it yet.

Flipping a scheduled post is safe alongside all this: `publish-scheduled`'s `^date:` match rejects
indented lines, so the nested `date:` keys inside a changelog entry are never mistaken for the
post's own. Its "drop an `updated` older than the new `date`" branch is now belt-and-braces —
the schema stops such a file from existing in the first place.
