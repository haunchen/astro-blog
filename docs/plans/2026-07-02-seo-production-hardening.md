# SEO 生產級收尾（seo-production-hardening）Implementation Plan

Goal: 修補上線前全站檢查發現的 12 項生產級缺口（社群分享 meta、giscus 佔位、首頁 h1／死連結、skip-link、sitemap lastmod、RSS self link、llms.txt、_headers、og png 型別），一次到位並清 Issue #13。

Architecture: 全為 build-time 靜態產出的修改——BaseLayout 集中處理社群 meta 與 skip-link；sitemap lastmod 在 astro.config.mjs 以 gray-matter 直讀 frontmatter 建對照表（config 內無法用 astro:content）；其餘各檔獨立小改。無 runtime 錯誤面，失敗即 build fail。

Tech Stack: Astro v5、astro-seo、@astrojs/sitemap（serialize）、@astrojs/rss（xmlns + customData）、gray-matter、glob、satori/sharp（既有）。

Spec: `docs/specs/pre-launch-infra.md`（Pending Changes：R10、R11、MODIFIED R5/R6/R8）、`docs/specs/site-pages.md`（Pending Changes：R20、R21、R22）

Design doc: `docs/plans/2026-07-02-seo-production-hardening-design.md`

分支：`feat/seo-production-hardening`（已存在且為當前分支，直接在其上 commit）

---

## 執行者須知（先讀）

- 本 repo **無測試框架**（CLAUDE.md 明載無 test/lint 指令）。各 task 的驗證以「`npm run build` 後對 `dist/` 斷言」取代 TDD 的測試步驟。
- `npm run build` 會先跑 `node scripts/subset-fonts.mjs` 再 `astro build`，產出 104 頁＋35 張 OG 圖，一次約 1-2 分鐘，屬正常。
- 驗證指令一律用 **Bash tool**（Git Bash 語法）。`grep -c` 在 0 筆時 exit code 為 1，斷言「不存在」時用 `! grep -q ...`。
- 站台目前有 **35 篇非草稿文章**，全部無 `updated` frontmatter 欄位（sitemap lastmod 將全數取 `date`）。
- 文章頁路徑範例（供斷言用）：`dist/n8n-canva-oauth-setup/index.html`。
- `SITE.name` = `下班後的工程師筆記`（斷言 RSS autodiscovery title 用）。
- 工作目錄：`D:\UserData\Documents\Code\astro-blog`。commit 訊息用正體中文、沿用 repo 既有 conventional commit 風格（`feat(seo): ...`）。**不要**自行 `git checkout -b` 切新分支，全部 commit 到 `feat/seo-production-hardening`。

---

### Task 1: BaseLayout 社群分享 meta（og:image fallback／og:type article／Twitter Card／RSS title）

Implements: `pre-launch-infra.md` #R10

Files:
- Modify: `src/layouts/BaseLayout.astro:22-58`
- Modify: `src/pages/[...slug].astro:71-76`

Step 1: 改寫 `src/layouts/BaseLayout.astro` 的 Props 與 URL 計算

把現有這段（第 22-32 行）：

```astro
interface Props {
  title: string;
  description?: string;
  ogImage?: string;
  jsonLd?: object[];
}

const { title, description = '', ogImage, jsonLd = [] } = Astro.props;
const allJsonLd = [ORGANIZATION_JSONLD, WEBSITE_JSONLD, ...jsonLd];
const canonicalURL = new URL(Astro.url.pathname, Astro.site);
const ogImageURL = ogImage ? new URL(ogImage, Astro.site).href : undefined;
```

整段替換為：

```astro
interface Props {
  title: string;
  description?: string;
  ogImage?: string;
  /** 文章頁傳入：og:type 轉 article，輸出 article:published_time / modified_time / tag */
  article?: {
    publishedTime: Date;
    modifiedTime?: Date;
    tags?: string[];
  };
  jsonLd?: object[];
}

const { title, description = '', ogImage, article, jsonLd = [] } = Astro.props;
const allJsonLd = [ORGANIZATION_JSONLD, WEBSITE_JSONLD, ...jsonLd];
const canonicalURL = new URL(Astro.url.pathname, Astro.site);
// og:image 不可為空：頁面未指定時 fallback 站台 cover 圖
const ogImageURL = new URL(ogImage ?? '/cover.webp', Astro.site).href;
```

