# Site Pages Implementation Plan

Goal: 補齊 astro-blog 缺少的 `/about/`、`/articles/`、`/category/[category]/`、`/privacy-policy/` 四個頁面，移植 personal 作品集內容與 `cover.webp` 主視覺，並把分類顯示收斂成單一來源。

Architecture: 新增 4 個 Astro 頁面 + 1 個共用 `CategoryBar` 元件，全部用既有 `BaseLayout` 與 design tokens。分類顯示名稱集中到 `site-meta.ts` 的新 `CATEGORIES` 清單（供導覽/列表/分類頁），文章數由 content collection 即時計算。`cover.webp` 放 `public/` 當 about hero 與 OG；作品集截圖走 astro:assets。

Tech Stack: Astro v5、astro:content `getCollection`、astro:assets `<Image>`、astro-seo（經 BaseLayout）、純 CSS（global.css tokens）。

Spec: `docs/specs/site-pages.md`

設計來源：`docs/plans/2026-06-26-site-pages-design.md`
內容逐字來源：`/Users/haunchenchen/Projects/haunchen/personal/index.html`

## 既有事實（implementer 必讀）

- design tokens 在 `src/styles/global.css` `@theme`：色票全部帶 `--color-` 前綴（如 `--color-bg-secondary` `#212a37`、`--color-brand-orange` `#fb923c`、`--color-text-secondary` `#94A3B8`、`--color-border-default` `#4f5b62`）；`--radius-sm/md/full`；`--font-serif/sans/mono`；`--width-content 720 / --width-wide 960 / --width-max 1200`。引用變數務必含 `--color-` 前綴（曾因短名缺前綴造成 fallback，見 Issue #6）。
- `BaseLayout`（`src/layouts/BaseLayout.astro`）props：`title`、`description?`、`ogImage?`（字串路徑，內部以 `Astro.site` 轉絕對 URL）、`jsonLd?: object[]`。已含 Nav + Footer + Organization/WebSite JSON-LD。
- `ArticleCard`（`src/components/ArticleCard.astro`）props：`title, description, date(Date), category(string), slug, cover?(ImageMetadata), featured?`。連到 `/${slug}/`。目前 badge 直接渲染 `category` 原始 slug。
- `TagBadge`（`src/components/TagBadge.astro`）props：`text`、`href?`（有則渲染 `<a>`）、`size?: 'default'|'sm'`。
- `JsonLd`（`src/components/JsonLd.astro`）：`data: object | object[]`，逐項輸出 `<script type="application/ld+json">`。BaseLayout 已透過 `jsonLd` prop 串接。
- `site-meta.ts`：`SITE`（`name '下班後的工程師筆記'`、`url 'https://frankchen.tw'`、`email 'frank@frankchen.tw'`、`sameAs[]`）、`CATEGORY_LABEL`（`{n8n:'n8n', flutter:'Flutter', devops:'DevOps', 'raspberry-pi':'Raspberry Pi', tools:'工具'}`）、`ORGANIZATION_JSONLD`、`WEBSITE_JSONLD`。
- `CATEGORY_LABEL` 被 `src/pages/[...slug].astro`（文章頁 badge + breadcrumb articleSection）與 `src/pages/og/[...slug].png.ts`（OG 圖分類 badge，用預建 subset 字型 `src/assets/og-fonts/noto-sans-tc-subset.woff`）使用。**不要改 `CATEGORY_LABEL` 的值**：OG 用 build 前 subset 的字型（只含文章標題用字），改成「架站部署」等新字可能 subset 缺字變 tofu，且會重生所有 OG 圖。新導覽/列表一律用本計畫新增的 `CATEGORIES`。
- enum 分類（`src/content.config.ts`）：`n8n, flutter, devops, raspberry-pi, tools`。非草稿文章每類皆 ≥1 篇（n8n 16、devops 8、tools 5、flutter 4、raspberry-pi 3 量級；以 build 即時計算為準），故 5 個分類頁都會產出。
- 草稿：`src/content/posts/test-markdown-rendering/`（`draft: true`），列表一律 `!data.draft` 過濾。
- `src/pages/[...slug].astro:81` 文章 badge 已連 `/category/${category}/`（目前死連結，本計畫補齊後生效）。
- 專案無 test/lint，唯一驗證閘門是 `npm run build`（須成功、無 zod/型別錯誤）。

---

### Task 1: 分類顯示單一來源（CATEGORIES + categoryLabel + 卡片套用）

Implements: `site-pages.md` #R6

Files:
- Modify: `src/utils/site-meta.ts`（在 `CATEGORY_LABEL` 之後新增，`CATEGORIES` 與 `CATEGORY_LABEL` 並存、非替換）
- Modify: `src/components/ArticleCard.astro`（加 import、改分類 badge）

