# 排程發布（publish-scheduled）Implementation Plan

Goal: 讓已進 repo 的文章帶一個 `publishAt` 日期，到期由 GitHub Actions 自動把 `draft` 翻掉並推回 main，Cloudflare Pages 照常部署。

Architecture: 新增 optional frontmatter 欄位 `publishAt`。純函式（到期判定、frontmatter 行級改寫）放 `scripts/lib/publish-scheduled.mjs`，`scripts/publish-scheduled.mjs` 是薄 CLI（預設 dry-run、`--apply` 才寫工作區、不 commit 不 push）。`.github/workflows/publish-scheduled.yml` 每日 cron 跑 CLI，有變更才 build、驗證、commit、push。

Tech Stack: Node 22（`.nvmrc`）、node:test、gray-matter、glob、Astro content collections（zod schema）、GitHub Actions。

Design: `docs/plans/2026-08-23-scheduled-publish-design.md`

Spec: 無獨立 spec，design doc 即規格。

## Global Constraints

- Node 版本讀 `.nvmrc`（目前 22），CI 一律 `node-version-file: '.nvmrc'`，不寫死版本號
- 測試指令是 `node --test "scripts/lib/*.test.mjs"`，所以測試檔必須放在 `scripts/lib/` 且命名為 `*.test.mjs`，放別處不會被跑到
- 所有註解、文件、commit message 一律正體中文（台灣用語）
- 註解寫「為什麼」不寫「做什麼」，與 repo 既有風格一致（見 `scripts/lib/vault-post.mjs`）
- GitHub 官方 action 一律追大版本 tag（`@v7`）而非鎖小版本，理由見 `.github/workflows/seo-pr.yml` 檔頭
- workflow 任何步驟都不得使用 `continue-on-error`（design D8）
- 日期比較一律歸算到 `Asia/Taipei` 日曆日，不比 UTC 時間戳（design D7）
- frontmatter 改寫一律行級文字操作，禁止 gray-matter 讀出再序列化寫回（design D4）
- 範圍外，一行都不要動：`scripts/sync-from-vault.mjs`、`scripts/lib/vault-post.mjs`、vault 端任何檔案
- 每個 task 結束時 commit，訊息用 Conventional Commits

---

### Task 1: 到期判定與 frontmatter 改寫的純函式

Files:
- Create: `scripts/lib/publish-scheduled.mjs`
- Test: `scripts/lib/publish-scheduled.test.mjs`

Interfaces:
- Produces:
  - `toTaipeiDay(value: Date | string): string | null` — 把時間點歸算成 `Asia/Taipei` 的日曆日字串（`YYYY-MM-DD`），無法解析回 `null`
  - `isDue(data: Record<string, unknown>, today: string): boolean` — 給 frontmatter 物件與今天的台北日曆日，判定這篇是否該翻牌
  - `flipToPublished(raw: string): { text: string, publishedOn: string } | null` — 給 md 全文，回傳改寫後的全文與採用的發布日；不具備翻牌條件時回 `null`

Step 1: 寫失敗的測試

Create `scripts/lib/publish-scheduled.test.mjs`：

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toTaipeiDay, isDue, flipToPublished } from './publish-scheduled.mjs';

test('toTaipeiDay：YAML 解析出的 UTC 午夜 Date 歸算回同一個日曆日', () => {
  // gray-matter 把裸日期 `2026-08-28` 解析成 2026-08-28T00:00:00Z，
  // 台北是同日早上八點，不能因為時區位移就變成 8/29。
  assert.equal(toTaipeiDay(new Date('2026-08-28T00:00:00Z')), '2026-08-28');
});

test('toTaipeiDay：UTC 當日下午四點之後在台北已是隔天', () => {
  assert.equal(toTaipeiDay(new Date('2026-08-27T16:30:00Z')), '2026-08-28');
  assert.equal(toTaipeiDay(new Date('2026-08-27T15:30:00Z')), '2026-08-27');
});

test('toTaipeiDay：接受字串，無法解析回 null', () => {
  assert.equal(toTaipeiDay('2026-08-28'), '2026-08-28');
  assert.equal(toTaipeiDay('不是日期'), null);
  assert.equal(toTaipeiDay(''), null);
});

