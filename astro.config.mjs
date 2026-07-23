import { readFileSync, renameSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';
import { globSync } from 'glob';
import matter from 'gray-matter';
import { rehypeTableCaption } from './scripts/lib/rehype-table-caption.mjs';

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
    build: {
      // 禁止 Astro 把小型 hoisted script 內聯進 HTML。全站因此 0 個 inline script，
      // CSP 的 script-src 才能收緊成 'self'（見 public/_headers）。實測把這個值改成
      // 4096，Nav.astro 的 script 就會被內聯回 HTML，CSP 會當場擋掉導覽選單。
      //
      // 副作用：Astro 的 build.inlineStylesheets 預設是 'auto'，判斷門檻用的正是這個
      // 值，所以設 0 等於連小型樣式表的內聯也一併關掉——首頁因此有 5 支外部 CSS 全部
      // 阻斷算繪。兩者共用同一顆旋鈕，不能只開其中一邊，故改用下面的 cssCodeSplit。
      assetsInlineLimit: 0,

      // 把全站 CSS 併成單一檔案，取代原本按頁面切出的 14 個 chunk。
      //
      // 動機：PSI 行動裝置版量到首頁有 5 支阻斷算繪的樣式表（估計延後算繪 790 毫秒），
      // 其中 4 支加起來只有 7.9 KB 卻各佔一次 round trip——在慢速 4G 上請求數比位元組
      // 數貴得多。合併後首頁 CSS 從「5 個請求 / 13,525 B (gzip)」變成「1 個請求 /
      // 15,293 B」，多 1.7 KB 換掉 4 次往返。
      //
      // 第二個好處是跨頁：合併前每種版面各自拉不同的 chunk 組合，換頁就要下載新檔；
      // 合併後全站共用同一支且帶內容雜湊與長 TTL，第二頁起 CSS 請求數為 0。
      //
      // 代價是首次載入會拿到用不到的樣式（例如首頁也含文章頁的 prose 樣式）。以本站
      // 全站 CSS 僅 15 KB (gzip) 的量體，這比多 4 次往返划算；若哪天 CSS 膨脹到數十 KB，
      // 要重新評估這個取捨。
      cssCodeSplit: false,
    },
  },
  markdown: {
    shikiConfig: {
      theme: 'tokyo-night',
      transformers: [
        {
          // tokyo-night 的註解色 #51597D 在其自身背景 #1a1b26 上對比只有 2.54:1，
          // 遠低於 WCAG AA 小字所需的 4.5:1（Lighthouse color-contrast 在每篇有
          // 程式碼的文章都會失敗）。程式碼註解往往是理解範例的關鍵，不該是最難讀的。
          // Shiki 把顏色寫成 inline style，CSS 覆蓋要靠 !important，改用 transformer
          // 在產生 HTML 時直接換掉，語意乾淨且不影響其他 token 的配色。
          // #7A82AB 對 #1a1b26 為 4.56:1，色相與原色一致，只是提高明度。
          span(node) {
            const style = node.properties?.style;
            if (typeof style === 'string' && style.toLowerCase().includes('#51597d')) {
              node.properties.style = style.replace(/#51597[dD]/g, '#7A82AB');
            }
          },
        },
      ],
    },
    rehypePlugins: [rehypeTableCaption],
  },
});
