# Pre-launch Infrastructure Implementation Plan

Goal: Implement the 6-piece pre-launch infrastructure (JSON-LD 4-set, dynamic OG images, RSS feed, llms.txt, robots.txt, security headers + Zod schema limits) and prepare CF Pages deployment via GitHub integration.

Architecture: All work on `feat/pre-launch-infra` branch. New utility module `site-meta.ts` is the single source of truth for site identity (used by JSON-LD, RSS, llms.txt, OG). One new Astro component `JsonLd.astro` for safe serialization. Three new build-time endpoints (`rss.xml.ts`, `llms.txt.ts`, `og/[...slug].png.ts`). One pre-build node script `scripts/subset-fonts.mjs` invoked by `npm run build`. Two static files in `public/` (`robots.txt`, `_headers`). Content schema gets `.max()` constraints. No test framework configured in repo — verification is `npm run build` success + `grep`/`curl` on output files.

Tech Stack: Astro 5, TypeScript, satori, sharp, @astrojs/rss, markdown-it, sanitize-html, subset-font, gray-matter, glob.

Spec: `docs/specs/pre-launch-infra.md`

Design: `docs/plans/2026-05-16-pre-launch-infra-design.md`

Branch: `feat/pre-launch-infra` (already checked out)

---

## Pre-flight (already done by /dev:brainstorm)

- [x] `git checkout -b feat/pre-launch-infra`
- [x] Commit design + spec

## Tasks

### Task 1: 安裝執行期與建置期依賴

Implements: setup for #R2–#R9

Files:
- Modify: `package.json`

Step 1: 安裝執行期依賴
Run: `npm install @astrojs/rss@^4 satori@^0.10 sharp@^0.33 markdown-it@^14 sanitize-html@^2 subset-font@^2 gray-matter@^4 glob@^10`
Expected: 8 packages added; no errors.

Step 2: 安裝型別 dev deps
Run: `npm install -D @types/markdown-it @types/sanitize-html`
Expected: 2 packages added.

Step 3: Commit
Run:
```bash
git add package.json package-lock.json
git commit -m "build: add deps for OG / RSS / sanitize / font subset"
```

---

### Task 2: 建立 `src/utils/site-meta.ts`

Implements: #R2, #R3 (shared site identity)

Files:
- Create: `src/utils/site-meta.ts`

Step 1: 建檔
Write `src/utils/site-meta.ts`:
```ts
export const SITE = {
  name: '下班後的工程師筆記',
  tagline: '白天上班，下班寫 Side Project。',
  url: 'https://frankchen.tw',
  logo: 'https://frankchen.tw/logo.png',
  email: 'frank@frankchen.tw',
  sameAs: [
    'https://www.threads.com/@frankchen.tw',
    'https://www.instagram.com/frankchen.tw/',
    'https://github.com/haunchen',
    'https://www.linkedin.com/in/frankchen0130/',
  ],
} as const;

export const CATEGORY_LABEL: Record<string, string> = {
  'n8n': 'n8n',
  'flutter': 'Flutter',
  'devops': 'DevOps',
  'raspberry-pi': 'Raspberry Pi',
  'tools': '工具',
};

export const ORGANIZATION_JSONLD = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  '@id': `${SITE.url}/#org`,
  name: SITE.name,
  url: SITE.url,
  logo: SITE.logo,
  email: SITE.email,
  sameAs: SITE.sameAs,
};

