// src/data/n8n-resources.ts
// n8n-resources 頁面後五區外部策展資料單一來源（spec site-pages #R18）
// 內容沿用原站 https://www.frankchen.tw/n8n-resources/ ，image 為 public/ 下絕對路徑

export type ResLink = { label: string; href: string };

export type Creator = {
  name: string;
  desc: string;
  image: string;
  links: ResLink[];
};

export type Community = {
  name: string;
  desc: string;
  image: string;
  joinHref: string;
};

// 區塊 3：推薦學習資源
export const LEARNING_RESOURCES: Creator[] = [
  {
    name: 'HC AI說人話',
    desc: 'n8n AI 實作 0 基礎入門到進階（3 小時影片）',
    image: '/n8n-resources/hc-ai.webp',
    links: [
      { label: 'YouTube 頻道', href: 'https://www.youtube.com/@HC-AIChannel' },
      { label: '影片', href: 'https://www.youtube.com/watch?v=vvqhzbp4J5A' },
      { label: 'Threads', href: 'https://www.threads.com/@hc_aichannel' },
    ],
  },
  {
    name: '偷懶辦公室（LazyOffice）',
    desc: '《提早下班系列》N8N + OpenAI 整合 LINE、Gmail、行事曆',
    image: '/n8n-resources/lazyoffice.webp',
    links: [
      { label: 'YouTube 頻道', href: 'https://www.youtube.com/@LazyOffice2024' },
      { label: '影片', href: 'https://www.youtube.com/watch?v=RxXMQ8CG5RI' },
      { label: 'Threads', href: 'https://www.threads.com/@lazyoffice2024' },
    ],
  },
  {
    name: 'PAPAYA 電腦教室',
    desc: 'n8n 工作流基礎教學（3 集系列）',
    image: '/n8n-resources/papaya.webp',
    links: [
      { label: 'YouTube 頻道', href: 'https://www.youtube.com/@papayaclass' },
      { label: '播放清單', href: 'https://www.youtube.com/playlist?list=PL7enJ2-v6SPk1_XBg2cOp58uV25_pamFd' },
    ],
  },
];

// 區塊 4：推薦進階應用
export const ADVANCED_APPS: Creator[] = [
  {
    name: 'Darrell',
    desc: 'n8n 教學：節點介紹、模板、部署指南',
    image: '/n8n-resources/darrell.webp',
    links: [
      { label: 'Threads', href: 'https://www.threads.com/@darrell_tw_' },
      { label: 'Website', href: 'https://www.darrelltw.com/' },
      { label: '教學資源', href: 'https://www.darrelltw.com/n8n-tutorial-resources/' },
    ],
  },
  {
    name: '科技宅阿高',
    desc: 'n8n 自動化流程教學',
    image: '/n8n-resources/geekaz.webp',
    links: [
      { label: 'Threads', href: 'https://www.threads.com/@geekaz/' },
      { label: 'Website', href: 'https://geekaz.net/' },
      { label: '文章標籤', href: 'https://geekaz.net/tag/automation-workflow/' },
    ],
  },
];

// 區塊 5：推薦模板
export const RECOMMENDED_TEMPLATES: Creator[] = [
  {
    name: 'Darrell',
    desc: '信用卡帳單自動建日曆提醒',
    image: '/n8n-resources/tpl-creditcard.webp',
    links: [
      { label: '模板', href: 'https://www.darrelltw.com/tools/n8n_template/model/creditcard.html' },
    ],
  },
  {
    name: 'Vicky（鋼鐵Ｖ）',
    desc: 'n8n 面試大師',
    image: '/n8n-resources/tpl-interviewer.webp',
    links: [
      { label: '模板', href: 'https://portaly.cc/ironvicky/product/myRHqQsuZLAz2TVrvDe4' },
      { label: 'Threads', href: 'https://www.threads.com/@ironv.careerlife' },
    ],
  },
  {
    name: 'Darks',
    desc: 'AI 知識助手',
    image: '/n8n-resources/tpl-ai-assistant.webp',
    links: [
      { label: '模板', href: 'https://portaly.cc/darks/product/XVvmqhkHO2BeiGn81IHc' },
      { label: 'Website', href: 'https://lifecheatslab.com/' },
    ],
  },
];

// 區塊 6：推薦 Line 社群
export const COMMUNITY: Community = {
  name: 'n8n & AI & Vibe Coding 討論交流群',
  desc: '社群裡充滿各路大神，歡迎有任何有關 n8n、AI、Vibe Coding 問題的大家加入群組一起討論',
  image: '/n8n-resources/line-community-qr.jpg',
  joinHref: 'https://line.me/ti/g2/bfnrSbbUE56PISKtQa9KK5gqpMhed_DXf-hmQw',
};

// 區塊 7：官方資源
export const OFFICIAL_LINKS: ResLink[] = [
  { label: '官方網站', href: 'https://n8n.io/' },
  { label: '官方文件', href: 'https://docs.n8n.io/' },
  { label: '官方模板', href: 'https://n8n.io/workflows/' },
  { label: '官方 Github', href: 'https://github.com/n8n-io/n8n' },
];
