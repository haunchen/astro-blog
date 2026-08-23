#!/usr/bin/env node
/**
 * 排程發布：把到期的草稿翻成正式文章。
 *
 * 預設 dry-run，與 sync-from-vault.mjs 同一個慣例：這支腳本的預設行為應該是「告訴我
 * 今天有什麼要發」，不是「動手」。加 --apply 才真的寫檔，而且就算 --apply 也只改工作區
 * ——不 commit、不 push。推上站是 workflow 或人按下 commit 那一刻決定的事。
 *
 * 設計文件：docs/plans/2026-08-23-scheduled-publish-design.md
 *
 * 用法：
 *   node scripts/publish-scheduled.mjs                    # dry-run，印今天到期的清單
 *   node scripts/publish-scheduled.mjs --apply            # 真的寫入工作區
 *   node scripts/publish-scheduled.mjs --date 2026-08-28  # 覆寫「今天」，供測試
 */

import { globSync } from 'glob';
import matter from 'gray-matter';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { toTaipeiDay, isDue, flipToPublished } from './lib/publish-scheduled.mjs';

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const POSTS_GLOB = 'src/content/posts/**/*.md';

/** 只接受 YYYY-MM-DD，避免 --date 收到含時區的字串又繞回時區問題。 */
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseArgs(argv) {
  const args = { apply: false, date: null, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--apply') args.apply = true;
    else if (a === '--date') args.date = argv[++i] ?? null;
    else if (a === '--help' || a === '-h') args.help = true;
    else throw new Error(`未知參數：${a}`);
  }
  if (args.date !== null && !DAY_RE.test(args.date)) {
    throw new Error(`--date 需為 YYYY-MM-DD，收到：${args.date}`);
  }
  return args;
}

const USAGE = `用法：
  node scripts/publish-scheduled.mjs                    dry-run，印今天到期的清單
  node scripts/publish-scheduled.mjs --apply            真的寫入工作區
  node scripts/publish-scheduled.mjs --date YYYY-MM-DD  覆寫「今天」，供測試`;

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(USAGE);
    return;
  }

  const today = args.date ?? toTaipeiDay(new Date());
  console.log(`今天（台北）：${today}${args.apply ? '' : '　　dry-run，未寫入'}`);

  const files = globSync(POSTS_GLOB, { cwd: PROJECT_ROOT }).sort();
  const due = [];
  const problems = [];

  for (const file of files) {
    const abs = path.join(PROJECT_ROOT, file);
    const raw = await fs.readFile(abs, 'utf8');

    let data;
    try {
      ({ data } = matter(raw));
    } catch (err) {
      // frontmatter 壞掉的檔不是這支腳本能修的，但也不能靜靜跳過——它可能正是今天
      // 該發的那篇。列進 problems 讓 CI 紅燈。
      problems.push({ file, reason: `frontmatter 解析失敗：${err.message}` });
      continue;
    }

    if (!isDue(data, today)) continue;

    const flipped = flipToPublished(raw);
    if (flipped === null) {
      // isDue 說到期、改寫卻做不到，代表 frontmatter 的形狀出乎預期（例如 date 縮排了）。
      // 這種矛盾不能吞，否則那篇會每天被判到期又每天沒動，永遠不會有人發現。
      problems.push({ file, reason: 'isDue 判為到期，但 frontmatter 無法改寫（缺 date？）' });
      continue;
    }

    due.push({ file, abs, ...flipped });
  }

  if (due.length === 0) {
    console.log('今天沒有到期的排程文章');
  } else {
    console.log(`到期 ${due.length} 篇`);
    for (const item of due) {
      const slug = item.file.replace(/^src\/content\/posts\//, '').replace(/\/index\.md$/, '');
      console.log(`  + ${slug}  date → ${item.publishedOn}`);
    }
  }

  if (args.apply) {
    for (const item of due) {
      await fs.writeFile(item.abs, item.text, 'utf8');
    }
    if (due.length > 0) console.log(`已寫入 ${due.length} 篇`);
  }

  if (problems.length > 0) {
    console.error(`\n有 ${problems.length} 篇需要人工處理：`);
    for (const p of problems) console.error(`  ! ${p.file}　${p.reason}`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
