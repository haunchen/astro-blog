# Architecture Verification — frankchen.tw

目標：在正式 MVP 開發前，用最少頁面驗證 Astro + Tailwind v4 + Design System 的實際呈現效果。
參考：`style-preview.html`（2,072 行 HTML 原型）

---

## 驗證範圍

| 驗證項目 | 對應頁面/元件 | 驗證重點 |
|---------|-------------|---------|
| Design tokens 轉換 | BaseLayout | CSS variables → Tailwind v4 `@theme` 語法是否正確映射 |
| 字型混排 | 文章頁 | Serif（Merriweather + Noto Serif TC）內文 + Sans UI + Mono 程式碼 |
| 邊框驅動層次 | 卡片、Nav | 無陰影架構下視覺層次是否清晰 |
| E-ink 效果 | 全站 | paper noise texture、card hover flash、page transition |
| 響應式 | 全部 | 720/960/1200px 三種寬度 + mobile 斷點 |
| Markdown 排版 | 文章頁 | prose 樣式、code block、blockquote、表格、圖片 |
| 側邊欄 sticky | 文章頁 | TOC 在捲過作者卡片後 sticky |

---

## 需要建立的頁面

### 1. BaseLayout（共用骨架）

所有頁面的外殼，驗證 Design System 基礎設施。

包含：
- `<head>`：meta、@fontsource 字型載入、astro-seo
- CSS：Tailwind v4 `@theme` 定義所有 design tokens
- E-ink paper noise texture overlay（`body::after`）
- View Transitions（E-ink exit/enter keyframes）
- `prefers-reduced-motion` 支援
- slot 區域

CSS variables 來源（從 style-preview.html 提取）：

```
背景：--bg-primary #0f172a / --bg-secondary #212a37 / --bg-tertiary #152030 / --bg-elevated #222222
文字：--text-primary #E2E8F0 / --text-secondary #94A3B8 / --text-muted #64748B
品牌：--brand-blue #0084ff / --brand-orange #fb923c
邊框：--border-default #4f5b62 / --border-subtle #2d3a47 / --border-strong #6b7b86
```

### 2. Navigation 元件

```
[Logo]  n8n 資源 | 文章 | 關於我  [GitHub] [Threads]
─────────────────────────────────────────────────────
bg-secondary / 64px 高 / sticky top / 底部 1px border-default
Mobile: 漢堡選單
```

### 3. Footer 元件

```
─────────────────────────────────────────────────────
連結列 + 社群圖示 + © 2026 Frank Chen
bg-secondary / 上方 1px border-default
```

### 4. 首頁 `/`（max-width: 1200px）

驗證重點：多種元件組合、卡片網格、主題格
區塊：
- Hero：Serif h1 + 副標題 + 3 個身份 tag
- 最新文章：4 卡片網格（desktop 2 欄 / mobile 1 欄）
- 主題探索：2x2 分類卡片（連結到 `/articles/?category={name}`）
- 精簡介紹：頭像 96px + bio + 技能 tag + 「更多 →」
- 專案精選：3 欄網格（mobile 1 欄）

### 5. 文章頁 `/{slug}/`（max-width: 720px + aside）

驗證重點：Markdown 排版品質、側邊欄行為、程式碼區塊
結構：
- Header：分類 tag + 日期 + Serif h1 + 閱讀時間
- 封面圖：full-width
- 內文：720px Markdown prose
- Aside（desktop only, >=1024px）：
  - 作者卡片（40px 頭像 + 名稱 + bio）
  - 相關文章（3 篇）
  - TOC（sticky，捲過上方 widget 後才吸附）
- 上下篇導航
- giscus 留言區（placeholder 即可）

需要一篇測試文章，包含所有 Markdown 元素：
- h2, h3, h4
- 段落、粗體、斜體、連結
- 有序/無序列表
- code block（多語言）+ inline code
- blockquote
- 表格
- 圖片（含 caption）

