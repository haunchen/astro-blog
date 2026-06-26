# Site Pages 設計文件

日期：2026-06-26
分支：`feat/site-pages`
Domain：`site-pages`

## 背景與目標

astro-blog 首頁、Nav、Footer 連到多個尚未實作的頁面，導致全站導覽存在死連結。
本次補齊這些頁面，並把 personal 作品集（`/Users/haunchenchen/Projects/haunchen/personal`）的內容與 `cover.webp` 主視覺移植進來。

範圍（本次做）：
- `/about/` — 關於我（完整移植 portfolio：自我介紹／工作經歷／專案經歷／作品集／聯絡）
- `/articles/` — 文章總覽（時序列表 + 頂部分類 bar）
- `/category/[category]/` — 分類頁
- `/privacy-policy/` — 隱私權政策（貼合靜態站現況）

不做：
- `/n8n-resources/` — repo 無現成素材；Nav 對它的連結一併移除

## 內容素材來源

- 文字（自我介紹／經歷／專案／作品集）逐字來源：`personal/index.html`
- cover：`personal/images/cover.webp`（1200×630 終端機風格主視覺）
- 圖片：`personal/images/` 的 `frank-avatar.png`、`n8n-app-screenshot.png`、`blog-screenshot.png`、`iset2021-screenshot.png`、`iset2020-screenshot.png`
- 隱私權政策來源：`https://www.frankchen.tw/privacy-policy/`（WordPress 預設版，需改寫貼合靜態站）

## 檔案規劃

新增：
- `src/pages/about.astro`
- `src/pages/articles.astro`
- `src/pages/category/[category].astro`
- `src/pages/privacy-policy.astro`
- `src/components/CategoryBar.astro`
- `public/cover.webp`（從 personal 複製）
- `src/assets/about/`（avatar + 4 張截圖，走 astro:assets）

修改：
- `src/utils/site-meta.ts` — 新增有序 `CATEGORIES` 清單當導覽/列表/分類頁的顯示與排序單一來源（與既有 `CATEGORY_LABEL` 並存、非替換；`CATEGORY_LABEL` 保留給 OG 圖與文章頁 badge，其用預建 subset 字型，改動會撞缺字）
- `src/pages/index.astro` — 分類卡改讀 `CATEGORIES` + 即時計數，修掉 `/category/deployment/` 死連結
- `src/components/Nav.astro` — 移除 `/n8n-resources/` 連結

## 設計細節

### 共用：CATEGORIES 單一來源（site-meta.ts）

把現有 `CATEGORY_LABEL` 升級為有序陣列，採首頁較口語的 label：

```ts
export const CATEGORIES = [
  { slug: 'n8n', label: 'n8n 自動化' },
  { slug: 'devops', label: '架站部署' },
  { slug: 'flutter', label: 'Flutter' },
  { slug: 'tools', label: '工具' },
  { slug: 'raspberry-pi', label: '樹莓派' },
] as const;
```

- 文章數一律由 `getCollection` 即時計算，不寫死。
- `CATEGORY_LABEL` 若仍有其他使用處，由 `CATEGORIES` 衍生保留相容（實作時 grep 確認用處）。

### CategoryBar.astro

- props：`active`（`'all'` 或某 slug）
- 渲染：「全部」→ `/articles/`，其餘 → `/category/{slug}/`，當前項加 active 樣式
- 沿用 Nav 的 e-ink hover 風格

### /about/

`BaseLayout` 包裹，`ogImage="/cover.webp"`，並透過 `jsonLd` prop 注入 Person/ProfilePage 結構化資料。六區塊由上而下：

1. Hero banner：`cover.webp` 全幅主視覺 + 標題「Frank Chen」+ tagline
2. 關於我：avatar（圓形）+ 兩段 bio + 技能標籤（系統架構規劃／電子電路開發／系統整合／Flutter／n8n）
3. 工作經歷：兩張時間軸卡
   - 系統整合課長｜原妙醫學 2024.09–2025.04（BOM −30%、Hailo 穩定度 +50%、樹莓派 5 成本 −80%）
   - 軟韌體工程師｜原妙醫學 2021.11–2024.08（韌體穩定度 +30%、SGS ESD/EMI、多國上市許可、GitHub 版控、NAS）
