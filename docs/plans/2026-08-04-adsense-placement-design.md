# AdSense 版位設計

**日期**：2026-08-04
**狀態**：設計確認，待實作
**Spec**：`docs/specs/monetization.md`

## 背景

AdSense 已通過審核（publisher ID `pub-5544842849576289`），要在 frankchen.tw 開始投放。
使用者提出的先決條件是「不影響 Lighthouse 分數」。

這個先決條件在 AdSense 下無法完全成立，設計的主軸因此變成「把影響壓到可控且可量測」，
而非「讓影響消失」。使用者確認的底線是：用影響最小的方案，且 CI 量到的要接近讀者真實體驗
——也就是不用環境旗標讓 CI 看不見廣告。

## 現況約束（動手前逐一核對過的）

| 約束 | 出處 | 對本案的意義 |
|------|------|-------------|
| CI 門檻 SEO 100 / a11y ≥95 / Best Practices 100 / Performance ≥85 | `.github/workflows/seo-pr.yml` | Best Practices 100 守不住，見下 |
| `script-src 'self' https://static.cloudflareinsights.com`，無 `frame-src` | `public/_headers` | AdSense 的 script 與 iframe 全被擋 |
| 隱私權政策明寫「本站本身不使用追蹤型 Cookie」 | `src/pages/privacy-policy.astro:30` | 放行為廣告後這句話變成不實陳述 |
| `.layout-aside` 在 ≤1024px 是 `display: none` | `src/pages/[...slug].astro:465` | 行動版沒有側欄，側欄版位在 CI 裡不存在 |
| 文章頁版面：容器 1200px、內文 864px、aside 240px、gap 48px | `src/pages/[...slug].astro:273-289` | 決定兩側固定版位的斷點算式 |
| `public/app-ads.txt` 已存在且內容正確 | commit 212f279 | ads.txt「找不到」的根因，見下 |

## 三個必然的衝擊

**Best Practices 100 守不住。** Lighthouse 的 third-party-cookies 稽核算在 Best Practices，
AdSense 一定會種 doubleclick.net 的第三方 cookie。沒有技術繞法，只能依實測數字調門檻。

**Performance ≥85 有救。** CI 跑的是 Lighthouse 預設的行動版 emulation（375px），而兩側固定
版位的斷點是 1600px、`.layout-aside` 在 1024px 以下不存在——CI 量到的只有文末那一個版位，
加上延後載入的 AdSense 腳本本身。

**CSP 要放寬。** 至少要放行 `pagead2.googlesyndication.com`、`tpc.googlesyndication.com`、
`googleads.g.doubleclick.net`、`adservice.google.com`，分散在 `script-src` / `frame-src` /
`img-src` / `connect-src`。Google 官方 CSP 指引還要求 `script-src` 加 `'unsafe-inline'`，
可能還要 `'unsafe-eval'`——這點不憑記憶斷言，實作時以 report-only 實測為準。

## 版位

```
視窗 ≥1600px
│←─ 留白 ≥200px ─→│←──── 容器 1200px ────→│←─ 留白 ≥200px ─→│
│  ▓ 160×600 fixed │  內文 864 │ aside 240 │  ▓ 160×600 fixed │
                     ▓ 文末位（article-tags 之前）
```

**桌機兩側固定位**：`position: fixed`，`top: calc(var(--height-header) + 24px)`，
左右各一個 160×600（IAB wide skyscraper）。斷點 `min-width: 1600px` 的算式是
容器 1200 + 兩側各（160 廣告 + 20 間距）= 1560，取 1600 留餘裕。
低於斷點時**不輸出 DOM**，不是 `display: none`——在隱藏容器上跑 `adsbygoogle.push()` 會拿到
`availableWidth=0` 並在 console 報錯，而 console error 是 Best Practices 的稽核項。

附收合鈕（參考站台同樣有），狀態存 `sessionStorage`。`aria-label` 與 `aria-expanded` 必須寫對
——a11y 門檻 95，一個沒有可及名稱的按鈕就足以扣破，`seo-perfection` spec 記載過同一個坑
（caret 按鈕可及名稱不符，40 頁 error）。

**文末位**：`article-tags` 之前。桌機 864px 寬、行動版滿版，`min-height` 鎖 280px。
放這裡而非頁面末，是因為讀者讀完內文多半直接離開，`article-nav` 之後的可見率明顯更低。

**不放廣告的頁面**：首頁、`/articles/`、`/about/`、`/contact-frank/`、`/privacy-policy/`、
分類頁、標籤頁。這幾頁停留短、eCPM 低，而 CI 稽核的四頁裡有三頁正是它們——不放等於少三個戰場。

## 載入策略

`adsbygoogle.js` 不放 `<head>`、不隨 HTML 同步載入。改由一支外部 JS
（CSP 是 `script-src 'self'`，內聯會被擋）在 `requestIdleCallback` 時注入，
無 idle callback 的 Safari 退回 `setTimeout(…, 2000)`。

用 idle 而非 IntersectionObserver 是刻意的：兩側位是 `position: fixed`，一載入頁面就在視窗內，
IntersectionObserver 會立刻觸發，等於沒有延後。而文末位在行動版位置很深，Lighthouse 量測時
不捲動頁面，用 IntersectionObserver 會導致腳本在 CI 裡永遠不載入——四頁分數一分不掉，
但那讓「CI 接近真實體驗」這個要求失效。idle 載入讓 CI 量得到腳本的真實成本，
同時不碰 LCP / FCP。

