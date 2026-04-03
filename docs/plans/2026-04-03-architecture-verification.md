# Architecture Verification Implementation Plan

Goal: 用最少頁面驗證 Astro + Tailwind v4 + Design System 的實際呈現效果，確認 style-preview.html 的設計能正確轉換到 Astro 框架

Architecture: Astro SSG 純靜態站，Tailwind CSS v4 `@theme` 定義 design tokens，@fontsource 載入字型，Shiki 語法高亮。所有樣式從 style-preview.html 提取，轉換為 Tailwind v4 原生語法 + global.css 自訂樣式。

Tech Stack: Astro 5.x, Tailwind CSS v4, @fontsource (Merriweather, Inter, JetBrains Mono, Noto Serif TC, Noto Sans TC), astro-seo, Shiki (tokyo-night)

---

### Task 1: Scaffold Astro Project

Files:
- Create: `package.json`
- Create: `astro.config.mjs`
- Create: `tsconfig.json`
- Create: `public/favicon.svg`

Step 1: 初始化 Astro 專案
Run: `npm create astro@latest . -- --template minimal --no-install --no-git --typescript strict`

Step 2: 安裝依賴
Run: `npm install @astrojs/tailwind @astrojs/sitemap astro-seo @fontsource/merriweather @fontsource/inter @fontsource/jetbrains-mono @fontsource-variable/noto-serif-tc @fontsource-variable/noto-sans-tc`

> 注意：Tailwind CSS v4 搭配 Astro 的整合方式需確認。Astro 5.x 可能使用 `@astrojs/tailwind` 或直接用 Vite plugin。若 `@astrojs/tailwind` 不支援 v4，改用 `tailwindcss @tailwindcss/vite` 並在 astro.config.mjs 手動加入 Vite plugin。

Step 3: 設定 astro.config.mjs
```javascript
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://frankchen.tw',
  integrations: [sitemap()],
  vite: {
    plugins: [tailwindcss()],
  },
  markdown: {
    shikiConfig: {
      theme: 'tokyo-night',
    },
  },
});
```

Step 4: 建立 favicon placeholder
Create `public/favicon.svg`：簡單的 F 字母 SVG

Step 5: 確認 dev server 啟動
Run: `npm run dev`
Expected: Astro dev server 正常啟動

Step 6: Commit
Message: `feat: scaffold Astro project with Tailwind v4 and dependencies`

---

### Task 2: Global CSS — Design Tokens + E-ink Effects

Files:
- Create: `src/styles/global.css`

Step 1: 建立 global.css，包含三大區塊

區塊 A — Tailwind v4 import + @theme tokens：
```css
@import "tailwindcss";

@theme {
  /* Background */
  --color-bg-primary: #0f172a;
  --color-bg-secondary: #212a37;
  --color-bg-tertiary: #152030;
  --color-bg-elevated: #222222;

  /* Text */
  --color-text-primary: #E2E8F0;
  --color-text-secondary: #94A3B8;
  --color-text-muted: #64748B;

  /* Brand */
  --color-brand-blue: #0084ff;
  --color-brand-blue-hover: #0177e3;
  --color-brand-orange: #fb923c;

  /* Border */
  --color-border-default: #4f5b62;
  --color-border-subtle: #2d3a47;
  --color-border-strong: #6b7b86;

  /* State */
  --color-state-success: #22c55e;
  --color-state-error: #ef4444;

  /* Radius */
  --radius-sm: 2px;
  --radius-md: 4px;
  --radius-full: 9999px;

  /* Font families */
  --font-serif: 'Merriweather', 'Noto Serif TC', Georgia, serif;
  --font-sans: 'Inter', 'Noto Sans TC', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', monospace;

  /* Layout widths */
  --width-content: 720px;
  --width-wide: 960px;
  --width-max: 1200px;
  --height-header: 64px;
}
```

區塊 B — E-ink effects（從 style-preview.html 提取）：
- `body::after` paper noise texture overlay（opacity 0.03, SVG fractalNoise）
- `@keyframes einkRefresh`（card hover flash）
- `@keyframes einkExit` / `einkEnter`（page transition）
- `@keyframes einkGlitch`（404 glitch）
- `@keyframes blink`（cursor blink）
- `@media (prefers-reduced-motion: reduce)` 停用所有動畫

區塊 C — Prose 樣式（Markdown 排版）：
- `.prose h2/h3` — serif, 28px/22px
- `.prose p/a/strong/em/ul/ol/li`
- `.prose blockquote` — brand-orange 左邊線 + bg-secondary
- `.prose code` — mono, bg-tertiary, border-subtle
- `.prose pre` — bg-tertiary, border-default, radius-md
- `.prose pre code` — reset background/border
- `.prose table/th/td` — sans, border-default
- `.prose hr` — border-subtle