Step 1: 在 `src/utils/site-meta.ts` 的 `CATEGORY_LABEL` 區塊之後插入：

```ts
// 導覽/列表/分類頁用的口語顯示名稱與顯示順序（單一來源）。
// 注意：CATEGORY_LABEL（上方）保留給 OG 圖與文章頁 badge，使用預建 subset 字型，
// 兩者刻意分開，勿合併，避免 OG subset 缺字。
export const CATEGORIES = [
  { slug: 'n8n', label: 'n8n 自動化' },
  { slug: 'devops', label: '架站部署' },
  { slug: 'flutter', label: 'Flutter' },
  { slug: 'tools', label: '工具' },
  { slug: 'raspberry-pi', label: '樹莓派' },
] as const;

const CATEGORY_DISPLAY: Record<string, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.slug, c.label]),
);

export function categoryLabel(slug: string): string {
  return CATEGORY_DISPLAY[slug] ?? slug;
}
```

Step 2: 在 `src/components/ArticleCard.astro` frontmatter 頂部（`import TagBadge` 那行之後）加入：

```astro
import { categoryLabel } from '../utils/site-meta';
```

Step 3: 找到 `src/components/ArticleCard.astro` 中分類 badge 那行（`<TagBadge text={category} size="sm" />`），改為顯示名稱：

```astro
<TagBadge text={categoryLabel(category)} size="sm" />
```

Step 4: 驗證
Run: `npm run build`
Expected: build 成功；首頁文章卡分類 badge 由 `devops` 變為「架站部署」等。

Step 5: Commit
Run: `git add -A && git commit -m "feat(site-meta): 加 CATEGORIES 分類顯示單一來源，卡片套用口語標籤"`

---

### Task 2: 複製圖片資產（cover + 作品集截圖）

Implements: `site-pages.md` #R1, #R2

Files:
- Create: `public/cover.webp`
- Create: `src/assets/about/frank-avatar.png`
- Create: `src/assets/about/n8n-app-screenshot.png`
- Create: `src/assets/about/blog-screenshot.png`
- Create: `src/assets/about/iset2021-screenshot.png`
- Create: `src/assets/about/iset2020-screenshot.png`

Step 1: 複製檔案

```bash
SRC=/Users/haunchenchen/Projects/haunchen/personal/images
mkdir -p src/assets/about
cp "$SRC/cover.webp" public/cover.webp
cp "$SRC/frank-avatar.png" src/assets/about/frank-avatar.png
cp "$SRC/n8n-app-screenshot.png" src/assets/about/n8n-app-screenshot.png
cp "$SRC/blog-screenshot.png" src/assets/about/blog-screenshot.png
cp "$SRC/iset2021-screenshot.png" src/assets/about/iset2021-screenshot.png
cp "$SRC/iset2020-screenshot.png" src/assets/about/iset2020-screenshot.png
```

Step 2: 驗證
Run: `ls -la public/cover.webp src/assets/about/`
Expected: 6 個檔案皆存在、非 0 byte。

Step 3: Commit
Run: `git add -A && git commit -m "chore: 從 personal 複製 cover 與作品集截圖資產"`

---

### Task 3: global.css 加列表頁共用樣式

Implements: `site-pages.md` #R3, #R4

Files:
- Modify: `src/styles/global.css`（檔案末尾追加）

Step 1: 在 `src/styles/global.css` 末尾追加：

```css

/* ========================================
   D — List Pages (articles / category)
   ======================================== */
.list-page {
  max-width: var(--width-wide);
  margin: 0 auto;
  padding: 64px 24px;
}

.list-head {
  margin-bottom: 32px;
}

.list-title {
  font-family: var(--font-serif);
  font-size: 36px;
  line-height: 48px;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.list-sub {
  font-family: var(--font-mono);
  font-size: 13px;
  color: var(--color-text-muted);
  margin-top: 8px;
  letter-spacing: 0.02em;
}

.article-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
}

@media (max-width: 768px) {
  .list-page {
    padding: 40px 16px;
  }

  .list-title {
    font-size: 28px;
    line-height: 38px;
  }

  .article-grid {
    grid-template-columns: 1fr;
  }
}
```

Step 2: 驗證
Run: `npm run build`
Expected: build 成功。

Step 3: Commit
Run: `git add -A && git commit -m "feat(css): 加列表頁共用樣式 list-page / article-grid"`

---

### Task 4: CategoryBar 共用元件

Implements: `site-pages.md` #R5

Files:
- Create: `src/components/CategoryBar.astro`

Step 1: 建立 `src/components/CategoryBar.astro`：

