# /articles/ 時間軸改版 + /category/ 總覽頁 Implementation Plan

Goal: 把 `/articles/` 改成按年份分組的時間軸彙整頁、新增 `/category/` 分類總覽頁、`/category/<slug>/` 改同款時間軸並加回鏈，並抽出共用元件、移除 CategoryBar。

Architecture: 新增兩個展示元件 `ArticleTimeline.astro`（年份分組時間軸，供 /articles/ 與 /category/<slug>/ 共用）與 `CategoryGrid.astro`（分類卡片，供首頁與 /category/ 總覽共用，內部自算即時篇數）。三個頁面改為呼叫這兩個元件；裸 /category/ 以實體 index.astro 呈現總覽（非 redirect）。刪除不再使用的 CategoryBar.astro。純 SSG、無新增相依、無測試框架，驗證走 `npm run build` + 檢查 `dist/`。

Tech Stack: Astro v5、Tailwind v4、TypeScript、既有 `TagBadge.astro`、`src/utils/site-meta.ts`（`CATEGORIES`/`CATEGORY_LABEL`/`categoryLabel`）、`src/styles/global.css` design tokens。

Spec: `docs/specs/site-pages.md`（Pending Changes 區塊：MODIFY R3/R4、REMOVE R5、ADD R11-R13/S9-S11/D10/D11；spec 正文定版交由 dev:finish 套用 delta）

設計文件：`docs/plans/2026-06-27-articles-timeline-design.md`

共用約定：

- 每個 task 結尾 `npm run build` 必須 PASS（無測試框架，build 是唯一守門）。
- 連結 hover 一律沿用站上 `.section-link` 的 rgba 橘底線模式（`rgba(251,146,60,0.4)` → hover 加深 + 淡背景），不引入 `color-mix()`，避免舊瀏覽器降級缺口（見 Issue #11）。
- 提交訊息用 Conventional Commits、scope 用 `articles`/`category`/`home`。

---

### Task 1: 新增 CategoryGrid 元件

Implements: `site-pages.md` #R11, #R6（即時篇數單一來源）

Files:
- Create: `src/components/CategoryGrid.astro`

說明：把首頁目前 inline 的分類卡片（`.category-grid`/`.category-card`）抽成獨立元件，內部自行查 collection 算各分類即時篇數、過濾 0 篇。樣式從 `src/pages/index.astro` 的 scoped CSS 原樣搬入，視覺零變化。

Step 1: 建立 `src/components/CategoryGrid.astro`，完整內容：

```astro
---
import { getCollection } from 'astro:content';
import { CATEGORIES } from '../utils/site-meta';

const posts = await getCollection('posts', ({ data }) => !data.draft);
const categories = CATEGORIES
  .map(({ slug, label }) => ({
    name: label,
    count: posts.filter((p) => p.data.category === slug).length,
    href: `/category/${slug}/`,
  }))
  .filter((c) => c.count > 0);
---

<div class="category-grid">
  {categories.map((cat) => (
    <a href={cat.href} class="category-card">
      <div class="category-name">{cat.name}</div>
      <div class="category-count">{cat.count} 篇</div>
    </a>
  ))}
</div>

<style>
  .category-grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 16px;
  }

  .category-card {
    background: transparent;
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-md);
    padding: 24px;
    text-decoration: none;
    color: inherit;
    transition: border-color 500ms steps(4);
  }

  .category-card:hover {
    animation: einkRefresh 500ms steps(4) forwards;
  }

  .category-name {
    font-family: var(--font-sans);
    font-size: 18px;
    font-weight: 600;
    margin-bottom: 4px;
  }

  .category-count {
    font-family: var(--font-sans);
    font-size: 14px;
    color: var(--color-text-muted);
  }

  @media (max-width: 768px) {
    .category-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }
</style>
```

註：`einkRefresh` 是 `global.css` 定義的全域 keyframe，scoped style 引用無需重新定義（首頁原本即如此用）。`--color-border-default`/`--radius-md`/`--font-sans`/`--color-text-muted` 皆為 global.css 既有 token。

Step 2: Run `npm run build`，Expected: PASS（此時元件尚未被引用，僅驗證可編譯）。

Step 3: Commit
Run: `git add src/components/CategoryGrid.astro && git commit -m "feat(category): 新增 CategoryGrid 共用元件（分類卡片+即時篇數）"`

---

### Task 2: 首頁改用 CategoryGrid

Implements: `site-pages.md` #R6, #D10

Files:
- Modify: `src/pages/index.astro`