所有數值直接對照 style-preview.html:840-889。

Step 2: 確認 CSS 無語法錯誤
Run: `npm run dev`
Expected: 無 CSS 解析錯誤

Step 3: Commit
Message: `feat: add global CSS with Tailwind v4 design tokens and E-ink effects`

---

### Task 3: BaseLayout

Files:
- Create: `src/layouts/BaseLayout.astro`

Step 1: 建立 BaseLayout.astro

Props interface：
```typescript
interface Props {
  title: string;
  description?: string;
  ogImage?: string;
}
```

包含：
- `<html lang="zh-TW">`
- `<head>`：meta charset/viewport、`<SEO>` 元件（astro-seo）、字型 import（6 個 @fontsource）
- `<body>`：
  - `class="font-serif bg-bg-primary text-text-primary leading-relaxed"` (或等效 Tailwind v4 class)
  - 如果 Tailwind v4 @theme 的 class 命名不直覺，改用 CSS variable 直接寫 body base style
  - `<slot />` 區域
- 載入 `global.css`
- Astro View Transitions：`import { ViewTransitions } from 'astro:transitions';`，使用自訂 einkExit/einkEnter animation

字型載入（在 BaseLayout 的 frontmatter import）：
```typescript
import '@fontsource/merriweather/400.css';
import '@fontsource/merriweather/700.css';
import '@fontsource/merriweather/400-italic.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import '@fontsource-variable/noto-serif-tc';
import '@fontsource-variable/noto-sans-tc';
```

Step 2: 建立測試頁確認 layout
建立臨時 `src/pages/index.astro` 引用 BaseLayout，放一段 h1 + p 確認字型和背景色

