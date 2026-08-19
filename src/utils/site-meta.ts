import coverImage from '../assets/cover.webp';
import logoImage from '../assets/logo.webp';
import { tagSlug } from '../../scripts/lib/tag-slug.mjs';

// 正規主機。SITE.url 與下面幾個要組絕對網址的地方共用同一份字面值——物件實字內
// 無法自我參照，分開寫兩份就會在改網域時漏掉其中一邊。
const SITE_URL = 'https://frankchen.tw';

export const SITE = {
  // 網站名：header/footer 顯示、<title> 後綴、og:site_name、JSON-LD（所有「網站」場合）
  name: '下班後的工程師筆記',
  tagline: '白天上班，下班寫 Side Project。',
  // 作者名（署名用：文章作者 byline、BlogPosting author / JSON-LD）
  author: '法蘭克｜不典型的軟體工程師',
  // header/footer 副標
  subtitle: '白天上班，下班寫 Side Project。',
  description: '從只會寫程式，到跨領域學習電路、製程、架站。在這裡分享實戰經驗、踩坑紀錄與自動化模板。',
  url: SITE_URL,
  // logo 與 cover 都放 src/assets/ 走 astro:assets，輸出成 /_astro/<name>.<hash>.<ext>：
  // 檔名帶內容雜湊，內容一變網址就變，快取正確性不再依賴 Cloudflare dashboard 的
  // Cache Rule 設定（見 docs/specs/site-pages.md D19）。這裡要的是絕對網址（JSON-LD
  // 的 logo 欄位不吃相對路徑），故以 SITE_URL 接上 import 給的雜湊路徑。
  logo: `${SITE_URL}${logoImage.src}`,
  email: 'frank@frankchen.tw',
  // <meta name="theme-color">：對齊 global.css 的 --color-bg-primary，行動裝置網址列同色
  themeColor: '#0f172a',
  // twitter:site / twitter:creator
  twitterHandle: '@frankchen_tw',
  // Google Search Console 驗證碼。
  // 本站主要靠 DNS TXT 驗證，這個 meta 是第二道錨點——DNS 若哪天搬移或改寫，
  // 驗證不會跟著斷。值直接寫在這裡而非環境變數：它本來就會原樣出現在每一頁的
  // HTML 裡，不是秘密，藏進環境變數只是多一道部署設定卻沒有換到任何保護。
  // 仍保留環境變數覆寫，方便 fork 或預覽環境換成自己的驗證碼。
  googleSiteVerification:
    import.meta.env.PUBLIC_GOOGLE_SITE_VERIFICATION ??
    '6YGhgUvPOUW51Ju7lVpEX69-wEKZpewvpDWE_EX7kJ4',
  sameAs: [
    'https://www.threads.com/@frankchen.tw',
    'https://www.instagram.com/frankchen.tw/',
    'https://github.com/haunchen',
    'https://www.linkedin.com/in/frankchen0130/',
    // 下面這筆不進 SOCIAL 圖示列（那裡是固定的四個索引），只用於
    // Organization.sameAs——讓搜尋引擎把 X 帳號歸到同一個實體。
    'https://x.com/frankchen_tw',
  ],
} as const;

/**
 * og:image 的站台預設值——頁面沒有自己的縮圖時用它。
 *
 * width／height／type 直接取自圖檔本身而非寫死：BaseLayout 原本把這三個值寫成
 * 1200/630/png，對約 69 個非文章頁輸出的是不實的中繼資料。改讀 import 的
 * ImageMetadata 之後，換圖就自動跟著換，不會再有第二次漂移的機會。
 */
export const OG_FALLBACK = {
  src: coverImage.src,
  width: String(coverImage.width),
  height: String(coverImage.height),
  type: `image/${coverImage.format}`,
} as const;

// 短標籤：OG 圖、文章頁 badge、文章時間軸 badge 用。刻意不匯出——三個消費端一律走
// 下方的 categoryBadgeLabel()，`?? slug` 的 fallback 才只有一份（category 是 Zod enum，
// 那個分支實務上取不到，但取不到的分支散在三處仍然是三處要一起改）。
const CATEGORY_BADGE_LABEL: Record<string, string> = {
  'n8n': 'n8n',
  'flutter': 'Flutter',
  'devops': 'DevOps',
  'raspberry-pi': 'Raspberry Pi',
  'tools': '工具',
  'hardware': '硬體',
};

/**
 * 短標籤（'DevOps'、'Raspberry Pi'）。
 *
 * 與下方的 categoryLabel()（口語名稱，'架站部署'、'樹莓派'）是兩套不同的顯示名稱，
 * 刻意分開、勿合併：這一套的字元集有預建 subset 字型撐著（scripts/subset-fonts.mjs 的
 * CATEGORY_LABELS），合併會讓 OG 圖缺字。
 */
export function categoryBadgeLabel(slug: string): string {
  return CATEGORY_BADGE_LABEL[slug] ?? slug;
}