### 6. 404 頁面

驗證 E-ink glitch 動畫效果：

```
    404
（einkGlitch 動畫）

找不到這個頁面
[← 回首頁]
```

---

## 不在此階段的頁面

| 頁面 | 原因 |
|------|------|
| `/articles/` 文章列表 | 需要多篇文章資料，架構驗證用 1 篇即可 |
| `/about/` 關於我 | 內容密集但元件類型與首頁重疊 |
| `/privacy-policy/` | 純文字頁，無新元件 |
| `/n8n-resources/` | MVP 後 |
| `/category/{name}/` | MVP 後 |
| `/contact/` | MVP 後 |

---

## 預期檔案結構

```
astro-blog/
├── src/
│   ├── layouts/
│   │   └── BaseLayout.astro          # 共用骨架 + design tokens
│   ├── components/
│   │   ├── Nav.astro                 # 導覽列
│   │   ├── Footer.astro              # 頁尾
│   │   ├── ArticleCard.astro         # 文章卡片（首頁/列表共用）
│   │   ├── TagBadge.astro            # 橘色螢光筆標籤
│   │   └── TableOfContents.astro     # 側邊 TOC
│   ├── styles/
│   │   └── global.css                # @theme tokens + E-ink effects + prose
│   ├── content/
│   │   ├── config.ts                 # Content Collection schema
│   │   └── posts/
│   │       └── test-markdown-rendering/
│   │           ├── index.md          # 測試文章（涵蓋所有 MD 元素）
│   │           └── images/
│   │               └── cover.png     # 測試封面圖
│   └── pages/
│       ├── index.astro               # 首頁
│       ├── 404.astro                 # 404 E-ink glitch
│       └── [...slug].astro           # 文章動態路由
├── public/
│   └── favicon.svg
├── astro.config.mjs
├── tailwind.config.ts                # 如 v4 需要
├── package.json
└── docs/
    └── architecture-verification.md  # 本文件
```

---

## Content Collection Schema

```typescript
// src/content/config.ts
import { defineCollection, z } from 'astro:content';

const posts = defineCollection({
  type: 'content',
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

---

## 技術堆疊

| 項目 | 選擇 |
|------|------|
| 框架 | Astro（純 SSG） |
| CSS | Tailwind CSS v4（`@theme` 語法） |
| 字型 | @fontsource（Merriweather, Inter, JetBrains Mono, Noto TC） |
| 語法高亮 | Shiki（Astro 內建，tokyo-night 主題） |
| SEO | astro-seo |
| 部署 | Cloudflare Pages |

---

## 驗收標準

完成後逐項確認：

- [ ] Design tokens：Tailwind v4 `@theme` 輸出的 CSS variables 與 style-preview.html 一致
- [ ] 字型：Serif/Sans/Mono 三種字型在對應場景正確載入，中文 fallback 正常
- [ ] 色彩：背景、文字、品牌色、邊框色在各元件正確呈現
- [ ] 邊框層次：卡片、Nav、Footer 的邊框驅動層次清晰可辨
- [ ] E-ink noise：body::after paper texture 可見但不干擾閱讀
- [ ] E-ink transition：頁面切換時 exit/enter 動畫觸發
- [ ] 卡片 hover：einkRefresh 閃爍效果
- [ ] 404 glitch：einkGlitch 動畫循環播放
- [ ] Markdown prose：h2-h4、列表、code block、blockquote、表格、圖片排版正確
- [ ] Code block：Shiki 語法高亮 + bg-tertiary 背景 + 圓角 4px
- [ ] TOC sticky：捲過作者卡片後吸附
- [ ] 響應式 1200px：首頁正確
- [ ] 響應式 960px：寬版容器正確
- [ ] 響應式 720px：文章內文正確
- [ ] 響應式 mobile：漢堡選單、單欄堆疊
- [ ] prefers-reduced-motion：所有動畫停用