Step 3: 啟動 dev server 確認
Run: `npm run dev`
Expected: 頁面顯示正確背景色 (#0f172a)、Merriweather serif 字型、paper noise overlay 可見

Step 4: Commit
Message: `feat: add BaseLayout with font loading and View Transitions`

---

### Task 4: Nav Component

Files:
- Create: `src/components/Nav.astro`
- Modify: `src/layouts/BaseLayout.astro`（加入 Nav）

Step 1: 建立 Nav.astro

結構（對照 style-preview.html:1208-1218）：
```html
<nav class="...">
  <a href="/" class="nav-logo">Frank Chen</a>
  <ul class="nav-links">
    <li><a href="/n8n-resources/">n8n 資源</a></li>
    <li><a href="/articles/">文章</a></li>
    <li><a href="/about/">關於我</a></li>
    <li><a href="https://github.com/HaunChen" class="social-icon">GH</a></li>
    <li><a href="https://threads.net/@frank_chen" class="social-icon">TH</a></li>
  </ul>
  <button class="nav-hamburger" aria-label="選單">
    <span></span><span></span><span></span>
  </button>
</nav>
```

樣式要點（style-preview.html:356-423）：
- sticky top-0, z-100, h-16 (64px)
- bg-bg-secondary, border-bottom 1px border-default
- font-sans
- nav-links: flex, gap-6, 15px, text-secondary hover:text-primary
- social-icon: text-muted, 13px
- hamburger: hidden on desktop, flex on <=768px
- nav-links: hidden on <=768px

Mobile menu 行為：
- 用 `<script>` tag 在 Nav.astro 內加入 hamburger toggle
- 展開時 nav-links 變成 column layout，position absolute，bg-secondary

Step 2: 在 BaseLayout 的 `<body>` 中加入 `<Nav />`（slot 前面）

Step 3: 使用 `Astro.url.pathname` 標記目前頁面的 nav-active class

Step 4: 確認
Run: `npm run dev`
Expected: Nav 正確顯示，sticky 行為正常，mobile 漢堡選單可展開

Step 5: Commit
Message: `feat: add Nav component with mobile hamburger menu`

---

### Task 5: Footer Component

Files:
- Create: `src/components/Footer.astro`
- Modify: `src/layouts/BaseLayout.astro`（加入 Footer）

Step 1: 建立 Footer.astro

結構（對照 style-preview.html:1101-1116）：
```html
<footer class="footer">
  <div class="footer-inner">
    <div class="footer-brand">Frank Chen</div>
    <p class="footer-tagline">分享實戰經驗、踩坑紀錄與自動化模板</p>
    <ul class="footer-links">
      <li><a href="/">首頁</a></li>
      <li><a href="/articles/">文章</a></li>
      <li><a href="/about/">關於我</a></li>
      <li><a href="/privacy-policy/">隱私權政策</a></li>
    </ul>
    <p class="footer-copyright">© 2026 Frank Chen. All rights reserved.</p>
  </div>
</footer>
```

樣式要點：
- bg-secondary, border-top 1px border-default, padding 48px 0
- font-sans, 14px, text-muted
- footer-inner: max-width 1200px, margin auto, padding 0 24px
- footer-brand: 16px bold text-primary
- footer-links: flex gap-6, text-secondary hover:text-primary
- footer-copyright: 12px mono text-muted

Step 2: 在 BaseLayout 的 `<slot />` 後面加入 `<Footer />`

Step 3: 確認
Run: `npm run dev`
Expected: Footer 正確顯示在頁面底部

Step 4: Commit
Message: `feat: add Footer component`

---

### Task 6: TagBadge Component

Files:
- Create: `src/components/TagBadge.astro`

Step 1: 建立 TagBadge.astro

Props：
```typescript
interface Props {
  text: string;
  href?: string;
  size?: 'default' | 'sm';
}
```

樣式（style-preview.html:516-532）：
- inline-block, font-sans, 12px (sm: 11px), font-weight 500
- padding 2px 8px (sm: 1px 6px)
- bg: rgba(251,146,60,0.15), color: brand-orange
- border-radius: radius-sm, no border
- hover: bg rgba(251,146,60,0.25)
- 如果有 href，渲染為 `<a>`；否則 `<span>`

Step 2: Commit
Message: `feat: add TagBadge component`

---

### Task 7: ArticleCard Component

Files:
- Create: `src/components/ArticleCard.astro`

Step 1: 建立 ArticleCard.astro

Props：
```typescript
interface Props {
  title: string;
  description: string;
  date: Date;
  category: string;
  slug: string;
  cover?: ImageMetadata;
  featured?: boolean;
}
```

兩種模式（style-preview.html:537-618）：

**普通卡片** (`featured=false`)：
- `.card`: bg-secondary, border 1px border-default, radius-md, overflow hidden
- hover: `animation: einkRefresh 500ms steps(4) forwards`
- `.card-image`: h-180px, bg-tertiary, dithered placeholder pattern, border-bottom
- `.card-body`: padding 20px
- `.card-meta`: flex between, tag--sm + date (mono 11px text-muted)
- `.card-title`: serif 18px/26px bold
- `.card-excerpt`: sans 14px/22px text-secondary, line-clamp-2

**Featured 卡片** (`featured=true`)：
- grid 2 columns, image 左 content 右
- image: h-full min-h-240px, border-right instead of border-bottom
- body: padding 32px, flex column justify-center
- title: 22px/30px, excerpt: line-clamp-3

**Responsive** (<=768px)：
- 普通卡片: 1 欄
- featured: 1 欄, image border-right → border-bottom, min-h 180px

Step 2: Commit
Message: `feat: add ArticleCard component with featured variant`

---

### Task 8: Content Collection Schema + Test Article

Files:
- Create: `src/content.config.ts`
- Create: `src/content/posts/test-markdown-rendering/index.md`
- Create: `src/content/posts/test-markdown-rendering/images/cover.png`

Step 1: 建立 content.config.ts（Astro 5.x Content Layer API）

```typescript
import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/posts' }),
  schema: ({ image }) => z.object({
    title: z.string(),
    date: z.date(),
    updated: z.date().optional(),
    description: z.string(),
    category: z.enum(['n8n', 'flutter', 'devops', 'raspberry-pi', 'tools']),
    tags: z.array(z.string()).default([]),
    cover: image(),
    draft: z.boolean().default(false),
  }),
});

export const collections = { posts };
```

> 注意：Astro 5.x 使用 Content Layer API，config 檔名為 `content.config.ts` 放在 `src/` 根目錄，而非 `src/content/config.ts`。collection 需要指定 loader。

Step 2: 建立 cover.png placeholder
用簡單的 1200x630 灰色 PNG（可用 ImageMagick 或手動建立）
Run: `convert -size 1200x630 xc:'#152030' src/content/posts/test-markdown-rendering/images/cover.png`
若無 ImageMagick，用 Node script 產生或放一張任意 PNG

Step 3: 建立測試文章 index.md

Frontmatter：
```yaml
---
title: "Markdown 排版測試：所有元素的完整展示"
date: 2026-03-25
description: "測試所有 Markdown 元素在部落格中的呈現效果，包含標題、列表、程式碼、表格、圖片等。"
category: "tools"
tags: ["markdown", "測試", "排版"]
cover: "./images/cover.png"
draft: false
---
```

內文需涵蓋（對照 architecture-verification.md:86-94）：
- h2、h3、h4 各一
- 段落（含粗體、斜體、連結）
- 有序列表 + 無序列表
- Code block（JavaScript、Python、Bash 各一）+ inline code
- Blockquote
- 表格（3 欄 x 4 行）
- 圖片（含 alt text，用 cover.png）
- 水平線

Step 4: 確認 content collection 可載入
Run: `npm run dev`
Expected: 無 schema 錯誤

Step 5: Commit
Message: `feat: add content collection schema and test article`

---

### Task 9: Home Page

Files:
- Create: `src/pages/index.astro`（覆蓋 Task 3 的臨時版）

Step 1: 建立首頁

結構（對照 architecture-verification.md:64-70 + style-preview.html:1223-1420）：

**Section 1 — Hero**（style-preview.html:466-510）：
```
<div class="hero">
  <h1>法蘭克｜不典型的軟體工程師</h1>  ← serif 36px
  <p>副標題</p>                         ← sans 16px text-secondary
  <div class="hero-tags">
    <TagBadge text="系統整合" />
    <TagBadge text="技術部落客" />
    <TagBadge text="開源貢獻" />
  </div>
</div>
```
- container max-width 1200px
- hero max-width 720px, padding 96px 0 64px

**Section 2 — 最新文章**：
- section-header: serif 28px title + "查看全部 →" link
- 1 個 featured ArticleCard + 3 個普通 ArticleCard (三欄網格)
- 資料來源：Content Collection query，按 date 排序取前 4 篇
- 驗證階段只有 1 篇測試文章，用假資料補齊也可，或只顯示有的

**Section 3 — 探索主題**：
- 5 欄 category-grid（mobile 2 欄）
- 每張 category-card：category-name + category-count
- 資料可先 hardcode（n8n/Flutter/DevOps/工具/樹莓派）

**Section 4 — 精簡介紹**：
- about-preview: flex, gap 32px
- avatar 96px circle + bio text + skill tags + "更多 →" link
- mobile: column, center

**Section 5 — 專案精選**：
- 3 欄 project-grid（mobile 1 欄）
- 每張 project-card: image placeholder + name + desc + tags + link
- 資料 hardcode 3 個專案

各 section 之間用 `border-top: 1px solid border-subtle` 分隔（`.section + .section`）

Step 2: 確認
Run: `npm run dev`
Expected: 首頁所有區塊正確顯示，響應式 1200/768px 正常

Step 3: Commit
Message: `feat: add home page with hero, articles, categories, about, and projects`

---

### Task 10: Article Dynamic Route

Files:
- Create: `src/pages/[...slug].astro`

Step 1: 建立 [...slug].astro

```typescript
import { getCollection, render } from 'astro:content';
import BaseLayout from '../layouts/BaseLayout.astro';
import TagBadge from '../components/TagBadge.astro';
import TableOfContents from '../components/TableOfContents.astro';

export async function getStaticPaths() {
  const posts = await getCollection('posts', ({ data }) => !data.draft);
  return posts.map((post) => ({
    params: { slug: post.id },
    props: { post },
  }));
}

const { post } = Astro.props;
const { Content, headings } = await render(post);
```

頁面結構（style-preview.html:892-945）：

**Article Header**（max-width wide 960px）：
- meta: TagBadge category + date (mono 13px)
- h1: serif 36px/48px bold
- info: 閱讀時間（字數 / 400 取整）

**Article Cover**（full width within container）：
- 如果有 cover image，用 `<Image>` 渲染
- 否則 dithered placeholder

**Two-column layout**（style-preview.html:741-752）：
- `.layout-with-aside`: flex, gap 48px, max-width 1200px
- `.layout-main`: flex 1, min-width 0
  - `<div class="prose"><Content /></div>`
  - Article nav（上一篇/下一篇）
  - giscus placeholder
- `.layout-aside`: width 240px, flex-shrink 0
  - 作者卡片 widget
  - 相關文章 widget（同 category 的其他文章）
  - TableOfContents（sticky）
- `@media (max-width: 1024px)`: aside hidden

Step 2: 確認
Run: `npm run dev`
Expected: 測試文章頁面可訪問，Markdown 排版正確

Step 3: Commit
Message: `feat: add article page with two-column layout`

---

### Task 11: TableOfContents Component

Files:
- Create: `src/components/TableOfContents.astro`

Step 1: 建立 TableOfContents.astro

Props：
```typescript
interface Props {
  headings: { depth: number; slug: string; text: string }[];
}
```

結構（style-preview.html:810-835）：
```html
<div class="aside-toc">
  <div class="aside-widget-title">目錄</div>
  <ul class="toc-list">
    {headings.filter(h => h.depth <= 3).map(h => (
      <li>
        <a href={`#${h.slug}`} class={h.depth === 3 ? 'toc-h3' : ''}>
          {h.text}
        </a>
      </li>
    ))}
  </ul>
