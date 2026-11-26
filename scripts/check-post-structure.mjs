#!/usr/bin/env node
/**
 * 文章結構檢查的命令列入口（規則見 docs/specs/article-blocks.md R8）。
 *
 *   node scripts/check-post-structure.mjs                 # 檢查全部文章（CI）
 *   node scripts/check-post-structure.mjs a.md b.md       # 檢查指定檔案的工作區內容
 *   node scripts/check-post-structure.mjs --staged a.md   # 檢查 git index 的內容（pre-commit）
 *
 * --staged 讀 `git show :path` 而不是工作區：commit 的是索引內容，只改了工作區還沒 add 時
 * 檢查工作區會誤判。
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { globSync } from 'glob';
import matter from 'gray-matter';
import { checkPostStructure } from './lib/article-blocks.mjs';

const args = process.argv.slice(2);
const staged = args.includes('--staged');
const named = args.filter((a) => a !== '--staged');
// --staged 只在 pre-commit 帶著檔名呼叫時有意義；沒帶檔名就退回掃全部文章，會對未追蹤的檔 git show 而崩潰。
if (staged && named.length === 0) {
  console.error('check-post-structure：--staged 需要指定要檢查的檔案');
  process.exit(2);
}
const files = (named.length > 0 ? named : globSync('src/content/posts/**/*.md'))
  .map((f) => f.replace(/\\/g, '/'))
  .sort();

let total = 0;
for (const file of files) {
  const raw = staged
    ? execFileSync('git', ['show', `:${file}`], { encoding: 'utf8' })
    : readFileSync(file, 'utf8');
  const { content } = matter(raw);
  // 檢查函式回的行號是正文內的行號；加上 frontmatter 佔的行數才對得上編輯器看到的行號。
  const offset = raw.split(/\r?\n/).length - content.split(/\r?\n/).length;
  for (const v of checkPostStructure(content)) {
    total += 1;
    console.error(`${file}:${v.line + offset} ${v.rule}「${v.heading}」${v.message}`);
  }
}

console.log(`結構檢查：${files.length} 篇，${total} 條違規`);
if (total > 0) process.exitCode = 1;
