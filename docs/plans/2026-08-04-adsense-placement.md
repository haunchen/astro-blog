# AdSense 版位 Implementation Plan

Goal: 在文章頁投放 Google AdSense——桌機兩側各一個 160×600 固定版位、文末一個 responsive 版位——並修好 `ads.txt` 一直被判為「找不到」的問題。

Architecture: 三個 Astro 元件（`AdSide` 兩側 DOM、`AdEnd` 文末 DOM、`AdLoader` 唯一的 client 邏輯）只掛在 `src/pages/[...slug].astro`，其餘頁面完全不引入。`adsbygoogle.js` 由 `AdLoader` 在 `requestIdleCallback` 時動態注入，不寫進 `<head>`。兩側版位靠 CSS media query 在 <1600px 隱藏、靠 JS 的同一個門檻值決定不送請求，避免在隱藏容器上初始化。`public/_headers` 放寬 CSP，`verify-seo` 新增兩條斷言守住 ads.txt 與「廣告只在文章頁」。

Tech Stack: Astro v5 元件與 scoped style、TypeScript strict、Astro `<script>`（經 Vite 打包成外部檔，符合 `script-src 'self'`）、Cloudflare Pages `_headers`、`scripts/verify-seo.mjs`。

Spec: `docs/specs/monetization.md`

Design: `docs/plans/2026-08-04-adsense-placement-design.md`

## 執行前的人工前置（程式碼管不到，缺一項就白做）

1. ~~**AdSense 後台建立三個廣告單元**~~ **已完成**（2026-08-04）：左 `4732356388`／右 `2386995389`／文末 `4958822751`，三個都是回應式單元。Task 2 已填入實際值。
2. **AdSense 後台關閉「自動廣告」**。設計決定用手動 ad unit（spec D1），但 Auto ads 的開關在後台不在程式碼——後台開著的話 Google 仍會自行往內文插入廣告，CLS 與排版控制全部失效，spec R6 直接破功。
3. **查證 Google 現行對 EEA/UK 流量未設 CMP 的處理方式**。spec D7 決定第一版不裝同意管理平台，依據是「Google 的處理是停止投放該區廣告而非違規」——這條政策每年在變，design doc 已把它標為待驗證。查證結果若仍是「不投放而非違規」，照本 plan 執行；若已變成「未設 CMP 即違反政策」，停止並回報，D7 需要重新決定（那會多出一個 CMP 腳本、一輪 CSP 放行與一輪效能成本，屬於本 plan 範圍外的新設計）。

## 設計上的一處措辭偏離（照做，但要知道）

Spec R3 寫「低於斷點時該版位的 DOM 完全不輸出」。靜態建置時不知道視窗寬度，做不到字面上的「不輸出」；純由 JS 動態建立節點雖然做得到，卻換來 scoped style 失效與收合鈕的 a11y 屬性無法靜態驗證。

本 plan 的做法是：DOM 照常輸出（`position: fixed`，不參與文檔流，CLS 仍是 0），CSS 在 <1600px 設 `display: none`，JS 用同一個門檻值判斷而**不送廣告請求**。R3 真正要守的是「未達寬度時不出現廣告、且不產生 console error」，這個做法完全滿足。Task 8 會把 R3 的措辭改成實際行為。

## Global Constraints

以下逐條適用於每一個 task，不因 task 沒提就不成立：

- 語言 zh-TW，正體中文台灣用語。程式碼註解寫「為什麼」不寫「做什麼」，與現有檔案風格一致。
- Canonical host 是非 www（`https://frankchen.tw`）。任何情況都不得產生 www 網址。
- TypeScript strict 模式。不得使用 `any`。
- CSP 目前是 `script-src 'self' https://static.cloudflareinsights.com`，全站 0 個內聯 script。所有新增的 client 程式碼一律走 Astro `<script>`（Vite 會因 `vite.build.assetsInlineLimit: 0` 打包成外部檔），**絕不可寫 `is:inline` 或 HTML 內聯事件屬性**。
- Lighthouse CI 門檻（`.github/workflows/seo-pr.yml`）：SEO 100、Accessibility ≥95、Performance ≥85 不得下降。任何 console error 都會扣 Best Practices。
- CSS 一律用 `src/styles/global.css` 的 design token（`--color-*`、`--width-*`、`--height-header`），不寫死色票或尺寸。
- 品牌色半透明宣告若有用到，必須是 `rgba()` fallback + `color-mix()` 連續兩行的漸進增強 pair（`docs/specs/design-system.md` R1）。
- `public/_headers` 對同一個標頭是**合併不是覆蓋**。任何需要改寫既有標頭的規則，都必須先 `! <Header-Name>` 清掉再設，否則會產生兩組值而後者失效。
- AdSense publisher ID 是 `ca-pub-5544842849576289`（`data-ad-client` 用）／`pub-5544842849576289`（ads.txt 用）。它不是機密，本來就要公開，不得藏進環境變數。
- `AdLoader`、`AdSide`、`AdEnd` 三個元件**不得讀取 `import.meta.env` 或任何環境變數做條件輸出**。spec R8 要求廣告在 CI、preview、正式站的行為完全一致；用環境旗標讓 CI 量不到廣告是設計階段明確排除的方案（design doc「被排除的方案」），因為那會讓 CI 綠燈不再代表讀者的真實體驗。
- 每個 task 結束都要 commit，訊息用正體中文，格式沿用 repo 既有慣例（`feat(scope): ...`、`fix(scope): ...`、`docs(scope): ...`）。

---

### Task 1: ads.txt 與其迴歸防線

Implements: `monetization.md` #R1, #R12

Files:
- Create: `public/ads.txt`
- Modify: `scripts/verify-seo.mjs`（新增常數 + 檔尾新增一條 check）
- Test: 無單元測試——`npm test` 只涵蓋 `scripts/lib/`，`verify-seo.mjs` 是對 `dist/` 的斷言腳本，它自己就是測試

Interfaces:
- Consumes: 無
- Produces: `dist/ads.txt`（build 時由 `public/` 原樣複製）；`verify-seo.mjs` 內的模組層常數 `ADS_TXT_PUBLISHER_ID`

背景：`public/app-ads.txt` 早就存在且內容正確，但 `app-ads.txt` 是行動 App（AdMob）規格，網站要的是 `ads.txt`，Google 走不同的檢索路徑。使用者有上架 App，所以**兩個檔都要保留**，內容相同。

Step 1: 建立 `public/ads.txt`

內容一行，結尾要有換行：

