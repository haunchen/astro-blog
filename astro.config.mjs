import { readFileSync } from 'node:fs';
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';
import { globSync } from 'glob';
import matter from 'gray-matter';

// sitemap serialize callback 只拿得到 URL，先從文章 frontmatter 建 pathname → lastmod 對照。
// astro.config 內無法使用 astro:content，直接以 gray-matter 讀 frontmatter；
// id 規則與 content loader 一致（去 base、去 /index.md 或 .md 後綴）。
const POST_LASTMOD = new Map(
  globSync('src/content/posts/**/*.md').map((file) => {
    const { data } = matter(readFileSync(file, 'utf8'));
    const id = file
      .replace(/\\/g, '/')
      .replace(/^src\/content\/posts\//, '')
      .replace(/\/index\.md$/, '')
      .replace(/\.md$/, '');
    return [`/${id}/`, new Date(data.updated ?? data.date)];
  }),
);

export default defineConfig({
  site: 'https://frankchen.tw',
  integrations: [
    sitemap({
      serialize(item) {
        const lastmod = POST_LASTMOD.get(new URL(item.url).pathname);
        if (lastmod) {
          item.lastmod = lastmod.toISOString();
        }
        return item;
      },
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
  markdown: {
    shikiConfig: {
      theme: 'tokyo-night',
    },
  },
});
