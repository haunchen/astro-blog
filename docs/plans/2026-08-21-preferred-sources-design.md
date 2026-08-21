# Google Preferred Sources 行動號召 — 設計

- 日期：2026-08-21
- Spec：`docs/specs/preferred-sources.md`（新 domain，status: draft）
- Branch：`feat/preferred-sources`

## 背景

Google Preferred Sources（偏好來源）是讀者端主動把某個站標成偏好來源的功能，不是排名因素。
被標記後，該站內容在焦點新聞、AI 模式、AI 摘要中會帶「偏好」徽章，Google 稱點擊率約為一般
連結的兩倍。2026-05-27 起延伸到 AI Overviews 與 AI Mode，這是它對技術部落格唯一有意義的
部分——焦點新聞本來就偏新聞媒體。

資格是網域／子網域層級，子目錄不符合，frankchen.tw 自己算一個獨立來源。站方唯一能做的就是
提供 deep link `https://www.google.com/preferences/source?q=<host>`。官方另提供 16 語系按鈕
素材，也允許自製設計或純文字連結，並明講這些步驟都非必要條件。

官方文件：https://developers.google.com/search/docs/appearance/preferred-sources
（以上背景由使用者於 2026-08-21 查證後提供。）

## 動手前查到的三件事

這三件事改變了原始需求的前提，設計依查到的實況走，不依原始假設。

### 1. 本站沒有淺色主題

`BaseLayout.astro:124` 寫死 `<meta name="color-scheme" content="dark">`，`src/styles/global.css`
從頭到尾沒有任何 `prefers-color-scheme` 分支。原始需求的「深淺色主題都要正常」目前沒有淺色
可驗。改為：元件一律走 design token、零寫死色值，日後真的加淺色主題時不需重寫；另外確保
`forced-colors`（Windows 高對比）不破版。

### 2. 本站裝了 GA4，UTM 因此真的量得到

`BaseLayout.astro:148` 有 `gtag('config', 'G-J4PFZEBYW7')`，走 Cloudflare Google 代碼閘道的
第一方路徑 `/ql0n/`。GA4 增強型評估的外連點擊事件會記下完整 `link_url`，其中包含我們自己掛
上去的 UTM 參數。因此兩個放置點掛不同的 `utm_content` 就能分辨版位貢獻——不需要任何程式碼、
不需要 script、不碰 CSP、不碰 `verify-*`。

（設計過程中一度評估過 `/go/preferred-source/` 中介轉址方案。它會撞上 `verify-seo.mjs:501`
的「站內連結皆可解析為實際輸出的檔案」檢查，且在 GA4 存在的前提下毫無必要，已丟棄。）

### 3. 側邊欄在 1024px 以下不渲染

`[...slug].astro:480-483` 有 `@media (max-width: 1024px) { .layout-aside { display: none } }`。
側邊欄是整個不渲染，不是換位置。因此放在作者區塊上方的那顆，手機與平板讀者一個都看不到。
這直接決定了 footer 那顆必須全站出現（含文章頁），否則手機讀者在站上任何地方都找不到入口。

## 決策

### 放置

| 位置 | 形態 | 出現範圍 |
|------|------|----------|
| 文章頁側邊欄，作者 widget 之前（`[...slug].astro:189`） | 滿寬 240px pill，四色 G | 文章頁，>1024px |
| Footer 社群圖示列尾端（`Footer.astro` 的 `.footer-id`） | 20×20 四色 G 圖示 | 全站每一頁 |

桌機文章頁會同時出現兩顆。兩者形態差很多、位置差很遠，不會讀成重複；換來的是手機讀者也有
入口。

### 元件

`src/components/PreferredSource.astro`，單一元件，一個 prop：`placement: 'aside' | 'footer'`。

刻意用放置點命名而非外觀命名（不是 `variant: 'pill' | 'icon'`）：這個 prop 同時決定外觀形態、
`utm_content` 的值、以及要用四色還是單色 G，三者一一對應，用同一個名字就不會出現「形態對了
但 UTM 標錯版位」的漂移。只有兩個消費端，不預先拆成兩個 prop；日後同一形態用到第三處再拆。

### 網址組裝（SSOT）

