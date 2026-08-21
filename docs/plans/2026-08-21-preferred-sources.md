# Google Preferred Sources 行動號召 Implementation Plan

Goal: 在文章頁側邊欄與全站 footer 各放一個入口，讓讀者把 frankchen.tw 設為 Google 偏好來源，
並讓兩個入口的點擊可分別統計。

Architecture: 新增一個 `PreferredSource.astro` 元件，唯一的 prop 是放置點（`aside` / `footer`），
同時決定外觀形態與 UTM 版位標記。deep link 由 `src/utils/site-meta.ts` 的
`preferredSourceUrl()` 組出，網域取自 `SITE.url` 的 hostname。成效靠站上既有 GA4 增強型評估的
外連點擊事件回收 UTM，不新增任何 client 端腳本。

Tech Stack: Astro v5、TypeScript strict、Astro scoped style、既有 design token（`global.css`）

Spec: `docs/specs/preferred-sources.md`

Design: `docs/plans/2026-08-21-preferred-sources-design.md`

Context: 專案無 `CONTEXT.md`

## Global Constraints

- deep link 的網域與 `utm_source` 一律取自 `SITE.url` 的 hostname，repo 內不得出現第二份網域字面值
- 連結一律 `target="_blank"` 加 `rel="noopener noreferrer"`（`docs/specs/site-pages.md` R19）
- 品牌色半透明宣告一律成對：`rgba(...)` 在前、`color-mix(in srgb, var(--color-brand-*) N%, transparent)` 在後，色值等值（`design-system.md` R1）
- 濃度固定：邊框 40%、hover 背景 10%（`design-system.md` R2）。`.community-btn` 現況的 12% 是既有孤例，不要照抄
- 不使用 `einkRefresh` 於本功能的任何 hover：該動畫會把 `border-color` 掃到 `--color-border-strong`（灰），會蓋掉橘框
- 站台自身不新增任何色票，全部走 `global.css` 既有 CSS 變數；Google 標誌的四個品牌色寫在 SVG 的 `fill` 屬性上，不進 design token
- Google 標誌原樣使用：不改色、不改比例、不加外框或陰影、不與本站標誌組合成共同品牌，只可整體縮放
- 不修改 `public/robots.txt`、`src/pages/llms.txt.ts`、任何 JSON-LD，不修改任何 `scripts/verify-*.mjs`
- 不新增 client 端腳本、不修改 `public/_headers` 的 CSP、不新增站內轉址路徑
- 不寫 `<script is:inline>`（`docs/SEO_GUIDE.md` CSP 節）
- 文案一律正體中文台灣用語
- 每個 task 以一次 commit 收尾

---

### Task 1: deep link 的單一來源

Implements: `preferred-sources.md` #R1, #R7

Files:
- Modify: `src/utils/site-meta.ts`（在 `SITE` 常數之後、`OG_FALLBACK` 之前插入）

Interfaces:
- Consumes: `SITE.url`（既有常數，值為 `'https://frankchen.tw'`）
- Produces: `preferredSourceUrl(placement: string): string` — 回傳含 `q` 與四個 UTM 參數的完整絕對網址

Step 1: 插入函式

在 `src/utils/site-meta.ts` 中，緊接在 `} as const;`（`SITE` 物件的結尾，約第 46 行）之後、
`/**\n * og:image 的站台預設值...` 註解之前，插入：

```ts
/**
 * Google Preferred Sources 的 deep link（見 docs/specs/preferred-sources.md）。
 *
 * 網域取自 SITE.url 而非再寫一份字面值：這支的 `q` 參數決定讀者會把「哪個站」設為偏好來源，
 * 寫死的話改站台網域時不會有任何東西報錯，只會靜靜指向舊網域。
 *
 * UTM 不是給 Google 看的——它進不了我們的報表。它是給本站 GA4 用的：增強型評估的外連點擊
 * 事件會記下完整的 link_url，`utm_content` 因此成為分辨版位的唯一依據。所以 placement 必須
 * 跟元件的放置點同值，不要各寫各的。
 */
export function preferredSourceUrl(placement: string): string {
  const host = new URL(SITE.url).hostname;
  const url = new URL('https://www.google.com/preferences/source');
  url.searchParams.set('q', host);
  url.searchParams.set('utm_source', host);
  url.searchParams.set('utm_medium', 'referral');
  url.searchParams.set('utm_campaign', 'preferred-sources');
  url.searchParams.set('utm_content', placement);
  return url.href;
}
```

