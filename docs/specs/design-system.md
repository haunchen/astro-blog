---
domain: design-system
status: draft
created: 2026-07-06
last_modified: 2026-07-06
---

# Design System

全站視覺樣式的跨頁面不變量：品牌色半透明宣告的漸進增強寫法，與 e-ink hover 效果的驅動方式。約束所有引用 design token 的 scoped CSS，確保新頁面沿用同一標準、不重新引入舊瀏覽器 regression 或 dead code。

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

## Design Decisions

### D1: fallback 在前、color-mix 在後
- **Decision**: pair 的兩行順序固定為 rgba 在前、color-mix 在後
- **Rationale**: CSS 後宣告勝出，現代瀏覽器最終採用 color-mix；舊瀏覽器解析 color-mix 失敗整條丟棄、保留較早的 rgba。順序反過來會讓現代瀏覽器停在 rgba、失去 color-mix 的意義
- **Date**: 2026-07-06

### D2: TagBadge 等既有 pair 為標準範本，非殘留
- **Decision**: `TagBadge.astro`、`ResourceCard.astro`、`n8n-resources.astro` 已成對的 rgba+color-mix 宣告視為正確標準，不清除
- **Rationale**: git log 佐證（PR #10 commit「add rgba fallback before color-mix」）rgba 行是刻意補的舊瀏覽器 fallback；清掉會在 iOS 15 前 Safari 引入 regression（#15 第 2 項駁回理由）
- **Date**: 2026-07-06

## Pending Changes

<!-- Brownfield delta 放這裡，finish spec sync 時清除 -->
