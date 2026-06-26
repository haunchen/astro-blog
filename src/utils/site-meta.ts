export const SITE = {
  name: '下班後的工程師筆記',
  tagline: '白天上班，下班寫 Side Project。',
  url: 'https://frankchen.tw',
  logo: 'https://frankchen.tw/logo.png',
  email: 'frank@frankchen.tw',
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

export const ORGANIZATION_JSONLD = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  '@id': `${SITE.url}/#org`,
  name: SITE.name,
  url: SITE.url,
  logo: SITE.logo,
  email: SITE.email,
  sameAs: SITE.sameAs,
};

export const WEBSITE_JSONLD = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': `${SITE.url}/#website`,
  name: SITE.name,
  url: SITE.url,
  inLanguage: 'zh-TW',
  publisher: { '@id': `${SITE.url}/#org` },
};