Step 2: 型別檢查

Run: `npx astro check`
Expected: 沒有新增的 error。（既有 warning 若原本就存在則不算失敗，執行前可先在乾淨工作樹跑一次
留底作為對照。）

Step 3: 確認實際輸出的網址

Run:
```bash
node -e "
const SITE_URL='https://frankchen.tw';
const host=new URL(SITE_URL).hostname;
const u=new URL('https://www.google.com/preferences/source');
u.searchParams.set('q',host);
u.searchParams.set('utm_source',host);
u.searchParams.set('utm_medium','referral');
u.searchParams.set('utm_campaign','preferred-sources');
u.searchParams.set('utm_content','aside');
console.log(u.href);
"
```
Expected 逐字輸出：
```
https://www.google.com/preferences/source?q=frankchen.tw&utm_source=frankchen.tw&utm_medium=referral&utm_campaign=preferred-sources&utm_content=aside
```
（這一步是用等價的 JS 驗證組出來的字串長什麼樣，因為 `site-meta.ts` 是 TS、不在 `npm test`
的涵蓋範圍內——`npm test` 只跑 `scripts/lib/*.test.mjs`。）

Step 4: Commit

```bash
git add src/utils/site-meta.ts
git commit -m "feat(preferred-sources): deep link 的單一來源"
```

---

### Task 2: PreferredSource 元件

Implements: `preferred-sources.md` #R2, #R4, #R5, #R6, #R9

Files:
- Create: `src/components/PreferredSource.astro`

Interfaces:
- Consumes: `preferredSourceUrl(placement: string): string`（Task 1 加在 `src/utils/site-meta.ts`）
- Produces: 預設匯出的 Astro 元件，props 為 `{ placement: 'aside' | 'footer' }`

Step 1: 建立元件

建立 `src/components/PreferredSource.astro`，完整內容：

