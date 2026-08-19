#!/usr/bin/env node
/**
 * vault → posts collection 的發布管線。
 *
 * 預設 dry-run：這支腳本的預設行為應該是「告訴我現在狀況如何」，不是「動手」。
 * 加 --apply 才真的寫檔，而且就算 --apply 也只改工作區——不 commit、不 push、
 * 不碰 vault。文章上不上站是人按 commit 那一刻決定的事。
 *
 * 設計文件：docs/plans/2026-08-19-sync-from-vault-design.md
 *
 * 用法：
 *   node scripts/sync-from-vault.mjs                 # dry-run，印報告
 *   node scripts/sync-from-vault.mjs --apply         # 真的寫入
 *   node scripts/sync-from-vault.mjs --slug <slug>   # 只處理單篇
 *   node scripts/sync-from-vault.mjs --vault <path>  # 覆寫 vault 位置
 */

import { glob } from 'glob';
import matter from 'gray-matter';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { transformPost, renderPostFile } from './lib/vault-post.mjs';

const POSTS_DIR = 'src/content/posts';

/** 與 scripts/lib/images.mjs 的 migrate-wp 管線同值，站上圖片品質才一致。 */
const WEBP_QUALITY = 82;

function parseArgs(argv) {
  const args = { apply: false, slug: null, vault: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--apply') args.apply = true;
    else if (a === '--slug') args.slug = argv[++i] ?? null;
    else if (a === '--vault') args.vault = argv[++i] ?? null;
    else if (a === '--help' || a === '-h') args.help = true;
    else throw new Error(`未知參數：${a}`);
  }
  return args;
}

/**
 * vault 根目錄：--vault > VAULT_PATH > ~/obsidian-vault。
 *
 * 必須解 symlink：`~/obsidian-vault` 在本機是指向實體儲存位置的連結，而 glob 預設
 * 不跟隨 symlink——不解的話掃出來是零筆，而且不會報錯，看起來就像「vault 裡沒有文章」。
 * vault 自己的 hook 系統踩過同一個根因（字面路徑比對 vs realpath），修法也是這個。
 */
async function resolveVaultRoot(override) {
  const raw = path.resolve(
    override ?? process.env.VAULT_PATH ?? path.join(os.homedir(), 'obsidian-vault'),
  );
  try {
    return await fs.realpath(raw);
  } catch {
    return raw; // 不存在時原樣回傳，讓下面那道存在性檢查去報錯
  }
}

/**
 * 掃 vault 找所有 tutorial。
 *
 * 跳過所有 `.` 開頭的目錄是規則而不是清單：vault 頂層就有十幾個 dot 目錄，
 * 而 `.stversions`（Syncthing 版本史）裡是整份 vault 的歷史快照——逐一列舉遲早會漏，
 * 漏掉的表現是「同一篇文章冒出好幾個過期版本」而且不會報錯。
 * （Frankify 的 task-board 踩過同一個坑，見該專案 issue #144。）
 */
async function findVaultTutorials(vaultRoot) {
  return glob('**/*.md', {
    cwd: vaultRoot,
    absolute: true,
    // 99-Template 是 vault 的空白模板（frontmatter-tutorial.md 帶 type: tutorial 但每一欄都空），
    // 不排掉的話每次 dry-run 都會多一筆「什麼都缺」的假警報。
    ignore: ['**/.*/**', '**/node_modules/**', '99-Template/**'],
  });
}

/** repo 已有哪些 slug——只新增不覆蓋，這些一律跳過（設計文件 D1）。 */
async function findExistingSlugs() {
  const entries = await fs.readdir(POSTS_DIR, { withFileTypes: true });
  return new Set(entries.filter((e) => e.isDirectory()).map((e) => e.name));
}

/**
 * 把一則圖片引用解析成 vault 內的實體路徑。
 *
 * 兩種語法的解析基準不同：wikilink 寫的是 vault 根目錄相對路徑，
 * markdown 的相對路徑則是相對該篇 .md 所在的目錄。
 */
function resolveImagePath({ kind, src }, vaultRoot, mdDir) {
  if (kind === 'wikilink') return path.join(vaultRoot, src);
  if (path.isAbsolute(src)) return src;
  return path.resolve(mdDir, src);
}