```
google.com, pub-5544842849576289, DIRECT, f08c47fec0942fa0
```

Step 2: 確認兩個檔內容一致

Run: `diff public/ads.txt public/app-ads.txt`
Expected: 無輸出（兩檔完全相同）

Step 3: 在 `scripts/verify-seo.mjs` 加入 publisher ID 常數

在檔案上方常數區、緊接 `const SITE_ORIGIN = \`https://${SITE_HOST}\`;` 那一行之後插入：

```js

// AdSense 的賣家授權宣告（docs/specs/monetization.md R1）。ads.txt 用 pub- 前綴，
// 元素屬性 data-ad-client 用 ca-pub- 前綴，是同一個帳號的兩種寫法，不能互換。
const ADS_TXT_PUBLISHER_ID = 'pub-5544842849576289';
```

Step 4: 在 `scripts/verify-seo.mjs` 檔尾新增 check

插入位置：最後一個 `check(...)` 區塊（`'每個 HTML 頁面都宣告自己的 markdown 變體'`）的結尾 `});` 之後、`// ---` 開頭的「輸出報告」註解區塊之前。

```js

// ads.txt 宣告誰有權販售本站的廣告空間。它失效的方式是完全靜默的——檔案不見、改名、
// 或 publisher ID 被動過，站台一切正常，只有 AdSense 後台會冒出一行「找不到 ads.txt」，
// 而那個畫面沒有人天天看。這次就是這麼發生的：WordPress 遷移時（commit 212f279）把檔名
// 搬成 app-ads.txt（那是 AdMob 的規格），內容一字不差卻整整兩個多月沒被 Google 認到。
// 兩個檔都驗：app-ads.txt 是給已上架的行動 App 用的，不是可以拿掉的舊物。
check('ads.txt 與 app-ads.txt 都宣告正確的 publisher ID', (failures) => {
  for (const file of ['ads.txt', 'app-ads.txt']) {
    const filePath = path.join(DIST, file);
    if (!existsSync(filePath)) {
      failures.push({ page: `/${file}`, reason: '檔案不存在' });
      continue;
    }
    const text = readFileSync(filePath, 'utf8');
    if (!text.includes(ADS_TXT_PUBLISHER_ID)) {
      failures.push({ page: `/${file}`, reason: `未宣告 ${ADS_TXT_PUBLISHER_ID}` });
    }
  }
});
```

Step 5: 建置並驗證

Run: `npm run build && npm run verify:seo`
Expected: 輸出含 `[PASS] ads.txt 與 app-ads.txt 都宣告正確的 publisher ID`，整體結尾為「全數通過」

Step 6: 反向驗證斷言真的會擋

Run: `mv dist/ads.txt dist/ads.txt.bak && npm run verify:seo; mv dist/ads.txt.bak dist/ads.txt`
Expected: 第一次執行輸出 `[FAIL] ads.txt 與 app-ads.txt 都宣告正確的 publisher ID（1 個問題）` 且 `- /ads.txt: 檔案不存在`，離開碼非 0

Step 7: Commit

```
fix(ads): 補上 ads.txt 並加斷言守住

public/app-ads.txt 內容一字不差，但那是 AdMob 規格，網站要的是 ads.txt——
遷移時（212f279）連檔名一起搬錯，AdSense 後台因此兩個多月判為「找不到」。
兩個檔都留，各有對象（使用者有上架 App）。

順帶在 verify-seo 加一條斷言：這種失效完全靜默，站台一切正常，
只有後台某個沒人天天看的畫面會顯示錯誤。
```

---

### Task 2: 廣告常數與文末版位元件

Implements: `monetization.md` #R5, #R6

Files:
- Create: `src/utils/ads.ts`
- Create: `src/components/AdEnd.astro`
- Test: 無單元測試（Astro 元件無測試框架，`npm test` 只涵蓋 `scripts/lib/`）；驗收靠 Task 5 的 `verify-seo` 斷言與 `npx astro check`

Interfaces:
- Consumes: 無
- Produces:
  - `src/utils/ads.ts` 匯出 `ADSENSE_CLIENT: string`、`AD_SLOTS: { sideLeft: string; sideRight: string; articleEnd: string }`、`SIDE_AD_MIN_WIDTH: number`
  - `src/components/AdEnd.astro`：無 props，輸出一個 `<aside class="ad-end">`，內含 `<ins class="adsbygoogle">`

Slot ID 已由使用者提供，直接照抄下面程式碼即可（左 `4732356388`／右 `2386995389`／文末 `4958822751`）。

**三個單元在 AdSense 後台都建成回應式**（後台給的範例碼是 `data-ad-format="auto"` + `data-full-width-responsive="true"`）。文末版位照用回應式，兩側版位刻意覆寫成固定 160×600——側邊留白只有 160px 寬，回應式在這個寬度會挑到小方形且高度不確定，容器就無法預先鎖高，spec R6 的 CLS 保證失去依據。ad unit ID 決定的是「這是哪個版位」，實際請求的尺寸由 `<ins>` 的樣式決定，同一個單元帶固定尺寸樣式是合規用法。

後台範例碼裡那段 `(adsbygoogle = window.adsbygoogle || []).push({})` 的 inline script **不要照抄**：三個版位各自載入一次 `adsbygoogle.js` 會重複注入並在 console 報錯，且 inline script 違反本 plan 的 Global Constraints。載入與 push 統一由 Task 4 的 `AdLoader` 處理。

Step 1: 建立 `src/utils/ads.ts`

```ts
// AdSense 設定單一來源（docs/specs/monetization.md）。
//
// publisher ID 直接寫在這裡而非環境變數：它本來就要公開在 /ads.txt 與每一個廣告單元的
// data-ad-client 屬性裡，不是秘密。藏進環境變數只會多一道「各環境不一致」的來源，
// 而 spec R8 要求廣告在 CI、preview、正式站的行為完全一致（見 spec D6）。
export const ADSENSE_CLIENT = 'ca-pub-5544842849576289';

// 廣告單元 ID，取自 AdSense 後台「廣告 → 依廣告單元」。三個版位分開建立單元，
// 才能在後台分別看到各版位的表現；共用一個單元會讓三處的數據混成一筆。
export const AD_SLOTS = {
  sideLeft: '4732356388',
  sideRight: '2386995389',
  articleEnd: '4958822751',
} as const;

// 兩側固定版位的顯示門檻（px）。
//
// 算式：文章頁容器是 --width-max 1200px，兩側各需 160px 廣告 + 20px 間距，
// 合計 1200 + 180 × 2 = 1560px，取 1600 留 20px 邊距餘裕。
//
// 這個值同時出現在 AdSide.astro 的 media query 裡，兩邊必須一致：CSS 負責隱藏，
// JS 負責不送廣告請求，只要有一邊走鐘，就會在 display:none 的容器上初始化廣告，
// 拿到 availableWidth=0 並在 console 報錯——而 console error 是 Lighthouse
// Best Practices 的稽核項（spec R9 要求該分數有門檻）。
export const SIDE_AD_MIN_WIDTH = 1600;
```