說明：移除首頁 inline 的分類計算、分類卡片 markup 與對應 scoped CSS，改放 `<CategoryGrid />`。其餘區塊（hero、最新文章、關於我、專案作品）不動。

Step 1: 在 frontmatter 加入 import，並移除分類計算。

加上 import（與其他元件 import 並列，第 4 行附近）：
```astro
import CategoryGrid from '../components/CategoryGrid.astro';
```

移除這個 import（第 6 行，CATEGORIES 已不在本頁直接使用）：
```astro
import { CATEGORIES } from '../utils/site-meta';
```

移除整段 categories 計算（原第 14-20 行）：
```astro
const categories = CATEGORIES
  .map(({ slug, label }) => ({
    name: label,
    count: posts.filter((p) => p.data.category === slug).length,
    href: `/category/${slug}/`,
  }))
  .filter((c) => c.count > 0);
```

Step 2: 把「探索主題」section 內的 `.category-grid` 區塊換成元件。

將原本（約第 110-117 行）：
```astro
        <div class="category-grid">
          {categories.map((cat) => (
            <a href={cat.href} class="category-card">
              <div class="category-name">{cat.name}</div>
              <div class="category-count">{cat.count} 篇</div>
            </a>
          ))}
        </div>
```
替換為：
```astro
        <CategoryGrid />
```

Step 3: 移除首頁 scoped CSS 中已搬到元件的規則：`.category-grid`、`.category-card`、`.category-card:hover`、`.category-name`、`.category-count`（原約第 281-313 行的「Category grid」區塊），以及響應式區塊內的 `.category-grid { grid-template-columns: repeat(2, 1fr); }`（原約第 448-450 行）。其餘 CSS 保留。

Step 4: Run `npm run build`，Expected: PASS。

Step 5: 驗證首頁產出仍含分類卡：
Run: `grep -c "category-card" dist/index.html`
Expected: 數字 > 0（卡片仍渲染，視覺不變）。

Step 6: Commit
Run: `git add src/pages/index.astro && git commit -m "refactor(home): 探索主題改用 CategoryGrid 元件（視覺不變）"`

---

### Task 3: 新增 ArticleTimeline 元件

Implements: `site-pages.md` #R3, #R12

Files:
- Create: `src/components/ArticleTimeline.astro`

說明：吃一個「已過濾非草稿」的文章陣列，內部依年份分組（年份降序、組內新到舊），每列渲染日期（MM-DD）、標題連結、分類標籤。分類標籤沿用文章頁慣例用 `CATEGORY_LABEL` 短名。

Step 1: 建立 `src/components/ArticleTimeline.astro`，完整內容：

```astro
---
import type { CollectionEntry } from 'astro:content';
import TagBadge from './TagBadge.astro';
import { CATEGORY_LABEL } from '../utils/site-meta';

interface Props {
  posts: CollectionEntry<'posts'>[];
}

const { posts } = Astro.props;

// 依年份分組：年份降序、組內由新到舊
const sorted = [...posts].sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
const groupsMap = new Map<number, CollectionEntry<'posts'>[]>();
for (const post of sorted) {
  const year = post.data.date.getFullYear();
  if (!groupsMap.has(year)) groupsMap.set(year, []);
  groupsMap.get(year)!.push(post);
}
const groups = [...groupsMap.entries()].sort((a, b) => b[0] - a[0]);

const mmdd = (d: Date) =>
  `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
---

<div class="timeline">
  {groups.map(([year, items]) => (
    <section class="timeline-year">
      <h2 class="timeline-year-title">{year}</h2>
      <ul class="timeline-list">
        {items.map((post) => (
          <li class="timeline-row">
            <time class="timeline-date" datetime={post.data.date.toISOString().slice(0, 10)}>
              {mmdd(post.data.date)}
            </time>
            <a class="timeline-link" href={`/${post.id}/`}>{post.data.title}</a>
            <span class="timeline-badge">
              <TagBadge
                text={CATEGORY_LABEL[post.data.category] ?? post.data.category}
                href={`/category/${post.data.category}/`}
                size="sm"
              />
            </span>
          </li>
        ))}
      </ul>
    </section>
  ))}
</div>