放 `src/utils/site-meta.ts`，照 `docs/SEO_GUIDE.md` 的規定（SEO 相關常數只有 `site-meta.ts`
與 `BaseLayout.astro` 兩處）：

```ts
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

網域從 `SITE.url` 取 hostname，沒有第二份字面值。用 `URLSearchParams` 而非手拼字串，理由同
`site-meta.ts` 現有註解：拼字串遲早會漏掉一次 encode。

### UTM 命名

repo 內零筆 `utm_`，確實沒有既有慣例，這組是新訂的：

| 參數 | 值 | 理由 |
|------|-----|------|
| `utm_source` | `frankchen.tw`（取自 `SITE.url`） | 流量來源是本站 |
| `utm_medium` | `referral` | 標準外連值 |
| `utm_campaign` | `preferred-sources` | 對應這次的功能名，與 spec domain 同名 |
| `utm_content` | `aside` / `footer` | 專門用來分版位，與 `placement` prop 同值 |

### 連結屬性

`target="_blank"` 加 `rel="noopener noreferrer"`。原始需求指定的是 `noopener`，改為跟 repo
慣例一致（`SocialIcons.astro`、`ResourceCard.astro`、`about.astro` 全部如此，
`docs/specs/site-pages.md` R19 將其列為 MUST）。差別只在 Google 那端看不看得到 Referer——
成效是靠本站 GA4 記的、不靠對方回報，拿掉 referrer 沒有損失。使用者已同意。

### 樣式

側邊欄 pill 就是一顆滿寬 240px 的按鈕，沒有小標、沒有說明句。側邊欄小標（`.aside-widget-title`）
的作用是替一段內容命名（「作者」「相關文章」），一顆自帶文字的按鈕不需要再被命名一次；一併
省掉在元件裡複製那 12 行小標 CSS 的成本（Astro scoped style 無法跨檔共用）。

品牌橘的用法照 `docs/specs/design-system.md`，並沿用站上既有的橘框按鈕 `.community-btn`
（`n8n-resources.astro`）那一套：

- 邊框 40%、hover 背景 10%（R2 的全站統一濃度。`.community-btn` 現況是 12%，屬既有孤例，
  新元件照 spec 寫 10%）
- 兩者都寫成 `rgba` 在前、`color-mix` 在後的成對宣告（R1）
- hover 用 `transition: border-color, background-color` 加 `:hover` 直接改 `border-color`，
  **不用** `einkRefresh`。該動畫會把 `border-color` 掃到 `--color-border-strong`（灰），
  套在橘框上等於把橘色蓋掉。這不違反 R3——R3 擋的是「`:hover` 不改 `border-color` 卻留著
  `transition`」那種永不觸發的 dead code，而這裡的 `:hover` 確實直接改它
- pill 用 `--radius-full` 做全圓角（照使用者提供的官方按鈕形狀），不是站上卡片慣用的
  `--radius-sm`／`--radius-md`
- 標籤文字用 `--color-text-primary` 而非 `--color-brand-orange`：橘字配四色 G 會有兩組暖色
  互打，官方按鈕本身也是白字

站台本身不引入任何新色，全部走 CSS 變數；唯一的例外是 Google G 的四個品牌色，它們寫在 SVG
的 `fill` 屬性上、不進 design token，因為那是外部商標的固定色、不是本站色票。四色 G 加
`forced-color-adjust: none`，避免 Windows 高對比模式把它塗成單色而失去辨識。

footer 那顆不動 `SocialIcons.astro`——該元件由 `SOCIAL` 陣列驅動，而 `SOCIAL` 推導自
`SITE.sameAs`，硬塞一個不是社群帳號的項目會弄髒它的語意。改在 `Footer.astro` 把
`<SocialIcons />` 與這顆包進同一個 `display: flex; gap: 14px; align-items: center` 的容器，
G 排在五顆圖示右邊、同樣 20×20。它是這一列唯一有顏色的元素：旁邊五顆是 `currentColor`
的單色圖示、hover 由 muted 轉白，四色 G 沒有 `currentColor` 可換，改用 `opacity: 0.75 → 1`
對齊「hover 變亮」這個語意。

### 文案

- pill 文字：`新增至偏好來源`（照官方按鈕素材的中文文案）
- footer 圖示的 `aria-label`：`把本站設為 Google 偏好來源`（圖示無可見文字，無障礙名稱要說完整）

### Spec domain

新開 `preferred-sources`，不塞進 `seo-perfection`（status 已 done）或 `site-pages`（那是非文章
型頁面與全站導覽，跟這個橫跨文章頁側邊欄的元件對不上）。這是邊界清楚的外部平台整合，Google
日後改規則時集中改一處。

## 風險與代價

1. **UTM 可能被 Google 那頁拒絕**。我們在 `preferences/source?q=` 後面掛四個它不認識的參數，
   官方沒有任何文件保證未知 query 的處理方式。驗收時必須真的點一次確認仍正常帶出
   frankchen.tw。若有問題，UTM 整組拿掉、退回沒有版位辨識度的量測。
2. **G 標誌的商標風險（已知並接受）**。2026-08-21 實際下載官方素材包
   （`google_preferred_source_badge_all_languages.zip`，1.2 MB）確認：內容是 17 個語系
   （DA/DE/EN/ES/ET/FI/FR/HI/IW/JA/KO/NO/PT-BR/RU/SV/TR/UK）的 PNG，沒有中文、沒有任何 SVG。
   英文暗色版是 676×213（@2x）的黑色 pill，四色 G 加兩行白字。使用者截圖裡那顆中文按鈕來自
   官方的 standard JavaScript button（文件載明會自動翻譯），但那需要載入 Google 的 script
   並放寬 CSP，而 `verify-headers.mjs:40` 把整條 CSP 寫死，動它會撞上「不碰 `verify-*`」的
   需求，該路徑已排除。

   Google 品牌規範（partnermarketinghub.withgoogle.com，2026-08-21 查證）明載
   「Don't use the Google G in marketing materials for a business or to imply endorsement
   from Google」，允許的是新聞、教學、指稱性用途。站上這顆 CTA 是否落入「商業行銷素材」有
   解釋空間，但方向偏向「是」。Preferred Sources 文件雖允許自製設計（"use your own design
   assets"），該句指的是站方自己的素材，不等於授權把 Google 的 G 放進自製按鈕。

   以上已完整說明，使用者於 2026-08-21 決定採用四色 G（SVG 由使用者提供，非官方素材包），
   兩個放置點皆用彩色版。風險由站方承擔，不走純文字 fallback。
3. **GA4 的外連點擊追蹤需要開著**。增強型評估的「外連點擊」預設開啟，但未實際確認過本站後台
   的設定。沒開的話兩顆都量不到，而且不會有任何錯誤訊息。上線後第一件要確認的事。
4. **這功能沒有自動化回歸防線**。`verify-seo` 的站內連結檢查只看 `/` 開頭的 href、外連整條
   跳過；`npm test` 只跑 `scripts/lib/`，而網址組裝依 SSOT 規定要放 `site-meta.ts`。改壞 UTM
   或改錯網域，CI 會全綠。這是「不碰 verify-*」這條需求換來的代價，如實記錄，不假裝有防線。

## 稽核影響

純 HTML 連結加 inline SVG，不發第三方請求、不產生 console error。CI 四個稽核頁
（首頁／文章列表／關於我／文章頁樣本）的 Lighthouse 分數不受影響：文章頁 Best Practices
門檻 75 是 doubleclick 第三方 cookie 造成的（`docs/specs/monetization.md` R9），與這顆無關；
其餘三頁的 100 也保得住。`verify:seo` 的外連跳過規則見 `scripts/verify-seo.mjs:516`，
不需要動任何白名單。

## 驗收

- 本地預覽：連結可點、外觀正確、行動版不破版（含 768px 與 1024px 兩個斷點）
- 點擊後導向 Google 的來源偏好設定頁，且帶出 frankchen.tw（含 UTM 參數的完整網址）
- `npm run build` → `npm run verify:seo` 全綠
- CI（`seo-pr.yml`）全綠，四頁 Lighthouse 門檻不變
- 上線後：GA4 後台確認「增強型評估 → 外連點擊」已開，並在事件報表看得到 `link_url` 含
  `preferences/source` 的點擊，能依 `utm_content` 分出 `aside` 與 `footer`
