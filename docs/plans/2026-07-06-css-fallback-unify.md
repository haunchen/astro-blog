# CSS fallback pair 統一 + dead transition 清理 Implementation Plan

Goal: 全站品牌色半透明宣告統一為「rgba fallback ＋ color-mix」兩行 pair，並移除 7 處 eink hover 的 dead transition。

Architecture: 純 scoped CSS 機械改寫，零行為變化（色值等值）。按檔案拆 task，每個 task 只改一個檔案（避免 execute 平行 subagent 撞同檔），最後一個 task 做全站 build + grep 驗收。無測試框架（專案未配置 test/lint），驗收靠 `npm run build` 綠 + grep pair 檢查 + 目視。

Tech Stack: Astro v5 scoped `<style>` + `src/styles/global.css`，CSS `color-mix()` / `rgba()`。

Spec: `docs/specs/design-system.md`（draft，R1/R2/R3）

Design: `docs/plans/2026-07-06-css-fallback-unify-design.md`

---

## 執行注意（所有 task 共通）

1. **縮排精確**：`global.css` 用 **2 空格**縮排；所有 `.astro` scoped `<style>` 用 **4 空格**縮排。old_string / new_string 必須逐字（含前導空格）對上，否則 Edit 失敗。
2. **300ms steps(3) ≠ 500ms steps(4)**：A/B 段連結那行 `transition: ... 300ms steps(3) ...` 是**有作用的**（hover 有改 border/background），**不可動**。只有 D 段的 `transition: border-color 500ms steps(4);` 是 dead code 要刪。
3. **勿動既有正確 pair**：`TagBadge.astro`、`ResourceCard.astro:96-104`、`n8n-resources.astro` 既有的 4 組 color-mix pair 都是標準寫法，不在本計畫範圍，別誤改。
4. **行號僅供定位參考**，以 old_string 內容為準。

---

## D 段：移除 dead transition（Task 1-5）

### Task 1: ArticleCard.astro 移除 2 處 dead transition

Implements: `design-system.md` #R3

Files:
- Modify: `src/components/ArticleCard.astro`

Step 1: 刪除 `.card` 的 dead transition（Edit）
old_string:
```
    overflow: hidden;
    transition: border-color 500ms steps(4);
    text-decoration: none;
```
new_string:
```
    overflow: hidden;
    text-decoration: none;
```

Step 2: 刪除 `.card--featured` 的 dead transition（Edit）
old_string:
```
    color: inherit;
    transition: border-color 500ms steps(4);
  }

  .card--featured:hover {
```
new_string:
```
    color: inherit;
  }

  .card--featured:hover {
```

Step 3: Commit
Run: `git add -A && git commit -m "fix(css): 移除 ArticleCard dead transition (#19)"`

---

### Task 2: ResourceCard.astro 移除 dead transition

Implements: `design-system.md` #R3

Files:
- Modify: `src/components/ResourceCard.astro`

注意：只刪 `.res-card` 的 `transition` 行。ResourceCard 的 `border-bottom` / `background-color` color-mix pair（約 96-104 行）是既有正確 pattern，勿動。

Step 1: 刪除 `.res-card` 的 dead transition（Edit）
old_string:
```
    padding: 20px;
    transition: border-color 500ms steps(4);
  }
```
new_string:
```
    padding: 20px;
  }
```

Step 2: Commit
Run: `git add -A && git commit -m "fix(css): 移除 ResourceCard dead transition (#19)"`

---

### Task 3: CategoryGrid.astro 移除 dead transition

Implements: `design-system.md` #R3

Files:
- Modify: `src/components/CategoryGrid.astro`

Step 1: 刪除 `.category-card` 的 dead transition（Edit）
old_string:
```
    color: inherit;
    transition: border-color 500ms steps(4);
  }
```
new_string:
```
    color: inherit;
  }
```

Step 2: Commit
Run: `git add -A && git commit -m "fix(css): 移除 CategoryGrid dead transition (#19)"`

---

### Task 4: [...slug].astro 移除 dead transition

Implements: `design-system.md` #R3

Files:
- Modify: `src/pages/[...slug].astro`

Step 1: 刪除 `.article-nav-item` 的 dead transition（Edit）
old_string:
```
    border-radius: var(--radius-md);
    transition: border-color 500ms steps(4);
  }

  .article-nav-item:hover {
```
new_string:
```
    border-radius: var(--radius-md);
  }

  .article-nav-item:hover {
```