export const WEBSITE_JSONLD = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': `${SITE.url}/#website`,
  name: SITE.name,
  url: SITE.url,
  inLanguage: 'zh-TW',
  publisher: { '@id': `${SITE.url}/#org` },
};
```

Step 2: 驗證 TypeScript 沒語法錯
Run: `npx tsc --noEmit`
Expected: 0 errors。若有錯先修，不繼續。

Step 3: Commit
```bash
git add src/utils/site-meta.ts
git commit -m "feat: add site-meta utility (org/website JSON-LD + category labels)"
```

---

### Task 3: 建立 `src/components/JsonLd.astro`

Implements: #R2, #R3 (JSON-LD serialization safety)

Files:
- Create: `src/components/JsonLd.astro`

Step 1: 建檔
Write `src/components/JsonLd.astro`:
```astro
---
interface Props {
  data: object | object[];
}
const { data } = Astro.props;
const items = Array.isArray(data) ? data : [data];
const escape = (obj: object) => JSON.stringify(obj).replace(/</g, '\\u003c');
---
{items.map((item) => (
  <script type="application/ld+json" set:html={escape(item)} is:inline />
))}
```

Step 2: Commit
```bash
git add src/components/JsonLd.astro
git commit -m "feat: add JsonLd component (escape </script> for safe injection)"
```

---

### Task 4: BaseLayout 注入 Organization + WebSite JSON-LD

Implements: #R2

Files:
- Modify: `src/layouts/BaseLayout.astro`

Step 1: 在 frontmatter 區（`---` 內）import 與 props 擴充。

打開 `src/layouts/BaseLayout.astro`，找到既有 frontmatter 區頂部 `import { SEO } from 'astro-seo';` 那段，在其後新增：
```ts
import JsonLd from '../components/JsonLd.astro';
import { ORGANIZATION_JSONLD, WEBSITE_JSONLD } from '../utils/site-meta';
```

找到 `interface Props { ... }`，改為：
```ts
interface Props {
  title: string;
  description?: string;
  ogImage?: string;
  jsonLd?: object[];
}
```

找到 `const { title, description = '', ogImage } = Astro.props;`，改為：
```ts
const { title, description = '', ogImage, jsonLd = [] } = Astro.props;
const allJsonLd = [ORGANIZATION_JSONLD, WEBSITE_JSONLD, ...jsonLd];
```

Step 2: 在 `<head>` 內 `<ClientRouter />` 之前插入：
```astro
    <link rel="alternate" type="application/rss+xml" title={title} href="/rss.xml" />
    <JsonLd data={allJsonLd} />
```

Step 3: 跑 build 驗證
Run: `npm run build` （此時 subset-fonts 還沒做、`build` script 還沒改，能跑通；先用此驗 BaseLayout 改動）
Expected: build 成功；`dist/index.html` 與 `dist/test-markdown-rendering/index.html` 都含 `application/ld+json`。
Verify:
```bash
grep -l 'application/ld+json' dist/index.html dist/test-markdown-rendering/index.html
grep -c '"@type":"Organization"' dist/index.html
grep -c '"@type":"WebSite"' dist/index.html
```
Expected: 兩個 grep 都印出檔名；`@type":"Organization"` 在 index.html 出現 1 次。

Step 4: Commit
```bash
git add src/layouts/BaseLayout.astro
git commit -m "feat: inject Organization + WebSite JSON-LD via BaseLayout"
```

---

### Task 5: 文章頁注入 BlogPosting + BreadcrumbList JSON-LD

Implements: #R3

Files:
- Modify: `src/pages/[...slug].astro`

Step 1: 在 frontmatter 區 imports 區段加入：
```ts
import { SITE, CATEGORY_LABEL } from '../utils/site-meta';
```

Step 2: 刪除既有的 `categoryNames` map 與 `categoryLabel` 派生，改用統一的 `CATEGORY_LABEL`：

找到並刪除：
```ts
// Category display name mapping
const categoryNames: Record<string, string> = {
  'n8n': 'n8n',
  'flutter': 'Flutter',
  'devops': 'DevOps',
  'raspberry-pi': 'Raspberry Pi',
  'tools': '工具',
};
const categoryLabel = categoryNames[post.data.category] ?? post.data.category;
```

替換為：
```ts
const categoryLabel = CATEGORY_LABEL[post.data.category] ?? post.data.category;
```

Step 3: 在 frontmatter 區結尾（`---` 之前）新增 JSON-LD 物件構造：
```ts
const canonicalURL = new URL(`/${post.id}/`, SITE.url).href;

const blogPosting = {
  '@context': 'https://schema.org',
  '@type': 'BlogPosting',
  headline: post.data.title,
  description: post.data.description,
  datePublished: post.data.date.toISOString(),
  dateModified: (post.data.updated ?? post.data.date).toISOString(),
  image: `${SITE.url}/og/${post.id}.png`,
  author: { '@id': `${SITE.url}/#org` },
  publisher: { '@id': `${SITE.url}/#org` },
  mainEntityOfPage: canonicalURL,
  articleSection: categoryLabel,
  inLanguage: 'zh-TW',
};

const breadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: '首頁', item: SITE.url },
    { '@type': 'ListItem', position: 2, name: '文章', item: `${SITE.url}/articles/` },
    { '@type': 'ListItem', position: 3, name: post.data.title },
  ],
};
```

Step 4: 找到 page template 內 `<BaseLayout ...>` 的開頭 tag，在現有 props 後加 `jsonLd={[blogPosting, breadcrumb]}`。範例：
```astro
<BaseLayout
  title={post.data.title}
  description={post.data.description}
  ogImage={`/og/${post.id}.png`}
  jsonLd={[blogPosting, breadcrumb]}
>
```
（如現有 ogImage 取值方式不同，依現況保留，只新增 `jsonLd` 一 prop）

Step 5: 跑 build 驗證
Run: `npm run build`
Verify:
```bash
grep -o '"@type":"[A-Za-z]*"' dist/test-markdown-rendering/index.html | sort -u
```
Expected: 至少四種：`"@type":"BlogPosting"`、`"@type":"BreadcrumbList"`、`"@type":"Organization"`、`"@type":"WebSite"`（順序不拘）。

Step 6: Commit
```bash
git add src/pages/\[...slug\].astro
git commit -m "feat: inject BlogPosting + BreadcrumbList JSON-LD on article pages"
```

---

### Task 6: 建立 logo placeholder

Implements: #R2 (Organization.logo 來源)

Files:
- Create: `public/logo.png`

Step 1: 產 256x256 placeholder PNG
Run（在 repo 根）:
```bash
node -e "
const sharp = require('sharp');
const svg = \`<svg width='256' height='256' xmlns='http://www.w3.org/2000/svg'>
  <rect width='256' height='256' fill='#0f172a'/>
  <text x='128' y='128' font-family='sans-serif' font-size='80' font-weight='700'
        fill='#fb923c' text-anchor='middle' dominant-baseline='central'>下班</text>
</svg>\`;
sharp(Buffer.from(svg)).png().toFile('public/logo.png').then(()=>console.log('ok'));
"
```
Expected: 印 `ok`，`public/logo.png` 出現。

Step 2: 驗證檔案
Run: `file public/logo.png && wc -c < public/logo.png`
Expected: 顯示 PNG 格式、size 為非零小檔（< 10KB）。

Step 3: Commit
```bash
git add public/logo.png
git commit -m "feat: add 256x256 logo.png placeholder for JSON-LD Organization"
```

---

### Task 7: 修改 `src/content.config.ts` 加字數限制

Implements: #R1

Files:
- Modify: `src/content.config.ts`

Step 1: 把 schema 中 `title` 與 `description` 改成有 max 限制。打開 `src/content.config.ts`，把：
```ts
title: z.string(),
date: z.date(),
updated: z.date().optional(),
description: z.string(),
```
改為：
```ts
title: z.string().min(1).max(60, '標題不可超過 60 字（SEO 限制）'),
date: z.date(),
updated: z.date().optional(),
description: z.string().max(160, '描述不可超過 160 字（SEO 限制）'),
```

Step 2: 跑 build 驗證現有 test 文章不會被擋
Run: `npm run build`
Expected: build 成功。若失敗（test 文章 title 或 description 超出限制），到 `src/content/posts/test-markdown-rendering/index.md` 縮短 frontmatter 對應欄位後重跑。**此步驟必須通過才能繼續。**

Step 3: Commit
```bash
git add src/content.config.ts
git commit -m "feat: add SEO length limits to title (max 60) and description (max 160)"
```

---

### Task 8: 建立 `scripts/subset-fonts.mjs`

Implements: #R4 (字型 subset 為 OG 圖前置)

Files:
- Create: `scripts/subset-fonts.mjs`
- Modify: `.gitignore`

