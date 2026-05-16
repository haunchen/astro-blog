---
date: 2026-05-16
topic: pre-launch-infra
status: design
---

# 上線前 Infra 設計文件

## 目標

部署 frankchen.tw 上線前完成 6 件基礎建設 + CF Pages 部署，bundled 為一個 PR：

1. JSON-LD 四件套（Organization / WebSite / BlogPosting / BreadcrumbList）
2. RSS feed（@astrojs/rss，最新 20 篇全文 HTML）
3. 動態 OG 圖（satori + sharp + subset Noto Sans TC）
4. Zod schema 字數限制（title.max(60), description.max(160)）
5. `_headers` 安全標頭 + 快取策略
6. `robots.txt`（訓練爬蟲擋 / 搜尋查詢允許）+ `llms.txt`（build 時產出）
7. CF Pages GitHub integration 部署，使用 `*.pages.dev` 預設網域（frankchen.tw cutover 留到 sync 35 篇後）

## 設計決策摘要

| # | 決策 | 取捨 |
|---|------|------|
| D1 | All-in-one PR、最後一次部署 | 上線即完整、無「半成品已上線」SEO 雜訊 |
| D2 | OG 圖走 satori + sharp + subset Noto Sans TC | 中文標題正確顯示、subset 後字型 50-200KB |
| D3 | RSS 全文 HTML（sanitize + 絕對 URL） | 讀者黏著度優先於 PV |
| D4 | robots.txt 擋訓練爬蟲、允許搜尋查詢爬蟲 | 跟 honestmc.com.tw 一致，承接 [[robots-txt-爬蟲設定調研]] 結論 |
| D5 | robots.txt 加 `Llms-txt:` header | 跟 cablate 連點，非標準擴充、零效果但無害 |
| D6 | 不加 CSP header | AdSense / CF Analytics / 第三方 embed 整合會踩坑，需要時再針對性加 |
| D7 | spec domain 命名 `pre-launch-infra` | 範圍明確，未來這類「上線前一次性 infra」可累積到同 spec |
| D8 | 部署用 `*.pages.dev`，不切自訂網域 | frankchen.tw cutover 等 sync script 跑完 35 篇後 |

## 檔案配置

```
src/
  components/
    JsonLd.astro                # 序列化 + 防 </script> 注入
  layouts/
    BaseLayout.astro            # 改：always 掛 Organization + WebSite
  pages/
    [...slug].astro             # 改：掛 BlogPosting + BreadcrumbList
    rss.xml.ts                  # 新
    llms.txt.ts                 # 新
    og/
      [...slug].png.ts          # 新
  utils/
    site-meta.ts                # 新：站名 / URL / logo / sameAs single source
  content.config.ts             # 改：title.max(60) / description.max(160)
  assets/
    og-fonts/                   # subset 後字型輸出位置（gitignored）
public/
  _headers                      # 新
  robots.txt                    # 新
  logo.png                      # 新：256x256 placeholder
scripts/
  subset-fonts.mjs              # 新：build 前掃 collection 標題、subset
package.json                    # 改：build 改成 subset-fonts && astro build
```

## 元件設計

### JsonLd.astro

```astro
---
interface Props {
  data: object | object[];
}
const { data } = Astro.props;
const items = Array.isArray(data) ? data : [data];
const escape = (obj: object) =>
  JSON.stringify(obj).replace(/</g, '\\u003c');
---
{items.map((item) => (
  <script type="application/ld+json" set:html={escape(item)} />
))}
```

只負責序列化 + 防 `</script>` 注入，不知道 schema 內容。

### site-meta.ts

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

### BaseLayout 改動

```astro
---
import JsonLd from '../components/JsonLd.astro';
import { ORGANIZATION_JSONLD, WEBSITE_JSONLD } from '../utils/site-meta';

interface Props {
  title: string;
  description?: string;
  ogImage?: string;
  jsonLd?: object[];  // 文章頁傳入 BlogPosting + BreadcrumbList
}
const { title, description = '', ogImage, jsonLd = [] } = Astro.props;
const allJsonLd = [ORGANIZATION_JSONLD, WEBSITE_JSONLD, ...jsonLd];
---
<head>
  ...
  <link rel="alternate" type="application/rss+xml" href="/rss.xml" />
  <JsonLd data={allJsonLd} />
</head>
```

### 文章頁 [...slug].astro 改動

```ts
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
  articleSection: CATEGORY_LABEL[post.data.category],
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

傳入 BaseLayout：`<BaseLayout ... jsonLd={[blogPosting, breadcrumb]}>`

注意：BreadcrumbList 列了 `/articles/` 中介，該頁目前還沒實作，但是 schema.org BreadcrumbList 接受 leaf 不一定要可點，先列著、頁面實作時自動連通。

### OG 圖（[...slug].png.ts）

```ts
import { getCollection } from 'astro:content';
import satori from 'satori';
import sharp from 'sharp';
import fs from 'node:fs/promises';

export async function getStaticPaths() {
  const posts = await getCollection('posts', ({ data }) => !data.draft);
  return posts.map((p) => ({ params: { slug: p.id }, props: { post: p } }));
}

const notoSansTC = await fs.readFile('src/assets/og-fonts/noto-sans-tc-subset.woff');
const inter = await fs.readFile('src/assets/og-fonts/inter-bold.woff');