Step 2: 建立 `src/components/AdEnd.astro`

```astro
---
import { ADSENSE_CLIENT, AD_SLOTS } from '../utils/ads';
---

<aside class="ad-end" aria-label="廣告">
  <span class="ad-end-label">廣告</span>
  <ins
    class="adsbygoogle"
    style="display:block"
    data-ad-client={ADSENSE_CLIENT}
    data-ad-slot={AD_SLOTS.articleEnd}
    data-ad-format="auto"
    data-full-width-responsive="true"
  ></ins>
</aside>

<style>
  /* min-height 是 CLS 防線（spec R6）：這個版位在文檔流裡，下方緊接著標籤區與
     上下篇導覽。廣告填充前後容器高度必須一致，否則廣告一到就把下面全部往下推。
     280px 取自回應式版位在 720~864px 寬容器下的常見高度。
     contain: layout 讓廣告 iframe 的尺寸變化不外溢成整頁重排。 */
  .ad-end {
    display: block;
    min-height: 280px;
    margin-top: 48px;
    contain: layout;
  }

  /* 廣告必須與內容可區分——這既是 AdSense 政策要求，也是不想讓讀者把它讀成
     文章的一部分。刻意用最低調的樣式：站上其他小標（.aside-widget-title）
     是同一組字級與字色。 */
  .ad-end-label {
    display: block;
    font-family: var(--font-sans);
    font-size: 12px;
    letter-spacing: 0.05em;
    color: var(--color-text-muted);
    margin-bottom: 8px;
  }
</style>
```

Step 3: 型別檢查

Run: `npx astro check`
Expected: 0 errors（既有 warning 不算——執行前先跑一次記下基準數字，比較前後是否新增）

Step 4: Commit

```
feat(ads): 廣告設定常數與文末版位元件

文末版位在文檔流裡，min-height 必須在 HTML 送出時就鎖死，
否則廣告填充會把標籤區與上下篇導覽整個往下推（spec R6）。
```

---

### Task 3: 兩側固定版位元件

Implements: `monetization.md` #R3, #R4, #R6

Files:
- Create: `src/components/AdSide.astro`
- Test: 無單元測試；驗收靠 Task 5 的 `verify-seo` 斷言與 Task 6 的手動視覺驗證

Interfaces:
- Consumes: `src/utils/ads.ts` 的 `ADSENSE_CLIENT`、`AD_SLOTS`
- Produces: `src/components/AdSide.astro`：無 props，輸出兩個 `<aside class="ad-side ad-side--left|--right">`，各含一個 `.ad-side-body`（內有 `<ins class="adsbygoogle">`）與一個 `.ad-side-toggle` 按鈕。DOM 結構與 class 名稱是 Task 4 的 client script 的契約，改名必須兩邊同步。

Step 1: 建立 `src/components/AdSide.astro`

```astro
---
import { ADSENSE_CLIENT, AD_SLOTS } from '../utils/ads';

const SIDES = [
  { key: 'left', slot: AD_SLOTS.sideLeft },
  { key: 'right', slot: AD_SLOTS.sideRight },
] as const;
---

{
  SIDES.map(({ key, slot }) => (
    <aside class={`ad-side ad-side--${key}`} aria-label="廣告">
      <div class="ad-side-body" id={`ad-side-body-${key}`}>
        <ins
          class="adsbygoogle"
          style="display:inline-block;width:160px;height:600px"
          data-ad-client={ADSENSE_CLIENT}
          data-ad-slot={slot}
        />
      </div>
      {/* aria-label 與 aria-expanded 由 AdLoader 的 client script 依收合狀態改寫。
          這裡給的是展開狀態的初始值——沒有可及名稱的按鈕會直接扣破 Accessibility
          門檻（95），seo-perfection spec 記載過同一個坑：40 頁的 caret 按鈕可及
          名稱不符，當時是 error 等級。 */}
      <button
        type="button"
        class="ad-side-toggle"
        aria-controls={`ad-side-body-${key}`}
        aria-expanded="true"
        aria-label="收合廣告"
      />
    </aside>
  ))
}

<style>
  /* 定位算式：容器 --width-max 是 1200px，從視窗中線往外推半個容器寬（600px）
     再留 20px 間距，廣告就貼在內容區外緣。用 50% 而非固定值，版面加寬時自動跟著跑。

     z-index 50 的位置：低於 Nav（100）所以捲動時不會蓋住 header，高於一般內容。
     body::after 的紙張雜訊疊層是 9998 但 pointer-events: none，會蓋在廣告上方
     疊一層 0.03 的雜訊（與全站一致），不影響點擊。 */
  .ad-side {
    position: fixed;
    top: calc(var(--height-header) + 24px);
    z-index: 50;
    display: none;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }

  .ad-side--left {
    right: calc(50% + 600px + 20px);
  }

  .ad-side--right {
    left: calc(50% + 600px + 20px);
  }

  /* 1600 這個數字與 src/utils/ads.ts 的 SIDE_AD_MIN_WIDTH 是同一個門檻，改一邊
     就要改另一邊：CSS 負責隱藏、JS 負責不送請求，走鐘會導致在隱藏容器上初始化
     廣告並在 console 報錯（Lighthouse Best Practices 稽核項）。 */
  @media (min-width: 1600px) {
    .ad-side {
      display: flex;
    }
  }

  .ad-side--collapsed .ad-side-body {
    display: none;
  }

  /* 收合鈕：站上既有的 caret 樣式語彙（Nav 下拉、TOC）都是同一組低彩度的
     muted 字色 + 細框，這裡沿用，不另外發明一種按鈕長相。 */
  .ad-side-toggle {
    width: 32px;
    height: 20px;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-bg-tertiary);
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-sm);
    color: var(--color-text-muted);
    font-size: 11px;
    line-height: 1;
    cursor: pointer;
    transition: color 300ms steps(3), border-color 300ms steps(3);
  }

  .ad-side-toggle:hover {
    color: var(--color-text-secondary);
    border-color: var(--color-text-muted);
  }

  /* 箭頭用 CSS content 而非文字節點：按鈕已有 aria-label 提供可及名稱，
     螢幕閱讀器不會讀 content 產生的裝飾字元。 */
  .ad-side-toggle::after {
    content: '▾';
  }

  .ad-side--collapsed .ad-side-toggle::after {
    content: '▴';
  }
</style>
```