```astro
---
import { CATEGORIES } from '../utils/site-meta';

interface Props {
  active: string; // 'all' 或某分類 slug
}

const { active } = Astro.props;
---

<nav class="category-bar" aria-label="文章分類">
  <a
    href="/articles/"
    class:list={['category-bar-item', { 'category-bar-item--active': active === 'all' }]}
  >全部</a>
  {CATEGORIES.map(({ slug, label }) => (
    <a
      href={`/category/${slug}/`}
      class:list={['category-bar-item', { 'category-bar-item--active': active === slug }]}
    >{label}</a>
  ))}
</nav>

<style>
  .category-bar {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 40px;
  }

  .category-bar-item {
    font-family: var(--font-sans);
    font-size: 14px;
    color: var(--color-text-secondary);
    text-decoration: none;
    padding: 6px 14px;
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-full);
    transition: color 300ms steps(3), border-color 300ms steps(3), background-color 300ms steps(3);
  }

  .category-bar-item:hover {
    color: var(--color-text-primary);
    border-color: var(--color-border-strong);
  }

  .category-bar-item--active {
    color: var(--color-bg-primary);
    background: var(--color-brand-orange);
    border-color: var(--color-brand-orange);
    font-weight: 600;
  }
</style>
```

Step 2: 驗證
Run: `npm run build`
Expected: build 成功（元件未被引用，僅驗證語法）。

Step 3: Commit
Run: `git add -A && git commit -m "feat(components): 加 CategoryBar 分類導覽列"`

---

### Task 5: /articles/ 文章總覽頁

Implements: `site-pages.md` #R3, #R5

Files:
- Create: `src/pages/articles.astro`

Step 1: 建立 `src/pages/articles.astro`：

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
import ArticleCard from '../components/ArticleCard.astro';
import CategoryBar from '../components/CategoryBar.astro';
import { getCollection } from 'astro:content';

const posts = (await getCollection('posts', ({ data }) => !data.draft))
  .sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
---

<BaseLayout
  title="文章 - 下班後的工程師筆記"
  description="所有技術文章，涵蓋 n8n 自動化、架站部署、Flutter、樹莓派與開發工具的實戰經驗與踩坑紀錄。"
