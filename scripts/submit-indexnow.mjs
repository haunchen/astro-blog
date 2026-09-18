#!/usr/bin/env node
/**
 * IndexNow 提交：把這次新上線或內容有更新的文章網址通知搜尋引擎。
 *
 * 一次 POST，Bing、Yandex、Seznam、Naver 都會收到。Google 不在其中——它沒有給一般文章的
 * 官方提交路徑，理由見設計文件。
 *
 * 送出前會先等線上 sitemap 反映出新的 lastmod，確認 Cloudflare Pages 的部署真的完成了。
 * 不等的話，搜尋引擎收到通知馬上來抓，拿到的會是舊版或 404。
 *
 * 失敗一律 exit 1：壞掉的只是這一次通知，文章本身早就上線了，重跑 workflow 即可補送。
 *
 * 設計文件：docs/plans/2026-09-18-index-submission-design.md
 *
 * 用法：
 *   node scripts/submit-indexnow.mjs --base <ref>     比對 <ref>..HEAD 的文章變動並送出
 *   node scripts/submit-indexnow.mjs --base <ref> --dry-run   只印清單，不等部署也不送
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import matter from 'gray-matter';
import {
  postPathToUrl,
  expectedLastmod,
  shouldSubmit,
  parseSitemapLastmods,
  buildIndexNowPayload,
} from './lib/indexnow.mjs';

const ORIGIN = 'https://frankchen.tw';
const HOST = 'frankchen.tw';
const KEY = 'a7f3c9e2b8d4416fa0c5e7d92b1f6403';
const ENDPOINT = 'https://api.indexnow.org/IndexNow';

const POLL_INTERVAL_MS = 15_000;
const POLL_TIMEOUT_MS = 10 * 60_000;
/** 首次加三次重試。只對 429 與 5xx 生效。 */
const MAX_ATTEMPTS = 4;

const USAGE = `用法：
  node scripts/submit-indexnow.mjs --base <ref>            比對 <ref>..HEAD 並送出
  node scripts/submit-indexnow.mjs --base <ref> --dry-run  只印清單，不等部署也不送`;

function parseArgs(argv) {
  const args = { base: null, dryRun: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--base') args.base = argv[++i] ?? null;
    else if (a === '--dry-run') args.dryRun = true;
    else if (a === '--help' || a === '-h') args.help = true;
    else throw new Error(`未知參數：${a}`);
  }
  return args;
}

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
}

/**
 * 確認 base ref 在本地真的可解析。
 *
 * `github.event.before` 在 force push 之後可能指向一個已經不可達的物件，而 `git diff` 對
 * 未知 ref 的錯誤訊息跟「這個 ref 沒有那個檔案」長得很像。先驗一次，拿不到就退回 HEAD~1
 * 並明說——退回的結果最多是少送或多送一篇，但沉默的失敗會讓整條管線看起來是綠的。
 */
function resolveBase(base) {
  if (base) {
    try {
      git(['rev-parse', '--verify', `${base}^{commit}`]);
      return base;
    } catch {
      console.warn(`base ref 無法解析：${base}，退回 HEAD~1`);
    }
  }
  return 'HEAD~1';
}

/** 這次變動到的文章檔案。`--diff-filter=d` 排除刪除——被刪的文章沒有網址可送。 */
function changedPostFiles(base) {
  const out = git([
    'diff',
    '--name-only',
    '--diff-filter=d',
    base,
    'HEAD',
    '--',
    'src/content/posts',
  ]);
  return out
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.endsWith('.md'));
}

/** 上一版的 frontmatter。檔案在 base 不存在（新增）時回 null。 */
function frontmatterAt(ref, file) {
  let raw;
  try {
    raw = git(['show', `${ref}:${file}`]);
  } catch {
    return null;
  }
  return matter(raw).data;
}