Step 2: 確認 design token 都存在

Run: `grep -n -- "--radius-sm\|--color-bg-tertiary\|--color-border-default\|--color-text-muted\|--color-text-secondary" src/styles/global.css | head`
Expected: 五個 token 各至少一筆輸出。**若 `--radius-sm` 不存在**，改用 `--radius-md`（`.article-cover` 用的就是它）。

Step 3: 型別檢查

Run: `npx astro check`
Expected: 0 errors，且與 Task 2 記下的 warning 基準相同

Step 4: Commit

```
feat(ads): 兩側固定版位元件

position: fixed 讓版位脫離文檔流，廣告填充多晚都不推擠內容（spec R6）。
1600px 門檻的算式：容器 1200 + 兩側各 (160 廣告 + 20 間距) = 1560，
取 1600 留邊距餘裕。這個值與 utils/ads.ts 的 SIDE_AD_MIN_WIDTH 必須一致。
```

---

### Task 4: 廣告載入器

Implements: `monetization.md` #R3, #R4, #R7, #R8

Files:
- Create: `src/components/AdLoader.astro`
- Test: 無單元測試；驗收靠 Task 6 的手動 console 檢查與 Lighthouse

Interfaces:
- Consumes: `src/utils/ads.ts` 的 `ADSENSE_CLIENT`、`SIDE_AD_MIN_WIDTH`；`AdSide.astro` 產生的 `.ad-side` / `.ad-side-body` / `.ad-side-toggle` class 與 `aria-expanded` 屬性；`AdEnd.astro` 與 `AdSide.astro` 共同產生的 `ins.adsbygoogle`
- Produces: `src/components/AdLoader.astro`：無 props、無 DOM 輸出，只含一個 Astro `<script>`。這是整個功能唯一的 client 邏輯所在。

Step 1: 建立 `src/components/AdLoader.astro`

```astro
---
/**
 * 廣告的 client 邏輯總入口：載入 adsbygoogle.js、決定哪些版位送請求、處理收合。
 *
 * 為什麼集中在一個沒有 DOM 輸出的元件，而不是分散在 AdSide / AdEnd 各自的 <script>：
 * adsbygoogle.js 全站只能載入一次，兩個元件各寫一份會重複注入並在 console 報錯，
 * 而 console error 會扣 Lighthouse Best Practices（spec R9）。
 */
---

<script>
  import { ADSENSE_CLIENT, SIDE_AD_MIN_WIDTH } from '../utils/ads';

  const SCRIPT_SRC = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`;
  const COLLAPSE_KEY = 'ads-side-collapsed';

  // window 上的兩個欄位都不在標準型別裡：adsbygoogle 是 Google 的腳本自己建的佇列，
  // __adsenseLoaded 是我們自己的旗標。用一次性斷言取代 declare global，避免把型別
  // 洩漏到整個專案的全域命名空間。
  const w = window as unknown as {
    adsbygoogle?: unknown[];
    __adsenseLoaded?: boolean;
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
  };

  /** 與 AdSide.astro 的 media query 同一個門檻，兩邊必須一致。 */
  function sideAdsVisible(): boolean {
    return window.matchMedia(`(min-width: ${SIDE_AD_MIN_WIDTH}px)`).matches;
  }

  function isCollapsed(): boolean {
    try {
      return sessionStorage.getItem(COLLAPSE_KEY) === '1';
    } catch {
      // 部分隱私模式下光是讀 sessionStorage 就會丟 SecurityError。
      // 讀不到就當作沒收合過，不值得為此讓整段初始化中斷。
      return false;
    }
  }

  function applyCollapsed(collapsed: boolean): void {
    for (const side of document.querySelectorAll<HTMLElement>('.ad-side')) {
      side.classList.toggle('ad-side--collapsed', collapsed);
      const toggle = side.querySelector<HTMLButtonElement>('.ad-side-toggle');
      if (!toggle) continue;
      toggle.setAttribute('aria-expanded', String(!collapsed));
      toggle.setAttribute('aria-label', collapsed ? '展開廣告' : '收合廣告');
    }
  }

  function loadScript(): void {
    if (w.__adsenseLoaded) return;
    w.__adsenseLoaded = true;
    const script = document.createElement('script');
    script.src = SCRIPT_SRC;
    script.async = true;
    script.crossOrigin = 'anonymous';
    document.head.appendChild(script);
  }

  /**
   * 對尚未填充的版位送出廣告請求。
   *
   * 只挑沒有 data-adsbygoogle-status 的元素——那個屬性是 adsbygoogle.js 自己標上的，
   * 對已填充的元素再 push 一次會拿到「All ins elements in the DOM with
   * class=adsbygoogle already have ads in them」的例外並印進 console。
   */
  function fillSlots(): void {
    const showSides = sideAdsVisible() && !isCollapsed();
    const slots = document.querySelectorAll<HTMLElement>(
      'ins.adsbygoogle:not([data-adsbygoogle-status])',
    );
    for (const slot of slots) {
      // 未達斷點時兩側版位是 display:none，在隱藏容器上初始化會拿到
      // availableWidth=0 並報錯；讀者主動收合過的也一樣要跳過，
      // 既省他的流量也避免對看不見的版位刷曝光。
      if (slot.closest('.ad-side') && !showSides) continue;
      (w.adsbygoogle = w.adsbygoogle || []).push({});
    }
  }

  function initAds(): void {
    if (!document.querySelector('ins.adsbygoogle')) return;

    applyCollapsed(isCollapsed());

    for (const toggle of document.querySelectorAll<HTMLButtonElement>('.ad-side-toggle')) {
      // View Transitions 每次換頁都會重跑這支初始化，而換頁後的 DOM 是全新的節點。
      // 這個標記防的是同一個節點被重複綁定（例如哪天 ClientRouter 被拿掉、
      // 初始化改回直接呼叫）——重複綁定會讓一次點擊觸發兩次，收合完立刻又展開。
      if (toggle.dataset.bound) continue;
      toggle.dataset.bound = '1';
      toggle.addEventListener('click', () => {
        const collapsed = toggle.getAttribute('aria-expanded') === 'true';
        applyCollapsed(collapsed);
        try {
          sessionStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0');
        } catch {
          // 寫不進去就只在這一頁生效，不值得為此擋掉收合這個動作本身。
        }
      });
    }

    // 延後到瀏覽器空閒才載入第三方腳本（spec R7）。
    //
    // 為什麼不用 IntersectionObserver：兩側版位是 position: fixed，一載入頁面就在
    // 視窗內，用 observer 等於沒有延後；而文末版位在行動版位置很深，Lighthouse
    // 量測時不捲動頁面，用 observer 會讓腳本在 CI 裡永遠不載入——四頁分數一分不掉，
    // 但那讓「CI 反映讀者真實成本」失效，正是 spec R8 與 D8 要擋的事。
    const start = () => {
      loadScript();
      fillSlots();
    };
    if (typeof w.requestIdleCallback === 'function') {
      w.requestIdleCallback(start, { timeout: 3000 });
    } else {
      // Safari 沒有 requestIdleCallback。
      window.setTimeout(start, 2000);
    }
  }

  // 只掛事件不直接呼叫：BaseLayout 有 ClientRouter，astro:page-load 在初次載入
  // 與每次換頁都會觸發。兩者都做會讓初次載入跑兩遍。
  document.addEventListener('astro:page-load', initAds);