Step 2: 改寫 `<SEO>` 元件與 RSS autodiscovery link

把現有這段（原第 41-58 行）：

```astro
    <SEO
      title={title}
      description={description}
      canonical={canonicalURL.href}
      openGraph={{
        basic: {
          title,
          type: 'website',
          image: ogImageURL ?? '',
        },
        optional: {
          description,
          locale: 'zh_TW',
          siteName: SITE.name,
        },
      }}
    />
    <link rel="alternate" type="application/rss+xml" title={title} href="/rss.xml" />
```

整段替換為：

```astro
    <SEO
      title={title}
      description={description}
      canonical={canonicalURL.href}
      openGraph={{
        basic: {
          title,
          type: article ? 'article' : 'website',
          image: ogImageURL,
        },
        optional: {
          description,
          locale: 'zh_TW',
          siteName: SITE.name,
        },
        ...(article && {
          article: {
            publishedTime: article.publishedTime.toISOString(),
            ...(article.modifiedTime && { modifiedTime: article.modifiedTime.toISOString() }),
            ...(article.tags && article.tags.length > 0 && { tags: [...article.tags] }),
          },
        }),
      }}
      twitter={{
        card: 'summary_large_image',
        title,
        description,
        image: ogImageURL,
        imageAlt: title,
      }}
    />
    <link rel="alternate" type="application/rss+xml" title={SITE.name} href="/rss.xml" />
```

說明：`twitter.imageAlt` 一併給（astro-seo 對 twitter.image 搭配 alt 較穩，無害）；無 X 帳號，刻意不寫 `site`/`creator` handle。

Step 3: `src/pages/[...slug].astro` 傳入 `article` prop

把現有這段（第 71-76 行）：

```astro
<BaseLayout
  title={pageTitle(post.data.title)}
  description={post.data.description}
  ogImage={`/og/${post.id}.png`}
  jsonLd={[blogPosting, breadcrumb]}
>
```

替換為：

```astro
<BaseLayout
  title={pageTitle(post.data.title)}
  description={post.data.description}
  ogImage={`/og/${post.id}.png`}
  article={{
    publishedTime: post.data.date,
    modifiedTime: post.data.updated,
    tags: post.data.tags,
  }}
  jsonLd={[blogPosting, breadcrumb]}
>
```

（`post.data.updated` 為 optional，undefined 時 BaseLayout 端不會輸出 `article:modified_time`，符合設計。）

Step 4: 建置並斷言

Run: `npm run build`
Expected: build 成功（exit 0）

Run（Bash）:
```bash
grep -q 'property="og:type" content="article"' dist/n8n-canva-oauth-setup/index.html && \
grep -q 'property="article:published_time"' dist/n8n-canva-oauth-setup/index.html && \
grep -q 'property="article:tag"' dist/n8n-canva-oauth-setup/index.html && \
grep -q 'name="twitter:card" content="summary_large_image"' dist/n8n-canva-oauth-setup/index.html && \
grep -q 'property="og:image" content="https://frankchen.tw/cover.webp"' dist/articles/index.html && \
grep -q 'property="og:type" content="website"' dist/articles/index.html && \
grep -q 'type="application/rss+xml" title="下班後的工程師筆記"' dist/articles/index.html && \
echo TASK1-PASS
```
Expected: `TASK1-PASS`

Step 5: Commit

Run: `git add src/layouts/BaseLayout.astro "src/pages/[...slug].astro" && git commit -m "feat(seo): 社群分享 meta 完整化（og:image fallback／og:type article／Twitter Card／RSS title 固定站名）"`

---

