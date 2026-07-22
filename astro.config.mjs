import { readFileSync, renameSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
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

// @astrojs/sitemap 一律輸出 sitemap-index.xml + sitemap-0.xml，無法直接指定單一檔名。
// 對外要的是 /sitemap.xml，且本站遠低於 entryLimit（預設 45000）只會有一個分片，
// 因此 build 後把該分片改名為 sitemap.xml 並移除只指向它的 index。
// 若哪天分片超過一個（即文章數破 45000），這裡會直接讓 build 失敗而非默默漏掉網址。
function sitemapAsSingleFile() {
  return {
    name: 'sitemap-as-single-file',
    hooks: {
      'astro:build:done': ({ dir }) => {
        const outDir = fileURLToPath(dir);
        const chunks = globSync('sitemap-*.xml', { cwd: outDir }).filter(
          (name) => name !== 'sitemap-index.xml',
        );
        if (chunks.length !== 1) {
          throw new Error(
            `sitemap 分片數為 ${chunks.length}（預期 1）：${chunks.join(', ')}。` +
              '超過一個分片時不能直接改名，否則會遺漏網址，請改回保留 sitemap-index.xml。',
          );
        }
        renameSync(join(outDir, chunks[0]), join(outDir, 'sitemap.xml'));
        rmSync(join(outDir, 'sitemap-index.xml'), { force: true });
      },
    },
  };
}

export default defineConfig({
  site: 'https://frankchen.tw',
  integrations: [
    sitemap({
      // 個別標籤彙整頁不進 sitemap：內容與文章頁重複、單頁文章數少，
      // 收錄價值低（WP 時期 Yoast 也是排除的，故舊 sitemap 只有 40 幾筆）。
      // 保留 /tag/ 總覽頁本身——它是導覽入口，個別標籤頁仍可被爬到，只是不主動提交。
      filter: (page) => !/\/tag\/[^/]+\//.test(new URL(page).pathname),
      serialize(item) {
        const lastmod = POST_LASTMOD.get(new URL(item.url).pathname);
        if (lastmod) {
          item.lastmod = lastmod.toISOString();
        }
        return item;
      },
    }),
    sitemapAsSingleFile(),
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