// 導覽/列表/分類頁用的口語顯示名稱與顯示順序（單一來源）。
// 注意：短標籤（上方 categoryBadgeLabel）是另一套，理由見該函式註解。
export const CATEGORIES = [
  { slug: 'n8n', label: 'n8n 自動化' },
  { slug: 'devops', label: '架站部署' },
  { slug: 'flutter', label: 'Flutter' },
  { slug: 'tools', label: '工具' },
  { slug: 'raspberry-pi', label: '樹莓派' },
  { slug: 'hardware', label: '硬體維護' },
] as const;

const CATEGORY_DISPLAY: Record<string, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.slug, c.label]),
);

export function categoryLabel(slug: string): string {
  return CATEGORY_DISPLAY[slug] ?? slug;
}

/** Google SERP 大約在 60 個字元處截斷標題，超出的部分等於沒有版位。 */
const TITLE_MAX = 60;

// 頁面 <title> 單一來源：有頁名則「頁名 - 品牌名」，首頁等無頁名則純品牌名。
// 若加上品牌後綴會超過 60 字元，就不加——被截掉的本來就是尾端的品牌名，
// 留著只是把 SERP 版位讓給一段顯示不完的字，不如全部留給頁名本身。
export function pageTitle(title?: string): string {
  if (!title) return SITE.name;
  const withBrand = `${title} - ${SITE.name}`;
  return withBrand.length <= TITLE_MAX ? withBrand : title;
}

export const ORGANIZATION_JSONLD = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  '@id': `${SITE.url}/#org`,
  name: SITE.name,
  url: SITE.url,
  // 這裡刻意用字串而非 ImageObject：schema.org 兩者都合法，但獨立 Organization
  // 節點上的 logo，部分驗證器（squirrelscan）只接受字串 URL。
  // Article 內的 publisher 需求相反（見 PUBLISHER_JSONLD），故兩處分開定義。
  logo: SITE.logo,
  email: SITE.email,
  sameAs: SITE.sameAs,
};

/**
 * Article/BlogPosting 的 publisher 專用：Google 要求 publisher.name 與 publisher.logo
 * 必須在該筆 Article 內可解析，用 { '@id': ... } 外部參照會被判為缺欄位，故此處內聯。
 */
export const PUBLISHER_JSONLD = {
  '@type': 'Organization',
  '@id': `${SITE.url}/#org`,
  name: SITE.name,
  url: SITE.url,
  logo: {
    '@type': 'ImageObject',
    url: SITE.logo,
    width: 512,
    height: 512,
  },
};

export const WEBSITE_JSONLD = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': `${SITE.url}/#website`,
  name: SITE.name,
  alternateName: SITE.author,
  description: SITE.description,
  url: SITE.url,
  inLanguage: 'zh-TW',
  publisher: { '@id': `${SITE.url}/#org` },
};

/** SERP 的 description 版位：低於這個長度是浪費版位，超過會被截斷。 */
const DESC_MIN = 120;
const DESC_MAX = 160;

/**
 * 列表頁（分類／標籤）的 meta description 產生器。
 *
 * 為什麼要有這支：站上有 5 個分類頁 + 55 個標籤頁，若共用同一句樣板只換名稱與
 * 篇數，搜尋引擎會視為近似重複的描述而讓它失去作用。改以該頁實際的資料組出
 * 描述——篇數、最新幾篇的標題——每頁的組合天然不同，而且內容是真的，不是為了
 * 差異化硬湊出來的字。
 *
 * 加標題前必須先確認整句放得下：直接串完再截斷，會從標題中間硬切，產生
 * 「另有〈不用再當搬運工！ n8n 助你實現 Notion 無縫轉移 WordPre…」這種〈〉
 * 不閉合的殘句（正式站上實際出現過）。寧可短一點也不要切半。
 *
 * @param lead 開場句，需自行帶入頁名與篇數
 * @param titles 文章標題，順序需與畫面一致（新到舊）
 * @param padding 冷門頁湊不到下限時逐句補上的句子；分類與標籤頁請各自給不同的
 *                句子，否則補完之後兩種列表頁的結尾又會撞在一起
 */
export function listPageDescription(opts: {
  lead: string;
  titles: string[];
  padding: string[];
}): string {
  let description = opts.lead;

  for (const [i, title] of opts.titles.entries()) {
    if (description.length >= DESC_MIN) break;
    const clause = i === 0 ? `最新一篇是〈${title}〉，` : `另有〈${title}〉，`;
    if (description.length + clause.length > DESC_MAX) break;
    description += clause;
  }
  description = description.replace(/，$/, '。');

  for (const sentence of opts.padding) {
    if (description.length >= DESC_MIN) break;
    description += sentence;
  }

  // 補完仍可能超出上限（padding 的最後一句可能把長度推過去）。這裡的截斷只會
  // 落在 padding 的句子上——標題已在上面逐句確認過放得下，不會被切到。
  return description.length <= DESC_MAX ? description : `${description.slice(0, DESC_MAX - 1)}…`;
}