test('isDue：draft 且 publishAt 是過去或今天才算到期', () => {
  const today = '2026-08-28';
  assert.equal(isDue({ draft: true, publishAt: new Date('2026-08-27T00:00:00Z') }, today), true);
  assert.equal(isDue({ draft: true, publishAt: new Date('2026-08-28T00:00:00Z') }, today), true);
  assert.equal(isDue({ draft: true, publishAt: new Date('2026-08-29T00:00:00Z') }, today), false);
});

test('isDue：沒有 publishAt 的草稿永遠不動', () => {
  // 這是整個設計的安全性質：還在寫的稿只有 draft 沒有 publishAt，
  // 不論腳本出什麼錯都不可能被發出去。
  const today = '2026-08-28';
  assert.equal(isDue({ draft: true }, today), false);
  assert.equal(isDue({ draft: true, publishAt: null }, today), false);
  assert.equal(isDue({ draft: true, publishAt: '不是日期' }, today), false);
});

test('isDue：已上站的文章不動，即使帶著 publishAt', () => {
  const today = '2026-08-28';
  assert.equal(isDue({ publishAt: new Date('2026-08-01T00:00:00Z') }, today), false);
  assert.equal(isDue({ draft: false, publishAt: new Date('2026-08-01T00:00:00Z') }, today), false);
});

const SAMPLE = `---
title: 這是一篇文章：副標題也有全形冒號
date: 2026-08-01
updated: 2026-08-05
description: 描述文字
category: devops
tags:
  - n8n
  - 自動化
cover: ./images/cover.webp
draft: true
publishAt: 2026-08-28
---

正文第一段。

---

分隔線後的第二段，這裡的三個減號不是 frontmatter 結尾。
`;

test('flipToPublished：date 換成 publishAt，draft 與 publishAt 兩行整行移除', () => {
  const result = flipToPublished(SAMPLE);
  assert.notEqual(result, null);
  assert.equal(result.publishedOn, '2026-08-28');
  assert.match(result.text, /^date: 2026-08-28$/m);
  assert.doesNotMatch(result.text, /^draft:/m);
  assert.doesNotMatch(result.text, /^publishAt:/m);
});

test('flipToPublished：除了那三行以外一個字元都不動', () => {
  const result = flipToPublished(SAMPLE);
  const before = SAMPLE.split('\n');
  const after = result.text.split('\n');
  // 預期少兩行（draft、publishAt），date 那行換值，其餘逐行相同。
  assert.equal(after.length, before.length - 2);
  const survivors = before.filter((l) => !/^(draft|publishAt):/.test(l));
  survivors[survivors.findIndex((l) => /^date:/.test(l))] = 'date: 2026-08-28';
  assert.deepEqual(after, survivors);
});

test('flipToPublished：正文裡的 --- 不會被當成 frontmatter 結尾', () => {
  const result = flipToPublished(SAMPLE);
  assert.match(result.text, /分隔線後的第二段/);
  assert.match(result.text, /\n---\n\n分隔線後的第二段/);
});

test('flipToPublished：沒有 publishAt 或沒有 date 時回 null', () => {
  const noPublishAt = SAMPLE.replace(/^publishAt: .*$/m, '');
  assert.equal(flipToPublished(noPublishAt), null);
  const noDate = SAMPLE.replace(/^date: .*$/m, '');
  assert.equal(flipToPublished(noDate), null);
});

test('flipToPublished：沒有 frontmatter 的檔回 null 而不是丟例外', () => {
  assert.equal(flipToPublished('沒有 frontmatter 的純文字'), null);
  assert.equal(flipToPublished('---\n只有開頭沒有結尾\n'), null);
});
```

Step 2: 跑測試確認失敗

Run: `cd /Users/haunchenchen/Projects/astro-blog && node --test "scripts/lib/publish-scheduled.test.mjs"`

Expected: FAIL（`Cannot find module './publish-scheduled.mjs'`）

Step 3: 寫最小實作讓測試通過

Create `scripts/lib/publish-scheduled.mjs`：

```js
/**
 * 排程發布的純函式：判定哪篇到期、以及怎麼改寫它的 frontmatter。
 *
 * 抽 lib 不只是為了測試——Frankify 的 Discord 發布介面會是同一份邏輯的第二個消費端，
 * 寫進 CLI 就得抄第二份。與 vault-post.mjs 同一個形狀，理由也相同。
 *
 * 設計文件：docs/plans/2026-08-23-scheduled-publish-design.md
 */