Step 1: 建 `scripts/subset-fonts.mjs`：
```js
import { glob } from 'glob';
import matter from 'gray-matter';
import subsetFont from 'subset-font';
import fs from 'node:fs/promises';
import path from 'node:path';

const SITE_NAME = '下班後的工程師筆記';
const TAGLINE = '白天上班，下班寫 Side Project。';
const CATEGORY_LABELS = 'n8nFlutterDevOpsRaspberry Pi工具';
const STATIC_TEXT = `${SITE_NAME}${TAGLINE}${CATEGORY_LABELS}frankchen.tw`;

const files = await glob('src/content/posts/**/*.md');
const chars = new Set(STATIC_TEXT);

for (const f of files) {
  const raw = await fs.readFile(f, 'utf-8');
  const { data } = matter(raw);
  if (data.draft) continue;
  for (const c of data.title ?? '') chars.add(c);
  for (const c of data.description ?? '') chars.add(c);
}

const text = [...chars].join('');
console.log(`[subset-fonts] unique chars: ${chars.size}`);

const cjkSrcCandidates = [
  'node_modules/@fontsource-variable/noto-sans-tc/files/noto-sans-tc-chinese-traditional-wght-normal.woff2',
  'node_modules/@fontsource-variable/noto-sans-tc/files/noto-sans-tc-latin-wght-normal.woff2',
];
let cjkSrc;
for (const candidate of cjkSrcCandidates) {
  try {
    cjkSrc = await fs.readFile(candidate);
    console.log(`[subset-fonts] using ${candidate}`);
    break;
  } catch {}
}
if (!cjkSrc) {
  throw new Error('Noto Sans TC source font not found. Check @fontsource-variable/noto-sans-tc install.');
}

const cjkSubset = await subsetFont(cjkSrc, text, { targetFormat: 'woff' });
await fs.mkdir('src/assets/og-fonts', { recursive: true });
await fs.writeFile('src/assets/og-fonts/noto-sans-tc-subset.woff', cjkSubset);
console.log(`[subset-fonts] noto-sans-tc-subset.woff: ${cjkSubset.length} bytes`);

const interCandidates = [
  'node_modules/@fontsource/inter/files/inter-latin-700-normal.woff',
  'node_modules/@fontsource/inter/files/inter-latin-700-normal.woff2',
];
let interSrc, interExt;
for (const candidate of interCandidates) {
  try {
    interSrc = await fs.readFile(candidate);
    interExt = candidate.endsWith('.woff2') ? '.woff2' : '.woff';
    console.log(`[subset-fonts] using ${candidate}`);
    break;
  } catch {}
}
if (!interSrc) throw new Error('Inter 700 source not found.');

// satori 需要 woff（不接 woff2）。若 only woff2 可用，subset 為 woff
if (interExt === '.woff2') {
  const interSubset = await subsetFont(interSrc, text, { targetFormat: 'woff' });
  await fs.writeFile('src/assets/og-fonts/inter-bold.woff', interSubset);
} else {
  await fs.writeFile('src/assets/og-fonts/inter-bold.woff', interSrc);
}
console.log('[subset-fonts] inter-bold.woff written');
```

Step 2: 加 `src/assets/og-fonts/` 到 `.gitignore`：

開 `.gitignore`，在尾端新增：
```
# build-time subset fonts (regenerated each build)
src/assets/og-fonts/
```

Step 3: 跑 script 驗證
Run: `node scripts/subset-fonts.mjs`
Expected: console 印 unique chars 數、檔名、bytes；`src/assets/og-fonts/noto-sans-tc-subset.woff` 與 `inter-bold.woff` 出現。

Step 4: Commit
```bash
git add scripts/subset-fonts.mjs .gitignore
git commit -m "build: add subset-fonts script (CJK subset only used chars)"
```

---

### Task 9: 修改 `package.json` 的 build script

Implements: #R4 (build 前 subset)

Files:
- Modify: `package.json`

Step 1: 把 `scripts` 改為：
```json
"scripts": {
  "dev": "astro dev",
  "build": "node scripts/subset-fonts.mjs && astro build",
  "preview": "astro preview",
  "astro": "astro",
  "subset-fonts": "node scripts/subset-fonts.mjs"
}
```

Step 2: 驗證 build 鏈
Run: `rm -rf src/assets/og-fonts dist && npm run build`
Expected: 先看到 `[subset-fonts]` log，然後 Astro build 開始。build 成功。

Step 3: Commit
```bash
git add package.json
git commit -m "build: chain subset-fonts before astro build"
```

---

### Task 10: 建立 OG 圖端點 `src/pages/og/[...slug].png.ts`

Implements: #R4

Files:
- Create: `src/pages/og/[...slug].png.ts`