>
  <main class="list-page">
    <header class="list-head">
      <h1 class="list-title">文章</h1>
      <p class="list-sub">共 {posts.length} 篇</p>
    </header>

    <CategoryBar active="all" />

    <div class="article-grid">
      {posts.map((post) => (
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
  </main>
</BaseLayout>
```

Step 2: 驗證
Run: `npm run build`
Expected: build 成功，`dist/articles/index.html` 產出且含全部非草稿文章卡。

Step 3: Commit
Run: `git add -A && git commit -m "feat(pages): 加 /articles/ 文章總覽頁"`

---

### Task 6: /category/[category]/ 分類頁

Implements: `site-pages.md` #R4, #R5

Files:
- Create: `src/pages/category/[category].astro`

Step 1: 建立 `src/pages/category/[category].astro`：

```astro
---
import BaseLayout from '../../layouts/BaseLayout.astro';
import ArticleCard from '../../components/ArticleCard.astro';
import CategoryBar from '../../components/CategoryBar.astro';
import { getCollection } from 'astro:content';
import { CATEGORIES, categoryLabel } from '../../utils/site-meta';

export async function getStaticPaths() {
  const posts = await getCollection('posts', ({ data }) => !data.draft);
  return CATEGORIES
    .map(({ slug }) => {
      const categoryPosts = posts
        .filter((p) => p.data.category === slug)
        .sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
      return { params: { category: slug }, props: { categoryPosts, slug } };
    })
    .filter((entry) => entry.props.categoryPosts.length > 0);
}

const { categoryPosts, slug } = Astro.props;
const label = categoryLabel(slug);
---

<BaseLayout
  title={`${label} - 下班後的工程師筆記`}
  description={`所有「${label}」分類的技術文章。`}
>
  <main class="list-page">
    <header class="list-head">
      <h1 class="list-title">{label}</h1>
      <p class="list-sub">共 {categoryPosts.length} 篇</p>
    </header>

    <CategoryBar active={slug} />

    <div class="article-grid">
      {categoryPosts.map((post) => (
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
  </main>
</BaseLayout>
```

Step 2: 驗證
Run: `npm run build`
Expected: build 成功，`dist/category/{n8n,devops,flutter,tools,raspberry-pi}/index.html` 皆產出，篇數正確。

Step 3: Commit
Run: `git add -A && git commit -m "feat(pages): 加 /category/[category]/ 分類頁"`

---

### Task 7: 首頁分類卡動態化 + cover OG + Nav 收尾

Implements: `site-pages.md` #R7, #R9, #R2

Files:
- Modify: `src/pages/index.astro:1-19,46`
- Modify: `src/components/Nav.astro:4-8`

Step 1: 在 `src/pages/index.astro` frontmatter 的 import 區塊加入：

```astro
import { CATEGORIES } from '../utils/site-meta';
```

Step 2: 把 `src/pages/index.astro:13-19` 寫死的 `categories` 陣列替換為即時計算（用已存在的 `posts` collection）：

```astro
const categories = CATEGORIES
  .map(({ slug, label }) => ({
    name: label,
    count: posts.filter((p) => p.data.category === slug).length,
    href: `/category/${slug}/`,
  }))
  .filter((c) => c.count > 0);
```

Step 3: 把 `src/pages/index.astro:46` 的 `<BaseLayout ...>` 加上 `ogImage`：

```astro
<BaseLayout title="法蘭克的技術筆記" description="從只會寫程式，到跨領域學習電路、製程、架站。在這裡分享實戰經驗、踩坑紀錄與自動化模板。" ogImage="/cover.webp">
```

Step 4: 在 `src/components/Nav.astro:4-8` 移除指向未實作頁面的 `/n8n-resources/`，`navLinks` 改為：

```astro
const navLinks = [
  { href: '/articles/', label: '文章' },
  { href: '/about/', label: '關於我' },
];
```

Step 5: 驗證
Run: `npm run build`
Expected: build 成功；首頁分類卡連 `/category/{slug}/`（不再有 `/category/deployment/`）、數字為即時篇數；首頁 `<head>` 的 `og:image` 指向 `/cover.webp`；Nav 不再有 n8n 資源連結。

Step 6: Commit
Run: `git add -A && git commit -m "feat(home): 分類卡改即時計算、加 cover OG、Nav 移除死連結"`

---

### Task 8: /about/ 關於我頁

Implements: `site-pages.md` #R1, #R2

Files:
- Create: `src/pages/about.astro`

內容逐字以 `personal/index.html` 為準（bullet/公司/日期/標籤），email 一律 `frank@frankchen.tw`。

Step 1: 建立 `src/pages/about.astro`：

```astro
---
import { Image } from 'astro:assets';
import BaseLayout from '../layouts/BaseLayout.astro';
import TagBadge from '../components/TagBadge.astro';
import { SITE } from '../utils/site-meta';
import avatar from '../assets/about/frank-avatar.png';
import n8nShot from '../assets/about/n8n-app-screenshot.png';
import blogShot from '../assets/about/blog-screenshot.png';
import iset2021 from '../assets/about/iset2021-screenshot.png';
import iset2020 from '../assets/about/iset2020-screenshot.png';

const experiences = [
  {
    role: '系統整合課長',
    company: '澳門商原妙醫學科技有限公司 台灣分公司',
    period: '2024.09 - 2025.04',
    points: [
      '帶領 5 人跨領域團隊（硬體/軟體/機構）開發第三代醫療教學模擬器，協調跨部門資源並掌控專案進度，BOM Cost 相較第二代降低 30%，同時維持產品效能',
      '主導邊緣 AI 運算（Hailo）技術導入，解決影像處理不穩定問題，系統穩定度提升 50%，大幅改善用戶體驗',
      '優化硬體架構，以樹莓派 5 取代外購模組，在維持相同效能下單一成本減少 80%，顯著提升產品競爭力',
    ],
  },
  {
    role: '軟韌體工程師',
    company: '澳門商原妙醫學科技有限公司 台灣分公司',
    period: '2021.11 - 2024.08',
    points: [
      '主導廠商重複性插管用醫療器材韌體測試與驗證，即時回饋問題並提出解決方案，韌體穩定度提升 30%',
      '負責第二代醫療教學模擬器前期系統架構規劃，優化設計流程並降低材料成本，成本相較第一代降低 20%',
      '獨立設計一次性插管用醫療器材電路，通過 SGS ESD/EMI 認證，使產品順利取得中國、美國、泰國及澳洲醫療器材上市許可',
      '建立 GitHub 版本控管系統，解決多人協作衝突問題，團隊開發效率提升，專案交付準時率達 95%',
      '規劃並建置 NAS 檔案管理系統，統一公司數位資產管理，降低資料遺失風險並提升跨部門協作效率',
    ],
  },
];

const projects = [
  {
    title: '大型醫療教學模擬器（第三代）',
    period: '2024.11 - 2025.04',
    roles: ['專案領導人', '系統規劃', '軟體開發'],
    points: [
      '領導 5 人跨領域團隊進行第三代系統開發及改良',
      '導入邊緣 AI 運算（Hailo），影像處理穩定度提升 50%',
      '導入樹莓派 5，取代前代外購成品功能，保持相同效能下單一成本減少 80%',
      '統整前代缺點引導團隊改良，優化使用者體驗，解決操作延遲痛點',
    ],
    tags: ['跨團隊溝通及整合', 'Qt', 'Raspberry Pi', 'Hailo'],
  },
  {
    title: '大型醫療教學模擬器（第二代）',
    period: '2022.01 - 2024.06',
    roles: ['專案領導人', '系統規劃', '軟體開發', '電路設計', '產品推廣'],
    points: [
      '從零開始設計並開發軟體及硬體系統',
      '導入 RFID 模組，增強產品系統安全性',
      '與機構工程師協作，完成機電整合任務',
      '規劃及引導 App 工程師開發專用手機應用程式（Android / iOS），並完成雙平台上架',
      '定義 RESTful API，並使用 Python Flask 實作',
      '取得兩項發明專利，並應用於產品中',
    ],
    tags: ['跨團隊溝通及整合', 'Qt', 'Raspberry Pi', 'RESTful API', 'Python Flask'],
  },
  {
    title: '一次性插管用醫療器材',
    period: '2022.05 - 2023.05',
    roles: ['電路設計'],
    points: [
      '設計高成本效益電路，成功將 BOM Cost 控制在 1 美元以內，利於大規模量產',
      '取得 SGS EMI/ESD 測試報告',
      '取得發明專利及新型專利各一項',
    ],
    tags: ['電路設計', 'Altium Designer'],
  },
  {
    title: '重複性插管用醫療器材',
    period: '2021.11 - 2022.12',
    roles: ['韌體測試', 'App 規劃'],
    points: [
      '協助測試韌體，即時回饋廠商並提供建議解決方案，韌體穩定度提升 30%',
      '規劃 App 功能，導入 OTA 升級機制，提升用戶使用體驗',
    ],
    tags: ['韌體測試', 'App 規劃', 'Android / iOS 上架經驗'],
  },
];

const portfolio = [
  {
    img: n8nShot,
    title: 'n8nManager App',
    desc: '使用 Flutter 雙平台開發，採 MVVM 架構、Provider 控制狀態。提供 n8n 工作流管理、執行狀態監控與安全性偵測，可即時掌握 n8n 狀態。',
    tags: ['Flutter', 'Dart', 'Provider', 'MVVM'],
    link: 'https://www.frankchen.tw/n8nmanager',
    linkText: '查看專案',
  },
  {
    img: blogShot,
    title: '法蘭克的技術部落格',
    desc: '分享軟體開發實戰經驗與工具應用的技術部落格。',
    tags: ['WordPress', 'Astro'],
    link: '/',
    linkText: '前往網站',
  },
  {
    img: iset2021,
    title: 'ISET2021 研討會官方網站',
    desc: '沿用 ISET 研討會官網功能，美化介面並調整細節問題。',
    tags: ['HTML', 'CSS', 'JavaScript', 'Google Apps Script'],
    link: 'https://github.com/haunchen/ISET2021',
    linkText: 'GitHub',
  },
  {
    img: iset2020,
    title: 'ISET2020 研討會官方網站',
    desc: '碩班時期作品，從零手刻網站完成報名與繳費功能。報名系統串接 Google Sheet 作資料庫，搭配 Google Apps Script 完成功能。',
    tags: ['HTML', 'CSS', 'JavaScript', 'Google Apps Script'],
    link: 'https://github.com/haunchen/ISET2020',
    linkText: 'GitHub',
  },
];

const socials = [
  { label: 'GitHub', href: 'https://github.com/haunchen' },
  { label: 'LinkedIn', href: 'https://www.linkedin.com/in/frankchen0130/' },
  { label: 'Threads', href: 'https://www.threads.com/@frankchen.tw' },
  { label: 'Buy Me a Coffee', href: 'https://buymeacoffee.com/frankchentw' },
];

const personJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'ProfilePage',
  url: `${SITE.url}/about/`,
  mainEntity: {
    '@type': 'Person',
    name: 'Frank Chen',
    alternateName: '法蘭克',
    jobTitle: '系統整合工程師',
    email: SITE.email,
    description: '系統整合工程師，跨領域整合軟體、韌體、硬體與 App，曾領導 5 人團隊完成兩代智慧醫療模擬器的開發與商業化。',
    knowsAbout: ['系統架構規劃', '電子電路開發', '系統整合', 'Flutter', 'n8n'],
    sameAs: SITE.sameAs,
  },
};
---

<BaseLayout
  title="關於我 - 下班後的工程師筆記"
  description="Frank Chen，系統整合工程師。跨領域整合軟體、韌體、硬體與 App，曾領導 5 人團隊完成兩代智慧醫療模擬器的開發與商業化。"
  ogImage="/cover.webp"
  jsonLd={[personJsonLd]}
>
  <main class="about">
    <!-- Hero banner -->
    <section class="about-hero">
      <img src="/cover.webp" alt="Frank Chen｜不典型的軟體工程師" width="1200" height="630" class="about-hero-img" />
      <h1 class="about-hero-title">Frank Chen</h1>
      <p class="about-hero-tagline">不典型的軟體工程師</p>
    </section>

    <!-- 關於我 -->
    <section class="about-section">
      <h2 class="about-h2">關於我</h2>
      <div class="about-bio">
        <Image src={avatar} alt="Frank Chen 的頭像" class="about-avatar" />
        <div>
          <p>我是一位充滿熱忱的系統整合工程師，擁有超過 3 年的軟體開發經驗。曾領導 5 人團隊完成兩代智慧醫療模擬器的完整開發與商業化，涵蓋軟體、韌體、硬體、App 及後端系統。</p>
          <p>技術棧涵蓋嵌入式系統、移動端開發與 AI 整合，具備從 0 到 1 的產品開發與團隊協作能力。</p>
          <div class="about-tags">
            <TagBadge text="系統架構規劃" />
            <TagBadge text="電子電路開發" />
            <TagBadge text="系統整合" />
            <TagBadge text="Flutter" />
            <TagBadge text="n8n" />
          </div>
        </div>
      </div>
    </section>

    <!-- 工作經歷 -->
    <section class="about-section">
      <h2 class="about-h2">工作經歷</h2>
      <div class="about-cards">
        {experiences.map((exp) => (
          <div class="about-card">
            <h3 class="about-card-title">{exp.role}</h3>
            <p class="about-card-company">{exp.company}</p>
            <p class="about-card-period">{exp.period}</p>
            <ul class="about-list">
              {exp.points.map((p) => <li>{p}</li>)}
            </ul>
          </div>
        ))}
      </div>
    </section>

    <!-- 專案經歷 -->
    <section class="about-section">
      <h2 class="about-h2">專案經歷</h2>
      <div class="about-grid-2">
        {projects.map((proj) => (
          <div class="about-card">
            <h3 class="about-card-title">{proj.title}</h3>
            <p class="about-card-period">{proj.period}</p>
            <div class="about-roles">
              {proj.roles.map((r) => <span class="about-role">{r}</span>)}
            </div>
            <ul class="about-list">
              {proj.points.map((p) => <li>{p}</li>)}
            </ul>
            <div class="about-tags">
              {proj.tags.map((t) => <TagBadge text={t} size="sm" />)}
            </div>
          </div>
        ))}
      </div>
    </section>

    <!-- 作品集 -->
    <section class="about-section">
      <h2 class="about-h2">作品集</h2>
      <div class="about-grid-2">
        {portfolio.map((item) => (
          <div class="about-card about-card--portfolio">
            <Image src={item.img} alt={item.title} class="about-portfolio-img" />
            <div class="about-card-body">
              <h3 class="about-card-title">{item.title}</h3>
              <p class="about-card-desc">{item.desc}</p>
              <div class="about-tags">
                {item.tags.map((t) => <TagBadge text={t} size="sm" />)}
              </div>
              <a href={item.link} class="about-link" target={item.link.startsWith('http') ? '_blank' : undefined} rel={item.link.startsWith('http') ? 'noopener noreferrer' : undefined}>{item.linkText} →</a>
            </div>
          </div>
        ))}
      </div>
    </section>

    <!-- 聯絡我 -->
    <section class="about-section">
      <h2 class="about-h2">聯絡我</h2>
      <p class="about-contact-intro">如果你有任何專案想法或合作機會，歡迎隨時與我聯繫。</p>
      <ul class="about-contact-list">
        <li>Email：<a class="about-link" href={`mailto:${SITE.email}`}>{SITE.email}</a></li>
        <li>地點：台南，台灣</li>
        <li>聯絡表單：<a class="about-link" href="https://www.frankchen.tw/contact-frank/" target="_blank" rel="noopener noreferrer">點此前往填寫</a></li>
      </ul>
      <div class="about-socials">
        {socials.map((s) => (
          <a class="about-social" href={s.href} target="_blank" rel="noopener noreferrer">{s.label}</a>
        ))}
      </div>
    </section>
  </main>
</BaseLayout>

<style>
  .about {
    max-width: var(--width-wide);
    margin: 0 auto;
    padding: 0 24px 80px;
  }

  /* Hero */
  .about-hero {
    text-align: center;
    padding: 48px 0 32px;
  }

  .about-hero-img {
    width: 100%;
    max-width: var(--width-content);
    height: auto;
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-md);
    margin-bottom: 24px;
  }

  .about-hero-title {
    font-family: var(--font-serif);
    font-size: 36px;
    line-height: 48px;
    font-weight: 700;
    letter-spacing: -0.02em;
  }

  .about-hero-tagline {
    font-family: var(--font-sans);
    font-size: 16px;
    color: var(--color-text-secondary);
    margin-top: 8px;
  }

  /* Section */
  .about-section {
    padding: 48px 0;
    border-top: 1px solid var(--color-border-subtle);
  }

  .about-h2 {
    font-family: var(--font-serif);
    font-size: 28px;
    line-height: 38px;
    font-weight: 600;
    margin-bottom: 24px;
  }

  /* Bio */
  .about-bio {
    display: flex;
    gap: 24px;
    align-items: flex-start;
  }

  .about-avatar {
    width: 96px;
    height: 96px;
    border-radius: var(--radius-full);
    border: 2px solid var(--color-border-default);
    object-fit: cover;
    flex-shrink: 0;
  }

  .about-bio p {
    font-family: var(--font-sans);
    font-size: 16px;
    line-height: 28px;
    color: var(--color-text-secondary);
    margin-bottom: 12px;
  }

  .about-tags {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    margin-top: 12px;
  }

  /* Cards */
  .about-cards {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .about-grid-2 {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 24px;
  }

  .about-card {
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-md);
    padding: 24px;
  }

  .about-card--portfolio {
    padding: 0;
    overflow: hidden;
  }

  .about-card-body {
    padding: 24px;
  }

  .about-portfolio-img {
    width: 100%;
    height: 200px;
    object-fit: cover;
    border-bottom: 1px solid var(--color-border-default);
  }

  .about-card-title {
    font-family: var(--font-sans);
    font-size: 18px;
    font-weight: 600;
    margin-bottom: 4px;
  }

  .about-card-company {
    font-family: var(--font-sans);
    font-size: 14px;
    color: var(--color-text-secondary);
    margin-bottom: 2px;
  }

  .about-card-period {
    font-family: var(--font-mono);
    font-size: 13px;
    color: var(--color-text-muted);
    margin-bottom: 12px;
    letter-spacing: 0.02em;
  }

  .about-card-desc {
    font-family: var(--font-sans);
    font-size: 14px;
    line-height: 22px;
    color: var(--color-text-secondary);
    margin-bottom: 12px;
  }

  .about-roles {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    margin-bottom: 12px;
  }

  .about-role {
    font-family: var(--font-sans);
    font-size: 12px;
    color: var(--color-text-muted);
    border: 1px solid var(--color-border-subtle);
    border-radius: var(--radius-sm);
    padding: 1px 8px;
  }

  .about-list {
    list-style: disc;
    padding-left: 20px;
    margin-bottom: 12px;
  }

  .about-list li {
    font-family: var(--font-sans);
    font-size: 14px;
    line-height: 24px;
    color: var(--color-text-secondary);
    margin-bottom: 6px;
  }

  .about-link {
    font-family: var(--font-sans);
    font-size: 14px;
    color: var(--color-text-primary);
    text-decoration: none;
    border-bottom: 2px solid rgba(251, 146, 60, 0.4);
    transition: border-color 300ms steps(3), background-color 300ms steps(3);
  }

  .about-link:hover {
    border-bottom-color: var(--color-brand-orange);
    background-color: rgba(251, 146, 60, 0.1);
  }

  /* Contact */
  .about-contact-intro {
    font-family: var(--font-sans);
    font-size: 16px;
    line-height: 28px;
    color: var(--color-text-secondary);
    margin-bottom: 16px;
  }

  .about-contact-list {
    list-style: none;
    padding: 0;
    margin: 0 0 20px;
    font-family: var(--font-sans);
    font-size: 15px;
    color: var(--color-text-secondary);
    line-height: 32px;
  }

  .about-socials {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
  }

  .about-social {
    font-family: var(--font-sans);
    font-size: 14px;
    color: var(--color-text-secondary);
    text-decoration: none;
    padding: 6px 14px;
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-full);
    transition: color 300ms steps(3), border-color 300ms steps(3);
  }

  .about-social:hover {
    color: var(--color-text-primary);
    border-color: var(--color-border-strong);
  }

  /* Responsive */
  @media (max-width: 768px) {
    .about-grid-2 {
      grid-template-columns: 1fr;
    }

    .about-bio {
      flex-direction: column;
      align-items: center;
      text-align: center;
    }

    .about-hero-title {
      font-size: 28px;
      line-height: 38px;
    }
  }
</style>
```

Step 2: 驗證
Run: `npm run build`
Expected: build 成功，`dist/about/index.html` 產出；cover 與 5 張截圖經 astro:assets 處理；`<head>` 含 ProfilePage JSON-LD 與 `og:image` = `/cover.webp`。

Step 3: Commit
Run: `git add -A && git commit -m "feat(pages): 加 /about/ 關於我頁（移植 portfolio + cover）"`

---

### Task 9: /privacy-policy/ 隱私權政策頁

Implements: `site-pages.md` #R8

Files:
- Create: `src/pages/privacy-policy.astro`

內容貼合靜態站現況（無留言/登入/Gravatar/分析），網址標示 `https://www.frankchen.tw`、聯絡 `frank@frankchen.tw`。

Step 1: 建立 `src/pages/privacy-policy.astro`：

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
import { SITE } from '../utils/site-meta';
---

<BaseLayout
  title="隱私權政策 - 下班後的工程師筆記"
  description="本站如何處理你的資料：本站為靜態網站，不主動蒐集個人資料、未安裝追蹤型分析工具。"
>
  <main class="legal">
    <h1 class="legal-title">隱私權政策</h1>
    <p class="legal-updated">最後更新：2026-06-26</p>

    <div class="prose">
      <h2>我們是誰</h2>
      <p>本網站網址為 https://www.frankchen.tw，由 Frank Chen 經營。如有任何隱私相關問題，歡迎來信 {SITE.email}。</p>

      <h2>我們蒐集哪些資料</h2>
      <p>本站為靜態網站，不提供留言、註冊或登入功能，因此不會主動向你蒐集姓名、電子郵件等個人資料。本站目前未安裝第三方分析工具（例如 Google Analytics），不會建立你的瀏覽行為輪廓。</p>

      <h2>Cookie</h2>
      <p>本站本身不使用追蹤型 Cookie。網站由 Cloudflare Pages 代管，平台可能基於資訊安全與效能設置必要性 Cookie；這類 Cookie 不用於識別你的身分。</p>

      <h2>第三方嵌入內容</h2>
      <p>本站文章可能嵌入來自第三方網站的內容（例如圖片、影片、程式碼片段）。這些內容的隱私權處理方式，與你直接造訪該第三方網站時相同；它們可能會蒐集你的資料、使用 Cookie，或追蹤你與嵌入內容的互動。</p>

      <h2>外部連結</h2>
      <p>本站文章可能包含指向外部網站的連結。一旦你離開本站，我們無法為其他網站的隱私權做法負責，建議你查閱該網站自己的隱私權政策。</p>

      <h2>你的權利與聯絡方式</h2>
      <p>由於本站不主動蒐集個人資料，通常沒有可供查詢或刪除的個人資料。如你仍有任何疑問或要求，歡迎來信 {SITE.email}。</p>
    </div>
  </main>
</BaseLayout>

<style>
  .legal {
    max-width: var(--width-content);
    margin: 0 auto;
    padding: 64px 24px;
  }

  .legal-title {
    font-family: var(--font-serif);
    font-size: 36px;
    line-height: 48px;
    font-weight: 700;
    letter-spacing: -0.02em;
  }

  .legal-updated {
    font-family: var(--font-mono);
    font-size: 13px;
    color: var(--color-text-muted);
    margin: 8px 0 32px;
    letter-spacing: 0.02em;
  }

  @media (max-width: 768px) {
    .legal {
      padding: 40px 16px;
    }

    .legal-title {
      font-size: 28px;
      line-height: 38px;
    }
  }
</style>
```

Step 2: 驗證
Run: `npm run build`
Expected: build 成功，`dist/privacy-policy/index.html` 產出；footer 的 `/privacy-policy/` 連結不再死。

Step 3: Commit
Run: `git add -A && git commit -m "feat(pages): 加 /privacy-policy/ 隱私權政策頁"`

---

### Task 10: 全站 build 最終驗收

Files:
- 無（純驗證）

Step 1: 乾淨重建
Run: `npm run build`
Expected: 成功，無 error/warning。

Step 2: 確認產出頁面齊全
Run: `ls dist/about/index.html dist/articles/index.html dist/privacy-policy/index.html dist/category/n8n/index.html dist/category/devops/index.html dist/category/flutter/index.html dist/category/tools/index.html dist/category/raspberry-pi/index.html`
Expected: 8 個檔案皆存在。

Step 3: 抽查死連結已解
Run: `grep -rl "/category/deployment/" dist/ || echo "OK: no deployment link"`
Expected: `OK: no deployment link`

Step 4: 抽查 cover OG 已注入
Run: `grep -l 'og:image' dist/about/index.html dist/index.html`
Expected: 兩檔皆含 og:image。

Step 5: 人工驗收（`npm run dev` 後瀏覽器）
- /about/ 六區塊、cover、5 張截圖、社群連結正常
- /articles/ 列出全部文章、CategoryBar 切換、卡片分類 badge 為口語名稱
- 各 /category/ 頁篇數正確
- 首頁分類卡連結與數字正確
- /privacy-policy/ 內容貼合靜態站
- Nav 無 n8n 資源死連結、Footer 隱私權連結可達

（本 task 無 commit）