/**
 * `en-CA` 的日期輸出恰好就是 `YYYY-MM-DD`，不必自己補零拼字串。
 */
const TAIPEI_DAY = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Taipei',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/**
 * 把一個時間點歸算成台北的日曆日。
 *
 * 「2026-08-28 發布」講的是台北時間的 8/28，但 cron 一律 UTC、gray-matter 又把裸日期
 * 解析成 UTC 午夜。直接比時間戳的話，現在（cron 設在台北早上八點＝UTC 00:00）剛好會對，
 * 但只要哪天把 cron 往前挪就會整批錯一天。歸算成日曆日再比字串就沒有這個脆弱點。
 *
 * @param {Date | string} value
 * @returns {string | null} `YYYY-MM-DD`，無法解析回 null
 */
export function toTaipeiDay(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return TAIPEI_DAY.format(d);
}

/**
 * 這篇今天該不該翻牌。
 *
 * 兩個條件都要成立：是草稿、而且有一個已到期的 publishAt。後者是安全性質——還在寫的稿
 * 沒有 publishAt，所以永遠落在這個述詞外面。
 *
 * @param {Record<string, unknown>} data frontmatter 物件
 * @param {string} today 台北日曆日 `YYYY-MM-DD`
 * @returns {boolean}
 */
export function isDue(data, today) {
  if (data?.draft !== true) return false;
  const raw = data.publishAt;
  if (raw === undefined || raw === null) return false;
  if (!(raw instanceof Date) && typeof raw !== 'string') return false;
  const day = toTaipeiDay(raw);
  if (!day) return false;
  return day <= today;
}

/** frontmatter 的分隔線，前後可有空白但不可縮排。 */
const FM_DELIM = /^---\s*$/;

/**
 * 把一篇草稿的 frontmatter 改寫成已發布的樣子。
 *
 * 刻意做行級文字操作而不是 gray-matter 讀出來再序列化寫回：站上標題大量使用全形冒號，
 * toYamlFrontmatter 的 JSON 逃逸規則是為此而寫，整份重寫多一條分岔風險；`updated` 有
 * 「與 date 同日時不輸出」的條件，重寫會讓它跑掉；而且無關欄位的格式會產生大量與這次
 * 改動無關的 diff，出事時看不出是哪一行造成的。
 *
 * `draft: false` 不是留著而是整行刪掉——schema 的 default 就是 false，留著等於寫一個
 * 沒有資訊量的值。
 *
 * @param {string} raw md 全文
 * @returns {{ text: string, publishedOn: string } | null} 不具備翻牌條件時回 null
 */
export function flipToPublished(raw) {
  const lines = raw.split('\n');
  if (!FM_DELIM.test(lines[0] ?? '')) return null;

  // 只找第一個結束分隔線：正文裡的 --- 在它之後，不會被誤判。
  let end = -1;
  for (let i = 1; i < lines.length; i++) {
    if (FM_DELIM.test(lines[i])) {
      end = i;
      break;
    }
  }
  if (end === -1) return null;

  /** @type {string | null} */
  let publishedOn = null;
  let dateIndex = -1;
  /** @type {Set<number>} */
  const drop = new Set();

  for (let i = 1; i < end; i++) {
    const line = lines[i];
    const pub = /^publishAt:\s*(.+?)\s*$/.exec(line);
    if (pub) {
      publishedOn = pub[1];
      drop.add(i);
      continue;
    }
    if (/^draft:\s*/.test(line)) {
      drop.add(i);
      continue;
    }
    // 只認第一個頂層 date，行首不允許縮排，所以巢狀結構下的同名鍵不會被誤抓。
    if (dateIndex === -1 && /^date:\s*/.test(line)) dateIndex = i;
  }

  if (publishedOn === null || dateIndex === -1) return null;

  // 直接沿用 publishAt 的字面值，不做格式正規化——避免把 `2026-08-28` 寫成
  // `2026-08-28T00:00:00.000Z` 這種與既有 36 篇不一致的形狀。
  lines[dateIndex] = `date: ${publishedOn}`;

  return {
    text: lines.filter((_, i) => !drop.has(i)).join('\n'),
    publishedOn,
  };
}
```

Step 4: 跑測試確認通過

Run: `cd /Users/haunchenchen/Projects/astro-blog && node --test "scripts/lib/*.test.mjs"`

Expected: PASS，且既有測試（vault-post 等）數量不減

Step 5: Commit

`feat(publish): 加排程發布的到期判定與 frontmatter 改寫純函式`

---

### Task 2: schema 新增 publishAt 欄位與 verify-seo 防呆

Files:
- Modify: `src/content.config.ts:15`
- Modify: `scripts/verify-seo.mjs:701-703`

Interfaces:
- Consumes: 無
- Produces: posts collection 接受 optional `publishAt`；`verify:seo` 會擋住 `publishAt` 曝光到 `.md` 變體

Step 1: 加 schema 欄位

Modify `src/content.config.ts`。現況第 8-16 行是：

```ts
      category: z.enum(['n8n', 'flutter', 'devops', 'raspberry-pi', 'tools', 'hardware']),
      tags: z.array(z.string()).default([]),
      cover: image(),
      draft: z.boolean().default(false),
    }),