```astro
---
import { preferredSourceUrl } from '../utils/site-meta';

interface Props {
  /**
   * 放置點。同時決定三件事：外觀形態、UTM 的 utm_content 版位標記、以及在哪一列排版。
   * 刻意不拆成「外觀」與「版位」兩個 prop——拆了就可能出現形態對了但版位標錯的組合，
   * 而那種漂移沒有任何自動檢查擋得下來（見 docs/specs/preferred-sources.md D1）。
   */
  placement: 'aside' | 'footer';
}

const { placement } = Astro.props;
const href = preferredSourceUrl(placement);

// footer 那顆只有圖示、沒有可見文字，無障礙名稱要自己把話說完整。
const A11Y_LABEL = '把本站設為 Google 偏好來源';

/**
 * Google 四色標誌，24x24 viewBox 的 path inner-markup（寫法沿用 SocialIcons.astro 的
 * set:html 慣例）。fill 是 Google 的品牌色，刻意不換成 currentColor、也不進 design token
 * ——那是外部商標的固定色，原樣使用是使用條件的一部分（見 spec R9）。
 */
const G_LOGO = '<path d="M23 12.245c0-.905-.075-1.565-.236-2.25h-10.54v4.083h6.186c-.124 1.014-.797 2.542-2.294 3.569l-.021.136 3.332 2.53.23.022C21.779 18.417 23 15.593 23 12.245z" fill="#4285F4"/><path d="M12.225 23c3.03 0 5.574-.978 7.433-2.665l-3.542-2.688c-.948.648-2.22 1.1-3.891 1.1a6.745 6.745 0 01-6.386-4.572l-.132.011-3.465 2.628-.045.124C4.043 20.531 7.835 23 12.225 23z" fill="#34A853"/><path d="M5.84 14.175A6.65 6.65 0 015.463 12c0-.758.138-1.491.361-2.175l-.006-.147-3.508-2.67-.115.054A10.831 10.831 0 001 12c0 1.772.436 3.447 1.197 4.938l3.642-2.763z" fill="#FBBC05"/><path d="M12.225 5.253c2.108 0 3.529.892 4.34 1.638l3.167-3.031C17.787 2.088 15.255 1 12.225 1 7.834 1 4.043 3.469 2.197 7.062l3.63 2.763a6.77 6.77 0 016.398-4.572z" fill="#EB4335"/>';
---

{placement === 'aside' ? (
  <a class="ps-pill" href={href} target="_blank" rel="noopener noreferrer">
    <svg class="ps-logo" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" set:html={G_LOGO} />
    <span>新增至偏好來源</span>
  </a>
) : (
  <a class="ps-icon" href={href} target="_blank" rel="noopener noreferrer" aria-label={A11Y_LABEL}>
    <svg class="ps-logo" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" set:html={G_LOGO} />
  </a>
)}

<style>
  /* 側邊欄：滿寬的橘框 pill。作法沿用站上既有的橘框按鈕 .community-btn
     （n8n-resources.astro）——transition 加 :hover 直接改 border-color，而不是
     einkRefresh：那個動畫會把 border-color 掃到 --color-border-strong（灰），
     套在橘框上等於把橘色蓋掉。 */
  .ps-pill {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    padding: 10px 14px;
    font-family: var(--font-sans);
    font-size: 14px;
    font-weight: 600;
    line-height: 1.4;
    color: var(--color-text-primary);
    text-decoration: none;
    border: 1px solid rgba(251, 146, 60, 0.4);
    border: 1px solid color-mix(in srgb, var(--color-brand-orange) 40%, transparent);
    border-radius: var(--radius-full);
    transition: border-color 300ms steps(3), background-color 300ms steps(3);
  }

  .ps-pill:hover {
    border-color: var(--color-brand-orange);
    background-color: rgba(251, 146, 60, 0.1);
    background-color: color-mix(in srgb, var(--color-brand-orange) 10%, transparent);
  }

  /* footer：排在社群圖示列尾端，尺寸與間距跟隨那一列。旁邊五顆是 currentColor 的單色圖示、
     hover 由 muted 轉白；四色標誌沒有 currentColor 可換，改用透明度對齊「hover 變亮」。 */
  .ps-icon {
    display: inline-flex;
    opacity: 0.75;
    transition: opacity 300ms steps(3);
  }

  .ps-icon:hover {
    opacity: 1;
  }

  /* Windows 高對比模式預設會把 SVG 塗成系統色，四色標誌會整個失去辨識。
     標誌保留原色，其餘元素照系統配色走。 */
  .ps-logo {
    forced-color-adjust: none;
  }
</style>
```

Step 2: 型別檢查

Run: `npx astro check`
Expected: 沒有新增的 error。

Step 3: 確認元件尚未被任何頁面引用

Run: `grep -rn "PreferredSource" src/pages src/layouts src/components --include="*.astro" | grep -v "src/components/PreferredSource.astro"`
Expected: 無輸出（這個 task 只建立元件，接線是 Task 3）。

Step 4: Commit

```bash
git add src/components/PreferredSource.astro
git commit -m "feat(preferred-sources): PreferredSource 元件（側邊欄 pill 與 footer 圖示）"
```

---

### Task 3: 接上兩個消費端

Implements: `preferred-sources.md` #R3

Files:
- Modify: `src/pages/[...slug].astro`（import 區塊約第 8-10 行；`<aside class="layout-aside">` 約第 189 行）
- Modify: `src/components/Footer.astro`（import 區塊第 2-4 行；`.footer-id` 區塊第 24-28 行；`<style>` 區塊）

