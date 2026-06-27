# /articles/ 時間軸改版 + /category/ 總覽頁設計

- 日期：2026-06-27
- 分支：feat/articles-timeline
- Domain：site-pages（brownfield delta，spec 既有最大 ID R10 → 新增從 R11 起）

## 背景與動機

現況：

- `/articles/` 為卡片網格 + 頂部分類導覽列（`CategoryBar`）
- `/category/<slug>/` 同為卡片網格
- 裸 `/category/` 無 index 頁，手動造訪會 404（全站無連結指向它）

使用者偏好 darrelltw.com/archives/ 式的「年份分組時間軸彙整」（純文字列、掃描快、版面輕），覺得卡片網格在文章總覽頁不必要；並希望裸 `/category/` 呈現分類總覽（如首頁「探索主題」區塊），而非 redirect。

## 目標

1. `/articles/` 改成按年份分組的時間軸列表。
2. 新增 `/category/` 分類總覽頁（消除 404）。
3. `/category/<slug>/` 改成同款時間軸 + 回鏈到 `/category/`。
4. 移除 `CategoryBar`，抽共用元件降低重複。

## 非目標（YAGNI）

- 不改首頁「探索主題」的視覺與行為（僅內部改用 `CategoryGrid` 元件，渲染結果不變）。
- 不動文章頁 `[...slug].astro` 的分類 badge（仍連 `/category/<slug>/`）。
- 不分頁、不做 client 端即時篩選。
- 不引入搜尋、標籤系統、表單。

## 架構

### 頁面

- `src/pages/articles.astro`
  - `<ArticleTimeline posts={全部非草稿文章} />`
  - 頁頂「文章 ／ 共 N 篇」，無分類導覽列
- `src/pages/category/index.astro`（新增）
  - `<CategoryGrid />`
  - 頁頂分類總覽標題；裸 `/category/` 從此不再 404
- `src/pages/category/[category].astro`
  - `<ArticleTimeline posts={該分類非草稿文章} />`
  - 頁頂「{分類名} ／ 共 N 篇」+「← 所有分類」回鏈（指向 `/category/`）
  - `getStaticPaths` 既有「只為有文章的分類產 path」邏輯不變

### 元件

- `src/components/ArticleTimeline.astro`（新增）
  - Props：`posts: CollectionEntry<'posts'>[]`
  - 邏輯：依 `post.data.date.getFullYear()` 分組 → 年份降序 → 組內 `date` 降序
  - 渲染：每年一段（年份大標 serif + 底部細線），其下每列三欄：
    - 日期 `MM-DD`（mono 字體、muted 灰、固定寬對齊）
    - 標題連結 `/{post.id}/`（hover 橘色底線）
    - 分類標籤：既有 `TagBadge`（`size="sm"`、`href={/category/<category>/}`）
  - 標題完整顯示不截斷
- `src/components/CategoryGrid.astro`（新增）
  - 內部 `getCollection('posts', 非草稿)` → 以 `CATEGORIES` map 算各分類即時篇數 → filter 掉 0 篇
  - 渲染卡片網格（搬自 `index.astro` 現有的 `.category-grid` / `.category-card` 結構與 scoped CSS）
  - 首頁與 `/category/` 總覽頁皆 `<CategoryGrid />`，篇數單一來源
- 刪除 `src/components/CategoryBar.astro`（兩頁皆不再使用）

### 首頁調整

- `src/pages/index.astro`：移除 inline 的「探索主題」卡片區塊與對應 scoped CSS，改放 `<CategoryGrid />`；移除因抽離而不再使用的 import（`CATEGORIES` 若僅此處用）。渲染結果視覺不變。

## 資料流

- `ArticleTimeline` 接收「已 filter 非草稿」的 posts，只負責分組／排序／渲染；不自行查 collection（呼叫端決定要全部或單一分類）。
- `CategoryGrid` 自行 `getCollection` 算篇數（總覽用途，單一來源）。
- `articles.astro` 與 `category/[category].astro` 各自 `getCollection` 取得要傳入的 posts。

## 樣式（沿用 `src/styles/global.css` 既有 token）

- 年份大標：`var(--font-serif)`，`border-bottom: 1px solid var(--color-border-subtle)`。
- 日期：`var(--font-mono)`，`var(--color-text-muted)`，固定寬以對齊整列。
- 標題連結 hover：沿用站上 `.section-link` 的橘色底線模式（`border-bottom: 2px solid rgba(251,146,60,0.4)`，hover 加深 + 淡背景）。刻意沿用 rgba 而非新引入 `color-mix()`，避免重蹈 Issue #11 的舊瀏覽器降級缺口。
- 分類標籤：`TagBadge size="sm"`。
- 響應式（≤768px）：日期 + 標題一行、分類標籤落下一行或縮小。
- 不套卡片 `einkRefresh` 動畫，維持時間軸清爽。

## 邊界與錯誤處理

- 空年份組不渲染年份標題。
- 0 篇分類：`CategoryGrid` filter 掉、`[category].astro` `getStaticPaths` 既有 filter 不產頁。
- 跨年份排序：2026 組在 2025 組之上，組內新到舊。

## 驗證策略

專案無元件測試框架，本次不另立。驗證走 `npm run build` + 檢查 `dist/`：

- `dist/articles/index.html`：年份分組標題、每列日期/標題/分類標籤、無 `CategoryBar` 殘留標記。
- `dist/category/index.html`：存在且列出分類卡（裸 `/category/` 不再 404）。
- `dist/category/n8n/index.html`：時間軸列表 + 「所有分類」回鏈。
- `grep` 確認全 repo 無殘留 `CategoryBar` import。
- 首頁「探索主題」卡視覺不變（改用 `CategoryGrid`）。

## Spec delta 摘要（寫入 `docs/specs/site-pages.md` 的 Pending Changes）

- MODIFIED R3：`/articles/` 改年份分組時間軸（新到舊、每列帶分類標籤、移除分類導覽列、仍不分頁）
- MODIFIED R4：`/category/<slug>/` 改時間軸呈現（共用 `ArticleTimeline`）
- REMOVED R5：分類導覽列（`CategoryBar`）取消
- ADDED R11：`/category/` 分類總覽頁（列有效分類 + 即時篇數）
- ADDED R12：時間軸按年份分組
- ADDED R13：分類子頁回鏈到 `/category/`
- MODIFIED D4 + 新增 D10/D11（共用元件、裸 `/category/` 改實體總覽頁）

## 檔案異動清單

- 新增：`src/components/ArticleTimeline.astro`、`src/components/CategoryGrid.astro`、`src/pages/category/index.astro`
- 修改：`src/pages/articles.astro`、`src/pages/category/[category].astro`、`src/pages/index.astro`、`docs/specs/site-pages.md`
- 刪除：`src/components/CategoryBar.astro`