```

改成：

```ts
      category: z.enum(['n8n', 'flutter', 'devops', 'raspberry-pi', 'tools', 'hardware']),
      tags: z.array(z.string()).default([]),
      cover: image(),
      draft: z.boolean().default(false),
      // 排程發布日。有值且 draft 為真時，publish-scheduled 到期會把 draft 翻掉並把
      // date 改寫成這個值。沒有這個欄位的草稿永遠不會被自動發布。
      // z.coerce 與上面的 date 一致，讓 YAML 的裸日期字串也能過。
      publishAt: z.coerce.date().optional(),
    }),
```

Step 2: 加 verify-seo 防呆

Modify `scripts/verify-seo.mjs`。現況第 701-703 行是：

```js
    if ('draft' in data) {
      failures.push({ page: `/${slug}.md`, reason: 'frontmatter 不應曝光 draft 欄位' });
    }
```

改成：

```js
    // 內部欄位不得出現在 md 變體。`.md` 是白名單輸出（見 [...slug].md.ts），本來就漏不
    // 出去，這道是防呆——新增內部欄位時忘了跟上，就會靜默外流。
    for (const internalKey of ['draft', 'publishAt']) {
      if (internalKey in data) {
        failures.push({
          page: `/${slug}.md`,
          reason: `frontmatter 不應曝光 ${internalKey} 欄位`,
        });
      }
    }
```

Step 3: 建一篇暫時的排程文章驗證 schema 收得下

Run:

```bash
cd /Users/haunchenchen/Projects/astro-blog
mkdir -p src/content/posts/tmp-schedule-probe/images
# 借一張既有的 webp 封面。刻意不用 test-markdown-rendering，它是全站 36 篇裡唯一
# 用 cover.png 的例外，拿它當來源會直接 cp 不到檔。
cp src/content/posts/cloudflare-cache-rules-wordpress/images/cover.webp src/content/posts/tmp-schedule-probe/images/cover.webp
cat > src/content/posts/tmp-schedule-probe/index.md <<'EOF'
---
title: 排程探針
date: 2026-08-01
description: 驗證 schema 收得下 publishAt 的暫時檔案，驗完即刪
category: devops
tags: []
cover: ./images/cover.webp
draft: true
publishAt: 2026-12-31
---

正文。
EOF
npm run build
```

Expected: build 成功（PASS）。若 schema 沒收下 `publishAt`，Astro 會報 content collection 驗證錯誤。

Step 4: 刪掉探針並確認驗證仍全綠

Run:

```bash
cd /Users/haunchenchen/Projects/astro-blog
rm -rf src/content/posts/tmp-schedule-probe
npm run build && npm run verify:seo
```

Expected: 兩者皆 PASS

Step 5: Commit

`feat(schema): posts 加 optional publishAt 欄位與 md 變體防呆`

---

### Task 3: CLI 薄殼

Files:
- Create: `scripts/publish-scheduled.mjs`
- Modify: `package.json`（scripts 區塊）

Interfaces:
- Consumes: `./lib/publish-scheduled.mjs` 的 `toTaipeiDay(value)`、`isDue(data, today)`、`flipToPublished(raw)`
- Produces: `npm run publish:scheduled`；`--apply` 時把到期文章寫回工作區

Step 1: 寫 CLI

Create `scripts/publish-scheduled.mjs`：

```js
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
```

Step 2: 加 npm script

Modify `package.json`。在 `"verify:seo"` 那一行後面加一行：

```json
    "publish:scheduled": "node scripts/publish-scheduled.mjs",