Interfaces:
- Consumes: `PreferredSource` 元件（Task 2 建立於 `src/components/PreferredSource.astro`），props `{ placement: 'aside' | 'footer' }`
- Produces: 無（這是接線 task，不對外提供介面）

Step 1: 文章頁側邊欄接線

在 `src/pages/[...slug].astro` 的 import 區塊，於
`import AdLoader from '../components/AdLoader.astro';` 之後加一行：

```astro
import PreferredSource from '../components/PreferredSource.astro';
```

接著找到這段（約第 188-191 行）：

```astro
      <!-- Aside -->
      <aside class="layout-aside">
        <!-- Author widget -->
        <div class="aside-widget">
```

改成：

```astro
      <!-- Aside -->
      <aside class="layout-aside">
        <!-- Google 偏好來源（docs/specs/preferred-sources.md R3）。放在作者區塊之前，
             側邊欄最上緣是視線落點。注意 .layout-aside 在 1024px 以下整個不渲染
             （見本檔 @media (max-width: 1024px)），手機與平板讀者看到的是 footer
             那顆——所以 footer 版必須全站出現，不能排除文章頁。 -->
        <div class="aside-widget">
          <PreferredSource placement="aside" />
        </div>

        <!-- Author widget -->
        <div class="aside-widget">
```

（包一層 `.aside-widget` 是為了拿到它的 `margin-bottom: 32px`，與其餘側邊欄區塊等距。）

Step 2: Footer 接線

在 `src/components/Footer.astro` 的 import 區塊，於
`import SocialIcons from './SocialIcons.astro';` 之後加一行：

```astro
import PreferredSource from './PreferredSource.astro';
```

接著找到這段（約第 24-28 行，`.footer-id` 區塊）：

```astro
        <div class="footer-id">
          <div class="footer-title">{SITE.name}</div>
          <p class="footer-desc">{SITE.description}</p>
          <SocialIcons />
        </div>
```

改成：

```astro
        <div class="footer-id">
          <div class="footer-title">{SITE.name}</div>
          <p class="footer-desc">{SITE.description}</p>
          <!-- 偏好來源排在社群圖示右邊，共用同一列。刻意不塞進 SocialIcons 的清單：
               那支元件由 SOCIAL 陣列驅動，而 SOCIAL 推導自 SITE.sameAs（社群帳號的
               單一來源），塞一個不是社群帳號的項目會讓那份資料同時代表兩種東西。 -->
          <div class="footer-actions">
            <SocialIcons />
            <PreferredSource placement="footer" />
          </div>
        </div>
```

然後在 `src/components/Footer.astro` 的 `<style>` 區塊內，緊接在 `.footer-desc { ... }` 規則
之後加入：

```css
  /* gap 與 .social-icons 內部的 14px 一致，讓第六個元素看起來就在同一列上 */
  .footer-actions {
    display: flex;
    align-items: center;
    gap: 14px;
  }
```

Step 3: 型別檢查

Run: `npx astro check`
Expected: 沒有新增的 error。

Step 4: 建置並確認兩個放置點都有輸出

Run:
```bash
npm run build
grep -c 'preferences/source' dist/cloudflare-cache-rules-wordpress/index.html
grep -c 'preferences/source' dist/about/index.html
```
Expected: 文章頁輸出 `2`（側邊欄一個、footer 一個），`/about/` 輸出 `1`（只有 footer）。

Step 5: Commit

```bash
git add "src/pages/[...slug].astro" src/components/Footer.astro
git commit -m "feat(preferred-sources): 接上文章頁側邊欄與全站 footer"
```

---

### Task 4: 建置驗證與稽核

Implements: `preferred-sources.md` #R1, #R3, #R4, #R7, #R8

Files:
- Modify: 無（純驗證 task；若任一斷言失敗，回到對應 task 修正後再跑一次）