### Task 2: 移除 giscus 佔位假 UI

Implements: 無 spec requirement（design doc §2 決策：生產環境不留佔位假 UI）

Files:
- Modify: `src/pages/[...slug].astro`（HTML 區塊＋CSS 兩處）

Step 1: 刪除 HTML 佔位區塊

刪除 `src/pages/[...slug].astro` 中這整段（原第 120-125 行，位於 `</nav>` 與 `</div>`／`<!-- Aside -->` 之間）：

```astro
        <!-- Giscus placeholder -->
        <section class="article-comments">
          <h2 class="article-comments-title">留言討論</h2>
          <div class="article-comments-placeholder">giscus 留言區將在此載入</div>
        </section>
```

Step 2: 刪除對應 CSS

刪除同檔 `<style>` 內這整段（原第 292-315 行）：

```css
  /* Article Comments */
  .article-comments {
    margin-top: 48px;
    padding-top: 32px;
    border-top: 1px solid var(--color-border-subtle);
  }

  .article-comments-title {
    font-family: var(--font-serif);
    font-size: 22px;
    font-weight: 600;
    margin-bottom: 16px;
  }

  .article-comments-placeholder {
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-md);
    padding: 48px;
    text-align: center;
    font-family: var(--font-sans);
    font-size: 14px;
    color: var(--color-text-muted);
  }
```

Step 3: 建置並斷言

Run: `npm run build`
Expected: build 成功

Run（Bash）:
```bash
! grep -rq 'giscus 留言區將在此載入' dist/ && ! grep -rq 'article-comments' src/pages/ && echo TASK2-PASS
```
Expected: `TASK2-PASS`

Step 4: Commit

Run: `git add "src/pages/[...slug].astro" && git commit -m "feat(article): 移除 giscus 留言佔位假 UI"`

---

### Task 3: 首頁 visually-hidden h1 與專案卡死連結

Implements: `site-pages.md` #R21, #R22

Files:
- Modify: `src/styles/global.css`（檔尾新增 section E）
- Modify: `src/pages/index.astro:7,27,41`

Step 1: `src/styles/global.css` 檔尾（`.article-grid` 的 768px media query 之後）新增：

```css
/* ========================================
   E — Accessibility
   ======================================== */

/* 視覺隱藏但保留給輔助科技與 SEO（首頁 h1 用） */
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}
```

Step 2: `src/pages/index.astro` 三處修改

2a. 第 7 行 import 補 `SITE`：

```astro
import { SITE, pageTitle } from '../utils/site-meta';
```

2b. 專案卡「醫療教學模擬器 G3」的 `link: '#'`（第 27 行）改為：

```ts
    link: '/about/',
```

2c. `<main>` 開頭（第 41 行 `<main>` 之後、`<!-- 最新文章 -->` 之前）插入 h1：

```astro
  <main>
    <h1 class="visually-hidden">{SITE.name}｜{SITE.tagline}</h1>
```

Step 3: 建置並斷言

Run: `npm run build`
Expected: build 成功

Run（Bash）:
```bash
test "$(grep -o '<h1' dist/index.html | wc -l)" = "1" && \
! grep -q 'href="#"' dist/index.html && \
grep -q 'visually-hidden' dist/index.html && \
echo TASK3-PASS
```
Expected: `TASK3-PASS`

Step 4: Commit

Run: `git add src/styles/global.css src/pages/index.astro && git commit -m "fix(seo): 首頁補 visually-hidden h1、專案卡死連結改連 /about/"`

---

### Task 4: skip-to-content 連結（清 Issue #13 第 2 項）

Implements: `site-pages.md` #R20

Files:
- Modify: `src/layouts/BaseLayout.astro:79-83`（body 內容）
- Modify: `src/styles/global.css`（section E 追加）

Step 1: `src/styles/global.css` 的 section E（Task 3 新增的 `.visually-hidden` 之後）追加：