</div>
```

樣式要點：
- `.aside-toc`: sticky, top = header-height + 24px
- `.toc-list`: border-left 1px border-subtle, font-sans 13px
- `a`: padding 4px 0 4px 16px, text-muted, border-left 2px transparent
- `a.active`: brand-orange, border-left brand-orange
- `.toc-h3`: padding-left 28px, 12px

Active tracking 用 `<script>` 做 IntersectionObserver：
- 觀察所有 h2/h3
- 進入 viewport 時標記對應 TOC link 為 active

Step 2: 在 [...slug].astro 的 aside 中引用 TableOfContents，傳入 headings

Step 3: 確認
Run: `npm run dev`
Expected: TOC 在 desktop 可見，sticky 行為正常，捲動時 active 狀態追蹤

Step 4: Commit
Message: `feat: add TableOfContents component with scroll tracking`

---

### Task 12: 404 Page

Files:
- Create: `src/pages/404.astro`

Step 1: 建立 404.astro

結構（style-preview.html:128-208 + 對應 HTML 區塊）：
```html
<BaseLayout title="404 — 找不到頁面">
  <div class="error-page">
    <div class="error-code">404</div>
    <p class="error-message">找不到這個頁面</p>
    <p class="error-desc">你要找的頁面可能已經移動、刪除，或者從來不存在</p>
    <div class="error-links">
      <a href="/" class="btn btn--primary">← 回首頁</a>
      <a href="/articles/" class="btn btn--outline">瀏覽文章</a>
    </div>
    <div class="error-terminal">
      <span class="prompt">$</span> <span class="cmd">curl frankchen.tw{path}</span><br>
      <span class="output">HTTP/1.1 404 Not Found</span><br>
      <span class="prompt">$</span> <span class="cursor"></span>
    </div>
  </div>