async function exists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function convertToWebp(srcPath, destPath) {
  await fs.mkdir(path.dirname(destPath), { recursive: true });
  await sharp(srcPath).webp({ quality: WEBP_QUALITY }).toFile(destPath);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(
      [
        '用法：node scripts/sync-from-vault.mjs [選項]',
        '',
        '  --apply         真的寫入（預設只做 dry-run）',
        '  --slug <slug>   只處理指定的一篇',
        '  --vault <path>  覆寫 vault 位置（預設 $VAULT_PATH 或 ~/obsidian-vault）',
      ].join('\n'),
    );
    return;
  }

  const vaultRoot = await resolveVaultRoot(args.vault);
  if (!(await exists(vaultRoot))) {
    console.error(`找不到 vault：${vaultRoot}`);
    process.exitCode = 1;
    return;
  }

  console.log(`vault：${vaultRoot}`);
  console.log(`模式：${args.apply ? 'APPLY（會寫檔）' : 'dry-run（不寫任何檔案）'}\n`);

  const [files, existingSlugs] = await Promise.all([
    findVaultTutorials(vaultRoot),
    findExistingSlugs(),
  ]);

  const ready = [];
  const blocked = [];
  let skippedExisting = 0;
  let skippedOther = 0;

  for (const file of files) {
    const raw = await fs.readFile(file, 'utf-8');
    let parsed;
    try {
      parsed = matter(raw);
    } catch {
      continue; // frontmatter 壞掉的檔在 vault 裡不歸這支腳本管
    }

    const result = transformPost(parsed.data, parsed.content);
    if (result.status === 'skipped') {
      if (parsed.data.type === 'tutorial') skippedOther++;
      continue;
    }
    if (args.slug && result.slug !== args.slug) continue;
    if (result.slug && existingSlugs.has(result.slug)) {
      skippedExisting++;
      continue;
    }

    if (result.status === 'blocked') {
      blocked.push({ file, result });
      continue;
    }

    // 第二道檢查：圖檔真的在不在。lib 是純函式碰不到檔案系統，但少一張圖
    // astro build 就會失敗，所以缺圖必須和缺欄位一樣擋下來，不能只是警告。
    const mdDir = path.dirname(file);
    const missing = [];
    const coverPath = resolveImagePath({ kind: 'markdown', src: result.cover.src }, vaultRoot, mdDir);
    if (!(await exists(coverPath))) missing.push(result.cover.src);

    const imageJobs = [{ srcPath: coverPath, destName: result.cover.destName }];
    for (const img of result.images) {
      const p = resolveImagePath(img, vaultRoot, mdDir);
      if (!(await exists(p))) missing.push(img.src);
      else imageJobs.push({ srcPath: p, destName: img.destName });
    }

    if (missing.length > 0) {
      result.issues.push(...missing.map((m) => `圖檔不存在：${m}`));
      blocked.push({ file, result });
      continue;
    }

    ready.push({ file, result, imageJobs });
  }

  if (ready.length > 0) {
    console.log(`可搬 ${ready.length} 篇`);
    for (const { result } of ready) {
      const fm = result.frontmatter;
      const state = fm.draft ? 'draft' : 'READY→上站';
      console.log(`  + ${result.slug}  [${fm.category}] ${state}  圖 ${result.images.length + 1} 張`);
    }
    console.log();
  }

  if (blocked.length > 0) {
    console.log(`不合規 ${blocked.length} 篇（差最少的排前面）`);
    // 只差一張封面的和整篇還沒開始寫的混在一起，會讓「補一下就能發」的那幾篇沉在中間。
    blocked.sort((a, b) => a.result.issues.length - b.result.issues.length);
    for (const { result, file } of blocked) {
      console.log(`  x ${result.slug ?? path.basename(file)}`);
      for (const issue of result.issues) console.log(`      ${issue}`);
    }
    console.log();
  }

  const warned = [...ready, ...blocked].filter(({ result }) => result.warnings.length > 0);
  if (warned.length > 0) {
    console.log('警告（不擋落地）');
    for (const { result } of warned) {
      for (const w of result.warnings) console.log(`  ! ${result.slug}：${w}`);
    }
    console.log();
  }

  console.log(`略過：repo 已有 ${skippedExisting} 篇、已發布或狀態不適用 ${skippedOther} 篇`);

  if (!args.apply) {
    console.log('\ndry-run 結束，未寫入任何檔案。要落地請加 --apply');
    return;
  }

  if (ready.length === 0) {
    console.log('\n沒有可落地的文章。');
    return;
  }

  console.log('\n寫入中…');
  for (const { result, imageJobs } of ready) {
    const destDir = path.join(POSTS_DIR, result.slug);
    await fs.mkdir(path.join(destDir, 'images'), { recursive: true });

    for (const job of imageJobs) {
      await convertToWebp(job.srcPath, path.join(destDir, 'images', job.destName));
    }
    await fs.writeFile(
      path.join(destDir, 'index.md'),
      renderPostFile(result.frontmatter, result.body),
      'utf-8',
    );
    console.log(`  ✓ ${destDir}`);
  }

  console.log(
    `\n完成 ${ready.length} 篇。檔案只在工作區，尚未 commit——` +
      '請自行 review diff 後再決定要不要發布。',
  );
}

main().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