```css
/* Skip to content：平時移出畫面，鍵盤 focus 時滑入可見 */
.skip-link {
  position: fixed;
  top: 12px;
  left: 12px;
  z-index: 10000; /* 高於 paper noise overlay（9998）與 header */
  padding: 10px 18px;
  background: var(--color-bg-secondary);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-md);
  font-family: var(--font-sans);
  font-size: 14px;
  text-decoration: none;
  transform: translateY(calc(-100% - 16px));
}

.skip-link:focus {
  transform: translateY(0);
}

/* skip-link 落點：不顯示整塊內容的 focus 外框 */
#main-content:focus {
  outline: none;
}
```

Step 2: `src/layouts/BaseLayout.astro` 的 `<body>` 內容改為 skip-link ＋ main-content 包裹

把現有這段（`transition:animate` 屬性結束的 `>` 之後、`</body>` 之前）：

```astro
    <Nav />
    <slot />
    <Footer />
```

替換為：

```astro
    <a href="#main-content" class="skip-link">跳到主內容</a>
    <Nav />
    <div id="main-content" tabindex="-1">
      <slot />
    </div>
    <Footer />
```

注意：skip-link 必須是 `<body>` 的第一個子元素（設計要求「HTML 首個可 focus 元素」）。包一層 `<div id="main-content">` 是為了免逐頁改 11 個 page 檔的 `<main>`；此 div 為普通 block 元素，不影響版面（已確認無任何 CSS 依賴 `body >` 直接子元素選擇器）。

Step 3: 建置並斷言

Run: `npm run build`
Expected: build 成功

Run（Bash）:
```bash
grep -q 'href="#main-content" class="skip-link"' dist/index.html && \
grep -q 'id="main-content"' dist/index.html && \
tr -d '\n' < dist/index.html | grep -q '<body[^>]*>\s*<a href="#main-content"' && \
echo TASK4-PASS
```
Expected: `TASK4-PASS`（第三個斷言確認 skip-link 緊接 `<body>` 開頭；若因空白字元 grep 不到，可放寬為 `<body[^>]*>.\{0,50\}#main-content` 再驗）

Step 4: Commit

Run: `git add src/layouts/BaseLayout.astro src/styles/global.css && git commit -m "feat(a11y): 全站 skip-to-content 連結（Issue #13）"`

---

### Task 5: sitemap 文章 lastmod

Implements: `pre-launch-infra.md` #R11

Files:
- Modify: `astro.config.mjs`（整檔改寫）

Step 1: `astro.config.mjs` 整檔替換為：

```js
import { readFileSync } from 'node:fs';
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';
import { globSync } from 'glob';
import matter from 'gray-matter';

// sitemap serialize callback 只拿得到 URL，先從文章 frontmatter 建 pathname → lastmod 對照。
// astro.config 內無法使用 astro:content，直接以 gray-matter 讀 frontmatter；
// id 規則與 content loader 一致（去 base、去 /index.md 或 .md 後綴）。
const POST_LASTMOD = new Map(
  globSync('src/content/posts/**/*.md').map((file) => {
    const { data } = matter(readFileSync(file, 'utf8'));
    const id = file
      .replace(/\\/g, '/')
      .replace(/^src\/content\/posts\//, '')
      .replace(/\/index\.md$/, '')
      .replace(/\.md$/, '');
    return [`/${id}/`, new Date(data.updated ?? data.date)];
  }),
);

export default defineConfig({
  site: 'https://frankchen.tw',
  integrations: [
    sitemap({
      serialize(item) {
        const lastmod = POST_LASTMOD.get(new URL(item.url).pathname);
        if (lastmod) {
          item.lastmod = lastmod.toISOString();
        }
        return item;
      },
    }),
  ],
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

說明：`glob`（v10）與 `gray-matter` 皆為既有 dependencies，不需新增安裝。`replace(/\\/g, '/')` 是 Windows 路徑分隔符防禦。草稿文章會進 Map 但不會被 build 成頁面，serialize 不會命中，無害。

Step 2: 建置並斷言

Run: `npm run build`
Expected: build 成功

Run（Bash）:
```bash
grep -q 'n8n-canva-oauth-setup/</loc><lastmod>' dist/sitemap-0.xml && \
! grep -q 'articles/</loc><lastmod>' dist/sitemap-0.xml && \
test "$(grep -o '<lastmod>' dist/sitemap-0.xml | wc -l)" = "35" && \
echo TASK5-PASS
```
Expected: `TASK5-PASS`（35 = 目前非草稿文章數，全部無 `updated` 故取 `date`）

Step 3: Commit

Run: `git add astro.config.mjs && git commit -m "feat(seo): sitemap 文章 URL 補 lastmod（updated ?? date）"`

---

### Task 6: RSS self link

Implements: `pre-launch-infra.md` #R5（MODIFIED）

Files:
- Modify: `src/pages/rss.xml.ts:48-54`

Step 1: 把 `rss()` 呼叫（第 48-54 行）：

```ts
  return rss({
    title: SITE.name,
    description: SITE.tagline,
    site: context.site ?? SITE.url,
    customData: '<language>zh-TW</language>',
    items,
  });