/** 列表頁（分類／標籤／文章總覽）共用的 CollectionPage JSON-LD */
export function collectionPageJsonLd(opts: {
  name: string;
  description: string;
  path: string;
  items: { title: string; path: string }[];
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: opts.name,
    description: opts.description,
    url: new URL(opts.path, SITE.url).href,
    inLanguage: 'zh-TW',
    isPartOf: { '@id': `${SITE.url}/#website` },
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: opts.items.length,
      itemListElement: opts.items.map((item, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: item.title,
        url: new URL(item.path, SITE.url).href,
      })),
    },
  };
}

// 首頁內容單一來源 ---------------------------------------------------
//
// 這些文案原本內聯在 index.astro。抽出來是因為 /index.md 要輸出「同一個首頁」的
// markdown 表示（見 docs/specs/agent-markdown.md R6）——兩邊各留一份副本，改了
// HTML 忘了改 md 不會有任何東西擋得住，agent 就會拿到過期的站台介紹。
export const HOME = {
  // 首頁不走 pageTitle()：那會得到純品牌名（僅 9 字元），對搜尋結果太短也說不出
  // 本站在寫什麼，故直接組出「品牌名｜主題」的完整標題。
  title: `${SITE.name}｜n8n 自動化、架站部署與 Flutter 開發實戰筆記`,
  description:
    '下班後的工程師筆記：白天上班，下班寫 Side Project。從只會寫程式，到跨領域學習電路、製程與架站，這裡分享 n8n 自動化流程、WordPress 與 Cloudflare 架站部署、Flutter App 開發與樹莓派實作的實戰經驗、踩坑紀錄，以及可直接套用的自動化模板。',
  ogImage: OG_FALLBACK.src,
  about: {
    bio: '系統整合工程師，擁有超過 3 年的軟體開發經驗。曾領導 5 人團隊完成兩代智慧醫療模擬器的完整開發與商業化，涵蓋軟體、韌體、硬體、App 及後端系統。',
    role: '系統整合課長 @ 原妙醫學科技',
    tags: ['系統架構', '電路設計', 'Flutter', 'n8n', 'Raspberry Pi'],
  },
  projects: [
    {
      name: 'n8nManager',
      desc: 'n8n 工作流管理 App，雙平台即時監控',
      tags: ['Flutter', 'Dart', 'MVVM'],
      link: 'https://n8nmanager.frankchen.tw/',
      linkText: '前往 n8nManager 網站 →',
    },
    {
      name: '醫療教學模擬器 G3',
      desc: '領導 5 人團隊開發，BOM 成本降低 30%',
      tags: ['Raspberry Pi', 'Hailo AI'],
      link: '/about/',
      linkText: '了解 G3 專案細節 →',
    },
    {
      name: '法蘭克技術部落格',
      desc: '個人技術部落格，分享開發實戰經驗',
      tags: ['Astro', 'Cloudflare'],
      link: '/',
      linkText: '前往部落格首頁 →',
    },
  ],
} as const;

// header/footer 導覽與連結單一來源 ---------------------------------

// 社群圖示：由 SITE.sameAs（threads/instagram/github/linkedin 順序）＋ email 推出
export const SOCIAL = [
  { icon: 'threads', label: 'Threads', href: SITE.sameAs[0] },
  { icon: 'instagram', label: 'Instagram', href: SITE.sameAs[1] },
  { icon: 'github', label: 'GitHub', href: SITE.sameAs[2] },
  { icon: 'linkedin', label: 'LinkedIn', href: SITE.sameAs[3] },
  { icon: 'email', label: 'Email', href: `mailto:${SITE.email}` },
] as const;

// Header 導覽；文章為下拉，固定 3 項策展清單（照原站，與 CATEGORIES 顯示名解耦）
export const HEADER_NAV = [
  { href: '/', label: '首頁' },
  { href: '/about/', label: '關於我' },
  { href: '/n8n-resources/', label: 'n8n 相關資源' },
  {
    href: '/articles/',
    label: '文章',
    children: [
      { href: '/category/n8n/', label: 'n8n 相關文章' },
      { href: '/category/flutter/', label: 'Flutter 開發' },
      { href: '/category/raspberry-pi/', label: 'Raspberry Pi' },
    ],
  },
  { href: '/contact-frank/', label: '聯絡我' },
] as const;

// Footer 兩欄策展連結（標籤沿用原站文字；分類/標籤連到實際頁面）
export const FOOTER_COLS = [
  [
    { href: '/category/n8n/', label: 'n8n 自動化' },
    { href: `/tag/${encodeURIComponent(tagSlug('模板'))}/`, label: 'n8n 模板' },
    { href: '/category/devops/', label: 'WordPress 架站' },
    { href: '/category/flutter/', label: 'App 應用開發' },
  ],
  [
    { href: '/n8n-resources/', label: 'n8n 學習資源' },
    { href: '/about/', label: '關於我' },
    { href: '/contact-frank/', label: '聯絡我' },
    { href: '/privacy-policy/', label: '隱私權政策' },
  ],
] as const;