Step 2: Commit
Run: `git add -A && git commit -m "fix(css): 移除 article-nav dead transition (#19)"`

---

### Task 5: n8n-resources.astro 移除 dead transition

Implements: `design-system.md` #R3

Files:
- Modify: `src/pages/n8n-resources.astro`

注意：只刪 `.official-link` 的 `transition` 行。該檔既有 4 組 color-mix pair（191-192,198-199,250-251,258-259）勿動。

Step 1: 刪除 `.official-link` 的 dead transition（Edit）
old_string:
```
    border-radius: var(--radius-md);
    transition: border-color 500ms steps(4);
  }

  .official-link:hover {
```
new_string:
```
    border-radius: var(--radius-md);
  }

  .official-link:hover {
```

Step 2: Commit
Run: `git add -A && git commit -m "fix(css): 移除 official-link dead transition (#19)"`

---

## A + D 段：index.astro（Task 6，該檔同時含 A 與 D，合一 task）

### Task 6: index.astro 補 color-mix pair（4 處）+ 移除 project-card dead transition

Implements: `design-system.md` #R1, #R3

Files:
- Modify: `src/pages/index.astro`

注意：`.section-link`(181) 與 `.project-link`(306) 的 `border-bottom` rgba 行完全相同；hover background(187,312) 也相同。兩處補的 color-mix 一致，故用 **replace_all** 一次補齊。project-card 的 `500ms steps(4)` transition 全檔僅一處，直接刪。

Step 1: 補 border-bottom color-mix（Edit，`replace_all: true`）
old_string:
```
    border-bottom: 2px solid rgba(251, 146, 60, 0.4);
```
new_string:
```
    border-bottom: 2px solid rgba(251, 146, 60, 0.4);
    border-bottom: 2px solid color-mix(in srgb, var(--color-brand-orange) 40%, transparent);
```

Step 2: 補 hover background color-mix（Edit，`replace_all: true`）
old_string:
```
    background-color: rgba(251, 146, 60, 0.1);
```
new_string:
```
    background-color: rgba(251, 146, 60, 0.1);
    background-color: color-mix(in srgb, var(--color-brand-orange) 10%, transparent);
```

Step 3: 移除 `.project-card` dead transition（Edit）
old_string:
```
    overflow: hidden;
    transition: border-color 500ms steps(4);
  }
```
new_string:
```
    overflow: hidden;
  }
```

Step 4: Commit
Run: `git add -A && git commit -m "fix(css): index.astro 補 color-mix pair + 清 dead transition (#19)"`

---

## A 段：其餘 rgba-only 補 color-mix（Task 7-10）

### Task 7: global.css 補 color-mix pair（2 處）

Implements: `design-system.md` #R1

Files:
- Modify: `src/styles/global.css`

注意：**global.css 縮排是 2 空格**（非 4）。

Step 1: 補 `.prose a` border-bottom color-mix（Edit）
old_string:
```
  border-bottom: 2px solid rgba(251, 146, 60, 0.4);
  transition: border-color 300ms steps(3), background-color 300ms steps(3);
}
```
new_string:
```
  border-bottom: 2px solid rgba(251, 146, 60, 0.4);
  border-bottom: 2px solid color-mix(in srgb, var(--color-brand-orange) 40%, transparent);
  transition: border-color 300ms steps(3), background-color 300ms steps(3);
}
```

Step 2: 補 `.prose a:hover` background color-mix（Edit）
old_string:
```
  background-color: rgba(251, 146, 60, 0.1);
}
```
new_string:
```
  background-color: rgba(251, 146, 60, 0.1);
  background-color: color-mix(in srgb, var(--color-brand-orange) 10%, transparent);
}
```

Step 3: Commit
Run: `git add -A && git commit -m "fix(css): global.css .prose a 補 color-mix pair (#19)"`

---

### Task 8: ArticleTimeline.astro 補 color-mix pair（2 處）

Implements: `design-system.md` #R1

Files:
- Modify: `src/components/ArticleTimeline.astro`

Step 1: 補 border-bottom color-mix（Edit）
old_string:
```
    border-bottom: 2px solid rgba(251, 146, 60, 0.4);
    transition: border-color 300ms steps(3), background-color 300ms steps(3);
  }
```
new_string:
```
    border-bottom: 2px solid rgba(251, 146, 60, 0.4);
    border-bottom: 2px solid color-mix(in srgb, var(--color-brand-orange) 40%, transparent);
    transition: border-color 300ms steps(3), background-color 300ms steps(3);
  }
```