Step 1: 建檔
Write `src/pages/og/[...slug].png.ts`:
```ts
import type { APIRoute, GetStaticPaths } from 'astro';
import { getCollection } from 'astro:content';
import satori from 'satori';
import sharp from 'sharp';
import fs from 'node:fs/promises';
import { CATEGORY_LABEL, SITE } from '../../utils/site-meta';

const notoSansTC = await fs.readFile('src/assets/og-fonts/noto-sans-tc-subset.woff');
const inter = await fs.readFile('src/assets/og-fonts/inter-bold.woff');

export const getStaticPaths: GetStaticPaths = async () => {
  const posts = await getCollection('posts', ({ data }) => !data.draft);
  return posts.map((post) => ({ params: { slug: post.id }, props: { post } }));
};

export const GET: APIRoute = async ({ props }) => {
  const { post } = props as { post: any };
  const title = post.data.title as string;
  const category = CATEGORY_LABEL[post.data.category] ?? post.data.category;

  const svg = await satori(
    {
      type: 'div',
      props: {
        style: {
          width: '1200px',
          height: '630px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '72px',
          backgroundColor: '#0f172a',
          color: '#E2E8F0',
          fontFamily: 'Noto Sans TC, Inter, sans-serif',
        },
        children: [
          {
            type: 'div',
            props: {
              style: {
                display: 'inline-flex',
                alignSelf: 'flex-start',
                padding: '8px 20px',
                backgroundColor: '#fb923c',
                color: '#0f172a',
                borderRadius: '999px',
                fontSize: '28px',
                fontWeight: 700,
              },
              children: category,
            },
          },
          {
            type: 'div',
            props: {
              style: {
                fontSize: '64px',
                fontWeight: 700,
                lineHeight: 1.3,
                color: '#F8FAFC',
                display: 'flex',
              },
              children: title,
            },
          },
          {
            type: 'div',
            props: {
              style: {
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                borderTop: '2px solid #334155',
                paddingTop: '24px',
              },
              children: [
                {
                  type: 'div',
                  props: {
                    style: { fontSize: '28px', color: '#F8FAFC', fontWeight: 700 },
                    children: SITE.name,
                  },
                },
                {
                  type: 'div',
                  props: {
                    style: { fontSize: '22px', color: '#94A3B8' },
                    children: 'frankchen.tw',
                  },
                },
              ],
            },
          },
        ],
      },
    },
    {
      width: 1200,
      height: 630,
      fonts: [
        { name: 'Noto Sans TC', data: notoSansTC, weight: 700, style: 'normal' },
        { name: 'Inter', data: inter, weight: 700, style: 'normal' },
      ],
    }
  );

  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  return new Response(png, { headers: { 'Content-Type': 'image/png' } });
};
```

Step 2: 跑 build 驗證
Run: `npm run build`
Verify:
```bash
ls dist/og/ && file dist/og/test-markdown-rendering.png
```
Expected: 至少一個 PNG 檔；`file` 印 `PNG image data, 1200 x 630`。

Step 3: 開圖看視覺
Run: `open dist/og/test-markdown-rendering.png`（macOS）
Expected: 看到暗色底、橘色 badge、白字大標、底部站名。中文不缺字。
若中文出現空白方框 → 回到 Task 8 確認 subset 涵蓋 title 全部字元。

Step 4: Commit
```bash
git add src/pages/og/\[...slug\].png.ts
git commit -m "feat: dynamic OG image endpoint (satori + sharp + subset font)"
```

---

### Task 11: 建立 RSS feed `src/pages/rss.xml.ts`

Implements: #R5

Files:
- Create: `src/pages/rss.xml.ts`

Step 1: 建檔
Write `src/pages/rss.xml.ts`:
```ts
import type { APIContext } from 'astro';
import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import MarkdownIt from 'markdown-it';
import sanitizeHtml from 'sanitize-html';
import { SITE } from '../utils/site-meta';

const md = new MarkdownIt({ html: true, linkify: true });

export async function GET(context: APIContext) {
  const posts = (await getCollection('posts', ({ data }) => !data.draft))
    .sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf())
    .slice(0, 20);

  return rss({
    title: SITE.name,
    description: SITE.tagline,
    site: context.site ?? SITE.url,
    customData: '<language>zh-TW</language>',
    items: posts.map((p) => {
      let html = md.render(p.body ?? '');
      // 相對路徑改絕對
      html = html.replace(/(src|href)="(?!https?:|\/\/|mailto:|#)([^"]+)"/g, (_m, attr, p2) => {
        const abs = p2.startsWith('/') ? `${SITE.url}${p2}` : `${SITE.url}/${p.id}/${p2}`;
        return `${attr}="${abs}"`;
      });
      const safe = sanitizeHtml(html, {
        allowedTags: ['img','a','h2','h3','h4','h5','p','ul','ol','li','code','pre','blockquote','strong','em','br','hr','table','thead','tbody','tr','th','td'],
        allowedAttributes: {
          a: ['href', 'title'],
          img: ['src', 'alt', 'title'],
          code: ['class'],
          pre: ['class'],
        },
      });
      return {
        title: p.data.title,
        pubDate: p.data.date,
        description: p.data.description,
        link: `/${p.id}/`,
        categories: [p.data.category, ...(p.data.tags ?? [])],
        content: safe,
      };
    }),
  });
}
```

