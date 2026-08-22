---
domain: design-system
status: active
created: 2026-07-06
last_modified: 2026-08-22
---

# Design System

全站視覺樣式的跨頁面不變量：品牌色半透明宣告的漸進增強寫法、e-ink hover 效果的驅動方式，與鍵盤焦點指示。約束所有引用 design token 的 scoped CSS，確保新頁面沿用同一標準、不重新引入舊瀏覽器 regression 或 dead code。

## Requirements

### R1: 品牌色半透明宣告採漸進增強 pair
- **Level**: MUST
- **Description**: 全站任何引用品牌色（`--color-brand-orange`、`--color-brand-blue`）的半透明宣告，一律寫成同一 CSS 屬性連續兩行——先 `rgba(...)` fallback、後 `color-mix(in srgb, var(--color-brand-*) N%, transparent)`，兩者色值等值。現代瀏覽器渲染 color-mix，不支援 color-mix 的舊瀏覽器（iOS 15／Safari 16.2 前）退回 rgba，兩者視覺一致。不得只寫 rgba（缺現代語意來源）或只寫 color-mix（舊瀏覽器整條丟棄變透明）。

### R2: 品牌色半透明濃度全站一致
- **Level**: SHOULD
- **Description**: 同一用途的品牌色半透明濃度全站統一——連結底線 `border-bottom` 用 40%、hover 背景 `background-color` 用 10%。不得出現孤例濃度（如 0.3）造成同類元件視覺不一致。

### R3: e-ink hover 效果僅由 einkRefresh 動畫驅動
- **Level**: MUST
- **Description**: 卡片／連結的 e-ink 邊框閃爍 hover 效果由 `:hover` 上的 `animation: einkRefresh ... steps(4) forwards` 單獨驅動。base 選擇器不得保留 `transition: border-color ...`——`:hover` 從不直接改 border-color base 值，該 transition 永不觸發，屬 dead code，會誤導後續維護者以為有 transition 語意。

### R4: 鍵盤焦點指示由 global.css 的單一 `:focus-visible` 規則供應
- **Level**: MUST
- **Description**: 全站的鍵盤焦點外框只由 `src/styles/global.css` 的裸選擇器 `:focus-visible` 定義（`2px solid var(--color-brand-orange)` + `outline-offset: 2px`），元件的 scoped CSS 不得各自宣告焦點樣式。唯一豁免是 `#main-content`——skip-link 的落點，`:focus` 與 `:focus-visible` 兩邊都寫 `outline: none`，不把整塊 `<main>` 圈起來。任何位置都不得寫 `:focus { outline: none }` 去清瀏覽器預設外框：不支援 `:focus-visible` 的瀏覽器會因此完全失去焦點指示。

## Scenarios

### S1: 舊瀏覽器開啟品牌色連結
- **Given**: 使用者用 iOS 15 前的 Safari（不支援 color-mix）
- **When**: 瀏覽含品牌色底線／hover 背景的連結（首頁 section link、文章內文連結等）
- **Then**: 瀏覽器丟棄 color-mix 行、退回吃前一行 rgba，連結底線與 hover 背景正常顯示品牌橙半透明，不變全透明
- **Implements**: #R1

### S2: 現代瀏覽器 hover 卡片
- **Given**: 使用者用支援 color-mix 的現代瀏覽器
- **When**: 滑鼠移入 eink 卡片（ArticleCard、CategoryGrid、project-card 等）
- **Then**: 邊框以 einkRefresh 動畫閃爍後停在終態；移除 base 的 transition 後閃爍效果與先前完全一致
- **Implements**: #R3

### S3: 鍵盤導覽與滑鼠點擊的焦點表現
- **Given**: 讀者在任一頁面
- **When**: 用 Tab 移動到互動元素（nav 連結、文章卡、TOC 項目、偏好來源 CTA 等）
- **Then**: 該元素外緣 2px 處出現橘色實線外框；改用滑鼠點擊同一元素時不出現外框
- **Implements**: #R4

### S4: skip-link 跳轉後不圈住整塊內容
- **Given**: 讀者用鍵盤啟用 skip to content
- **When**: 焦點被程式化移到 `#main-content`
- **Then**: 頁面捲到內文起點，`<main>` 不出現任何焦點外框
- **Implements**: #R4

## Design Decisions

### D1: fallback 在前、color-mix 在後
- **Decision**: pair 的兩行順序固定為 rgba 在前、color-mix 在後
- **Rationale**: CSS 後宣告勝出，現代瀏覽器最終採用 color-mix；舊瀏覽器解析 color-mix 失敗整條丟棄、保留較早的 rgba。順序反過來會讓現代瀏覽器停在 rgba、失去 color-mix 的意義
- **Date**: 2026-07-06

### D2: TagBadge 等既有 pair 為標準範本，非殘留
- **Decision**: `TagBadge.astro`、`ResourceCard.astro`、`n8n-resources.astro` 已成對的 rgba+color-mix 宣告視為正確標準，不清除
- **Rationale**: git log 佐證（PR #10 commit「add rgba fallback before color-mix」）rgba 行是刻意補的舊瀏覽器 fallback；清掉會在 iOS 15 前 Safari 引入 regression（#15 第 2 項駁回理由）
- **Date**: 2026-07-06

### D3: 焦點外框用 brand-orange，不用 brand-blue
- **Decision**: `:focus-visible` 的 outline 顏色取 `--color-brand-orange`
- **Rationale**: 橘色是站上既有的互動語彙——連結底線（R2 的 40%）與 hover 背景（10%）都用它，焦點指示跟著同一條線最不突兀。藍色則有實際衝突：404 頁的 `.btn` 是 `--color-brand-blue` 實心底，藍框畫在藍底按鈕旁切不開。`outline-offset: 2px` 讓外框落在元素外緣的頁面底色（`#0f172a` 或 `#212A37`）上，橘色在兩者上都遠超 WCAG 2.2 SC 1.4.11 要求的 3:1
- **Date**: 2026-08-22

### D4: 只加 `:focus-visible`，不清 `:focus` 的瀏覽器預設
- **Decision**: 不寫 `:focus { outline: none }`，也不對 `:focus-visible` 以外的狀態做任何焦點宣告
- **Rationale**: 常見寫法是先 reset 掉全部預設外框再自訂，但那樣不支援 `:focus-visible` 的瀏覽器會退化成「完全沒有焦點指示」，比預設外框不好看嚴重得多。現代瀏覽器本來就只在 `:focus-visible` 命中時才畫預設外框，這條規則直接覆蓋它，沒有需要先清掉的重疊
- **Date**: 2026-08-22