/** 工作區現況的 frontmatter。 */
function frontmatterNow(file) {
  if (!fs.existsSync(file)) return null;
  return matter(fs.readFileSync(file, 'utf8')).data;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 抓線上 sitemap。
 *
 * 帶 cache-busting query 與 no-cache：不破快取的話可能整整十分鐘都在讀 Cloudflare 邊緣的
 * 同一份舊副本，然後逾時紅燈——而部署其實早就好了。
 */
async function fetchSitemap() {
  const res = await fetch(`${ORIGIN}/sitemap.xml?cb=${Date.now()}`, {
    headers: { 'Cache-Control': 'no-cache' },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`抓取 sitemap 失敗：HTTP ${res.status}`);
  return res.text();
}

/**
 * 等到線上 sitemap 的 lastmod 與預期相符。
 *
 * 判據不用「網址回 200」：更新既有文章時舊版本同樣回 200，判不出新版上線沒。lastmod 一條
 * 規則同時涵蓋新文章與更新兩種情況。
 */
async function waitForDeployment(targets) {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  let pending = targets;
  for (;;) {
    const lastmods = parseSitemapLastmods(await fetchSitemap());
    pending = pending.filter((t) => lastmods.get(t.url) !== t.lastmod);
    if (pending.length === 0) return;
    if (Date.now() >= deadline) {
      const lines = pending.map((t) => `  ! ${t.url}　預期 lastmod ${t.lastmod}`).join('\n');
      throw new Error(`等待部署逾時（${POLL_TIMEOUT_MS / 60_000} 分鐘），未送出：\n${lines}`);
    }
    console.log(`等待部署……仍有 ${pending.length} 篇未反映到 sitemap`);
    await sleep(POLL_INTERVAL_MS);
  }
}

/**
 * 送出。
 *
 * 2xx 皆視為成功，202 也算——那只代表 key 還在驗證佇列裡，提交本身已經收下。
 * 429 與 5xx 是暫時性，指數退避重試；400／403／422 是打錯了，重試沒有意義。
 */
async function submit(payload) {
  let delay = 2_000;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(payload),
    });
    if (res.ok) return res.status;
    const retryable = res.status === 429 || res.status >= 500;
    if (!retryable || attempt === MAX_ATTEMPTS) {
      const body = await res.text().catch(() => '');
      throw new Error(`IndexNow 提交失敗：HTTP ${res.status} ${body}`.trim());
    }
    console.warn(`IndexNow 回 ${res.status}，${delay / 1000} 秒後重試（第 ${attempt} 次）`);
    await sleep(delay);
    delay *= 2;
  }
}

function writeSummary(lines) {
  const file = process.env.GITHUB_STEP_SUMMARY;
  if (!file) return;
  fs.appendFileSync(file, `${lines.join('\n')}\n`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(USAGE);
    return;
  }

  const base = resolveBase(args.base);
  const files = changedPostFiles(base);
  console.log(`比對 ${base}..HEAD，文章檔案變動 ${files.length} 個`);

  const targets = [];
  for (const file of files) {
    const url = postPathToUrl(file, ORIGIN);
    if (url === null) continue;
    const after = frontmatterNow(file);
    if (!shouldSubmit(frontmatterAt(base, file), after)) continue;
    const lastmod = expectedLastmod(after);
    if (lastmod === null) {
      // schema 要求 date 必填，走到這裡代表 frontmatter 形狀出乎預期。不能當成「沒事」
      // 跳過——那篇正是這次要通知的文章。
      throw new Error(`算不出預期 lastmod（缺 date？）：${file}`);
    }
    targets.push({ url, lastmod });
  }

  if (targets.length === 0) {
    console.log('沒有需要送出的文章');
    writeSummary(['## IndexNow', '- 結果：沒有需要送出的文章']);
    return;
  }

  console.log(`待送 ${targets.length} 篇：`);
  for (const t of targets) console.log(`  + ${t.url}`);

  if (args.dryRun) {
    console.log('dry-run，未等待部署也未送出');
    return;
  }

  await waitForDeployment(targets);
  const status = await submit(
    buildIndexNowPayload({ host: HOST, key: KEY, urls: targets.map((t) => t.url) }),
  );
  console.log(`已送出，IndexNow 回 HTTP ${status}`);
  writeSummary([
    '## IndexNow',
    `- 結果：已送出 ${targets.length} 篇（HTTP ${status}）`,
    ...targets.map((t) => `  - ${t.url}`),
  ]);
}

main().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
