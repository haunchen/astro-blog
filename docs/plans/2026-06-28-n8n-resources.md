# n8n-resources 完整策展頁 Implementation Plan

Goal: 將 `/n8n-resources/` 由占位頁升級為比照原站的完整 7 區塊策展頁。

Architecture: 前兩區（教學文章、模板分享）build 時從 content collection 即時查詢；後五區（學習資源、進階應用、推薦模板、Line 社群、官方資源）為集中於 `src/data/n8n-resources.ts` 的型別化策展資料。新增 `ResourceCard.astro` 渲染創作者卡，頁面沿用 e-ink 深色系與既有 `.list-page`/`.article-grid` 版面骨架。創作者卡縮圖與社群 QR 共 9 張資產從原站下載至 `public/n8n-resources/`。

Tech Stack: Astro v5、TypeScript（strict）、astro:content getCollection、Astro 元件 scoped CSS、既有 CSS 變數 design tokens。

Spec: `docs/specs/site-pages.md`（MODIFIED R17、ADDED R18/R19、S15/S16）

Design: `docs/plans/2026-06-28-n8n-resources-design.md`（外部連結／資產 URL 完整對照表在此）

注意：repo 無 test/lint framework（CLAUDE.md），驗證一律用 `npm run build`（會型別檢查 .astro/TS 並產出路由）＋手動清單。各 task 末以 build 為閘門。

---

### Task 1: 下載策展圖片資產

Implements: `site-pages.md` #R17, #R18

Files:
- Create: `public/n8n-resources/`（9 張圖：hc-ai.webp, lazyoffice.webp, papaya.webp, darrell.webp, geekaz.webp, tpl-creditcard.webp, tpl-interviewer.webp, tpl-ai-assistant.webp, line-community-qr.jpg）

Step 1: 建目錄並下載（使用者已授權從其網站下載）

Run:
```bash
mkdir -p public/n8n-resources
base="https://www.frankchen.tw/wp-content/uploads/2025/10"
curl -fsSL -o public/n8n-resources/hc-ai.webp          "$base/n8n-learn-hc-ai-150x150.webp"
curl -fsSL -o public/n8n-resources/lazyoffice.webp     "$base/n8n-learn-lazyoffice-150x150.webp"
curl -fsSL -o public/n8n-resources/papaya.webp         "$base/n8n-learn-papaya-150x150.webp"
curl -fsSL -o public/n8n-resources/darrell.webp        "$base/n8n-learn-darrell-150x150.webp"
curl -fsSL -o public/n8n-resources/geekaz.webp         "$base/n8n-learn-geekaz-150x150.webp"
curl -fsSL -o public/n8n-resources/tpl-creditcard.webp "$base/n8n-template-cover-creditcard-150x150.webp"
curl -fsSL -o public/n8n-resources/tpl-interviewer.webp "$base/n8n-template-cover-interviewer-150x150.webp"
curl -fsSL -o public/n8n-resources/tpl-ai-assistant.webp "$base/n8n-template-cover-ai-assistant-150x150.webp"
curl -fsSL -o public/n8n-resources/line-community-qr.jpg "$base/line-group-n8n-ai-vibecoding-150x150.jpg"
```

Step 2: 驗證 9 張都下載成功且為合法圖檔

Run:
```bash
ls -la public/n8n-resources/ && file public/n8n-resources/*
```
Expected: 9 個檔案皆非 0 bytes，`file` 顯示為 `Web/P image`（webp）與 `JPEG image data`（jpg）；若任一顯示 HTML/text 或 0 bytes 代表下載失敗，需重試該 URL。

Step 3: Commit
```bash
git add public/n8n-resources/
git commit -m "feat(n8n-resources): 加入策展縮圖與社群 QR 資產"
```

---

### Task 2: 策展資料單一來源檔

Implements: `site-pages.md` #R18

Files:
- Create: `src/data/n8n-resources.ts`

Step 1: 建立資料檔（完整內容，URL/描述為原站擷取實際值）