</BaseLayout>
```

樣式要點：
- error-page: 置中，padding 大
- error-code: mono 120px bold, `animation: einkGlitch 4s steps(3) infinite`
- error-code::after: 80px x 2px brand-orange 底線
- error-message: serif 22px bold
- error-desc: sans 15px text-secondary
- error-terminal: bg-tertiary, border border-default, radius-md, mono 13px
- cursor blink animation

Step 2: 確認
Run: 訪問不存在的路徑
Expected: 404 頁面正確顯示，glitch 動畫循環播放

Step 3: Commit
Message: `feat: add 404 page with E-ink glitch animation`

---

### Task 13: Responsive 驗證 + 收尾

Files:
- Modify: `src/styles/global.css`（修正任何 responsive 問題）

Step 1: 檢查所有 responsive 斷點（style-preview.html:1168-1187）

需確認的斷點：
- `<=768px`：
  - hero padding 縮小, h1 28px
  - card-grid 1 欄
  - featured card 1 欄（image top）
  - category-grid 2 欄
  - project-grid 1 欄
  - about-preview column + center
  - section padding 48px
  - container padding 16px
  - article h1 28px, cover 200px
  - article-nav column
  - nav-links hidden, hamburger visible
- `<=1024px`：
  - layout-aside hidden
  - layout-with-aside block

Step 2: 檢查 prefers-reduced-motion（style-preview.html:273-286）
確認 global.css 有完整的 reduced-motion media query，停用：
- body::after noise overlay
- einkRefresh, einkExit, einkEnter, einkGlitch
- 所有 transition-duration → 0ms

Step 3: 最終確認
Run: `npm run build`
Expected: Build 成功，無錯誤

Step 4: Commit
Message: `fix: responsive breakpoints and reduced-motion support`

---

## Task Dependencies

```
Task 1 (scaffold)
  └─ Task 2 (global CSS)
       └─ Task 3 (BaseLayout)
            ├─ Task 4 (Nav)
            ├─ Task 5 (Footer)
            └─ Task 6 (TagBadge)
                 └─ Task 7 (ArticleCard)
                      └─ Task 8 (Content Collection)
                           ├─ Task 9 (Home Page)
                           └─ Task 10 (Article Page)
                                └─ Task 11 (TOC)
            └─ Task 12 (404)
  Task 13 (Responsive 收尾) — 最後執行
```

Task 4/5/6/12 彼此獨立，可平行執行。
Task 9/10 依賴 Task 7+8，但彼此獨立。