Step 2: 補 hover background color-mix（Edit）
old_string:
```
    background-color: rgba(251, 146, 60, 0.1);
  }
```
new_string:
```
    background-color: rgba(251, 146, 60, 0.1);
    background-color: color-mix(in srgb, var(--color-brand-orange) 10%, transparent);
  }
```

Step 3: Commit
Run: `git add -A && git commit -m "fix(css): ArticleTimeline 補 color-mix pair (#19)"`

---

### Task 9: category/[category].astro 補 color-mix pair（2 處）

Implements: `design-system.md` #R1

Files:
- Modify: `src/pages/category/[category].astro`

Step 1: 補 border-bottom color-mix（Edit）
old_string:
```
    border-bottom: 2px solid rgba(251, 146, 60, 0.4);
    transition: border-color 300ms steps(3), background-color 300ms steps(3);
  }
```
new_string:
```
    border-bottom: 2px solid rgba(251, 146, 60, 0.4);
    border-bottom: 2px solid color-mix(in srgb, var(--color-brand-orange) 40%, transparent);
    transition: border-color 300ms steps(3), background-color 300ms steps(3);
  }
```

Step 2: 補 hover background color-mix（Edit）
old_string:
```
    background-color: rgba(251, 146, 60, 0.1);
  }
```
new_string:
```
    background-color: rgba(251, 146, 60, 0.1);
    background-color: color-mix(in srgb, var(--color-brand-orange) 10%, transparent);
  }
```

Step 3: Commit
Run: `git add -A && git commit -m "fix(css): category 頁補 color-mix pair (#19)"`

---

### Task 10: tag/[tag].astro 補 color-mix pair（2 處）

Implements: `design-system.md` #R1

Files:
- Modify: `src/pages/tag/[tag].astro`

Step 1: 補 border-bottom color-mix（Edit）
old_string:
```
    border-bottom: 2px solid rgba(251, 146, 60, 0.4);
    transition: border-color 300ms steps(3), background-color 300ms steps(3);
  }
```
new_string:
```
    border-bottom: 2px solid rgba(251, 146, 60, 0.4);
    border-bottom: 2px solid color-mix(in srgb, var(--color-brand-orange) 40%, transparent);
    transition: border-color 300ms steps(3), background-color 300ms steps(3);
  }
```

Step 2: 補 hover background color-mix（Edit）
old_string:
```
    background-color: rgba(251, 146, 60, 0.1);
  }
```
new_string:
```
    background-color: rgba(251, 146, 60, 0.1);
    background-color: color-mix(in srgb, var(--color-brand-orange) 10%, transparent);
  }
```

Step 3: Commit
Run: `git add -A && git commit -m "fix(css): tag 詳情頁補 color-mix pair (#19)"`

---

## A + C 段：tag/index.astro（Task 11，含 0.3→0.4 正規化）

### Task 11: tag/index.astro 正規化 0.3→0.4 + 補 color-mix pair（2 處）

Implements: `design-system.md` #R1, #R2

Files:
- Modify: `src/pages/tag/index.astro`

注意：`.tag-cloud-item` 的 border-bottom alpha 是 **0.3**（全站孤例），本 task 同時正規化為 0.4 並補 color-mix。

Step 1: 正規化 border-bottom 0.3→0.4 並補 color-mix（Edit）
old_string:
```
    border-bottom: 2px solid rgba(251, 146, 60, 0.3);
    transition: color 300ms steps(3), border-color 300ms steps(3), background-color 300ms steps(3);
```
new_string:
```
    border-bottom: 2px solid rgba(251, 146, 60, 0.4);
    border-bottom: 2px solid color-mix(in srgb, var(--color-brand-orange) 40%, transparent);
    transition: color 300ms steps(3), border-color 300ms steps(3), background-color 300ms steps(3);
```

Step 2: 補 hover background color-mix（Edit）
old_string:
```
    background-color: rgba(251, 146, 60, 0.1);
  }
```
new_string:
```
    background-color: rgba(251, 146, 60, 0.1);
    background-color: color-mix(in srgb, var(--color-brand-orange) 10%, transparent);
  }
```

Step 3: Commit
Run: `git add -A && git commit -m "fix(css): tag 標籤雲正規化 0.4 + 補 color-mix pair (#19)"`

---

## B 段：color-mix-only 補 rgba fallback（Task 12-13）