export async function GET({ props }) {
  const { post } = props;
  const svg = await satori(
    {
      type: 'div',
      props: {
        style: { /* E-ink 暗色背景、橘色 badge、白字大標、底部站名 */ },
        children: [/* category badge / title / footer */],
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
}
```

### subset-fonts.mjs

```js
import { glob } from 'glob';
import matter from 'gray-matter';
import subsetFont from 'subset-font';
import fs from 'node:fs/promises';
import path from 'node:path';

const SITE_NAME = '下班後的工程師筆記';
const CATEGORY_LABELS = 'n8nFlutter樹莓派工具DevOps';

const files = await glob('src/content/posts/**/*.md');
const chars = new Set([...SITE_NAME, ...CATEGORY_LABELS, ...'frankchen.tw']);

for (const f of files) {
  const { data } = matter(await fs.readFile(f, 'utf-8'));
  if (data.draft) continue;
  for (const c of data.title ?? '') chars.add(c);
}

const text = [...chars].join('');
const src = await fs.readFile('node_modules/@fontsource-variable/noto-sans-tc/files/noto-sans-tc-chinese-traditional-700-normal.woff2');
const subset = await subsetFont(src, text, { targetFormat: 'woff' });
await fs.mkdir('src/assets/og-fonts', { recursive: true });
await fs.writeFile('src/assets/og-fonts/noto-sans-tc-subset.woff', subset);

// Inter 不 subset、直接 copy
const inter = await fs.readFile('node_modules/@fontsource/inter/files/inter-latin-700-normal.woff');
await fs.writeFile('src/assets/og-fonts/inter-bold.woff', inter);
```

### RSS（rss.xml.ts）

```ts
import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import MarkdownIt from 'markdown-it';
import sanitizeHtml from 'sanitize-html';
import { SITE } from '../utils/site-meta';

const md = new MarkdownIt({ html: true });

export async function GET(context) {
  const posts = (await getCollection('posts', ({ data }) => !data.draft))
    .sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf())
    .slice(0, 20);

  return rss({
    title: SITE.name,
    description: SITE.tagline,
    site: context.site,
    customData: '<language>zh-TW</language>',
    items: posts.map((p) => {
      let html = md.render(p.body ?? '');
      html = html.replace(/src="(?!https?:)([^"]+)"/g, `src="${SITE.url}$1"`);
      const safe = sanitizeHtml(html, {
        allowedTags: ['img','a','h2','h3','h4','p','ul','ol','li','code','pre','blockquote','strong','em','br','hr'],
        allowedAttributes: { a: ['href'], img: ['src','alt'] },
      });
      return {
        title: p.data.title,
        pubDate: p.data.date,
        description: p.data.description,
        link: `/${p.id}/`,
        categories: [p.data.category, ...p.data.tags],
        content: safe,
      };
    }),
  });
}
```

### llms.txt（llms.txt.ts）

```ts
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { SITE } from '../utils/site-meta';

export const GET: APIRoute = async () => {
  const posts = (await getCollection('posts', ({ data }) => !data.draft))
    .sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());

  const body = [
    `# ${SITE.name}`,
    '',
    `> ${SITE.tagline} 一個專注於 n8n 自動化、Flutter、樹莓派、DevOps 的踩坑筆記平台。`,
    '',
    '## 主要頁面',
    `- [首頁](${SITE.url}/): 部落格首頁`,
    '',
    '## 文章',
    ...posts.map((p) => `- [${p.data.title}](${SITE.url}/${p.id}/): ${p.data.description}`),
  ].join('\n');

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
```

## robots.txt

放 `public/robots.txt`，內容參照段 4 已定版（25 條主流爬蟲 + Llms-txt header）。

## _headers

放 `public/_headers`，內容參照段 5 已定版。

## CF Pages 部署

Dashboard 設定，文件記錄於 `docs/deployment.md`（後續一次性建立）：

- Repo: `haunchen/astro-blog`，Production branch: `main`
- Framework preset: Astro
- Build command: `npm run build`
- Build output directory: `dist`
- Env var: `NODE_VERSION=20`
- 自訂網域：**先不設**，用 `*.pages.dev`

## 新增依賴

```
"@astrojs/rss": "^4",
"satori": "^0.10",
"sharp": "^0.33",
"markdown-it": "^14",
"sanitize-html": "^2",
"subset-font": "^2",
"gray-matter": "^4",
"glob": "^10"
```

dev deps（型別）：

```
"@types/markdown-it": "*",
"@types/sanitize-html": "*"
```

## 驗證 checklist

- [ ] 本地 `npm run build` 成功
- [ ] `dist/` 出現 `rss.xml` / `llms.txt` / `sitemap-index.xml` / `robots.txt` / `_headers` / `og/test-markdown-rendering.png`
- [ ] `dist/test-markdown-rendering/index.html` 含 4 種 JSON-LD `<script>`
- [ ] curl `*.pages.dev/` response header 含 `X-Frame-Options: DENY`
- [ ] Google Rich Results Test 驗 JSON-LD pass
- [ ] Facebook Sharing Debugger OG 圖預覽正確

## 不在本次範圍

- frankchen.tw 自訂網域切換（留到 35 篇文章 sync 完）
- sync-from-vault.mjs（另一個 brainstorm session）
- IndexNow postbuild（MVP 上線後再加）
- FAQPage / HowTo JSON-LD（等真有 FAQ 文章再加）
- Pagefind 全文搜尋（35 篇用不到）
- AdSense Manual Ad Units（另一個 task）