<style>
  .timeline-year {
    margin-bottom: 40px;
  }

  .timeline-year-title {
    font-family: var(--font-serif);
    font-size: 24px;
    font-weight: 700;
    padding-bottom: 8px;
    margin-bottom: 8px;
    border-bottom: 1px solid var(--color-border-subtle);
  }

  .timeline-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .timeline-row {
    display: flex;
    align-items: baseline;
    gap: 16px;
    padding: 10px 0;
    border-bottom: 1px solid var(--color-border-subtle);
  }

  .timeline-date {
    flex-shrink: 0;
    width: 48px;
    font-family: var(--font-mono);
    font-size: 14px;
    color: var(--color-text-muted);
  }

  .timeline-link {
    flex: 1;
    font-family: var(--font-sans);
    font-size: 16px;
    color: var(--color-text-primary);
    text-decoration: none;
    border-bottom: 2px solid rgba(251, 146, 60, 0.4);
    transition: border-color 300ms steps(3), background-color 300ms steps(3);
  }

  .timeline-link:hover {
    border-bottom-color: var(--color-brand-orange);
    background-color: rgba(251, 146, 60, 0.1);
  }

  .timeline-badge {
    flex-shrink: 0;
  }

  @media (max-width: 768px) {
    .timeline-row {
      flex-wrap: wrap;
      gap: 4px 12px;
    }

    .timeline-badge {
      margin-left: 64px;
    }
  }
</style>
```

註：手機版 `.timeline-row` 換行時，date + 標題同行、分類標籤掉到下一行並縮排 64px（48 date + 16 gap）對齊標題起點。`--color-text-primary` 等皆為 global.css 既有 token。

Step 2: Run `npm run build`，Expected: PASS（元件尚未被引用，僅驗證可編譯）。

Step 3: Commit
Run: `git add src/components/ArticleTimeline.astro && git commit -m "feat(articles): 新增 ArticleTimeline 共用元件（年份分組時間軸）"`

---

### Task 4: /articles/ 改用 ArticleTimeline

Implements: `site-pages.md` #R3, #R12（MODIFY），移除分類導覽列（#R5 REMOVED）

Files:
- Modify: `src/pages/articles.astro`

說明：把卡片網格 + CategoryBar 換成 ArticleTimeline。頁頂 list-head 保留。

Step 1: 以下列完整內容覆寫 `src/pages/articles.astro`：

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
import ArticleTimeline from '../components/ArticleTimeline.astro';
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

    <ArticleTimeline posts={posts} />
  </main>
</BaseLayout>
```

Step 2: Run `npm run build`，Expected: PASS。

Step 3: 驗證 /articles/ 為時間軸、無 CategoryBar：
Run: `grep -o "timeline-year-title" dist/articles/index.html | head -1; grep -c "category-bar" dist/articles/index.html`
Expected: 第一條印出 `timeline-year-title`（年份分組存在）；第二條為 `0`（無分類導覽列殘留）。

Step 4: Commit
Run: `git add src/pages/articles.astro && git commit -m "feat(articles): /articles/ 改年份分組時間軸、移除分類導覽列"`

---

### Task 5: /category/<slug>/ 改時間軸 + 回鏈

Implements: `site-pages.md` #R4, #R12, #R13（MODIFY/ADD）

Files:
- Modify: `src/pages/category/[category].astro`

說明：把卡片網格 + CategoryBar 換成 ArticleTimeline，頁頂加「← 所有分類」回鏈指向 `/category/`。`getStaticPaths`（只為有文章的分類產 path）邏輯不變。

Step 1: 以下列完整內容覆寫 `src/pages/category/[category].astro`：

```astro
---
import BaseLayout from '../../layouts/BaseLayout.astro';
import ArticleTimeline from '../../components/ArticleTimeline.astro';
import { getCollection, type CollectionEntry } from 'astro:content';
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

interface Props {
  categoryPosts: CollectionEntry<'posts'>[];
  slug: string;
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
      <a class="list-back" href="/category/">← 所有分類</a>
    </header>

    <ArticleTimeline posts={categoryPosts} />
  </main>
</BaseLayout>

<style>
  .list-back {
    display: inline-block;
    margin-top: 12px;
    font-family: var(--font-sans);
    font-size: 14px;
    color: var(--color-text-secondary);
    text-decoration: none;
    border-bottom: 2px solid rgba(251, 146, 60, 0.4);
    transition: border-color 300ms steps(3), background-color 300ms steps(3);
  }

  .list-back:hover {
    border-bottom-color: var(--color-brand-orange);
    background-color: rgba(251, 146, 60, 0.1);
  }
</style>
```

Step 2: Run `npm run build`，Expected: PASS。

Step 3: 驗證某分類子頁為時間軸 + 回鏈：
Run: `grep -c "timeline-year-title" dist/category/n8n/index.html; grep -o 'href="/category/"' dist/category/n8n/index.html | head -1`
Expected: 第一條 > 0；第二條印出 `href="/category/"`（回鏈存在）。