### Task 12: about.astro 補 rgba fallback（2 處）

Implements: `design-system.md` #R1

Files:
- Modify: `src/pages/about.astro`

注意：這兩處是 color-mix-only，rgba fallback 補在 color-mix 行的**前面**。

Step 1: 補 `.about-link` border-bottom rgba fallback（Edit）
old_string:
```
    border-bottom: 2px solid color-mix(in srgb, var(--color-brand-orange) 40%, transparent);
```
new_string:
```
    border-bottom: 2px solid rgba(251, 146, 60, 0.4);
    border-bottom: 2px solid color-mix(in srgb, var(--color-brand-orange) 40%, transparent);
```

Step 2: 補 `.about-link:hover` background rgba fallback（Edit）
old_string:
```
    background-color: color-mix(in srgb, var(--color-brand-orange) 10%, transparent);
```
new_string:
```
    background-color: rgba(251, 146, 60, 0.1);
    background-color: color-mix(in srgb, var(--color-brand-orange) 10%, transparent);
```

Step 3: Commit
Run: `git add -A && git commit -m "fix(css): about.astro 補 rgba fallback (#11 #19)"`

---

### Task 13: contact-frank.astro 補 rgba fallback（2 處）

Implements: `design-system.md` #R1

Files:
- Modify: `src/pages/contact-frank.astro`

Step 1: 補 `.contact-link` border-bottom rgba fallback（Edit）
old_string:
```
    border-bottom: 2px solid color-mix(in srgb, var(--color-brand-orange) 40%, transparent);
```
new_string:
```
    border-bottom: 2px solid rgba(251, 146, 60, 0.4);
    border-bottom: 2px solid color-mix(in srgb, var(--color-brand-orange) 40%, transparent);
```

Step 2: 補 `.contact-link:hover` background rgba fallback（Edit）
old_string:
```
    background-color: color-mix(in srgb, var(--color-brand-orange) 10%, transparent);
```
new_string:
```
    background-color: rgba(251, 146, 60, 0.1);
    background-color: color-mix(in srgb, var(--color-brand-orange) 10%, transparent);
```

Step 3: Commit
Run: `git add -A && git commit -m "fix(css): contact-frank.astro 補 rgba fallback (#11 #19)"`

---

## C 段選配：404.astro 品牌藍 pair（Task 14）

### Task 14: 404.astro 品牌藍補 color-mix pair

Implements: `design-system.md` #R1

Files:
- Modify: `src/pages/404.astro`

Step 1: 補 `.btn--outline:hover` background color-mix（Edit）
old_string:
```
    background: rgba(0, 132, 255, 0.1);
```
new_string:
```
    background: rgba(0, 132, 255, 0.1);
    background: color-mix(in srgb, var(--color-brand-blue) 10%, transparent);
```

Step 2: Commit
Run: `git add -A && git commit -m "fix(css): 404 品牌藍補 color-mix pair (#19)"`

---

## 驗收（Task 15）

### Task 15: 全站 build + grep 驗收

Files: 無（純驗證）

Step 1: build 綠
Run: `npm run build`
Expected: 成功，無錯誤

Step 2: 每個 color-mix 命中行的前一行都是同屬性 rgba（人工掃描輸出）
Run: `grep -rn -B1 "color-mix" src/`
Expected: 每個 color-mix 行的前一行皆為同屬性 rgba 宣告（TagBadge/ResourceCard/n8n-resources 既有 pair 亦成對）

Step 3: 每個品牌橙 rgba 命中行的後一行都是同屬性 color-mix
Run: `grep -rn -A1 "rgba(251" src/`
Expected: 每個 rgba(251...) 行的後一行皆為同屬性 color-mix 宣告

Step 4: dead transition 已清除、einkRefresh 動畫保留
Run: `grep -rn "steps(4)" src/`
Expected: 不再出現任何 `transition: border-color 500ms steps(4)`；`animation: einkRefresh 500ms steps(4) forwards` 仍在 7 處

Step 5: 確認 0.3 孤例已消除
Run: `grep -rn "rgba(251, 146, 60, 0.3)" src/`
Expected: 無輸出

Step 6: 目視（手動，非阻斷）
Run: `npm run dev`
Expected: 首頁 section/project link 底線與 hover、文章內文連結、卡片 hover 閃爍，與修改前一致（零視覺變化；唯 tag/index 底線極輕微加深屬預期）

Step 7: 無需 commit（純驗證）。若任一步驟不符，回對應 task 修正。