```ts
// src/data/n8n-resources.ts
// n8n-resources 頁面後五區外部策展資料單一來源（spec site-pages #R18）
// 內容沿用原站 https://www.frankchen.tw/n8n-resources/ ，image 為 public/ 下絕對路徑

export type ResLink = { label: string; href: string };

export type Creator = {
  name: string;
  desc: string;
  image: string;
  links: ResLink[];
};

export type Community = {
  name: string;
  desc: string;
  image: string;
  joinHref: string;
};

// 區塊 3：推薦學習資源
export const LEARNING_RESOURCES: Creator[] = [
  {
    name: 'HC AI說人話',
    desc: 'n8n AI 實作 0 基礎入門到進階（3 小時影片）',
    image: '/n8n-resources/hc-ai.webp',
    links: [
      { label: 'YouTube 頻道', href: 'https://www.youtube.com/@HC-AIChannel' },
      { label: '影片', href: 'https://www.youtube.com/watch?v=vvqhzbp4J5A' },
      { label: 'Threads', href: 'https://www.threads.com/@hc_aichannel' },
    ],
  },
  {
    name: '偷懶辦公室（LazyOffice）',
    desc: '《提早下班系列》N8N + OpenAI 整合 LINE、Gmail、行事曆',
    image: '/n8n-resources/lazyoffice.webp',
    links: [
      { label: 'YouTube 頻道', href: 'https://www.youtube.com/@LazyOffice2024' },
      { label: '影片', href: 'https://www.youtube.com/watch?v=RxXMQ8CG5RI' },
      { label: 'Threads', href: 'https://www.threads.com/@lazyoffice2024' },
    ],
  },
  {
    name: 'PAPAYA 電腦教室',
    desc: 'n8n 工作流基礎教學（3 集系列）',
    image: '/n8n-resources/papaya.webp',
    links: [
      { label: 'YouTube 頻道', href: 'https://www.youtube.com/@papayaclass' },
      { label: '播放清單', href: 'https://www.youtube.com/playlist?list=PL7enJ2-v6SPk1_XBg2cOp58uV25_pamFd' },
    ],
  },
];

// 區塊 4：推薦進階應用
export const ADVANCED_APPS: Creator[] = [
  {
    name: 'Darrell',
    desc: 'n8n 教學：節點介紹、模板、部署指南',
    image: '/n8n-resources/darrell.webp',
    links: [
      { label: 'Threads', href: 'https://www.threads.com/@darrell_tw_' },
      { label: 'Website', href: 'https://www.darrelltw.com/' },
      { label: '教學資源', href: 'https://www.darrelltw.com/n8n-tutorial-resources/' },
    ],
  },
  {
    name: '科技宅阿高',
    desc: 'n8n 自動化流程教學',
    image: '/n8n-resources/geekaz.webp',
    links: [
      { label: 'Threads', href: 'https://www.threads.com/@geekaz/' },
      { label: 'Website', href: 'https://geekaz.net/' },
      { label: '文章標籤', href: 'https://geekaz.net/tag/automation-workflow/' },
    ],
  },
];

// 區塊 5：推薦模板
export const RECOMMENDED_TEMPLATES: Creator[] = [
  {
    name: 'Darrell',
    desc: '信用卡帳單自動建日曆提醒',
    image: '/n8n-resources/tpl-creditcard.webp',
    links: [
      { label: '模板', href: 'https://www.darrelltw.com/tools/n8n_template/model/creditcard.html' },
    ],
  },
  {
    name: 'Vicky（鋼鐵Ｖ）',
    desc: 'n8n 面試大師',
    image: '/n8n-resources/tpl-interviewer.webp',
    links: [
      { label: '模板', href: 'https://portaly.cc/ironvicky/product/myRHqQsuZLAz2TVrvDe4' },
      { label: 'Threads', href: 'https://www.threads.com/@ironv.careerlife' },
    ],
  },
  {
    name: 'Darks',
    desc: 'AI 知識助手',
    image: '/n8n-resources/tpl-ai-assistant.webp',
    links: [
      { label: '模板', href: 'https://portaly.cc/darks/product/XVvmqhkHO2BeiGn81IHc' },
      { label: 'Website', href: 'https://lifecheatslab.com/' },
    ],
  },
];

// 區塊 6：推薦 Line 社群
export const COMMUNITY: Community = {
  name: 'n8n & AI & Vibe Coding 討論交流群',
  desc: '社群裡充滿各路大神，歡迎有任何有關 n8n、AI、Vibe Coding 問題的大家加入群組一起討論',
  image: '/n8n-resources/line-community-qr.jpg',
  joinHref: 'https://line.me/ti/g2/bfnrSbbUE56PISKtQa9KK5gqpMhed_DXf-hmQw',
};

// 區塊 7：官方資源
export const OFFICIAL_LINKS: ResLink[] = [
  { label: '官方網站', href: 'https://n8n.io/' },
  { label: '官方文件', href: 'https://docs.n8n.io/' },
  { label: '官方模板', href: 'https://n8n.io/workflows/' },
  { label: '官方 Github', href: 'https://github.com/n8n-io/n8n' },
];
```

