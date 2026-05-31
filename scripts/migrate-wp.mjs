#!/usr/bin/env node
/**
 * migrate-wp.mjs
 * WP → Astro 內容遷移主腳本
 *
 * 用法: node scripts/migrate-wp.mjs <path-to-WXR.xml>
 *
 * 對每篇 publish 文章：
 *   1. 清空重建 src/content/posts/<slug>/（冪等，R13）
 *   2. HTML → Markdown
 *   3. 蒐集圖片 URL → 下載 + WebP 轉換
 *   4. 改寫內文圖片 ref
 *   5. 組 frontmatter（cover 穩健三段優先序）
 *   6. 寫 src/content/posts/<slug>/index.md（R5）
 *
 * 圖片失敗不中斷，記錄 URL + 篇名（R7）。
 */

import { readFile, rm, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseWxr } from './lib/wxr.mjs';
import { mapCategory, toIsoDate, makeDescription } from './lib/frontmatter.mjs';
import { htmlToMarkdown } from './lib/html-to-md.mjs';
import {
  collectImageUrls,
  planImageNames,
  downloadAndConvert,
} from './lib/images.mjs';
import { rewriteImageRefs, buildFrontmatter } from './lib/post-writer.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const POSTS_DIR = path.join(ROOT, 'src/content/posts');

// ── 入口引數 ───────────────────────────────────────────────────────────────
const WXR_PATH = process.argv[2];
if (!WXR_PATH) {
  console.error('用法: node scripts/migrate-wp.mjs <path-to-WXR.xml>');
  process.exit(1);
}

// ── 解析 WXR ──────────────────────────────────────────────────────────────
const xml = await readFile(WXR_PATH, 'utf-8');
const { posts, attachments } = parseWxr(xml);
console.log(`解析到 ${posts.length} 篇 publish 文章`);

let imgOk = 0;
let imgFail = 0;

// ── 逐篇處理 ──────────────────────────────────────────────────────────────
const postsRoot = path.resolve(POSTS_DIR);

for (const post of posts) {
  const slug = post.slug;

  // 安全守衛：空 slug 或路徑穿越（外部 WXR 輸入，不可信任）
  if (!slug) {
    console.error(`[SKIP] slug 為空，跳過此篇`);
    continue;
  }
  const outDir = path.resolve(POSTS_DIR, slug);
  if (outDir !== postsRoot && !outDir.startsWith(postsRoot + path.sep)) {
    console.error(`[SKIP] 偵測到不安全的 slug（路徑穿越）: ${slug}`);
    continue;
  }

  const imagesDir = path.join(outDir, 'images');

  console.log(`\n處理: ${slug}`);

  // R13 冪等：清空重建
  await rm(outDir, { recursive: true, force: true });
  await mkdir(imagesDir, { recursive: true });

  // 1. HTML → Markdown（圖片仍是原 URL）
  let markdown = htmlToMarkdown(post.contentHtml);

  // 2. 蒐集圖片 URL
  const contentUrls = collectImageUrls(markdown);
  const coverUrl = post.thumbnailId ? attachments[post.thumbnailId] : null;
  const plan = planImageNames(coverUrl, contentUrls);

  // 3. 下載 + WebP 轉換
  //    urlToLocal：內文圖成功下載的 url → localName
  const urlToLocal = {};

  // 3a. featured image（cover.webp）
  let coverRef = null; // 最終 frontmatter cover 路徑（相對）
  if (plan.cover) {
    const destPath = path.join(imagesDir, plan.cover.localName);
    const ok = await downloadAndConvert(plan.cover.url, destPath);
    if (ok) {
      coverRef = `./images/${plan.cover.localName}`;
      imgOk++;
    } else {
      console.error(`[IMG FAIL] ${slug}: ${plan.cover.url}`);
      imgFail++;
    }
  }

  // 3b. 內文圖（img-N.webp）
  for (const item of plan.content) {
    const destPath = path.join(imagesDir, item.localName);
    const ok = await downloadAndConvert(item.url, destPath);
    if (ok) {
      urlToLocal[item.url] = item.localName;
      imgOk++;
    } else {
      console.error(`[IMG FAIL] ${slug}: ${item.url}`);
      imgFail++;
    }
  }

  // 4. cover 穩健三段優先序
  //    Priority 1: featured image 成功下載 → coverRef 已設
  //    Priority 2: 第一張成功下載的內文圖
  //    Priority 3: 無可用圖 → 明確報錯，仍寫檔讓 build 報錯
  if (!coverRef) {
    const firstContent = plan.content.find((item) => urlToLocal[item.url]);
    if (firstContent) {
      coverRef = `./images/${firstContent.localName}`;
    } else {
      console.error(`[NO COVER] ${slug}: 無可用 cover（featured 與內文圖全部失敗或不存在）`);
      // 指向不存在的檔案，讓 build 明確失敗（不靜默吞掉）
      coverRef = './images/cover.webp';
    }
  }

  // 5. 改寫內文圖 ref
  markdown = rewriteImageRefs(markdown, urlToLocal);

  // 6. 組 frontmatter
  const fm = buildFrontmatter({
    title: post.title,
    date: toIsoDate(post.pubDate),
    description: makeDescription(post.excerpt, post.contentHtml),
    category: mapCategory(post.categoryNicename),
    tags: post.tags,
    cover: coverRef,
  });

  // 7. 寫 index.md（R5）
  await writeFile(path.join(outDir, 'index.md'), fm + '\n' + markdown, 'utf-8');
  console.log(`✓ ${slug}`);
}

// ── 彙總 ──────────────────────────────────────────────────────────────────
console.log(`\n完成。圖片成功 ${imgOk} / 失敗 ${imgFail}`);
