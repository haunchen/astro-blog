# 全站 CSS fallback pair 統一 + dead transition 清理 — 設計文件

- 日期：2026-07-06
- 分支：`fix/css-fallback-unify`
- 對應 issue：#19（parent #22）；關 #11 全部、#15 第 1/3 項
- 性質：零行為變化的機械式技術債清理（scoped CSS）

## 目標

1. 全站品牌色半透明宣告統一為「rgba fallback ＋ color-mix」兩行 pair（fallback 在前、color-mix 在後），讓 iOS 15／Safari 16.2 前的舊瀏覽器退回吃 rgba、現代瀏覽器吃 color-mix，兩者渲染等值。
2. 移除全站 eink 卡片／連結 hover 的 dead transition（`transition: border-color 500ms steps(4)`）——閃爍效果 100% 由 `animation: einkRefresh ... forwards` 驅動，hover 從不直接改 border-color base 值，transition 永不觸發。

## 慣例（單一標準）

品牌橙 `--color-brand-orange: #fb923c` = rgb(251, 146, 60)。所有引用品牌色的半透明宣告寫成同屬性兩行：

```css
<屬性>: rgba(251, 146, 60, <alpha>);
<屬性>: color-mix(in srgb, var(--color-brand-orange) <alpha*100>%, transparent);
```

標準範本：`src/components/TagBadge.astro:25-26,35-36`。兩行在現代瀏覽器等值（後宣告勝出），舊瀏覽器不認 color-mix 會整條丟棄、退回 rgba。

## 變更清單

行號為 2026-07-06 驗證快照（已對照確認與 7/5 issue 快照一致、未偏移）。執行時仍以「選擇器＋屬性」內容定位。

### A. rgba-only → 在該行「後」補 color-mix（14 處）

| 檔案 | 選擇器 | 屬性 | 濃度 |
|---|---|---|---|
| `src/pages/index.astro:181` | `.section-link` | border-bottom | 40% |
| `src/pages/index.astro:187` | `.section-link:hover` | background-color | 10% |
| `src/pages/index.astro:306` | `.project-link` | border-bottom | 40% |
| `src/pages/index.astro:312` | `.project-link:hover` | background-color | 10% |
| `src/styles/global.css:152` | `.prose a` | border-bottom | 40% |
| `src/styles/global.css:158` | `.prose a:hover` | background-color | 10% |
| `src/components/ArticleTimeline.astro:91` | 文內連結 | border-bottom | 40% |
| `src/components/ArticleTimeline.astro:97` | hover | background-color | 10% |
| `src/pages/category/[category].astro:49` | 連結 | border-bottom | 40% |
| `src/pages/category/[category].astro:55` | hover | background-color | 10% |
| `src/pages/tag/index.astro:61` | 連結 | border-bottom | 40%（見 C 正規化） |
| `src/pages/tag/index.astro:68` | hover | background-color | 10% |
| `src/pages/tag/[tag].astro:48` | 連結 | border-bottom | 40% |
| `src/pages/tag/[tag].astro:54` | hover | background-color | 10% |

### B. color-mix-only → 在該行「前」補 rgba fallback（4 處，即 #11 全部）

| 檔案 | 選擇器 | 屬性 | fallback 值 |
|---|---|---|---|
| `src/pages/about.astro:431` | `.about-link` | border-bottom | `rgba(251, 146, 60, 0.4)` |
| `src/pages/about.astro:437` | `.about-link:hover` | background-color | `rgba(251, 146, 60, 0.1)` |
| `src/pages/contact-frank.astro:80` | `.contact-link` | border-bottom | `rgba(251, 146, 60, 0.4)` |
| `src/pages/contact-frank.astro:86` | `.contact-link:hover` | background-color | `rgba(251, 146, 60, 0.1)` |

### C. 正規化（2 處）

- `src/pages/tag/index.astro:61`：border-bottom alpha 為 **0.3**（全站孤例，其餘皆 0.4）。統一改 0.4，color-mix 用 40%。有極輕微加深，屬預期。
- `src/pages/404.astro:110`：品牌藍 `background: rgba(0, 132, 255, 0.1)` → 後補 `color-mix(in srgb, var(--color-brand-blue) 10%, transparent)`。issue #19 原標「選配」，但這是品牌色半透明宣告，屬 spec R1 範圍，本計畫納入為必做。

### D. dead transition 移除（7 處）

Issue #19 原列 3 處，本設計經 `grep -rn "steps(4)" src/` 全站掃描後補齊為 **7 處**——全部同款 dead pattern（base 有 transition、hover 只掛 einkRefresh 動畫、hover 不直接改 border-color base 值）。判定理由對 7 處字字相符，移除後視覺零變化。

| 檔案 | 選擇器 | issue 原列 |
|---|---|---|
| `src/components/ArticleCard.astro:47` | `.card` | ✅ |
| `src/components/ArticleCard.astro:133` | `.card--featured` | ✅ |
| `src/components/ResourceCard.astro:48` | `.res-card` | ✅ |
| `src/components/CategoryGrid.astro:38` | `.category-card` | 補 |
| `src/pages/index.astro:256` | `.project-card` | 補 |
| `src/pages/[...slug].astro:262` | `.article-nav-item` | 補 |
| `src/pages/n8n-resources.astro:278` | `.official-link` | 補 |

移除該 base 規則裡的 `transition: border-color 500ms steps(4);` 整行；hover 的 `animation: einkRefresh ...` 不動。

## 不可動（已是正確 pattern，勿誤清）

- `src/components/TagBadge.astro:25-26,35-36`（#15 第 2 項駁回：rgba 行是 PR #10 刻意補的 fallback）
- `src/components/ResourceCard.astro:96-97,103-104`
- `src/pages/n8n-resources.astro:191-192,198-199,250-251,258-259`

## 錯誤處理與風險

- 純 scoped CSS，色值等值改寫，無邏輯路徑、無 JS、無資料流。唯一可觀察差異＝tag/index 底線 0.3→0.4 的極輕微加深（預期）。
- 風險點：Edit 定位錯行導致補到別的選擇器。緩解＝以「選擇器＋屬性」內容定位、逐檔 grep 驗收。

## 測試策略（驗收）

1. `npm run build` 綠。
2. `grep -rn "color-mix" src/`：每個命中行的前一行都是同屬性 rgba 宣告。
3. `grep -rn "rgba(251" src/`：每個命中行的後一行都是同屬性 color-mix 宣告（TagBadge/ResourceCard/n8n-resources 既有 pair 除外，本就成對）。
4. `grep -rn "steps(4)" src/`：不再出現 `transition: border-color 500ms steps(4)`；`animation: einkRefresh ... steps(4)` 仍在（7 處）。
5. `npm run dev` 目視：首頁 section/project link、文章內文連結、卡片 hover 閃爍與修改前一致（零視覺變化）。

## 收尾（PR merge 後）

- PR 描述加 `Closes #11`。
- #15：勾第 1/3 項；第 2 項留言駁回理由（TagBadge rgba 為 PR #10 刻意 fallback，git 佐證）後 close。
- 註明 D 段由 issue 原 3 處擴充為 7 處（同款 dead pattern 一併清除）。