Step 2: 型別／語法檢查（隨 Task 4 的 build 一併驗，此處僅確認檔案存在與匯出齊全）

Run:
```bash
grep -E "export const (LEARNING_RESOURCES|ADVANCED_APPS|RECOMMENDED_TEMPLATES|COMMUNITY|OFFICIAL_LINKS)" src/data/n8n-resources.ts | wc -l
```
Expected: `5`

Step 3: Commit
```bash
git add src/data/n8n-resources.ts
git commit -m "feat(n8n-resources): 新增外部策展資料單一來源檔"
```

---

### Task 3: ResourceCard 元件

Implements: `site-pages.md` #R17, #R19

Files:
- Create: `src/components/ResourceCard.astro`

Step 1: 建立元件（縮圖＋name＋desc＋labeled links；外部連結新分頁）

```astro
---
interface ResLink {
  label: string;
  href: string;
}

interface Props {
  name: string;
  desc: string;
  image: string;
  links: ResLink[];
}

const { name, desc, image, links } = Astro.props;
---

<div class="res-card">
  <img
    src={image}
    alt={name}
    class="res-thumb"
    width="72"
    height="72"
    loading="lazy"
    decoding="async"
  />
  <div class="res-body">
    <h3 class="res-name">{name}</h3>
    <p class="res-desc">{desc}</p>
    <div class="res-links">
      {links.map((l) => (
        <a class="res-link" href={l.href} target="_blank" rel="noopener noreferrer">
          {l.label} &rarr;
        </a>
      ))}
    </div>
  </div>
</div>

<style>
  .res-card {
    display: flex;
    gap: 16px;
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-md);
    padding: 20px;
    transition: border-color 500ms steps(4);
  }

  .res-card:hover {
    animation: einkRefresh 500ms steps(4) forwards;
  }

  .res-thumb {
    width: 72px;
    height: 72px;
    flex-shrink: 0;
    object-fit: cover;
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-sm);
    background: var(--color-bg-tertiary);
  }

  .res-body {
    flex: 1;
    min-width: 0;
  }

  .res-name {
    font-family: var(--font-sans);
    font-size: 16px;
    font-weight: 600;
    margin-bottom: 4px;
  }

  .res-desc {
    font-family: var(--font-sans);
    font-size: 13px;
    line-height: 20px;
    color: var(--color-text-secondary);
    margin-bottom: 12px;
  }

  .res-links {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 16px;
  }

  .res-link {
    font-family: var(--font-sans);
    font-size: 13px;
    color: var(--color-text-primary);
    text-decoration: none;
    border-bottom: 2px solid color-mix(in srgb, var(--color-brand-orange) 40%, transparent);
    transition: border-color 300ms steps(3), background-color 300ms steps(3);
  }

  .res-link:hover {
    border-bottom-color: var(--color-brand-orange);
    background-color: color-mix(in srgb, var(--color-brand-orange) 10%, transparent);
  }
</style>
```

Step 2: 驗證隨 Task 4 build。此處確認檔案存在
Run: `test -f src/components/ResourceCard.astro && echo OK`
Expected: `OK`

Step 3: Commit
```bash
git add src/components/ResourceCard.astro
git commit -m "feat(n8n-resources): 新增 ResourceCard 創作者卡元件"
```

---

### Task 4: 改寫 n8n-resources 頁面組裝 7 區塊

Implements: `site-pages.md` #R17, #R18, #R19

Files:
- Modify（整檔覆寫）: `src/pages/n8n-resources.astro`

Step 1: 覆寫頁面（完整內容）

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
import ArticleCard from '../components/ArticleCard.astro';
import ResourceCard from '../components/ResourceCard.astro';
import { getCollection } from 'astro:content';
import { pageTitle } from '../utils/site-meta';
import {
  LEARNING_RESOURCES,
  ADVANCED_APPS,
  RECOMMENDED_TEMPLATES,
  COMMUNITY,
  OFFICIAL_LINKS,
} from '../data/n8n-resources';

const posts = await getCollection('posts', ({ data }) => !data.draft);
const byDateDesc = (a: typeof posts[number], b: typeof posts[number]) =>
  b.data.date.valueOf() - a.data.date.valueOf();

// 區塊 1：最新 6 篇 n8n 文章
const n8nPosts = posts
  .filter((p) => p.data.category === 'n8n')
  .sort(byDateDesc)
  .slice(0, 6);