```

替換為：

```ts
  return rss({
    title: SITE.name,
    description: SITE.tagline,
    site: context.site ?? SITE.url,
    xmlns: { atom: 'http://www.w3.org/2005/Atom' },
    customData: `<language>zh-TW</language><atom:link href="${SITE.url}/rss.xml" rel="self" type="application/rss+xml"/>`,
    items,
  });
```

Step 2: 建置並斷言

Run: `npm run build`
Expected: build 成功

Run（Bash）:
```bash
grep -q 'xmlns:atom="http://www.w3.org/2005/Atom"' dist/rss.xml && \
grep -q '<atom:link href="https://frankchen.tw/rss.xml" rel="self" type="application/rss+xml"/>' dist/rss.xml && \
echo TASK6-PASS
```
Expected: `TASK6-PASS`

Step 3: Commit

Run: `git add src/pages/rss.xml.ts && git commit -m "fix(rss): 補 atom:link rel=self 自我參照（消 W3C validator 警告）"`

---

### Task 7: llms.txt 主要頁面清單

Implements: `pre-launch-infra.md` #R6（MODIFIED）

Files:
- Modify: `src/pages/llms.txt.ts:14-15`

Step 1: 把「主要頁面」段（第 14-15 行）：

```ts
    '## 主要頁面',
    `- [首頁](${SITE.url}/): 部落格首頁`,
```

替換為：

```ts
    '## 主要頁面',
    `- [首頁](${SITE.url}/): 部落格首頁，最新文章與主題導覽`,
    `- [文章總覽](${SITE.url}/articles/): 全部文章依年份時間軸列出`,
    `- [分類總覽](${SITE.url}/category/): 文章分類與各分類篇數`,
    `- [標籤總覽](${SITE.url}/tag/): 全站標籤雲，依標籤瀏覽文章`,
    `- [n8n 相關資源](${SITE.url}/n8n-resources/): n8n 教學文章、模板與策展學習資源`,
    `- [關於我](${SITE.url}/about/): 作者介紹、經歷與作品集`,
    `- [聯絡我](${SITE.url}/contact-frank/): 聯絡方式與社群連結`,