4. 專案經歷：四張卡（醫療模擬器 G3／G2、一次性插管器材、重複性插管器材），各含角色 chip + bullet + 技術標籤
5. 作品集：四張卡含截圖（n8nManager／部落格／ISET2021／ISET2020），astro:assets `<Image>`，附專案/GitHub 連結
6. 聯絡我：email `frank@frankchen.tw`、地點「台南，台灣」、聯絡表單連結、社群連結（GitHub／LinkedIn／Threads／Buy Me a Coffee）

bullet 與標籤文字以 `personal/index.html` 為準，逐字移植。

### /articles/

- `getCollection('posts', ({data}) => !data.draft)`，依 `date` 由新到舊排序
- 標題「文章」+ `CategoryBar active="all"`
- `ArticleCard` 均一網格（3 欄 → 手機 1 欄），全部列出、不分頁、不做 client 篩選

### /category/[category]/

- `getStaticPaths`：只為「實際有文章」的分類產出路徑（避免空頁 404）
- 每頁：標題 `{label}` + 該分類文章數 + `CategoryBar active={slug}` + `ArticleCard` 網格
- OG title 用 `{label}`

### 首頁 index.astro 修正

- 分類卡改 `CATEGORIES.map`，文章數即時計算
- 修掉 `/category/deployment/` → 正確 slug `/category/devops/`
- 「專案作品」區塊維持現狀（已連 /about/）
- 加 `ogImage="/cover.webp"`

### /privacy-policy/

貼合靜態站現況改寫，不照搬 WordPress 原文（本站無留言、無登入、無 Gravatar、無分析）：

- 我們是誰：網站網址 `https://www.frankchen.tw`、聯絡 `frank@frankchen.tw`
- 蒐集與分析：本站為靜態網站，不主動蒐集個人資料、未掛分析工具（已 grep 確認無 analytics/gtag）
- 第三方嵌入內容：保留（文章可能嵌圖片/影片）
- 你的權利與聯絡方式：保留，導到聯絡 email
- 移除：留言、Gravatar、登入/密碼重設、使用者註冊段落
- 版面：`BaseLayout` 單欄文章排版，沿用內文樣式

### SEO

- cover OG：`public/cover.webp`，/about/ 與首頁傳 `ogImage="/cover.webp"`
- Person JSON-LD：/about/ 注入 ProfilePage/Person（jobTitle、skills、sameAs），移植自 portfolio
- /articles/、/category/ 沿用站台預設 SEO，不另設 OG 圖

### 導覽收尾

- Nav 移除 `/n8n-resources/`
- Footer `/privacy-policy/` 本次補上對應頁，不再死連結

## 測試策略

專案無 test/lint，靠 build + 人工驗收：

- `npm run build` 必須過（含 4 個分類頁 getStaticPaths、astro:assets 圖片優化、content schema）
- 人工驗收：
  - /about/ 六區塊、cover、截圖、Person JSON-LD 正常
  - /articles/ 列出全部非草稿文章、CategoryBar 切換正確
  - 每個 /category/ 頁文章數正確、無文章的分類不產頁
  - 首頁分類卡連結與數字正確、無 `/category/deployment/`
  - /privacy-policy/ 內容貼合靜態站
  - Nav 不再有 `/n8n-resources/` 死連結
  - cover 為 /about/ 與首頁的 og:image
  - view transition 動畫正常

## 決策摘要

- D1：CATEGORIES 有序清單當單一來源，採口語 label
- D2：cover.webp 放 public/，當 hero + OG，不走 astro:assets
- D3：分類頁只為有文章的分類產 path
- D4：/articles/ 不做 client 篩選、不分頁（35 篇規模）
- D5：隱私權政策貼合靜態站、不照搬 WordPress
- D6：about/聯絡 email 統一 frank@frankchen.tw
- D7：不做 /n8n-resources/，Nav 移除其連結