Interfaces:
- Consumes: Task 3 產出的 `dist/`
- Produces: 無

Step 1: 乾淨重建

Run: `npm run build`
Expected: 建置成功，無 error。

Step 2: 逐條斷言產物

Run:
```bash
ART=dist/cloudflare-cache-rules-wordpress/index.html

# 1. 側邊欄那顆的完整網址（含 utm_content=aside）
#    注意分隔符是原樣的 & 而不是 &amp;：Astro 的 addAttribute()
#    （node_modules/astro/dist/runtime/server/render/util.js）對能被 new URL() 解析成
#    http(s) 的字串會刻意跳過 HTML escape。2026-08-21 直接呼叫該函式實測確認。
grep -o 'https://www.google.com/preferences/source?q=frankchen.tw&utm_source=frankchen.tw&utm_medium=referral&utm_campaign=preferred-sources&utm_content=aside' "$ART" | head -1

# 2. footer 那顆的完整網址（含 utm_content=footer）
grep -o 'utm_content=footer' "$ART" | head -1

# 3. 外連屬性
grep -o 'rel="noopener noreferrer"[^>]*preferences/source\|preferences/source[^>]*rel="noopener noreferrer"' "$ART" | head -2

# 4. 非文章頁只有 footer 那顆
grep -c 'utm_content=aside' dist/about/index.html   # 預期 0
grep -c 'utm_content=footer' dist/about/index.html  # 預期 1

# 5. repo 內沒有第二份網域字面值（只有 site-meta.ts 的 SITE_URL 一處）
grep -rn "frankchen\.tw" src/components/PreferredSource.astro | wc -l  # 預期 0
```
Expected: 第 1、2、3 條各有輸出；第 4 條依序輸出 `0` 與 `1`；第 5 條輸出 `0`。

Step 3: 確認沒有動到禁止觸碰的檔案

Run: `git diff --name-only main...HEAD`
Expected: 只列出 `src/utils/site-meta.ts`、`src/components/PreferredSource.astro`、
`src/pages/[...slug].astro`、`src/components/Footer.astro`、以及 `docs/` 底下的檔案。
清單中不得出現 `public/robots.txt`、`src/pages/llms.txt.ts`、`public/_headers`、
任何 `scripts/verify-*.mjs`。

Step 4: 既有防線全綠

Run:
```bash
npm test
npm run verify:seo
```
Expected: 兩者皆全數通過，無 `[FAIL]`。刻意不寫死項數——`CLAUDE.md` 記的「115 個測試」與
`docs/SEO_GUIDE.md` 記的「16 條規則」都已過時（2026-08-21 實測 `verify:seo` 為 37 條），
把數字抄進驗收條件只會製造與實際輸出不符的假警報。

Step 5: Commit

若前面步驟有任何修正才需要 commit；全數通過且無檔案變動時跳過此步。

```bash
git commit --allow-empty -m "chore(preferred-sources): 建置驗證通過（npm test 與 verify:seo 全綠）"
```

---

## 人工驗收（execute 完成後由使用者操作，不屬於任何 task）

以下四項無法在 CI 或建置階段自動化，必須人工確認：

1. `npm run preview` 後開文章頁，確認側邊欄 pill 外觀正確、hover 有橘框反應；`--radius-full`
   的全圓角若與站台的方角語彙衝突，改成 `--radius-md` 只需換一個 token
2. 縮視窗到 1024px 以下確認側邊欄消失、footer 那顆仍在；縮到 768px 以下確認 footer 不破版
3. 實際點一次連結，確認 Google 的來源偏好設定頁正常帶出 frankchen.tw——我們在 `q=` 後面掛了
   四個它不認識的 UTM 參數，官方沒有任何文件保證未知 query 的處理方式（設計文件風險 1）
4. GA4 後台確認「增強型評估 → 外連點擊」為啟用狀態。沒開的話兩顆都量不到，而且不會有任何
   錯誤訊息（設計文件風險 3）