Step 2: 跑 build 驗證
Run: `npm run build`
Verify:
```bash
ls dist/rss.xml && head -20 dist/rss.xml
```
Expected: 檔案存在；XML 開頭 `<?xml version="1.0"`、含 `<language>zh-TW</language>`、含 test 文章 `<title>`。

Step 3: Commit
```bash
git add src/pages/rss.xml.ts
git commit -m "feat: RSS feed with full HTML content (sanitize + absolute URLs, top 20)"
```

---

### Task 12: 建立 llms.txt 端點 `src/pages/llms.txt.ts`

Implements: #R6

Files:
- Create: `src/pages/llms.txt.ts`

Step 1: 建檔
Write `src/pages/llms.txt.ts`:
```ts
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { SITE } from '../utils/site-meta';

export const GET: APIRoute = async () => {
  const posts = (await getCollection('posts', ({ data }) => !data.draft))
    .sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());

  const lines = [
    `# ${SITE.name}`,
    '',
    `> ${SITE.tagline} 一個專注於 n8n 自動化、Flutter、樹莓派、DevOps、工具的踩坑筆記平台。`,
    '',
    '## 主要頁面',
    `- [首頁](${SITE.url}/): 部落格首頁`,
    '',
    '## 文章',
    ...posts.map((p) => `- [${p.data.title}](${SITE.url}/${p.id}/): ${p.data.description}`),
    '',
  ];

  return new Response(lines.join('\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
```

Step 2: 跑 build 驗證
Run: `npm run build && cat dist/llms.txt`
Expected: 看到 `# 下班後的工程師筆記`、`## 主要頁面`、`## 文章`、test 文章一條 bullet。

Step 3: Commit
```bash
git add src/pages/llms.txt.ts
git commit -m "feat: llms.txt endpoint (build-time generated from collection)"
```

---

### Task 13: 建立 `public/robots.txt`

Implements: #R7

Files:
- Create: `public/robots.txt`

Step 1: 建檔
Write `public/robots.txt`:
```
# — 傳統搜尋引擎 + 社群 —
User-agent: Googlebot
Allow: /

User-agent: Bingbot
Allow: /

User-agent: Twitterbot
Allow: /

User-agent: facebookexternalhit
Allow: /

# — AI 搜尋與即時查詢（允許） —
User-agent: OAI-SearchBot
Allow: /

User-agent: ChatGPT-User
Allow: /

User-agent: Claude-SearchBot
Allow: /

User-agent: Claude-User
Allow: /

User-agent: Google-Agent
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Perplexity-User
Allow: /

User-agent: Amzn-SearchBot
Allow: /

User-agent: MistralAI-User
Allow: /

User-agent: YouBot
Allow: /

User-agent: DuckAssistBot
Allow: /

User-agent: Bravebot
Allow: /

# — AI 訓練（禁止） —
User-agent: GPTBot
Disallow: /

User-agent: ClaudeBot
Disallow: /

User-agent: Google-Extended
Disallow: /

User-agent: Bytespider
Disallow: /

User-agent: CCBot
Disallow: /

User-agent: meta-externalagent
Disallow: /

User-agent: Applebot-Extended
Disallow: /

User-agent: cohere-training-data-crawler
Disallow: /

User-agent: DeepSeekBot
Disallow: /

User-agent: *
Allow: /

Sitemap: https://frankchen.tw/sitemap-index.xml
Llms-txt: https://frankchen.tw/llms.txt
```

Step 2: 跑 build 驗證
Run: `npm run build && diff public/robots.txt dist/robots.txt`
Expected: 0 diff（Astro 把 public 直接複製到 dist）。

Step 3: Commit
```bash
git add public/robots.txt
git commit -m "feat: robots.txt (allow search/query bots, block training bots)"
```

---

### Task 14: 建立 `public/_headers`

Implements: #R8

Files:
- Create: `public/_headers`

Step 1: 建檔
Write `public/_headers`:
```
/*
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  X-XSS-Protection: 1; mode=block

/_astro/*
  Cache-Control: public, max-age=31536000, immutable

/images/*
  Cache-Control: public, max-age=604800

/og/*
  Cache-Control: public, max-age=604800

/favicon.svg
  Cache-Control: public, max-age=86400

/logo.png
  Cache-Control: public, max-age=86400

/robots.txt
  Cache-Control: public, max-age=86400

/llms.txt
  Cache-Control: public, max-age=86400

/rss.xml
  Cache-Control: public, max-age=3600
```

Step 2: 跑 build 驗證
Run: `npm run build && diff public/_headers dist/_headers`
Expected: 0 diff。

Step 3: Commit
```bash
git add public/_headers
git commit -m "feat: _headers (security headers + cache policy)"
```

---

### Task 15: 端到端驗證

Implements: 整合驗證 #R1–#R8

Files: 無

Step 1: 全新 clean build
Run:
```bash
rm -rf dist src/assets/og-fonts && npm run build
```
Expected: build 成功、無錯誤、無 warning（除了 Astro 預設一些 info）。

Step 2: 驗證所有產出檔案
Run:
```bash
echo "=== robots.txt ===" && head -5 dist/robots.txt
echo "=== llms.txt ===" && head -10 dist/llms.txt
echo "=== _headers ===" && head -10 dist/_headers
echo "=== rss.xml ===" && head -10 dist/rss.xml
echo "=== sitemap ===" && ls dist/sitemap*
echo "=== OG png ===" && ls dist/og/
echo "=== logo ===" && file dist/logo.png
```
Expected: 每個檔案都有預期內容。

Step 3: 驗證 JSON-LD 四件套都在文章頁
Run:
```bash
for t in Organization WebSite BlogPosting BreadcrumbList; do
  count=$(grep -c "\"@type\":\"$t\"" dist/test-markdown-rendering/index.html)
  echo "$t: $count"
done
```
Expected: 4 個各 1 次（共 4）。

Step 4: 驗證首頁只有 Organization + WebSite
Run:
```bash
grep -c '"@type":' dist/index.html
```
Expected: `2`。

Step 5: 驗證 RSS feed
Run:
```bash
grep -c '<item>' dist/rss.xml
```
Expected: `1`（test 文章一篇；之後 sync 進來會增加）。

Step 6: Commit verification log（無實際檔案變更）
若所有驗證都通過，無 commit 必要，直接進下一 task。若中途有檔修，分別 commit。

---

### Task 16: 補上 CF Pages 部署說明（人類設定）

Implements: #R9 (文件化)

Files:
- Create: `docs/deployment.md`

Step 1: 建檔
Write `docs/deployment.md`:
```markdown
# Cloudflare Pages 部署設定

> 一次性手動設定，無自動化。本次先使用 `*.pages.dev` 預設網域，不切自訂網域。

## Dashboard 設定步驟

1. CF Dashboard → Workers & Pages → Create → Pages → Connect to Git
2. 選 repository：`haunchen/astro-blog`
3. Production branch：`main`
4. Build configuration：
   - Framework preset：**Astro**
   - Build command：`npm run build`
   - Build output directory：`dist`
   - Root directory：`/`
5. Environment variables：
   - `NODE_VERSION` = `20`
6. Save and Deploy

## 自訂網域

frankchen.tw 自訂網域**先不切**。理由：
- 現有 frankchen.tw 在 WordPress / Zeabur 服務 31 篇舊文章
- 直接切過去等於老文章瞬間 404
- 等 `scripts/sync-from-vault.mjs` 跑完 35 篇 WordPress 文章 + 寫好 `public/_redirects` 後再 cutover

## 部署後驗證

Production 部署完成（CF Pages 提供 `*.pages.dev` URL）後，跑以下驗證：

```bash
PAGES_URL="https://YOUR-PROJECT.pages.dev"

# 安全標頭
curl -sI "$PAGES_URL/" | grep -iE 'x-frame|x-content|referrer|permissions'

# robots.txt / llms.txt / rss.xml 都 200
for path in /robots.txt /llms.txt /rss.xml /sitemap-index.xml; do
  echo "=== $path ==="
  curl -sI "$PAGES_URL$path" | head -1
done

# OG 圖
curl -sI "$PAGES_URL/og/test-markdown-rendering.png" | head -1
```

JSON-LD 驗證：
- 開 https://search.google.com/test/rich-results
- 輸入 `$PAGES_URL/test-markdown-rendering/`
- 應辨識出 BlogPosting + BreadcrumbList

OG 圖預覽驗證：
- 開 https://developers.facebook.com/tools/debug/
- 輸入文章 URL，看 OG 預覽是否正確

## 後續

frankchen.tw cutover 屬另一個 milestone，需要：
1. `sync-from-vault.mjs` 把 35 篇 WordPress 文章搬進 Astro
2. `public/_redirects` 含舊 slug 對新 slug 的 301
3. WordPress 端關閉或設好 301
4. CF Pages 加入自訂網域、DNS 切換
```

Step 2: Commit
```bash
git add docs/deployment.md
git commit -m "docs: add CF Pages deployment runbook"
```

---

### Task 17: 推 branch 並開 PR（人工驗收）

Implements: PR 收尾

Files: 無

Step 1: 推 branch
Run: `git push -u origin feat/pre-launch-infra`
Expected: branch 推上 GitHub。

Step 2: 開 PR
Run（內容用 HEREDOC）：
```bash
gh pr create --title "feat: pre-launch infrastructure (JSON-LD, RSS, OG, robots, headers)" --body "$(cat <<'EOF'
## Summary

- JSON-LD 4-piece set: Organization + WebSite (every page), BlogPosting + BreadcrumbList (article pages)
- Dynamic OG images via satori + sharp with subset Noto Sans TC
- RSS feed (`/rss.xml`) with sanitized full HTML, top 20 posts
- llms.txt endpoint (`/llms.txt`) build-time from collection
- robots.txt: allow search/query bots, block training bots, plus Llms-txt header
- Security headers via `_headers` (X-Frame-Options, Referrer-Policy, Permissions-Policy, etc.)
- Zod schema length limits: title.max(60), description.max(160)
- CF Pages deployment runbook (`docs/deployment.md`)

Spec: `docs/specs/pre-launch-infra.md`
Design: `docs/plans/2026-05-16-pre-launch-infra-design.md`

## Test plan

- [ ] `npm run build` succeeds
- [ ] `dist/` contains: `rss.xml`, `llms.txt`, `sitemap-index.xml`, `robots.txt`, `_headers`, `og/test-markdown-rendering.png`, `logo.png`
- [ ] `grep -c '"@type":' dist/test-markdown-rendering/index.html` returns 4
- [ ] `grep -c '"@type":' dist/index.html` returns 2
- [ ] OG image opens, shows 1200x630 with dark bg / orange badge / Chinese title / site name
- [ ] After CF Pages deploy: Google Rich Results Test passes BlogPosting + BreadcrumbList
- [ ] After CF Pages deploy: Facebook Sharing Debugger shows correct OG preview
- [ ] After CF Pages deploy: `curl -I` returns security headers
EOF
)"
```
Expected: PR 建立，回傳 URL。

---

## 不在本次範圍

- frankchen.tw 自訂網域切換（留到 35 篇 sync 完）
- `scripts/sync-from-vault.mjs`（另一個 brainstorm）
- IndexNow postbuild（MVP 上線後再加）
- FAQPage / HowTo JSON-LD（等真的有 FAQ 文章再加）
- Pagefind / Giscus / AdSense（待評估）

## 風險與注意事項

1. **satori 字型 fallback**：若 Task 8 subset 漏字、Task 10 OG 圖中文會出現空白方框。Step 3 視覺驗證務必執行。
2. **content.config.ts 改限制後 build fail**：Task 7 Step 2 必須通過才能繼續。若 test 文章描述超 160 字，要先縮減 frontmatter。
3. **`@fontsource-variable/noto-sans-tc` 內部檔名變動**：Task 8 用兩個候選路徑 try-catch；若都失敗會明確報錯。
4. **CF Pages Node 20**：env var 必須設 `NODE_VERSION=20`，否則 sharp 安裝可能失敗（Task 16 已記錄）。
5. **`sharp` 在 CF Pages build env**：sharp 有預編譯 binary，CF Pages Linux build 環境應該自動裝到 linux-x64。若遇到問題改用 `@resvg/resvg-js`（純 wasm）替代 sharp 是 Plan B。