</script>
```

Step 2: 型別檢查

Run: `npx astro check`
Expected: 0 errors，warning 數與 Task 2 基準相同

Step 3: 確認腳本被打包成外部檔而非內聯

Run: `npm run build && grep -c "adsbygoogle.js?client=" dist/*.html`
Expected: 每個檔案都是 `0`——腳本內容必須在 `dist/_astro/*.js` 裡，不能出現在 HTML 內。若 HTML 裡出現，表示被內聯了，CSP 的 `script-src 'self'` 會在執行時擋掉它。

Step 4: Commit

```
feat(ads): 廣告載入器

adsbygoogle.js 以 requestIdleCallback 延後注入，不放 head。
不用 IntersectionObserver：兩側版位是 fixed、一載入就在視窗內，
等於沒延後；文末版位則會因為 Lighthouse 不捲動而永遠不載入，
分數好看但 CI 就不再反映讀者真實成本（spec D8）。
```

---

### Task 5: 接上文章頁並守住「只在文章頁」

Implements: `monetization.md` #R2, #R3, #R5

Files:
- Modify: `src/pages/[...slug].astro`（import 區塊約 1-9 行、模板約 133-155 行）
- Modify: `scripts/verify-seo.mjs`（新增常數 + 檔尾新增一條 check）
- Test: `npm run build && npm run verify:seo`

Interfaces:
- Consumes: `AdSide.astro`、`AdEnd.astro`、`AdLoader.astro`（皆無 props）
- Produces: 文章頁 HTML 含三處 `data-ad-client="ca-pub-5544842849576289"`（左、右、文末）；其餘所有頁面零處

Step 1: 在 `src/pages/[...slug].astro` 加入 import

在既有的 `import Breadcrumbs from '../components/Breadcrumbs.astro';`（第 7 行）之後插入三行：

```astro
import AdSide from '../components/AdSide.astro';
import AdEnd from '../components/AdEnd.astro';
import AdLoader from '../components/AdLoader.astro';
```

Step 2: 在模板插入三個元件

找到 `<!-- Two-column layout -->` 那一行（約第 132 行），在它**之前**插入兩側版位與載入器：

```astro
    {/* 廣告只掛文章頁（spec R2）。兩側版位放在版面容器之外——它們是 position: fixed，
        定位錨點是視窗中線而不是這個容器，放進 .layout-with-aside 只會讓人以為它們
        跟 flex 佈局有關。 */}
    <AdSide />
    <AdLoader />

    <!-- Two-column layout -->
```

接著找到文章標籤那段的開頭註解 `<!-- 文章標籤：frontmatter 的 tags 原本只用在 article:tag 與 JSON-LD keywords，`（約第 139 行），在它**之前**（也就是 `</div>` 結束 `.prose` 之後）插入文末版位：

```astro
        <AdEnd />

        <!-- 文章標籤：frontmatter 的 tags 原本只用在 article:tag 與 JSON-LD keywords，
