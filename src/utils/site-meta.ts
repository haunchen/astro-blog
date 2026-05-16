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