```

Step 3: 驗證 dry-run 在沒有排程文章時的行為

Run: `cd /Users/haunchenchen/Projects/astro-blog && npm run publish:scheduled`

Expected: 印出今天日期與「今天沒有到期的排程文章」，exit code 0

Step 4: 用暫時檔案端到端驗一次

Run:

```bash
cd /Users/haunchenchen/Projects/astro-blog
mkdir -p src/content/posts/tmp-due-probe/images
# 同 Task 2：test-markdown-rendering 是全站唯一用 cover.png 的例外，不能當來源。
cp src/content/posts/cloudflare-cache-rules-wordpress/images/cover.webp src/content/posts/tmp-due-probe/images/cover.webp
cat > src/content/posts/tmp-due-probe/index.md <<'EOF'
---
title: 到期探針
date: 2026-08-01
description: 驗證到期翻牌的暫時檔案，驗完即刪
category: devops
tags: []
cover: ./images/cover.webp
draft: true
publishAt: 2026-08-20
---

正文。
EOF
echo '--- dry-run ---'
npm run publish:scheduled
echo '--- apply ---'
node scripts/publish-scheduled.mjs --apply
echo '--- 改寫後 ---'
cat src/content/posts/tmp-due-probe/index.md
echo '--- 未來日期不該被抓 ---'
node scripts/publish-scheduled.mjs --date 2026-08-19
```

Expected:
- dry-run 列出 `tmp-due-probe  date → 2026-08-20`
- apply 後檔案的 `date` 變成 `2026-08-20`，`draft` 與 `publishAt` 兩行消失
- `--date 2026-08-19` 印「今天沒有到期的排程文章」

Step 5: 驗證翻牌後的產物真的上得了站

前一步只看了 frontmatter 的三行變動，但 design 的驗收要的是「翻牌後 build 與 verify:seo
全綠、文章進得了 listing 與 sitemap、`datePublished` 等於 `publishAt`」。這一步把它補上——
探針還在工作區、已經是翻牌後的狀態，正是驗這件事的時機。

Run:

```bash
cd /Users/haunchenchen/Projects/astro-blog
npm run build && npm run verify:seo
echo '--- 進得了 sitemap ---'
grep -c 'tmp-due-probe' dist/sitemap.xml
echo '--- JSON-LD 的 datePublished 等於 publishAt ---'
grep -o '"datePublished":"[^"]*"' dist/tmp-due-probe/index.html
echo '--- 頁面實際產出 ---'
ls dist/tmp-due-probe/index.html
```

Expected:
- `npm run build` 與 `npm run verify:seo` 皆 PASS
- `grep -c` 回 `1`（sitemap 有這篇）
- `datePublished` 是 `2026-08-20T00:00:00.000Z`（`[...slug].astro:71` 用 `date.toISOString()`）
- `dist/tmp-due-probe/index.html` 存在

若 `verify:seo` 因為探針缺廣告版位之類的文章級契約而報 FAIL，那是探針內容太陽春造成的，
不是這次改動的問題——把失敗訊息記下來，補足探針缺的欄位再跑一次，不要改 `verify-seo.mjs`
去遷就探針。

Step 6: 清掉探針

Run: `cd /Users/haunchenchen/Projects/astro-blog && rm -rf src/content/posts/tmp-due-probe && git status --short`

Expected: 只剩 Task 3 該有的改動（`scripts/publish-scheduled.mjs`、`package.json`）

Step 7: Commit

`feat(publish): 加 publish-scheduled CLI`

---

### Task 4: 每日 cron workflow

Files:
- Create: `.github/workflows/publish-scheduled.yml`

Interfaces:
- Consumes: `npm run publish:scheduled`（Task 3）、既有的 `npm run build` 與 `npm run verify:seo`
- Produces: 每日自動翻牌並 push 到 main

Step 1: 寫 workflow

Create `.github/workflows/publish-scheduled.yml`：

```yaml
name: 排程發布

on:
  schedule:
    # cron 一律 UTC。0 0 * * * = 台北時間早上八點。每天跑而不是只跑週一／週四，
    # 是為了讓臨時插隊的文章不必等到下一個發布窗口。
    - cron: '0 0 * * *'
  workflow_dispatch:
    inputs:
      dry_run:
        description: 只印今天到期的清單，不寫檔也不 push
        type: boolean
        default: true

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: false

jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      contents: write

    steps:
      # 官方 action 追大版本 tag 的理由見 seo-pr.yml 檔頭，不在這裡重複。
      - uses: actions/checkout@v7

      - uses: actions/setup-node@v7
        with:
          node-version-file: '.nvmrc'
          cache: 'npm'

      - name: 安裝依賴
        run: npm ci

      # 這一步刻意沒有 continue-on-error：腳本會在 frontmatter 壞掉或「判為到期卻改不動」
      # 時 exit 1，那正是需要人介入的情況，吞掉的話那篇會每天被判到期又每天沒動。
      - name: 翻牌到期的排程文章
        run: |
          if [ "${{ inputs.dry_run }}" = "true" ]; then
            npm run publish:scheduled
          else
            node scripts/publish-scheduled.mjs --apply
          fi

      - name: 檢查有沒有實際變更
        id: changes
        run: |
          if git diff --quiet; then
            echo "changed=false" >> "$GITHUB_OUTPUT"
            echo "今天沒有要發的文章"
          else
            echo "changed=true" >> "$GITHUB_OUTPUT"
            git diff --stat
          fi

      # 必須是完整的 npm run build 而不是 astro build：subset-fonts 對草稿直接 skip，
      # 所以排程稿的標題與分類從來沒進過字型子集。翻牌後若含新字元，OG 圖會 tofu 而
      # astro build 照樣綠（hardware 分類那次踩過同一個坑）。
      - name: 建置
        if: steps.changes.outputs.changed == 'true'
        run: npm run build

      - name: 靜態 SEO 驗證
        if: steps.changes.outputs.changed == 'true'
        run: npm run verify:seo

      # 驗證全綠才 push。失敗時工作區的改動隨 runner 消失，那篇文章維持 draft 留在 repo
      # 裡，隔天 cron 會再試一次，同時 GitHub 上有一筆紅燈可查。
      - name: Commit 並 push
        if: steps.changes.outputs.changed == 'true'
        run: |
          git config --local user.email "action@github.com"
          git config --local user.name "GitHub Action"
          git add src/content/posts
          git commit -m "chore(publish): 排程發布到期文章"
          git push

      - name: 寫入 Job Summary
        if: always()
        run: |
          {
            echo "## 排程發布"
            echo "- 觸發：${{ github.event_name }}"
            echo "- 模式：${{ inputs.dry_run == true && 'dry-run' || 'apply' }}"
            echo "- 結果：${{ steps.changes.outputs.changed == 'true' && '有文章發布' || '今天沒有到期文章' }}"
          } >> "$GITHUB_STEP_SUMMARY"
```

Step 2: 本機驗 YAML 語法

Run:

```bash
cd /Users/haunchenchen/Projects/astro-blog
node -e "
const fs = require('node:fs');
const yaml = require('js-yaml');
const doc = yaml.load(fs.readFileSync('.github/workflows/publish-scheduled.yml', 'utf8'));
console.log('jobs:', Object.keys(doc.jobs));
console.log('steps:', doc.jobs.publish.steps.length);
console.log('permissions:', JSON.stringify(doc.jobs.publish.permissions));
"
```

Expected: 印出 `jobs: [ 'publish' ]`、步驟數 9、`permissions: {"contents":"write"}`

若 `js-yaml` 不在依賴裡，改用 `npx --yes js-yaml .github/workflows/publish-scheduled.yml > /dev/null && echo YAML OK`。

Step 3: 確認沒有踩到禁用項

Run: `cd /Users/haunchenchen/Projects/astro-blog && grep -n "continue-on-error" .github/workflows/publish-scheduled.yml; echo "exit=$?"`

Expected: 無輸出、`exit=1`（grep 找不到）

Step 4: Commit

`ci(publish): 加每日排程發布 workflow`

---

## 完成後的人工驗收（不在 subagent 範圍）

這幾項需要推上 GitHub 才能做，留給站主：

- 以 `dry_run: true` 手動觸發一次 workflow，確認沒有 commit 產生、Job Summary 有內容
- 實際排一篇文章驗證端到端：`publishAt` 設隔天，隔天早上八點後看站上有沒有出現、
  `datePublished` 是不是等於 `publishAt`
