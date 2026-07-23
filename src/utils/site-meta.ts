export const SITE = {
  // 網站名：header/footer 顯示、<title> 後綴、og:site_name、JSON-LD（所有「網站」場合）
  name: '下班後的工程師筆記',
  tagline: '白天上班，下班寫 Side Project。',
  // 作者名（署名用：文章作者 byline、BlogPosting author / JSON-LD）
  author: '法蘭克｜不典型的軟體工程師',
  // header/footer 副標
  subtitle: '白天上班，下班寫 Side Project。',
  description: '從只會寫程式，到跨領域學習電路、製程、架站。在這裡分享實戰經驗、踩坑紀錄與自動化模板。',
  url: 'https://frankchen.tw',
  logo: 'https://frankchen.tw/logo.webp',
  email: 'frank@frankchen.tw',
  // <meta name="theme-color">：對齊 global.css 的 --color-bg-primary，行動裝置網址列同色
  themeColor: '#0f172a',
  // twitter:site / twitter:creator。目前無 X 帳號，留空即不輸出（空字串比假帳號好）。
  twitterHandle: '',
  // Google Search Console 驗證碼。走環境變數以免驗證碼進版控；未設定則不輸出該 meta。
  googleSiteVerification: import.meta.env.PUBLIC_GOOGLE_SITE_VERIFICATION ?? '',
  sameAs: [
    'https://www.threads.com/@frankchen.tw',
    'https://www.instagram.com/frankchen.tw/',
    'https://github.com/haunchen',
    'https://www.linkedin.com/in/frankchen0130/',
  ],
} as const;

export const CATEGORY_LABEL: Record<string, string> = {
  'n8n': 'n8n',
  'flutter': 'Flutter',
  'devops': 'DevOps',
  'raspberry-pi': 'Raspberry Pi',
  'tools': '工具',
};

// 導覽/列表/分類頁用的口語顯示名稱與顯示順序（單一來源）。
// 注意：CATEGORY_LABEL（上方）保留給 OG 圖與文章頁 badge，使用預建 subset 字型，
// 兩者刻意分開，勿合併，避免 OG subset 缺字。
export const CATEGORIES = [
  { slug: 'n8n', label: 'n8n 自動化' },
  { slug: 'devops', label: '架站部署' },
  { slug: 'flutter', label: 'Flutter' },
  { slug: 'tools', label: '工具' },
  { slug: 'raspberry-pi', label: '樹莓派' },
] as const;

const CATEGORY_DISPLAY: Record<string, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.slug, c.label]),
);

export function categoryLabel(slug: string): string {
  return CATEGORY_DISPLAY[slug] ?? slug;
}

// 頁面 <title> 單一來源：有頁名則「頁名 - 品牌名」，首頁等無頁名則純品牌名
export function pageTitle(title?: string): string {
  return title ? `${title} - ${SITE.name}` : SITE.name;
}

export const ORGANIZATION_JSONLD = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  '@id': `${SITE.url}/#org`,
  name: SITE.name,
  url: SITE.url,
  // logo 必須是 ImageObject（純字串 URL 會被 Rich Results Test 判為缺欄位）
  logo: {
    '@type': 'ImageObject',
    url: SITE.logo,
    width: 512,
    height: 512,
  },
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
    { href: `/tag/${encodeURIComponent('模板')}/`, label: 'n8n 模板' },
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