```

Step 2: 建置並斷言

Run: `npm run build`
Expected: build 成功

Run（Bash）:
```bash
grep -q '/articles/): 全部文章' dist/llms.txt && \
grep -q '/n8n-resources/' dist/llms.txt && \
grep -q '/contact-frank/' dist/llms.txt && \
grep -q '/tag/' dist/llms.txt && \
echo TASK7-PASS
```
Expected: `TASK7-PASS`

Step 3: Commit

Run: `git add src/pages/llms.txt.ts && git commit -m "feat(seo): llms.txt 主要頁面擴為 7 個站台頁面"`

---

### Task 8: _headers 清理

Implements: `pre-launch-infra.md` #R8（MODIFIED）

Files:
- Modify: `public/_headers`（整檔改寫）

Step 1: `public/_headers` 整檔替換為：

```
/*
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  Strict-Transport-Security: max-age=31536000; includeSubDomains; preload

/_astro/*
  Cache-Control: public, max-age=31536000, immutable

/og/*
  Cache-Control: public, max-age=604800

/n8n-resources/*
  Cache-Control: public, max-age=604800

/n8n-resources/
  ! Cache-Control

/favicon.png
  Cache-Control: public, max-age=86400

/apple-touch-icon.png
  Cache-Control: public, max-age=86400

/logo.webp
  Cache-Control: public, max-age=86400

/cover.webp
  Cache-Control: public, max-age=86400

/robots.txt
  Cache-Control: public, max-age=86400

/llms.txt
  Cache-Control: public, max-age=86400

/rss.xml
  Cache-Control: public, max-age=3600
```

變更說明（相對現況）：
- 刪 `X-XSS-Protection: 1; mode=block`（已廢棄、舊瀏覽器有 side-channel 風險）。
- 刪 `/images/*` 規則（dist 無此路徑）。
- 加 `/n8n-resources/*` 一週快取——目標是 `public/n8n-resources/` 下 9 張策展圖。CF Pages 的 splat 有可能連 `/n8n-resources/` HTML 頁本身也命中，故緊接一條 `/n8n-resources/` 用 `! Cache-Control`（CF Pages 官方 detach 語法）把 HTML 頁的 Cache-Control 移除、回到平台預設，避免內容頁被快取一週。此 detach 規則在 splat 不命中 HTML 時也無害。
- 加 `/cover.webp` 一天快取（比照其他靜態根檔案）。

Step 2: 建置並斷言

Run: `npm run build`
Expected: build 成功（_headers 為 public/ 靜態複製）

Run（Bash）:
```bash
! grep -q 'X-XSS-Protection' dist/_headers && \
! grep -q '/images/\*' dist/_headers && \
grep -q '/cover.webp' dist/_headers && \
grep -q '/n8n-resources/\*' dist/_headers && \
grep -q '! Cache-Control' dist/_headers && \
echo TASK8-PASS
```
Expected: `TASK8-PASS`

Step 3: Commit

Run: `git add public/_headers && git commit -m "fix(headers): 移除廢棄 X-XSS-Protection 與 /images/*、補 cover.webp 與 n8n-resources 快取"`

---

### Task 9: og png Response 型別修正＋astro check 基建（清 Issue #13 第 1 項）

Implements: 無 spec requirement（Issue #13 技術債：astro check 歸零）

Files:
- Modify: `src/pages/og/[...slug].png.ts:107-108`
- Modify: `package.json`（新增 devDependencies：`@astrojs/check`、`typescript`）

Step 1: 安裝 astro check 所需套件（repo 目前沒有，`npx astro check` 會因缺 `@astrojs/check` 而失敗）

Run: `npm install --save-dev @astrojs/check typescript`
Expected: 安裝成功，package.json devDependencies 出現兩個新套件

Step 2: 修正 Response 型別

把 `src/pages/og/[...slug].png.ts` 檔尾（第 107-108 行）：

```ts
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  return new Response(png, { headers: { 'Content-Type': 'image/png' } });
```

替換為：

```ts
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png' } });
```

Step 3: 跑 astro check

Run: `npx astro check`
Expected: `0 errors`（Issue #13 盤點時 astro check 僅此一項錯誤；若出現其他預期外的錯誤，回報 controller，不要擅自大改其他檔案）

Step 4: 建置確認 OG 圖輸出不受影響

Run: `npm run build`
Expected: build 成功

Run（Bash）:
```bash
test -s dist/og/n8n-canva-oauth-setup.png && echo TASK9-PASS
```
Expected: `TASK9-PASS`

Step 5: Commit

Run: `git add "src/pages/og/[...slug].png.ts" package.json package-lock.json && git commit -m "fix(types): og png Response 改 Uint8Array、補 @astrojs/check 基建（Issue #13）"`

---

### Task 10: 全站驗證 sweep（design doc 驗證策略 10 項）

Implements: 驗證 `pre-launch-infra.md` #R5, #R6, #R8, #R10, #R11；`site-pages.md` #R20, #R21, #R22

Files: 無（純驗證，僅在發現問題時修）

Step 1: 完整建置

Run: `npm run build`
Expected: build 成功

Step 2: 一次跑完全部斷言

Run（Bash）:
```bash
set -e
# 1. 文章頁：og:type=article、published_time、twitter:card
grep -q 'property="og:type" content="article"' dist/n8n-canva-oauth-setup/index.html
grep -q 'property="article:published_time"' dist/n8n-canva-oauth-setup/index.html
grep -q 'name="twitter:card" content="summary_large_image"' dist/n8n-canva-oauth-setup/index.html
# 2. 未傳 ogImage 的頁 fallback cover、og:type=website
grep -q 'property="og:image" content="https://frankchen.tw/cover.webp"' dist/articles/index.html
grep -q 'property="og:image" content="https://frankchen.tw/cover.webp"' dist/category/index.html
grep -q 'property="og:type" content="website"' dist/articles/index.html
# 3. 首頁：有且僅有一個 h1、無 href="#"
test "$(grep -o '<h1' dist/index.html | wc -l)" = "1"
! grep -q 'href="#"' dist/index.html
# 4. 全站無 giscus 佔位
! grep -rq 'giscus 留言區將在此載入' dist/
# 5. sitemap：文章含 lastmod、列表頁不含、共 35 筆
grep -q 'n8n-canva-oauth-setup/</loc><lastmod>' dist/sitemap-0.xml
! grep -q 'articles/</loc><lastmod>' dist/sitemap-0.xml
test "$(grep -o '<lastmod>' dist/sitemap-0.xml | wc -l)" = "35"
# 6. RSS self link
grep -q 'xmlns:atom="http://www.w3.org/2005/Atom"' dist/rss.xml
grep -q '<atom:link href="https://frankchen.tw/rss.xml" rel="self" type="application/rss+xml"/>' dist/rss.xml
# 7. RSS autodiscovery title 固定站名（抽首頁＋文章頁＋列表頁）
grep -q 'type="application/rss+xml" title="下班後的工程師筆記"' dist/index.html
grep -q 'type="application/rss+xml" title="下班後的工程師筆記"' dist/n8n-canva-oauth-setup/index.html
grep -q 'type="application/rss+xml" title="下班後的工程師筆記"' dist/articles/index.html
# 8. _headers
! grep -q 'X-XSS-Protection' dist/_headers
! grep -q '/images/\*' dist/_headers
grep -q '/cover.webp' dist/_headers
grep -q '/n8n-resources/\*' dist/_headers
# 9. skip-link
grep -q 'href="#main-content" class="skip-link"' dist/index.html
grep -q 'id="main-content"' dist/index.html
grep -q 'href="#main-content" class="skip-link"' dist/n8n-canva-oauth-setup/index.html
# 10. llms.txt
grep -q '/articles/' dist/llms.txt
grep -q '/n8n-resources/' dist/llms.txt
echo ALL-PASS
```
Expected: `ALL-PASS`

Step 3: astro check 最終確認

Run: `npx astro check`
Expected: `0 errors`

Step 4: 若全部通過且工作區乾淨，不需 commit。若有修正，逐項小 commit 後重跑 Step 1-3。

---

## 上線後人工驗證（不在本 plan 自動化範圍）

- Facebook Sharing Debugger 抽驗一篇文章＋一個列表頁（沿用 pre-launch-infra S4）。
- 鍵盤實測：任一頁按 Tab，第一個 focus 為「跳到主內容」，Enter 後焦點落到主內容區。
- `curl -I` 抽驗 `/n8n-resources/` HTML 頁：確認 Cache-Control 未被 splat 規則設成一週（detach 規則生效）。