**CLS 貢獻是 0。** 固定版位脫離文檔流，填充時不推擠任何東西；文末位在 HTML 輸出時就帶著
預留高度。**不會搶走 LCP**：160×600 = 96,000 px²，文章 cover 是 864×360 = 311,040 px²。

## ads.txt

Google 後台顯示「找不到 ads.txt」的根因是檔名：`public/app-ads.txt` 早就存在，內容
（`google.com, pub-5544842849576289, DIRECT, f08c47fec0942fa0`）跟後台要求的一字不差，
但 `app-ads.txt` 是給行動 App（AdMob）用的規格，網站要的是 `ads.txt`，兩者 Google 走不同的
檢索路徑。這個檔是 WordPress 遷移時搬過來的（commit 212f279），連檔名一起搬錯了。

處置是**新增** `public/ads.txt`，`public/app-ads.txt` 保留——使用者有上架 App，兩個檔各有對象，
內容相同。

中介層不用動：`pagePathToMdPath('/ads.txt')` 回 `null`（不是以 `/` 結尾的頁面路徑），
middleware 原樣放行。`_headers` 的 `/*` 給它 600 秒 must-revalidate，比 robots.txt 那條 3600 更短，
沒有踩過的「改完等一天才生效」問題，不需要另設規則。

在 `verify-seo` 加一條靜態斷言確認 `dist/ads.txt` 存在且含 pub ID——這種靜默失效兩個多月的東西，
值得一條斷言擋住。

## 隱私權政策

三處要改：移除「本站本身不使用追蹤型 Cookie」、新增 AdSense 與第三方 Cookie 段落、
加上讀者如何透過 Google 廣告設定退出個人化廣告。

CMP（同意管理平台）第一版不裝。Google 對 EEA/UK 流量未設 CMP 的處理是停止投放該區廣告而非
違規，讀者以台灣為主，等真有歐洲流量再說。**此點待驗證**——Google 的區域政策每年在變，
實作前應查一次現行規定。

## 被排除的方案

**Auto ads**：會自行往內文任意位置插入，CLS 直接爆掉，且破壞 e-ink 排版節奏——那正是整份
`design-system` spec 在守的東西。一律用手動 ad unit。

**內文中段版位（第一個 h2 之後）**：收益最高的位置，但需要寫 rehype plugin 動到 markdown 渲染
管線。使用者選擇不做，換取零管線風險。（前端 JS 事後插入這條路本來就不能走——在已排版的內文
中間硬塞元素，CLS 直接爆。）

**aside 內的 sticky 版位**：覆蓋 100% 桌機讀者，比兩側固定位（只服務 ≥1600px 螢幕，估計約
一成流量）有效得多，但需要把 TOC 與廣告包進共用 sticky wrapper 並改 `TableOfContents.astro`
的 `max-height`。使用者選擇不動 TOC，換取零版面風險。收益差距已知並接受。

**環境旗標讓 CI 看不見廣告**：門檻可以一分不動，但 CI 綠燈不再代表真實體驗。與使用者的底線
牴觸，排除。

**逐路徑分設寬鬆／嚴格 CSP**：文章頁是 `/<slug>/`，在 `_headers` 的萬用字元下與 `/about/`
無法區分。且 Cloudflare 對同名標頭是合併不是覆蓋，兩份 CSP 並存時瀏覽器對每份都強制，
取交集後廣告一樣被擋。

**用 nonce 或 `'strict-dynamic'` 保住嚴格 script-src**：nonce 需要 per-request 產生，
本站 HTML 是靜態資產，要在 middleware 用 HTMLRewriter 逐請求改寫才行，等於毀掉邊緣快取；
而且 AdSense 動態注入的 script 也不會帶我們的 nonce。`'strict-dynamic'` 同樣需要 nonce 或
hash 當信任根，卡在同一個地方。

## 已知代價（明確接受）

1. Best Practices 從 100 降到實測值（第三方 cookie，無解）。
2. `script-src` 若實測證實非 `'unsafe-inline'` 不可就放寬，全站統一一份 CSP，在 `_headers`
   註解誠實記錄放寬了什麼、為什麼、代價是什麼。這是本案最大的實質代價，遠大於 Lighthouse 分數。
3. CI 量不到桌機兩側版位（斷點 1600px vs 行動版 emulation 375px），它們的效能代價要靠正式站
   PSI 桌機模式另外量。
4. CI 在 localhost 量到的是 no-fill（AdSense 只在通過審核的網域投放），也就是廣告基礎設施成本
   ——腳本載入時機、版位預留空間、版位數量。Google 回傳的廣告素材本身的重量量不到，那也不是
   我們控制得了的東西。

## 待驗證項目

- AdSense 實際需要的 CSP 最小放行集（先跑 `Content-Security-Policy-Report-Only`）
- `script-src` 是否真的非 `'unsafe-inline'` / `'unsafe-eval'` 不可
- Google 現行對 EEA/UK 流量未設 CMP 的處理方式
- 加上廣告後四個 CI 頁面的實際 Lighthouse 分數，據以定 Best Practices 新門檻