// 區塊 2：帶「模板」tag 的文章
const templatePosts = posts
  .filter((p) => p.data.tags.includes('模板'))
  .sort(byDateDesc);
---

<BaseLayout
  title={pageTitle('n8n 相關資源')}
  description="n8n 教學文章、自動化模板分享，以及精選 YouTube 學習資源、進階應用、推薦模板與社群整理。"
>
  <main class="list-page">
    <header class="list-head">
      <h1 class="list-title">n8n 相關資源</h1>
      <p class="list-sub">教學文章、模板分享、學習資源、進階應用與社群整理</p>
    </header>

    <!-- 區塊 1：教學文章 -->
    {n8nPosts.length > 0 && (
      <section class="n8n-section">
        <div class="n8n-section-head">
          <h2 class="n8n-section-title">教學文章</h2>
          <a href="/category/n8n/" class="n8n-section-link">查看全部 n8n 文章 &rarr;</a>
        </div>
        <div class="article-grid">
          {n8nPosts.map((post) => (
            <ArticleCard
              title={post.data.title}
              description={post.data.description}
              date={post.data.date}
              category={post.data.category}
              slug={post.id}
              cover={post.data.cover}
            />
          ))}
        </div>
      </section>
    )}

    <!-- 區塊 2：模板分享 -->
    {templatePosts.length > 0 && (
      <section class="n8n-section">
        <div class="n8n-section-head">
          <h2 class="n8n-section-title">模板分享</h2>
          <a href={`/tag/${encodeURIComponent('模板')}/`} class="n8n-section-link">更多模板 &rarr;</a>
        </div>
        <div class="article-grid">
          {templatePosts.map((post) => (
            <ArticleCard
              title={post.data.title}
              description={post.data.description}
              date={post.data.date}
              category={post.data.category}
              slug={post.id}
              cover={post.data.cover}
            />
          ))}
        </div>
      </section>
    )}

    <!-- 區塊 3：推薦學習資源 -->
    <section class="n8n-section">
      <div class="n8n-section-head">
        <h2 class="n8n-section-title">推薦學習資源</h2>
      </div>
      <div class="res-grid">
        {LEARNING_RESOURCES.map((c) => (
          <ResourceCard name={c.name} desc={c.desc} image={c.image} links={c.links} />
        ))}
      </div>
    </section>

    <!-- 區塊 4：推薦進階應用 -->
    <section class="n8n-section">
      <div class="n8n-section-head">
        <h2 class="n8n-section-title">推薦進階應用</h2>
      </div>
      <div class="res-grid">
        {ADVANCED_APPS.map((c) => (
          <ResourceCard name={c.name} desc={c.desc} image={c.image} links={c.links} />
        ))}
      </div>
    </section>

    <!-- 區塊 5：推薦模板 -->
    <section class="n8n-section">
      <div class="n8n-section-head">
        <h2 class="n8n-section-title">推薦模板</h2>
      </div>
      <div class="res-grid">
        {RECOMMENDED_TEMPLATES.map((c) => (
          <ResourceCard name={c.name} desc={c.desc} image={c.image} links={c.links} />
        ))}
      </div>
    </section>

    <!-- 區塊 6：推薦 Line 社群 -->
    <section class="n8n-section">
      <div class="n8n-section-head">
        <h2 class="n8n-section-title">推薦 Line 社群</h2>
      </div>
      <div class="community-card">
        <img
          src={COMMUNITY.image}
          alt={COMMUNITY.name}
          class="community-qr"
          width="150"
          height="150"
          loading="lazy"
          decoding="async"
        />
        <div class="community-body">
          <h3 class="community-name">{COMMUNITY.name}</h3>
          <p class="community-desc">{COMMUNITY.desc}</p>
          <a class="community-btn" href={COMMUNITY.joinHref} target="_blank" rel="noopener noreferrer">
            加入 LINE 社群 &rarr;
          </a>
        </div>
      </div>
    </section>

    <!-- 區塊 7：官方資源 -->
    <section class="n8n-section">
      <div class="n8n-section-head">
        <h2 class="n8n-section-title">官方資源</h2>
      </div>
      <div class="official-row">
        {OFFICIAL_LINKS.map((l) => (
          <a class="official-link" href={l.href} target="_blank" rel="noopener noreferrer">
            {l.label} &rarr;
          </a>
        ))}
      </div>
    </section>
  </main>
</BaseLayout>