Step 4: Commit
Run: `git add src/pages/category/\[category\].astro && git commit -m "feat(category): 分類子頁改時間軸並加回鏈至 /category/"`

---

### Task 6: 新增 /category/ 分類總覽頁

Implements: `site-pages.md` #R11, #S10

Files:
- Create: `src/pages/category/index.astro`

說明：裸 `/category/` 的實體總覽頁，用 CategoryGrid 列出各分類與即時篇數，消除 404。

Step 1: 建立 `src/pages/category/index.astro`，完整內容：

```astro
---
import BaseLayout from '../../layouts/BaseLayout.astro';
import CategoryGrid from '../../components/CategoryGrid.astro';
---

<BaseLayout
  title="分類 - 下班後的工程師筆記"
  description="依主題瀏覽所有技術文章分類：n8n 自動化、架站部署、Flutter、樹莓派與開發工具。"
>
  <main class="list-page">
    <header class="list-head">
      <h1 class="list-title">分類</h1>
      <p class="list-sub">依主題瀏覽文章</p>
    </header>

    <CategoryGrid />
  </main>
</BaseLayout>
```

Step 2: Run `npm run build`，Expected: PASS。

Step 3: 驗證總覽頁產出且含分類卡：
Run: `test -f dist/category/index.html && echo EXISTS; grep -c "category-card" dist/category/index.html`
Expected: 印出 `EXISTS`；卡片數 > 0。

Step 4: Commit
Run: `git add src/pages/category/index.astro && git commit -m "feat(category): 新增 /category/ 分類總覽頁（裸路徑不再 404）"`

---

### Task 7: 刪除 CategoryBar 元件

Implements: `site-pages.md` #R5（REMOVED）

Files:
- Delete: `src/components/CategoryBar.astro`

說明：Task 4/5 後 CategoryBar 已無任何引用，刪除元件。

Step 1: 確認無殘留 import：
Run: `grep -rn "CategoryBar" src/`
Expected: 無輸出（零引用）。若有輸出，回頭修正引用頁面後再繼續。

Step 2: 刪除檔案：
Run: `git rm src/components/CategoryBar.astro`

Step 3: Run `npm run build`，Expected: PASS。

Step 4: Commit
Run: `git commit -m "refactor(category): 移除不再使用的 CategoryBar 元件"`

---

### Task 8: 端到端 build 驗證

Implements: 全部（#R3, #R4, #R5, #R11, #R12, #R13）

Files:
- 無（純驗證）

說明：乾淨重建，逐項核對設計的驗證標準。

Step 1: 乾淨重建：
Run: `rm -rf dist && npm run build`
Expected: PASS，無錯誤。

Step 2: 逐項驗證（每條都應符合 Expected）：

```bash
# /articles/ 時間軸、無 bar
echo "[articles 年份分組]"; grep -c "timeline-year-title" dist/articles/index.html
echo "[articles 無 CategoryBar]"; grep -c "category-bar" dist/articles/index.html        # 期望 0

# /category/ 總覽頁存在
echo "[category 總覽頁]"; test -f dist/category/index.html && echo EXISTS
echo "[category 卡片數]"; grep -c "category-card" dist/category/index.html

# 各分類子頁時間軸 + 回鏈
for c in n8n devops flutter tools raspberry-pi; do
  echo "[/category/$c/]"; test -f dist/category/$c/index.html && \
  echo "  timeline=$(grep -c timeline-year-title dist/category/$c/index.html) back=$(grep -c 'href=\"/category/\"' dist/category/$c/index.html)"
done

# 首頁仍有分類卡（視覺不變）
echo "[home 分類卡]"; grep -c "category-card" dist/index.html

# 全 repo 無 CategoryBar 殘留
echo "[CategoryBar 殘留]"; grep -rc "CategoryBar" src/ || echo "0 (none)"
```

Expected：articles 年份分組 > 0、articles 無 bar = 0、category 總覽頁 EXISTS、各子頁 timeline>0 且 back>0（5 個分類）、首頁分類卡 > 0、CategoryBar 殘留為 none。

Step 3: 無 commit（純驗證 task）。若任一項不符，回對應 task 修正。

---

## 收尾備註

- spec `docs/specs/site-pages.md` 的 Pending Changes（R3/R4 MODIFY、R5 REMOVED、R11-R13/S9-S11/D10/D11 ADDED）於 dev:finish 階段套用進 spec 正文並清空 Pending Changes。
- 後續若要在首頁「探索主題」加「更多 →」連到 `/category/` 總覽，屬範圍外，另議。