```

插入後該區塊的結構應該是：

```astro
      <div class="layout-main">
        <div class="prose">
          <Content />
        </div>

        <AdEnd />

        <!-- 文章標籤：... -->
        {post.data.tags && post.data.tags.length > 0 && (
```

Step 3: 在 `scripts/verify-seo.mjs` 加入 client ID 常數

緊接 Task 1 加入的 `ADS_TXT_PUBLISHER_ID` 那一行之後插入：

```js
// 元素屬性上的寫法（data-ad-client）。用它當「這一頁有沒有廣告」的判準，
// 比對打包後的 JS 檔名穩定得多——檔名帶內容雜湊，每次改動都會變。
const ADSENSE_CLIENT_ATTR = 'ca-pub-5544842849576289';
```

Step 4: 在 `scripts/verify-seo.mjs` 檔尾新增 check

插入位置：Task 1 新增的那條 check 之後、「輸出報告」註解區塊之前。

```js

// 廣告只准出現在文章頁（spec R2）。這條斷言守的是兩個方向，漏哪一邊都很痛：
// 文章頁漏掉等於整件事白做；漏到列表頁或關於我頁則會直接打中 CI 稽核的另外三個
// 頁面，Lighthouse 門檻立刻紅，而原因會看起來像是與該 PR 無關的效能波動。
check('廣告版位只出現在文章頁', (failures) => {
  for (const { pathname, html } of pages) {
    const hasAd = html.includes(`data-ad-client="${ADSENSE_CLIENT_ATTR}"`);
    const isArticle = articlePathnames.has(pathname);
    if (isArticle && !hasAd) {
      failures.push({ page: pathname, reason: '文章頁缺少廣告版位' });
    } else if (!isArticle && hasAd) {
      failures.push({ page: pathname, reason: '非文章頁不應出現廣告版位' });
    }
  }
});
```

Step 5: 建置並驗證

Run: `npm run build && npm run verify:seo`
Expected: 輸出含 `[PASS] 廣告版位只出現在文章頁`，整體「全數通過」

Step 6: 確認每個文章頁恰有三個版位

Run: `node -e "const {readFileSync}=require('fs');const {globSync}=require('glob');const f=globSync('dist/**/*.html').find(p=>p.includes('n8n')&&!p.includes('category')&&!p.includes('tag'));const h=readFileSync(f,'utf8');console.log(f, (h.match(/data-ad-client=/g)||[]).length);"`
Expected: 印出一個文章頁路徑與數字 `3`

Step 7: Commit

```
feat(ads): 文章頁接上三個版位

只掛 [...slug].astro，首頁與列表頁一律不放——那幾頁停留短、eCPM 低，
而 CI 稽核的四頁裡有三頁正是它們（spec R2）。

verify-seo 補一條雙向斷言：漏到非文章頁會直接打中 CI 的另外三個稽核頁面，
紅燈原因看起來會像是與該 PR 無關的效能波動。
```

---

### Task 6: CSP 放行

Implements: `monetization.md` #R10

Files:
- Modify: `public/_headers`（`/*` 區塊裡的 CSP 註解與 `Content-Security-Policy:` 宣告，並新增一條 `Content-Security-Policy-Report-Only:`）
- Test: `npm run build && npm run preview:pages`，手動開文章頁看 console

Interfaces:
- Consumes: Task 4 注入的 `pagead2.googlesyndication.com` 腳本來源
- Produces: 放寬後的 `Content-Security-Policy` 標頭

背景與已知代價：使用者在設計階段已明確拍板接受 `script-src` 放寬（spec D5）。下面這組是**起始集合**，spec R10 要求以實測校正——本機與 preview 都是 no-fill（AdSense 只在通過審核的網域投放），完整的違規清單只有正式站量得到。

**Report-Only 的用法要反過來，這點容易搞錯**：spec R10 寫「以 Report-Only 收集到的真實違規為準」，直覺會以為是「先發 Report-Only 觀察、再改成 enforcing」。那個順序在這裡行不通——enforcing 的 CSP 現在還是嚴格版，廣告腳本根本載不進來，也就永遠收集不到後續的違規。正確順序是 enforcing 先放寬到確定能動，同時掛一份**不含 `'unsafe-inline'` 的收緊版當 Report-Only**，用正式站的真實流量去試「能不能收回來」。Report-Only 只觀測不阻擋，廣告不會因此壞掉。兩個是不同的標頭名稱，`_headers` 不會把它們合併在一起。

Step 1: 改寫 `public/_headers` 的 CSP 註解

在既有註解區塊中，找到這三行：

```
  #   - Cloudflare Web Analytics 例外：static.cloudflareinsights.com（beacon 指令碼）
```

在該行**之前**插入新的說明段落：

```
  #   - AdSense 例外（docs/specs/monetization.md R10、D5）：這是本檔目前最大的一處
  #     讓步，要知道換到了什麼、付出了什麼。
  #     付出的是 script-src 的 'unsafe-inline'——上面那句「全站掃描 0 個內聯 script，
  #     故可鎖到最嚴」從此不再成立，XSS 防護最關鍵的一面被打開。兩條想保住它的路都
  #     走不通：nonce 要 per-request 產生，本站 HTML 是靜態資產，得在 middleware 用
  #     HTMLRewriter 逐請求改寫才行，等於毀掉邊緣快取，而且 AdSense 動態注入的 script
  #     也不會帶我們的 nonce；'strict-dynamic' 同樣需要 nonce 或 hash 當信任根。
  #     逐路徑分設寬鬆／嚴格也不行：文章頁是 /<slug>/，在本檔的萬用字元下與 /about/
  #     無法區分，而且同名標頭是合併不是覆蓋，兩份 CSP 並存時瀏覽器對每份都強制，
  #     取交集後廣告照樣被擋。
  #     下面這組來源是起始集合，不是實測結果——本機與 Pages preview 都拿不到真實廣告
  #     （AdSense 只在通過審核的網域投放），完整的違規清單只有正式站量得到。上線後要
  #     實際開文章頁看 console，把沒用到的來源刪掉、把漏掉的補上。
```

Step 2: 改寫 CSP 宣告本身

把第 37 行整行（`  Content-Security-Policy: default-src 'self'; ...`）替換為：

```
  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com https://pagead2.googlesyndication.com https://tpc.googlesyndication.com https://partner.googleadservices.com https://adservice.google.com https://www.googletagservices.com https://ep2.adtrafficquality.google; connect-src 'self' https://cloudflareinsights.com https://pagead2.googlesyndication.com https://googleads.g.doubleclick.net https://ep1.adtrafficquality.google; frame-src https://googleads.g.doubleclick.net https://tpc.googlesyndication.com https://www.google.com https://ep2.adtrafficquality.google; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://pagead2.googlesyndication.com https://tpc.googlesyndication.com https://googleads.g.doubleclick.net https://www.google.com https://ep1.adtrafficquality.google; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'; upgrade-insecure-requests
```

Step 3: 加上收緊版的 Report-Only 標頭

在 Step 2 替換進去的 `Content-Security-Policy:` 那一行**之後**，緊接著插入兩段（註解 + 標頭）：

```
  # 收緊版的觀測用副本（docs/specs/monetization.md R10）：與上面那條唯一的差別是
  # script-src 沒有 'unsafe-inline'。Report-Only 只回報不阻擋，掛著它不會讓廣告壞掉，
  # 但只要 AdSense 真的用到內聯腳本，正式站的 console 就會冒出違規訊息——那就是
  # 「這個讓步收不回來」的實證。反過來說，掛了一段時間都沒有任何違規，就代表上面那條
  # 的 'unsafe-inline' 可以拿掉，把 XSS 防護那一面收回來。
  #
  # 順序是刻意的：先讓 enforcing 放寬到確定能動，再用 Report-Only 試收緊。反過來做
  # （先發 Report-Only 觀察、再改 enforcing）在這裡不成立——enforcing 還是嚴格版時
  # 廣告腳本根本載不進來，也就永遠收集不到後續的違規。
  Content-Security-Policy-Report-Only: default-src 'self'; script-src 'self' https://static.cloudflareinsights.com https://pagead2.googlesyndication.com https://tpc.googlesyndication.com https://partner.googleadservices.com https://adservice.google.com https://www.googletagservices.com https://ep2.adtrafficquality.google; connect-src 'self' https://cloudflareinsights.com https://pagead2.googlesyndication.com https://googleads.g.doubleclick.net https://ep1.adtrafficquality.google; frame-src https://googleads.g.doubleclick.net https://tpc.googlesyndication.com https://www.google.com https://ep2.adtrafficquality.google; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://pagead2.googlesyndication.com https://tpc.googlesyndication.com https://googleads.g.doubleclick.net https://www.google.com https://ep1.adtrafficquality.google; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'
```

Step 4: 本機跑 Pages Functions 環境

Run: `npm run build && npm run preview:pages`
Expected: wrangler 啟動並列出 `http://localhost:8788`

Step 5: 手動確認 CSP 沒有擋掉腳本本身

開瀏覽器到 `http://localhost:8788/<任一文章 slug>/`，開 DevTools Console。

Expected:
- **沒有** `Refused to load the script 'https://pagead2.googlesyndication.com/...'` 這類 CSP 違規
- 允許出現與廣告填充相關的訊息（no-fill、`availableWidth` 之外的 AdSense 提示）——localhost 不是授權網域，拿不到廣告是正常的
- **不允許**出現 `availableWidth=0` 或 `already have ads in them`：這兩個代表 Task 4 的判斷寫錯了，回頭修

Step 6: 確認兩個標頭都真的送出

Run: `curl -sI http://localhost:8788/ | grep -i content-security-policy`
Expected: 恰好兩行——一行 `Content-Security-Policy:`（含 `'unsafe-inline'`）與一行 `Content-Security-Policy-Report-Only:`（不含 `'unsafe-inline'`）。若 `Content-Security-Policy` 出現兩組值以逗號串接，代表 `_headers` 的合併規則被觸發，要回頭檢查是否有第二條規則命中同一路徑而漏了 `!` 清除。

Step 7: Commit

```
chore(csp): 放行 AdSense 所需來源

script-src 加 'unsafe-inline' 是本檔目前最大的讓步，註解裡寫清楚了
為什麼 nonce 與 strict-dynamic 兩條路都走不通（spec D5）。

這組來源是起始集合不是實測結果——本機與 preview 都是 no-fill，
完整違規清單只有正式站量得到，上線後要再收斂一次（spec R10）。
```

---

### Task 7: 隱私權政策改寫

Implements: `monetization.md` #R11

Files:
- Modify: `src/pages/privacy-policy.astro`（第 13 行 description、第 19 行更新日期、第 29-33 行 Cookie 與第三方段落）
- Test: `npm run build && npm run verify:seo`

Interfaces:
- Consumes: 無
- Produces: 無（純內容變更）

背景：現行政策第 30 行明寫「本站本身不使用追蹤型 Cookie」。放上 AdSense 之後這句話變成不實陳述，這是本次改動裡唯一有法律面意義的一項。

Step 1: 更新 meta description

找到 `<BaseLayout` 開頭標籤裡以 `description="本站的隱私權政策：` 起頭的那一行整行。description 有 120-160 字元的長度紀律（`src/utils/site-meta.ts` 的 `DESC_MIN`/`DESC_MAX`），改寫後要落在區間內。替換為：

```astro
  description="本站的隱私權政策：說明本站為靜態網站、不主動蒐集個人資料，並逐項解釋 Google AdSense 廣告與第三方 Cookie 的運作方式、如何退出個人化廣告，以及 Cookie、第三方嵌入內容與外部連結的處理方式。"
```

Step 2: 更新最後更新日期

找到 `<p class="legal-updated">最後更新：2026-07-23</p>` 那一行，替換為：

```astro
    <p class="legal-updated">最後更新：2026-08-04</p>
```

Step 3: 改寫 Cookie 段落

把這兩行：

```astro
      <h2>Cookie</h2>
      <p>本站本身不使用追蹤型 Cookie。網站由 Cloudflare Pages 代管，平台可能基於資訊安全與效能設置必要性 Cookie；這類 Cookie 不用於識別你的身分。</p>
```

替換為：

```astro
      <h2>廣告</h2>
      <p>本站文章頁面投放 Google AdSense 廣告。Google 及其合作夥伴會使用 Cookie 或類似技術，依你先前造訪本站與其他網站的紀錄放送廣告，這類 Cookie 由 Google 設置與讀取，本站無法存取其內容。</p>
      <p>你可以前往 <a href="https://myadcenter.google.com/" rel="noopener noreferrer" target="_blank">Google 廣告設定</a> 關閉個人化廣告；關閉後仍會看到廣告，但內容不再依你的瀏覽紀錄調整。若想更全面地管理第三方廣告 Cookie，可參考 <a href="https://www.aboutads.info/choices/" rel="noopener noreferrer" target="_blank">aboutads.info</a> 的退出工具。</p>

      <h2>Cookie</h2>
      <p>除上述廣告 Cookie 外，本站本身不設置用於識別身分或跨站追蹤的 Cookie。流量統計使用無 Cookie 的 Cloudflare Web Analytics。網站由 Cloudflare Pages 代管，平台可能基於資訊安全與效能設置必要性 Cookie；這類 Cookie 不用於識別你的身分。</p>
```

Step 4: 更新「我們蒐集哪些資料」段落的第二句

找到以「本站為靜態網站，不提供留言、註冊或登入功能」開頭的那一段 `<p>`。它結尾的「本站未安裝 Google Analytics 這類會建立跨站瀏覽輪廓的分析工具。」在有了 AdSense 之後容易被讀成「本站完全沒有跨站追蹤」。整行替換為：

```astro
      <p>本站為靜態網站，不提供留言、註冊或登入功能，因此不會主動向你蒐集姓名、電子郵件等個人資料。本站未安裝 Google Analytics 這類分析工具；跨站層面的資料蒐集僅來自下方說明的廣告服務。</p>
```

Step 5: 建置並驗證

Run: `npm run build && npm run verify:seo`
Expected: 全數通過（description 長度若超出 160 會被 SEO 斷言擋下，此時把第 1 步的句子縮短到區間內）

Step 6: Commit

```
docs(privacy): 補上 AdSense 與第三方 Cookie 揭露

「本站本身不使用追蹤型 Cookie」在放上 AdSense 之後是不實陳述，
這是本次改動裡唯一有法律面意義的一項（spec R11）。
另外補上讀者退出個人化廣告的兩個管道。
```

---

### Task 8: CI 門檻校正與 spec 措辭同步

Implements: `monetization.md` #R9, #R3

Files:
- Modify: `.github/workflows/seo-pr.yml`（第 116-121 行的 THRESHOLDS 與其上方註解）
- Modify: `docs/specs/monetization.md`（R3 的 Description、新增 Pending Changes）
- Test: 推 PR 後看 CI 的 Job Summary

Interfaces:
- Consumes: Task 5 產生的含廣告文章頁
- Produces: 校正後的 Best Practices 門檻

背景：Best Practices 100 在有 AdSense 之後守不住，兩個已知失分項是 `third-party-cookies`（Google 會種 doubleclick.net 的 cookie）與 `csp-xss`（Task 6 加了 `'unsafe-inline'`）。實際分數要跑過才知道，所以這個 task 是「先設一個保守值 → 用第一輪 CI 的實際數字收緊」。

Step 1: 先量本機的實際分數

先在另一個終端跑 `npm run build && npm run preview`，確認 `http://localhost:4321/` 起得來。

Run: `npx --yes lighthouse@13.4.1 http://localhost:4321/<任一文章 slug>/ --output=json --output-path=lighthouse-local.json --chrome-flags="--headless --no-sandbox" --quiet && node -e "const r=require('./lighthouse-local.json');for(const k of ['seo','accessibility','best-practices','performance'])console.log(k, Math.round(r.categories[k].score*100));"`

（輸出寫成檔案再讀，不要用 `--output-path=/dev/stdout`——本機是 Windows，Node 會把 `/dev/stdout` 當成相對路徑解析成 `D:\dev\stdout` 並丟 ENOENT。量完記得 `rm lighthouse-local.json`，那是暫存檔不要進版控。）

Expected: 四個分數。記下 `best-practices` 的值——下一步的門檻要以它為基準，不是照抄本 plan 寫死的數字。

Step 2: 改 `.github/workflows/seo-pr.yml` 的 THRESHOLDS

把第 116-121 行的 `THRESHOLDS` 物件替換為（`'best-practices'` 的值用上一步量到的實際分數往下取整到 5 的倍數，若量到 92 就填 90；本 plan 先寫 85 是保底值，量到更高務必收緊）：

```js
          // Best Practices 從 100 降下來，是 AdSense 的直接代價，有兩個已知失分項：
          //   1. third-party-cookies——Google 會種 doubleclick.net 的第三方 cookie，
          //      這條無解，除非不放廣告。
          //   2. csp-xss——public/_headers 為了 AdSense 在 script-src 加了 'unsafe-inline'，
          //      Lighthouse 會判 CSP 對 XSS 防護不足。
          // 兩者都是設計階段明確接受的取捨（docs/specs/monetization.md D5、R9），
          // 不是回歸。若哪天這個數字再往下掉，那才是真的有東西壞了。
          const THRESHOLDS = {
            seo: 100,
            accessibility: 95,
            'best-practices': 85,
            performance: 85,
          };
```

Step 3: 同步 spec R3 的措辭

`docs/specs/monetization.md` 的 R3 目前寫「低於此寬度時該版位的 DOM 完全不輸出」，與實作不符（見本 plan 開頭「設計上的一處措辭偏離」）。把 R3 的 Description 整段替換為：

```markdown
- **Description**: 視窗寬度 ≥1600px 時，內容區左右留白各出現一個 160×600 固定版位，垂直起點在站台 header 之下。低於此寬度時該版位不可見，且不得對它送出廣告請求——在不可見的容器上初始化廣告會產生 console error，而 console error 是 Lighthouse Best Practices 的稽核項。可見性判斷與送出請求的判斷必須以同一個門檻值為準。
```

同一份 spec 的 S3 與 S4 目前寫著「兩側版位的節點不存在」，與改過的 R3 互相矛盾，一併改掉——留著會讓日後照 Scenario 寫驗收測試的人踩空。

S3 的 **Then** 整行替換為：

```markdown
- **Then**: 兩側版位不可見，且未對其送出廣告請求，console 無廣告相關錯誤
```

S4 的 **Then** 整行替換為：

```markdown
- **Then**: 只有文末一個版位可見，兩側版位不可見且未送出廣告請求
```

Step 4: 在 spec 記錄本次的實測結果

把 `docs/specs/monetization.md` 檔尾的 Pending Changes 區塊替換為（`{實際分數}` 填入 Step 1 量到的值）：

```markdown
## Pending Changes

> Source: docs/plans/2026-08-04-adsense-placement.md
> Date: 2026-08-04

### MODIFIED R3: 桌機兩側固定版位
- **Level**: MUST
- **Description**: 見上方主區塊（已就地更新，S3／S4 一併同步）
- **Reason**: 原措辭要求「DOM 完全不輸出」，靜態建置時不知道視窗寬度而做不到；純由 JS 建立節點做得到，但換來 scoped style 失效與收合鈕 a11y 屬性無法靜態驗證。改以「不可見且不送請求」表述，守住原本要守的行為

### 待正式站實測補完
- CSP 最小放行集（R10）：目前 `public/_headers` 的 enforcing 那條是起始集合，另掛了一份不含 `'unsafe-inline'` 的 Report-Only 副本試收緊。本機與 Pages preview 都是 no-fill，兩者的判讀只有正式站做得到
- Best Practices 實際分數（R9）：本機文章頁量到 {實際分數}，CI 門檻依此設為 85。第一輪 CI 跑完後若穩定高於門檻，應收緊
- EEA/UK 的 CMP 政策（D7）：執行前已查證一次（見 plan 的人工前置第 3 項），政策每年在變，日後有歐洲流量時要重查
```

Step 5: 完整驗證

Run: `npm test && npm run build && npm run verify:seo`
Expected: 106 個單元測試全過、build 成功、verify:seo 全數通過

Step 6: Commit

```
ci(lighthouse): Best Practices 門檻依 AdSense 實測校正

兩個已知失分項：third-party-cookies（Google 種 doubleclick cookie，
無解）與 csp-xss（_headers 為 AdSense 加了 'unsafe-inline'）。
兩者都是設計階段明確接受的取捨，不是回歸——再往下掉才是真的壞了。

順帶把 spec R3 的措辭改成實作實際做得到的行為。
```

---

## 上線後才做得完的收尾（不屬於任何 task，但不能忘）

以下三項在合併前做不完，因為 AdSense 只在通過審核的正式網域投放廣告，本機與 Pages preview 一律是 no-fill：

1. **CSP 收斂**（spec R10）：正式站開文章頁看 console，把 `public/_headers` 裡沒用到的來源刪掉、漏掉的補上。同時判讀 Task 6 掛上的 Report-Only 副本——那份不含 `'unsafe-inline'`，掛一段時間都沒有違規訊息，就代表 enforcing 的那條可以把 `'unsafe-inline'` 拿掉，XSS 防護那一面收得回來；持續冒違規則相反，那個讓步是永久的，把結論寫回 `_headers` 註解。
2. **ads.txt 認證**：部署後回 AdSense 後台按「檢查更新」，確認「找不到 ads.txt」的警告消失。Google 說明需要幾天才會反映。
3. **正式站桌機分數**：CI 的行動版 emulation 量不到兩側版位（斷點 1600px vs 375px），它們的效能代價只能用 PageSpeed Insights 的桌機模式打正式站量。