<style>
  .n8n-section {
    padding: 48px 0;
    border-top: 1px solid var(--color-border-subtle);
  }

  .n8n-section-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
    margin-bottom: 24px;
  }

  .n8n-section-title {
    font-family: var(--font-serif);
    font-size: 24px;
    line-height: 32px;
    font-weight: 600;
  }

  .n8n-section-link {
    font-family: var(--font-sans);
    font-size: 14px;
    color: var(--color-text-primary);
    text-decoration: none;
    white-space: nowrap;
    border-bottom: 2px solid color-mix(in srgb, var(--color-brand-orange) 40%, transparent);
    transition: border-color 300ms steps(3), background-color 300ms steps(3);
  }

  .n8n-section-link:hover {
    border-bottom-color: var(--color-brand-orange);
    background-color: color-mix(in srgb, var(--color-brand-orange) 10%, transparent);
  }

  .res-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;
  }

  /* 區塊 6：社群 CTA */
  .community-card {
    display: flex;
    gap: 24px;
    align-items: center;
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-md);
    padding: 24px;
  }

  .community-qr {
    width: 150px;
    height: 150px;
    flex-shrink: 0;
    border-radius: var(--radius-sm);
    background: #fff;
  }

  .community-name {
    font-family: var(--font-sans);
    font-size: 18px;
    font-weight: 600;
    margin-bottom: 8px;
  }

  .community-desc {
    font-family: var(--font-sans);
    font-size: 14px;
    line-height: 22px;
    color: var(--color-text-secondary);
    margin-bottom: 16px;
  }

  .community-btn {
    display: inline-block;
    font-family: var(--font-sans);
    font-size: 14px;
    font-weight: 500;
    color: var(--color-brand-orange);
    text-decoration: none;
    padding: 8px 16px;
    border: 1px solid color-mix(in srgb, var(--color-brand-orange) 40%, transparent);
    border-radius: var(--radius-sm);
    transition: border-color 300ms steps(3), background-color 300ms steps(3);
  }

  .community-btn:hover {
    border-color: var(--color-brand-orange);
    background-color: color-mix(in srgb, var(--color-brand-orange) 12%, transparent);
  }

  /* 區塊 7：官方連結排 */
  .official-row {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
  }

  .official-link {
    font-family: var(--font-sans);
    font-size: 14px;
    color: var(--color-text-primary);
    text-decoration: none;
    padding: 10px 18px;
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-md);
    transition: border-color 500ms steps(4);
  }

  .official-link:hover {
    animation: einkRefresh 500ms steps(4) forwards;
  }

  @media (max-width: 768px) {
    .res-grid {
      grid-template-columns: 1fr;
    }

    .community-card {
      flex-direction: column;
      text-align: center;
    }
  }
</style>
```

Step 2: build 驗證（型別檢查 + 路由產出）
Run: `npm run build`
Expected: build 成功無錯誤；輸出含 `/n8n-resources/index.html`。

Step 3: 確認產物頁面含 7 區塊與關鍵連結
Run:
```bash
grep -c "n8n-section-title" dist/n8n-resources/index.html
grep -o 'href="https://www.youtube.com/@HC-AIChannel"' dist/n8n-resources/index.html
grep -o 'href="/category/n8n/"' dist/n8n-resources/index.html
grep -o 'rel="noopener noreferrer"' dist/n8n-resources/index.html | head -1
```
Expected: 第一行 `7`；其餘三行各有命中（YouTube 外連、查看全部站內連、外連 rel 屬性存在）。

Step 4: 手動視覺驗收（execute reviewer／使用者，`npm run dev` 後看 `/n8n-resources/`）
- 7 區塊齊全且順序正確
- 區塊 1 顯示最新 6 篇 n8n 卡、`查看全部 n8n 文章` 連到 `/category/n8n/`
- 區塊 2 顯示 3 篇模板卡、`更多模板` 連到 `/tag/模板/`
- 區塊 3/4/5 創作者卡縮圖正常顯示、各連結正確且開新分頁
- 區塊 6 QR 圖顯示、`加入 LINE 社群` 連 LINE join URL
- 區塊 7 四個官方連結正確、開新分頁
- 手機寬度下 res-grid 變單欄、community-card 直排

Step 5: Commit
```bash
git add src/pages/n8n-resources.astro
git commit -m "feat(n8n-resources): 組裝 7 區塊完整策展頁，取代占位頁"
```

---

## 完成後

四個 task 完成且 `npm run build` 綠後，spec `site-pages.md` 的 Pending Changes（R17/R18/R19）由 dev:finish 階段 promote 進正式 Requirements。
