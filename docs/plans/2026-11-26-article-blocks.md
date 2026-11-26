# 文章區塊版型與結構檢查 Implementation Plan

Goal: 文章頁依 h2 標題把常見問題區塊排成風琴、故障排除區塊與文末連結區塊框起來，補回列表符號與 footer 留白，並用結構檢查擋下不合約定的文章。

Done when: `npm test` 244 個測試全綠；`npm run check:posts` 輸出 `結構檢查：52 篇，0 條違規`；`npm run build` 與 `npm run verify:seo` 通過；`dist/kicad-mcp-autoroute/index.html` 有 4 個 `class="faq-item"`；`dist/` 內所有 `.md` 檔都不含 `<details`；瀏覽器實看風琴開合、列表符號、footer 留白三項都正確；`sync-from-vault --apply` 遇到結構違規的草稿不落地且結束碼為 1。

Architecture: `scripts/lib/article-blocks.mjs` 是區塊標題辨識與結構檢查的唯一實作（純函式、零相依）。`scripts/lib/rehype-article-blocks.mjs` 在 build 時用同一支辨識函式改寫 HTML 樹；`transformPost`、`scripts/check-post-structure.mjs`（pre-commit 與 CI 的入口）呼叫同一支檢查函式。既有文章的粗體題目與文末連結標題用一支一次性腳本批次改寫，其餘結構調整逐檔手改。

Tech Stack: Astro 5 markdown pipeline（rehype）、Node 22 內建 `node:test`、gray-matter、glob。不新增任何相依。

Spec: `docs/specs/article-blocks.md`

Context: `CONTEXT.md`

批次改寫說明：Task 6 用一次性腳本改 25 個文章檔（99 行粗體題目、15 行標題）。這是機械式取代，逐檔手改 114 行出錯機率比腳本高；腳本先 dry-run 印出命中數、與本計畫的預期值比對後才寫檔，跑完即刪、不進版控。

## Global Constraints

- 區塊標題只看 h2 的純文字：含「常見問題」＝常見問題區塊；以「故障排除」開頭＝故障排除區塊；等於「參考資料與延伸閱讀」＝文末連結區塊。h3 以下不參與辨識
- h2 同時含「常見問題」與「故障排除」時是常見問題區塊
- 辨識區塊標題的函式只有 `scripts/lib/article-blocks.mjs` 的 `classifyBlockHeading` 一份，rehype plugin 與結構檢查都呼叫它，不得另寫判斷
- `scripts/lib/article-blocks.mjs` 必須零相依（不 import 任何套件或其他檔案）
- 三種區塊的 h2 留在框外；框用 `--color-bg-secondary` 底色、`1px solid var(--color-border-default)` 邊框、`--radius-md` 圓角，不用左側橘色粗線
- 常見問題區塊每題是原生 `<details>`，預設收合、各題獨立（不加 `name` 屬性、不加 `open` 屬性），不寫任何 JavaScript，不加過場動畫
- 品牌色半透明宣告一律連續兩行：先 `rgba(251, 146, 60, 0.1)`、後 `color-mix(in srgb, var(--color-brand-orange) 10%, transparent)`（design-system R1、R2）
- 不宣告任何 `:focus`／`:focus-visible` 樣式，焦點外框由 `global.css` 既有的 `:focus-visible` 供應（design-system R4）
- 修改既有文章只動格式與結構：不改任何論述文字，不加 `changelog`，不動 frontmatter 的 `updated`、`date`、`draft`、`publishAt`。唯一新增的文字是 Task 5 在 samsung-wallet 那篇加的 `## 結語` 標題
- `style-preview.html` 是獨立的預覽頁，變數名與寫法自成一套（品牌色半透明只寫單行 rgba）；改它時沿用該檔既有寫法，上面的兩行規則不適用於它
- 這次改名的標題沒有任何站內連結指向它們的錨點（已查過 `src`、`public`），不需要補轉址或改連結
- 文章檔一律用 Edit 工具修改；唯一例外是 Task 6 的一次性腳本
- 不新增 npm 相依
- 測試用 `node:test` 與 `node:assert/strict`，名稱寫成「對象：條件與預期結果」，測試本體不用迴圈與條件
- 程式碼註解與文件不寫「何時新增、原本是什麼」這類沿革註記
- commit message 格式沿用 repo 慣例：`type(scope): 中文描述`

---

### Task 1: 區塊標題辨識與結構檢查

Implements: `article-blocks.md` #R1, #R3, #R4, #R8, #R10
Review: deep

Files:
- Create: `scripts/lib/article-blocks.mjs`
- Create: `scripts/lib/article-blocks.test.mjs`
- Create: `scripts/check-post-structure.mjs`
- Modify: `package.json`（`scripts` 區塊）

Interfaces:
- Consumes: 無
- Produces:
  - `LINKS_HEADING: string`（值為 `'參考資料與延伸閱讀'`）
  - `classifyBlockHeading(text: string): 'faq' | 'troubleshooting' | 'links' | null`
  - `headingText(raw: string): string` — 把 markdown 標題行 `## ` 之後的內容還原成純文字
  - `checkPostStructure(markdown: string): Array<{ rule: 'E1'|'E2'|'E3'|'E4'|'E5'|'E6', line: number, heading: string, message: string }>` — `markdown` 是不含 frontmatter 的正文，`line` 從 1 起算
  - CLI `node scripts/check-post-structure.mjs [--staged] [檔案...]`：不給檔案時檢查 `src/content/posts/**/*.md`；`--staged` 改讀 git index 的內容；有違規時結束碼 1
  - npm script `check:posts`

Done when: `npm test` 輸出 `# pass 232`、`# fail 0`；`npm run check:posts` 結束碼 1，最後一行是 `結構檢查：52 篇，133 條違規`（既有文章尚未遷移，這是預期的紅）。

範圍：只做辨識、檢查與 CLI。不接 pre-commit、CI、`sync-from-vault`（Task 7、8），不改任何文章。

Step 1: 寫失敗的測試

建立 `scripts/lib/article-blocks.test.mjs`：

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  LINKS_HEADING,
  classifyBlockHeading,
  headingText,
  checkPostStructure,
} from './article-blocks.mjs';

const rules = (markdown) => checkPostStructure(markdown).map((v) => v.rule);

test('classifyBlockHeading：含「常見問題」的標題是常見問題區塊', () => {
  assert.equal(classifyBlockHeading('Discord Bot 常見問題'), 'faq');
});

test('classifyBlockHeading：同時含「常見問題」與「故障排除」時是常見問題區塊', () => {
  assert.equal(classifyBlockHeading('常見問題與故障排除'), 'faq');
});

test('classifyBlockHeading：以「故障排除」開頭的標題是故障排除區塊', () => {
  assert.equal(classifyBlockHeading('故障排除指南'), 'troubleshooting');
});

test('classifyBlockHeading：「故障排除」不在開頭時不算區塊標題', () => {
  assert.equal(classifyBlockHeading('如何進行故障排除'), null);
});

test('classifyBlockHeading：完全等於文末連結標題才是文末連結區塊', () => {
  assert.equal(classifyBlockHeading(LINKS_HEADING), 'links');
});

test('classifyBlockHeading：只寫「參考資料」不是文末連結區塊', () => {
  assert.equal(classifyBlockHeading('參考資料'), null);
});

test('headingText：去掉粗體、行內程式碼、連結語法與結尾井號', () => {
  assert.equal(headingText('**n8n** `節點` [常見問題](https://example.com) ##'), 'n8n 節點 常見問題');
});

test('checkPostStructure：三種區塊都照約定寫的文章沒有違規', () => {
  const markdown = [
    '## 前言',
    '',
    '內文',
    '',
    '## 故障排除：連線逾時',
    '',
    '**先檢查這個**',
    '',
    '## 常見問題',
    '',
    '引言',
    '',
    '### 第一題？',
    '',
    '答案',
    '',
    `## ${LINKS_HEADING}`,
    '',
    '- [來源](https://example.com)',
  ].join('\n');
  assert.deepEqual(checkPostStructure(markdown), []);
});

test('checkPostStructure：常見問題區塊內沒有 h3 回報 E1，行號指向該 h2', () => {
  const markdown = ['## 前言', '', '## 常見問題', '', '- 第一題？', '', '答案'].join('\n');
  assert.deepEqual(checkPostStructure(markdown), [
    {
      rule: 'E1',
      line: 3,
      heading: '常見問題',
      message: '常見問題區塊內沒有任何「### 題目」',
    },
  ]);
});

test('checkPostStructure：常見問題區塊內整段粗體的段落回報 E2', () => {
  const markdown = ['## 常見問題', '', '### 第一題？', '', '答案', '', '**Q2：第二題？**', '', '答案'].join('\n');
  assert.deepEqual(checkPostStructure(markdown), [
    {
      rule: 'E2',
      line: 7,
      heading: '常見問題',
      message: '題目要寫成「### 題目」，不寫整段粗體',
    },
  ]);
});

test('checkPostStructure：常見問題區塊內的收尾型 h3 回報 E3', () => {
  const markdown = ['## 常見問題', '', '### 第一題？', '', '答案', '', '### 總結與下一步', '', '內文'].join('\n');
  assert.deepEqual(rules(markdown), ['E3']);
});

test('checkPostStructure：h2 寫成「常見問答」回報 E4', () => {
  assert.deepEqual(rules('## 常見問答\n\n### 第一題？\n\n答案'), ['E4']);
});

test('checkPostStructure：h2 只寫 FAQ 而沒有「常見問題」回報 E4', () => {
  assert.deepEqual(rules('## FAQ\n\n### 第一題？\n\n答案'), ['E4']);
});

test('checkPostStructure：h2 以「疑難排解」開頭回報 E4', () => {
  assert.deepEqual(rules('## 疑難排解：連線逾時\n\n內文'), ['E4']);
});

test('checkPostStructure：第二個常見問題區塊回報 E5', () => {
  const markdown = ['## 常見問題', '', '### 第一題？', '', '答案', '', '## 進階常見問題', '', '### 第二題？', '', '答案'].join('\n');
  assert.deepEqual(rules(markdown), ['E5']);
});

test('checkPostStructure：文末連結用了別名標題回報 E6', () => {
  assert.deepEqual(rules('## 延伸閱讀\n\n- [文章](/post/)'), ['E6']);
});

test('checkPostStructure：文末連結標題出現第二次回報 E6', () => {
  const markdown = [`## ${LINKS_HEADING}`, '', '- [甲](/a/)', '', `## ${LINKS_HEADING}`, '', '- [乙](/b/)'].join('\n');
  assert.deepEqual(rules(markdown), ['E6']);
});

test('checkPostStructure：程式碼區塊裡的 h2 與粗體行不列入檢查', () => {
  const markdown = ['## 常見問題', '', '### 第一題？', '', '```markdown', '## 常見問答', '**Q1：範例**', '```'].join('\n');
  assert.deepEqual(checkPostStructure(markdown), []);
});

test('checkPostStructure：故障排除區塊內的整段粗體不算違規', () => {
  assert.deepEqual(checkPostStructure('## 故障排除指南\n\n**問題一：連不上**\n\n處置'), []);
});

test('checkPostStructure：h3 層級寫「常見問題」不構成常見問題區塊', () => {
  assert.deepEqual(checkPostStructure('## 原因分析\n\n### 常見問題：為什麼會這樣？\n\n**粗體段落**'), []);
});
```

Step 2: 跑測試確認失敗

Run: `npm test`
Expected: FAIL，錯誤訊息含 `Cannot find module` 與 `article-blocks.mjs`

Step 3: 寫實作

建立 `scripts/lib/article-blocks.mjs`：

```js
// scripts/lib/article-blocks.mjs
// 區塊標題的辨識與文章的結構檢查。rehype-article-blocks.mjs（頁面版型）與結構檢查共用
// classifyBlockHeading——兩邊各寫一套的話，會出現檢查放行、頁面卻沒套版型的情況。
// 零相依：這支會被 astro.config.mjs、sync-from-vault 與 pre-commit 三個入口載入。

export const LINKS_HEADING = '參考資料與延伸閱讀';

const LINKS_ALIAS_PREFIXES = ['參考資料', '參考資源', '延伸閱讀', '相關文章'];
const TROUBLESHOOTING_ALIAS_PREFIXES = ['疑難排解', '問題排解'];
const CLOSING_H3 = /總結|結語|下一步|學習路徑|延伸閱讀/;

/**
 * 判斷一個 h2 的文字屬於哪種區塊。
 * @param {string} text h2 的純文字（不含 markdown 記號）
 * @returns {'faq' | 'troubleshooting' | 'links' | null}
 */
export function classifyBlockHeading(text) {
  const t = text.trim();
  // 「常見問題」優先於「故障排除」：`常見問題與故障排除` 是常見問題區塊。
  if (t.includes('常見問題')) return 'faq';
  if (t.startsWith('故障排除')) return 'troubleshooting';
  if (t === LINKS_HEADING) return 'links';
  return null;
}

/** 把 markdown 標題行的內容還原成純文字，結果要與 rehype 端從 HTML 取出的文字一致。 */
export function headingText(raw) {
  return raw
    .replace(/\s+#+\s*$/, '')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_`]/g, '')
    .replace(/\\(.)/g, '$1')
    .trim();
}

/**
 * 檢查一篇文章的 markdown 正文，回傳違規清單（空陣列＝合規）。
 * @param {string} markdown 不含 frontmatter 的正文
 * @returns {Array<{rule: string, line: number, heading: string, message: string}>}
 */
export function checkPostStructure(markdown) {
  const lines = markdown.split(/\r?\n/);
  const violations = [];
  let fence = null;
  let faq = null; // 目前所在的常見問題區塊：{ line, heading, h3Count }
  let faqCount = 0;
  let linksCount = 0;

  const closeFaq = () => {
    if (faq && faq.h3Count === 0) {
      violations.push({
        rule: 'E1',
        line: faq.line,
        heading: faq.heading,
        message: '常見問題區塊內沒有任何「### 題目」',
      });
    }
    faq = null;
  };

  lines.forEach((line, index) => {
    const lineNo = index + 1;
    const fenceMatch = line.match(/^\s*(```+|~~~+)/);
    if (fenceMatch) {
      const marker = fenceMatch[1][0];
      if (fence === null) fence = marker;
      else if (fence === marker) fence = null;
      return;
    }
    if (fence !== null) return;

    const h2 = line.match(/^##\s+(.+)$/);
    if (h2) {
      closeFaq();
      const heading = headingText(h2[1]);
      const kind = classifyBlockHeading(heading);

      if (kind === 'faq') {
        faqCount += 1;
        if (faqCount > 1) {
          violations.push({
            rule: 'E5',
            line: lineNo,
            heading,
            message: '一篇文章只能有一個常見問題區塊',
          });
        }
        faq = { line: lineNo, heading, h3Count: 0 };
        return;
      }

      if (kind === 'links') {
        linksCount += 1;
        if (linksCount > 1) {
          violations.push({
            rule: 'E6',
            line: lineNo,
            heading,
            message: `「${LINKS_HEADING}」只能出現一次`,
          });
        }
        return;
      }

      if (
        heading.includes('常見問答') ||
        /FAQ/i.test(heading) ||
        /Q\s*[&＆]\s*A/i.test(heading) ||
        TROUBLESHOOTING_ALIAS_PREFIXES.some((p) => heading.startsWith(p))
      ) {
        violations.push({
          rule: 'E4',
          line: lineNo,
          heading,
          message: '區塊標題用了別名：問答用「常見問題」，排錯章節以「故障排除」開頭',
        });
      } else if (LINKS_ALIAS_PREFIXES.some((p) => heading.startsWith(p))) {
        violations.push({
          rule: 'E6',
          line: lineNo,
          heading,
          message: `文末連結的標題只能是「${LINKS_HEADING}」`,
        });
      }
      return;
    }

    if (!faq) return;

    const h3 = line.match(/^###\s+(.+)$/);
    if (h3) {
      faq.h3Count += 1;
      const text = headingText(h3[1]);
      if (CLOSING_H3.test(text)) {
        violations.push({
          rule: 'E3',
          line: lineNo,
          heading: faq.heading,
          message: `「${text}」不是題目，應升成 h2 移出常見問題區塊`,
        });
      }
      return;
    }

    if (/^\*\*[^*]+\*\*\s*$/.test(line)) {
      violations.push({
        rule: 'E2',
        line: lineNo,
        heading: faq.heading,
        message: '題目要寫成「### 題目」，不寫整段粗體',
      });
    }
  });

  closeFaq();
  return violations;
}
```

Step 4: 跑測試確認通過

Run: `npm test`
Expected: 輸出含 `# pass 232` 與 `# fail 0`（原有 212 個加這次 20 個）

Step 5: 寫 CLI

建立 `scripts/check-post-structure.mjs`：

```js
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
```

Step 6: 加 npm script

`package.json` 的 `scripts` 區塊，在 `"check:functions": "tsc --noEmit -p functions/tsconfig.json",` 這一行之後加一行：

```json
    "check:posts": "node scripts/check-post-structure.mjs",
```

Step 7: 跑 CLI 確認它抓得到既有文章的違規

Run: `npm run check:posts`
Expected: 結束碼 1，最後一行 `結構檢查：52 篇，133 條違規`

Step 8: Commit

```bash
git add scripts/lib/article-blocks.mjs scripts/lib/article-blocks.test.mjs scripts/check-post-structure.mjs package.json
git commit -m "feat(article-blocks): 區塊標題辨識與文章結構檢查"
```

---

### Task 2: rehype plugin 產出風琴與框

Implements: `article-blocks.md` #R1, #R2, #R3, #R4, #R6, #R10

Files:
- Create: `scripts/lib/rehype-article-blocks.mjs`
- Create: `scripts/lib/rehype-article-blocks.test.mjs`
- Modify: `astro.config.mjs`（import 區與 `markdown.rehypePlugins`）

Interfaces:
- Consumes: `classifyBlockHeading(text: string): 'faq' | 'troubleshooting' | 'links' | null`（`scripts/lib/article-blocks.mjs`，Task 1）
- Produces: `rehypeArticleBlocks(): (tree: HastRoot) => void`。輸出的 class 名稱：`faq-list`（包住所有題目的 `div`）、`faq-item`（每題的 `details`）、`faq-answer`（答案的 `div`）、`prose-block`（故障排除區塊與文末連結區塊的 `div`）。Task 3 的 CSS 依這四個名稱寫

Done when: `npm test` 輸出 `# pass 241`、`# fail 0`；`npm run build` 成功後 `grep -o 'class="faq-item"' dist/kicad-mcp-autoroute/index.html | wc -l` 輸出 `4`，`grep -o '<summary><h3 id="' dist/kicad-mcp-autoroute/index.html | wc -l` 輸出 `4`。

背景：Astro 的 markdown 產出是一棵 hast 樹，根節點的 `children` 是平鋪的 `h2`、`h3`、`p`、`ul` 等元素，中間夾著值為 `"\n"` 的文字節點。「一節」是從一個 `h2` 到下一個 `h2` 之前的所有兄弟節點。Astro 在使用者的 rehype plugin 之後才替標題加 `id`，而且是走訪整棵樹加，所以 `h3` 被移進 `<summary>` 之後仍會拿到 `id`。

範圍：只改 HTML 樹與註冊 plugin。不寫 CSS（Task 3），不改文章。

Step 1: 寫失敗的測試

建立 `scripts/lib/rehype-article-blocks.test.mjs`：

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rehypeArticleBlocks } from './rehype-article-blocks.mjs';

const text = (value) => ({ type: 'text', value });
const el = (tagName, ...children) => ({ type: 'element', tagName, properties: {}, children });
const heading = (tagName, value) => el(tagName, text(value));
const para = (value) => el('p', text(value));

/** 跑 plugin 並回傳根節點的 children。 */
function transform(...children) {
  const tree = { type: 'root', children };
  rehypeArticleBlocks()(tree);
  return tree.children;
}

/** 把節點壓成「標籤.class」字串，讓斷言讀得出結構。 */
function shape(node) {
  if (node.type !== 'element') return node.type;
  const className = node.properties.className?.[0];
  return className ? `${node.tagName}.${className}` : node.tagName;
}

test('rehypeArticleBlocks：常見問題區塊的引言留在 faq-list 外', () => {
  const out = transform(heading('h2', '常見問題'), para('引言'), heading('h3', '第一題？'), para('答案'));
  assert.deepEqual(out.map(shape), ['h2', 'p', 'div.faq-list']);
});

test('rehypeArticleBlocks：每個 h3 成為一個 details，各自帶 summary 與 faq-answer', () => {
  const out = transform(
    heading('h2', '常見問題'),
    heading('h3', '第一題？'),
    para('答案一'),
    heading('h3', '第二題？'),
    para('答案二之一'),
    para('答案二之二'),
  );
  const items = out[1].children;
  assert.deepEqual(items.map(shape), ['details.faq-item', 'details.faq-item']);
  assert.deepEqual(items[1].children.map(shape), ['summary', 'div.faq-answer']);
  assert.deepEqual(items[1].children[1].children.map(shape), ['p', 'p']);
});

test('rehypeArticleBlocks：題目的 h3 節點原封不動移進 summary', () => {
  const question = heading('h3', '第一題？');
  const out = transform(heading('h2', '常見問題'), question, para('答案'));
  const summary = out[1].children[0].children[0];
  assert.equal(summary.children[0], question);
});

test('rehypeArticleBlocks：常見問題區塊止於下一個 h2', () => {
  const out = transform(
    heading('h2', '常見問題'),
    heading('h3', '第一題？'),
    para('答案'),
    heading('h2', '結語'),
    para('收尾'),
  );
  assert.deepEqual(out.map(shape), ['h2', 'div.faq-list', 'h2', 'p']);
});

test('rehypeArticleBlocks：沒有 h3 的常見問題區塊維持原樣', () => {
  const out = transform(heading('h2', '常見問題'), para('只有一段話'));
  assert.deepEqual(out.map(shape), ['h2', 'p']);
});

test('rehypeArticleBlocks：故障排除區塊的內容包進 prose-block，h2 留在外面', () => {
  const out = transform(heading('h2', '故障排除指南'), heading('h3', '連不上'), para('處置'));
  assert.deepEqual(out.map(shape), ['h2', 'div.prose-block']);
  assert.deepEqual(out[1].children.map(shape), ['h3', 'p']);
});

test('rehypeArticleBlocks：文末連結區塊的內容包進 prose-block', () => {
  const out = transform(heading('h2', '參考資料與延伸閱讀'), el('ul', el('li', text('來源'))));
  assert.deepEqual(out.map(shape), ['h2', 'div.prose-block']);
});

test('rehypeArticleBlocks：一般章節不變', () => {
  const out = transform(heading('h2', '前言'), heading('h3', '背景'), para('內文'));
  assert.deepEqual(out.map(shape), ['h2', 'h3', 'p']);
});

test('rehypeArticleBlocks：h2 的文字包在行內元素裡也認得出區塊', () => {
  const out = transform(el('h2', el('strong', text('常見問題'))), heading('h3', '第一題？'), para('答案'));
  assert.deepEqual(out.map(shape), ['h2', 'div.faq-list']);
});
```

Step 2: 跑測試確認失敗

Run: `npm test`
Expected: FAIL，錯誤訊息含 `Cannot find module` 與 `rehype-article-blocks.mjs`

Step 3: 寫實作

建立 `scripts/lib/rehype-article-blocks.mjs`：

```js
// scripts/lib/rehype-article-blocks.mjs
// markdown 產出的 h2、h3、段落是平行的兄弟節點，CSS 框不住「一節」或「一題」。
// 這裡在渲染階段依區塊標題把節的內容包起來：常見問題區塊變成風琴，
// 故障排除區塊與文末連結區塊各包成一個框。規格見 docs/specs/article-blocks.md。

import { classifyBlockHeading } from './article-blocks.mjs';

/** 遞迴取出節點下的純文字（標題內可能含 <code>、<strong> 等行內元素）。 */
function textOf(node) {
  if (node.type === 'text') return node.value;
  if (!Array.isArray(node.children)) return '';
  return node.children.map(textOf).join('');
}

const isElement = (node, tagName) => node.type === 'element' && node.tagName === tagName;

const element = (tagName, className, children) => ({
  type: 'element',
  tagName,
  properties: className ? { className: [className] } : {},
  children,
});

/**
 * 常見問題區塊：第一個 h3 之前是引言，留在外面；之後每個 h3 連同它底下的內容是一題。
 * 沒有 h3 就不動——那是結構檢查 E1 會擋下的寫法，這裡不替它猜題目在哪。
 * h3 節點本身原樣搬進 <summary>：Astro 之後才替標題加 id，目錄與錨點靠那個 id。
 */
function wrapFaq(body) {
  const first = body.findIndex((node) => isElement(node, 'h3'));
  if (first === -1) return body;

  const items = [];
  for (const node of body.slice(first)) {
    if (isElement(node, 'h3')) items.push({ question: node, answer: [] });
    else items[items.length - 1].answer.push(node);
  }

  const list = element(
    'div',
    'faq-list',
    items.map(({ question, answer }) =>
      element('details', 'faq-item', [
        element('summary', null, [question]),
        element('div', 'faq-answer', answer),
      ]),
    ),
  );
  return [...body.slice(0, first), list];
}

/** 故障排除區塊與文末連結區塊：整節內容包成一個框，內容不動。 */
function wrapBlock(body) {
  if (!body.some((node) => node.type === 'element')) return body;
  return [element('div', 'prose-block', body)];
}

/**
 * 不依賴 unist-util-visit：區塊標題只會出現在根節點的直接子層，
 * 掃一輪根節點的 children 就夠，不必走訪整棵樹。
 */
export function rehypeArticleBlocks() {
  return (tree) => {
    const children = tree.children;
    const out = [];
    let i = 0;

    while (i < children.length) {
      const node = children[i];
      if (!isElement(node, 'h2')) {
        out.push(node);
        i += 1;
        continue;
      }

      let end = i + 1;
      while (end < children.length && !isElement(children[end], 'h2')) end += 1;
      const body = children.slice(i + 1, end);
      const kind = classifyBlockHeading(textOf(node));

      out.push(node);
      if (kind === 'faq') out.push(...wrapFaq(body));
      else if (kind !== null) out.push(...wrapBlock(body));
      else out.push(...body);
      i = end;
    }

    tree.children = out;
  };
}

export default rehypeArticleBlocks;
```

Step 4: 跑測試確認通過

Run: `npm test`
Expected: 輸出含 `# pass 241` 與 `# fail 0`

Step 5: 註冊 plugin

`astro.config.mjs` 的 import 區，在這一行之後：

```js
import { rehypeTableCaption } from './scripts/lib/rehype-table-caption.mjs';
```

加一行：

```js
import { rehypeArticleBlocks } from './scripts/lib/rehype-article-blocks.mjs';
```

同檔 `markdown` 設定裡的這一行：

```js
    rehypePlugins: [rehypeTableCaption],
```

改成：

```js
    rehypePlugins: [rehypeTableCaption, rehypeArticleBlocks],
```

Step 6: build 並確認產物

Run: `npm run build`
Expected: 成功結束

Run: `grep -o 'class="faq-item"' dist/kicad-mcp-autoroute/index.html | wc -l`
Expected: `4`

Run: `grep -o '<summary><h3 id="' dist/kicad-mcp-autoroute/index.html | wc -l`
Expected: `4`

Step 7: Commit

```bash
git add scripts/lib/rehype-article-blocks.mjs scripts/lib/rehype-article-blocks.test.mjs astro.config.mjs
git commit -m "feat(article-blocks): rehype plugin 把常見問題排成風琴、故障排除與文末連結包成框"
```

---

### Task 3: 區塊樣式、列表符號與 footer 留白

Implements: `article-blocks.md` #R2, #R5；`design-system.md` #R5, #R6

Files:
- Modify: `src/styles/global.css`（`.prose ul, .prose ol` 與 `.prose li` 那一段）
- Modify: `src/pages/[...slug].astro`（`<style>` 內的 `.layout-with-aside`，共兩處）
- Modify: `style-preview.html`（`.prose li` 的 CSS 與文章範例的 HTML）

Interfaces:
- Consumes: Task 2 產出的 class 名稱 `faq-list`、`faq-item`、`faq-answer`、`prose-block`
- Produces: 無

Done when: `npm run build` 成功後，`grep -c 'faq-item' dist/_astro/*.css` 輸出大於 0；`grep -o 'padding:0 24px 64px' dist/_astro/*.css | wc -l` 輸出 `2`；`grep -o '\.prose ul{list-style:disc' dist/_astro/*.css | wc -l` 輸出 `1`。

範圍：只寫樣式。瀏覽器實看在 Task 9。

Step 1: 補列表符號與區塊樣式

`src/styles/global.css`，把這一段：

```css
.prose ul,
.prose ol {
  padding-left: 24px;
  margin-bottom: 16px;
}

.prose li {
  margin-bottom: 4px;
}
```

換成：

```css
.prose ul,
.prose ol {
  padding-left: 24px;
  margin-bottom: 16px;
}

/* Tailwind preflight 把 ol、ul 的 list-style 清成 none，這裡要自己加回來。 */
.prose ul {
  list-style: disc;
}

.prose ul ul {
  list-style: circle;
}

.prose ol {
  list-style: decimal;
}

.prose li {
  margin-bottom: 4px;
}

.prose li::marker {
  color: var(--color-text-muted);
}

/* 文章區塊（docs/specs/article-blocks.md）：h2 留在框外，框住的是標題底下的內容。
   刻意不用左側橘色粗線——那是 blockquote 與更新紀錄的樣子。 */
.prose .prose-block,
.prose .faq-list {
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-md);
  margin: 16px 0;
}

.prose .prose-block {
  padding: 20px 24px;
}

.prose .prose-block > :first-child {
  margin-top: 0;
}

.prose .prose-block > :last-child {
  margin-bottom: 0;
}

/* 表頭原本就是 bg-secondary，放進同色的框裡會消失，換成深一階。 */
.prose .prose-block th {
  background: var(--color-bg-tertiary);
}

.prose .faq-item + .faq-item {
  border-top: 1px solid var(--color-border-subtle);
}

.prose .faq-item > summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 20px;
  cursor: pointer;
  list-style: none;
}

.prose .faq-item > summary::-webkit-details-marker {
  display: none;
}

.prose .faq-item > summary::after {
  content: '+';
  flex-shrink: 0;
  font-family: var(--font-mono);
  font-size: 20px;
  line-height: 1;
  color: var(--color-text-muted);
}

.prose .faq-item[open] > summary::after {
  content: '−';
}

.prose .faq-item > summary:hover {
  background-color: rgba(251, 146, 60, 0.1);
  background-color: color-mix(in srgb, var(--color-brand-orange) 10%, transparent);
}

.prose .faq-item:first-child > summary {
  border-top-left-radius: var(--radius-md);
  border-top-right-radius: var(--radius-md);
}

.prose .faq-item:last-child:not([open]) > summary {
  border-bottom-left-radius: var(--radius-md);
  border-bottom-right-radius: var(--radius-md);
}

/* 框裡的題目用 22px 太重，一列會被撐成兩三行。 */
.prose .faq-item > summary h3 {
  font-size: 18px;
  line-height: 28px;
  margin: 0;
}

.prose .faq-answer {
  padding: 0 20px 16px;
}

.prose .faq-answer > :last-child {
  margin-bottom: 0;
}
```

Step 2: 補文章頁底部留白

`src/pages/[...slug].astro` 的 `<style>` 內有兩條 `.layout-with-aside` 規則，兩條都要改；只改第一條的話，1024px 以下會被第二條蓋回 0。

第一條，把：

```css
  .layout-with-aside {
    display: flex;
    gap: 48px;
    max-width: var(--width-max);
    margin: 0 auto;
    padding: 0 24px;
  }
```

換成：

```css
  /* 底部 64px 與 .list-page 的上下留白同值，否則上一篇／下一篇會貼著 footer。 */
  .layout-with-aside {
    display: flex;
    gap: 48px;
    max-width: var(--width-max);
    margin: 0 auto;
    padding: 0 24px 64px;
  }
```

第二條（在 `@media (max-width: 1024px)` 內），把：

```css
    .layout-with-aside {
      display: block;
      padding: 0 24px;
    }
```

換成：

```css
    .layout-with-aside {
      display: block;
      padding: 0 24px 64px;
    }
```

Step 3: 更新 style-preview.html

`style-preview.html` 用的是自己的一組變數名（`--bg-secondary`、`--border-default`、`--text-muted` 等，沒有 `color-` 前綴）。

把這一行：

```css
    .prose li { margin-bottom: 4px; }
```

換成：

```css
    .prose ul { list-style: disc; }
    .prose ul ul { list-style: circle; }
    .prose ol { list-style: decimal; }
    .prose li { margin-bottom: 4px; }
    .prose li::marker { color: var(--text-muted); }

    .prose .prose-block, .prose .faq-list {
      background: var(--bg-secondary); border: 1px solid var(--border-default);
      border-radius: var(--radius-md); margin: 16px 0;
    }
    .prose .prose-block { padding: 20px 24px; }
    .prose .prose-block > :first-child { margin-top: 0; }
    .prose .prose-block > :last-child { margin-bottom: 0; }
    .prose .faq-item + .faq-item { border-top: 1px solid var(--border-subtle); }
    .prose .faq-item > summary {
      display: flex; align-items: center; justify-content: space-between; gap: 16px;
      padding: 16px 20px; cursor: pointer; list-style: none;
    }
    .prose .faq-item > summary::-webkit-details-marker { display: none; }
    .prose .faq-item > summary::after {
      content: '+'; flex-shrink: 0; font-family: var(--font-mono);
      font-size: 20px; line-height: 1; color: var(--text-muted);
    }
    .prose .faq-item[open] > summary::after { content: '−'; }
    .prose .faq-item > summary:hover { background-color: rgba(251, 146, 60, 0.1); }
    .prose .faq-item > summary h3 { font-size: 18px; line-height: 28px; margin: 0; }
    .prose .faq-answer { padding: 0 20px 16px; }
    .prose .faq-answer > :last-child { margin-bottom: 0; }
```

再把文章範例裡的這一段（`<hr>` 到 `<h2>總結</h2>`，全檔只出現一次）：

```html
        <hr>

        <h2>總結</h2>
```

換成：

```html
        <h2>故障排除：Webhook 沒有反應</h2>
        <div class="prose-block">
          <p>先確認 Trigger 節點處於啟用狀態，再檢查下列項目：</p>
          <ol>
            <li>Webhook URL 是否為 Production URL</li>
            <li>反向代理是否放行 <code>POST</code></li>
          </ol>
        </div>

        <h2>常見問題</h2>
        <div class="faq-list">
          <details class="faq-item">
            <summary><h3>Pipeline 可以跨 workflow 共用嗎？</h3></summary>
            <div class="faq-answer"><p>可以，把共用的 Skill 抽成 sub-workflow 再由各 Pipeline 呼叫。</p></div>
          </details>
          <details class="faq-item">
            <summary><h3>單一 Skill 失敗會中斷整條 Pipeline 嗎？</h3></summary>
            <div class="faq-answer"><p>預設會；在該 Skill 開啟 Continue On Fail 後由下游自行判斷。</p></div>
          </details>
        </div>

        <hr>

        <h2>總結</h2>
```

最後，在同一個文章範例的 `<div class="article-nav">` 這一行之前插入：

```html
        <h2>參考資料與延伸閱讀</h2>
        <div class="prose-block">
          <ul>
            <li><a href="#">n8n 官方文件</a></li>
            <li><a href="#">Notion 轉 WordPress 自動發布：n8n 工作流完整教學</a></li>
          </ul>
        </div>

```

Step 4: build 並確認樣式進了產物

Run: `npm run build`
Expected: 成功結束

Run: `grep -c 'faq-item' dist/_astro/*.css`
Expected: 大於 0 的數字

Run: `grep -o 'padding:0 24px 64px' dist/_astro/*.css | wc -l`
Expected: `2`

Run: `grep -o '\.prose ul{list-style:disc' dist/_astro/*.css | wc -l`
Expected: `1`。不能只 grep `list-style:disc`：`about.astro` 的 `.about-list` 本來就有這個宣告，改之前就會命中。輸出是 `0` 時先跑 `grep -o '\.prose ul[^}]*}' dist/_astro/*.css` 看 minify 後的實際寫法再判斷

Step 5: Commit

```bash
git add src/styles/global.css "src/pages/[...slug].astro" style-preview.html
git commit -m "feat(article-blocks): 區塊與風琴樣式、補回列表符號、文章頁底部留白"
```

---

### Task 4: 把誤掛在常見問題區塊底下的收尾標題升成 h2

Implements: `article-blocks.md` #R1

Files:
- Modify: `src/content/posts/n8n-discord-bot-setup-tutorial/index.md`
- Modify: `src/content/posts/n8n-telegram-bot-notification-tutorial/index.md`
- Modify: `src/content/posts/n8n-wordpress-api-integration-guide/index.md`
- Modify: `src/content/posts/cloudflare-cache-rules-wordpress/index.md`
- Modify: `src/content/posts/nextjs-geoip-memory-optimization/index.md`

Interfaces:
- Consumes: CLI `node scripts/check-post-structure.mjs [檔案...]`（Task 1）
- Produces: 無

Done when: `node scripts/check-post-structure.mjs` 帶這 5 個檔案執行，輸出裡沒有任何 `E3`，且 `grep -c '^### 效能測試工具推薦' src/content/posts/cloudflare-cache-rules-wordpress/index.md` 輸出 `0`。

背景：這 5 篇的常見問題區塊後面接著「總結」之類的 h3。照「常見問題區塊內每個 h3 是一題」的規則，這些收尾段落會被收進風琴，所以要升成 h2 移出區塊。

範圍：每篇只改下列標題行的井號數，其餘一個字都不動。粗體題目留給 Task 6。

Step 1: 改標題層級

每一項都是把整行換掉，行內文字不變：

| 檔案 | 原本的行 | 改成 |
|------|---------|------|
| `n8n-discord-bot-setup-tutorial/index.md` | `### 總結與下一步` | `## 總結與下一步` |
| `n8n-discord-bot-setup-tutorial/index.md` | `### 建議的學習路徑` | `## 建議的學習路徑` |
| `n8n-telegram-bot-notification-tutorial/index.md` | `### 總結與下一步` | `## 總結與下一步` |
| `n8n-telegram-bot-notification-tutorial/index.md` | `### 建議的學習路徑` | `## 建議的學習路徑` |
| `n8n-wordpress-api-integration-guide/index.md` | `### 總結與下一步` | `## 總結與下一步` |
| `n8n-wordpress-api-integration-guide/index.md` | `### 建議的學習路徑` | `## 建議的學習路徑` |
| `cloudflare-cache-rules-wordpress/index.md` | `### 效能測試工具推薦` | `## 效能測試工具推薦` |
| `nextjs-geoip-memory-optimization/index.md` | `### 記憶體優化總結與下一步行動` | `## 記憶體優化總結與下一步行動` |

每一行在各自的檔案裡只出現一次。

Step 2: 確認

Run:

```bash
node scripts/check-post-structure.mjs src/content/posts/n8n-discord-bot-setup-tutorial/index.md src/content/posts/n8n-telegram-bot-notification-tutorial/index.md src/content/posts/n8n-wordpress-api-integration-guide/index.md src/content/posts/cloudflare-cache-rules-wordpress/index.md src/content/posts/nextjs-geoip-memory-optimization/index.md 2>&1 | grep -c ' E3'
```

Expected: `0`（仍會列出 E1、E2 與 E6，那是 Task 6 的範圍）

Run: `git diff --stat`
Expected: 5 個檔案，`8 insertions(+), 8 deletions(-)`

Step 3: Commit

```bash
git add src/content/posts
git commit -m "content: 把掛在常見問題底下的收尾標題升成 h2"
```

---

### Task 5: 逐檔調整五篇的區塊結構

Implements: `article-blocks.md` #R1, #R3, #R4

Files:
- Modify: `src/content/posts/n8n-instagram-access-token/index.md`
- Modify: `src/content/posts/samsung-wallet-nfc-access-card-function-unlocked-supported-devices-and-complete-setup-guide/index.md`
- Modify: `src/content/posts/zeabur-nginx-subdomain-to-subdirectory/index.md`
- Modify: `src/content/posts/n8n-data-table-csv-export-import/index.md`
- Modify: `src/content/posts/n8n-line-discord-telegram-bot-comparison/index.md`

Interfaces:
- Consumes: CLI `node scripts/check-post-structure.mjs [檔案...]`（Task 1）
- Produces: 無

Done when: 對 instagram、samsung 兩個檔案執行 `node scripts/check-post-structure.mjs` 輸出 `結構檢查：2 篇，0 條違規`；對 zeabur-nginx 執行輸出恰好 6 條 `E2` 與 1 條 `E1`、沒有 `E4`；對 data-table 與 line-discord-telegram 執行輸出裡沒有 `E6`。

範圍：只做下列五篇列出的修改。答案與連結的文字不動。

Step 1: n8n-instagram-access-token — 清單項目題目改成 h3

`## 常見問題與故障排除` 這一節裡有 6 個寫成清單項目的題目（`-` 後面三個空白）。把下列 6 行各自整行換掉：

| 原本的行 | 改成 |
|---------|------|
| `-   我的 Instagram 帳號不是專業帳號怎麼辦？` | `### 我的 Instagram 帳號不是專業帳號怎麼辦？` |
| `-   為什麼我的 Access Token 會失效？` | `### 為什麼我的 Access Token 會失效？` |
| `-   n8n 憑證測試失敗怎麼辦？` | `### n8n 憑證測試失敗怎麼辦？` |
| `-   Facebook Graph API 無法下載圖片怎麼辦？` | `### Facebook Graph API 無法下載圖片怎麼辦？` |
| `-   如何發佈多張圖片或影片？` | `### 如何發佈多張圖片或影片？` |
| `-   如何排程發佈？` | `### 如何排程發佈？` |

h2 `## 常見問題與故障排除` 不改（含「常見問題」，已是常見問題區塊）。

Step 2: samsung-wallet — 標題改名、清單項目改成 h3、收尾段落移出區塊

把這一整段：

```markdown
## 「NFC 門禁卡」功能問題？

-   **支援哪些實體門禁卡**：支援 RFID 實體卡或感應磁扣，但並不支援加密過的實體卡。

-   **最多可以加幾張**：一支手機最多 8 張。

-   「NFC 門禁卡」功能需要**開啟 NFC** 嗎：需要，因為是靠著 NFC 來模擬門禁卡，而且要設定成「嵌入式安全元件」。

-   **無網路**可以使用「NFC 門禁卡」功能嗎：可以，這功能不需要使用到網路。

-   **沒有電了**可以使用「NFC 門禁卡」功能嗎：不可以，沒電情況下只能使用「悠遊卡」。

-   如果換手機了，**需要重新綁定嗎**：不需要，可以使用三星原廠提供的 Smart Switch Mobile 轉移到新手機。

盼了許久
```

換成：

```markdown
## 「NFC 門禁卡」常見問題

### 支援哪些實體門禁卡？

支援 RFID 實體卡或感應磁扣，但並不支援加密過的實體卡。

### 最多可以加幾張？

一支手機最多 8 張。

### 「NFC 門禁卡」功能需要開啟 NFC 嗎？

需要，因為是靠著 NFC 來模擬門禁卡，而且要設定成「嵌入式安全元件」。

### 無網路可以使用「NFC 門禁卡」功能嗎？

可以，這功能不需要使用到網路。

### 沒有電了可以使用「NFC 門禁卡」功能嗎？

不可以，沒電情況下只能使用「悠遊卡」。

### 如果換手機了，需要重新綁定嗎？

不需要，可以使用三星原廠提供的 Smart Switch Mobile 轉移到新手機。

## 結語

盼了許久
```

「盼了許久」是文章最後一段的開頭四個字，該段其餘文字不動。加 `## 結語` 是因為那一段是全文收尾，不加的話會被收進最後一題的答案裡。

Step 3: zeabur-nginx-subdomain-to-subdirectory — 兩個標題改名

| 原本的行 | 改成 |
|---------|------|
| `## 常見問題排解：Nginx 反向代理設定注意事項` | `## 故障排除：Nginx 反向代理設定注意事項` |
| `## 常見問答` | `## 常見問題` |

這篇 `## 常見問題` 底下的 6 個 `**Q1：…**` 粗體題目留給 Task 6。

Step 4: n8n-data-table-csv-export-import — 兩節併成一節

先把這一行：

```markdown
## 參考資源
```

換成：

```markdown
## 參考資料與延伸閱讀
```

再把這一段：

```markdown
-   [n8n Community](https://community.n8n.io/)

## 延伸閱讀

-   [【n8n 模板分享】探店心願助手
```

換成：

```markdown
-   [n8n Community](https://community.n8n.io/)
-   [【n8n 模板分享】探店心願助手
```

第二段的最後一行只寫到連結文字的開頭，該行其餘文字不動。兩份清單之間不留空行，合成同一份清單。

Step 5: n8n-line-discord-telegram-bot-comparison — 兩節併成一節

把這一段：

```markdown
## 延伸閱讀

-   [n8n x WordPress 整合指南：API 設定、媒體上傳、自動發文全攻略](/n8n-wordpress-api-integration-guide/)

如果這篇文章對你有幫助，歡迎分享給更多需要的人！

## 參考資料

-   [LINE Developers 官方文件](https://developers.line.biz/)
```

換成：

```markdown
如果這篇文章對你有幫助，歡迎分享給更多需要的人！

## 參考資料與延伸閱讀

-   [n8n x WordPress 整合指南：API 設定、媒體上傳、自動發文全攻略](/n8n-wordpress-api-integration-guide/)
-   [LINE Developers 官方文件](https://developers.line.biz/)
```

「如果這篇文章對你有幫助」那句是全文的收尾語，移到標題之前，才不會被框進文末連結區塊。

Step 6: 確認

Run:

```bash
node scripts/check-post-structure.mjs src/content/posts/n8n-instagram-access-token/index.md src/content/posts/samsung-wallet-nfc-access-card-function-unlocked-supported-devices-and-complete-setup-guide/index.md
```

Expected: `結構檢查：2 篇，0 條違規`

Run: `node scripts/check-post-structure.mjs src/content/posts/zeabur-nginx-subdomain-to-subdirectory/index.md`
Expected: 6 行 `E2「常見問題」` 加 1 行 `E1「常見問題」`（粗體題目還沒轉成 h3，所以區塊內暫時沒有 h3，Task 6 會消掉），沒有 `E4`，最後一行 `結構檢查：1 篇，7 條違規`

Run:

```bash
node scripts/check-post-structure.mjs src/content/posts/n8n-data-table-csv-export-import/index.md src/content/posts/n8n-line-discord-telegram-bot-comparison/index.md 2>&1 | grep -c ' E6'
```

Expected: `0`

Step 7: Commit

```bash
git add src/content/posts
git commit -m "content: 五篇文章的常見問題、故障排除與文末連結改成區塊約定的寫法"
```

---

### Task 6: 批次改寫粗體題目與文末連結標題

Implements: `article-blocks.md` #R1, #R4
Review: deep

Files:
- Modify: `src/content/posts/cloudflare-cache-rules-wordpress/index.md`
- Modify: `src/content/posts/edge-ai-accelerator-sizing/index.md`
- Modify: `src/content/posts/n8n-canva-oauth-setup/index.md`
- Modify: `src/content/posts/n8n-data-table-csv-export-import/index.md`
- Modify: `src/content/posts/n8n-discord-bot-setup-tutorial/index.md`
- Modify: `src/content/posts/n8n-line-api-integration-tutorial/index.md`
- Modify: `src/content/posts/n8n-line-discord-telegram-bot-comparison/index.md`
- Modify: `src/content/posts/n8n-notion-api-integration-tutorial/index.md`
- Modify: `src/content/posts/n8n-telegram-bot-notification-tutorial/index.md`
- Modify: `src/content/posts/n8n-template-line-bot-upload-system/index.md`
- Modify: `src/content/posts/n8n-wordpress-api-integration-guide/index.md`
- Modify: `src/content/posts/nextjs-geoip-memory-optimization/index.md`
- Modify: `src/content/posts/nginx-cache-wordpress/index.md`
- Modify: `src/content/posts/security-incidents-php2shell-nodejs-railway/index.md`
- Modify: `src/content/posts/threads-data-export-tutorial/index.md`
- Modify: `src/content/posts/zeabur-incident-permission-blast-radius/index.md`
- Modify: `src/content/posts/zeabur-shutdown-migration-guide/index.md`
- Modify: `src/content/posts/zeabur-nginx-subdomain-to-subdirectory/index.md`
- Modify: `src/content/posts/claude-code-cross-session-messaging/index.md`
- Modify: `src/content/posts/embeddinggemma-2-chinese-retrieval-mac/index.md`
- Modify: `src/content/posts/gemini-4-argon-release/index.md`
- Modify: `src/content/posts/qwen-image-mac-ssd-streaming/index.md`
- Modify: `src/content/posts/n8n-template-store-wish-list/index.md`
- Modify: `src/content/posts/wordpress-migrate-to-zeabur/index.md`
- Modify: `src/content/posts/n8n-credentials-setup-complete-guide/index.md`

Interfaces:
- Consumes: `classifyBlockHeading`、`headingText`、`LINKS_HEADING`（`scripts/lib/article-blocks.mjs`，Task 1）；CLI `node scripts/check-post-structure.mjs`（Task 1）
- Produces: 無（一次性腳本跑完即刪）

Done when: `npm run check:posts` 輸出 `結構檢查：52 篇，0 條違規`；`git diff --stat` 最後一行是 `25 files changed, 114 insertions(+), 114 deletions(-)`；`scripts/tmp-migrate-article-blocks.mjs` 不存在於工作區。

前置：Task 4、Task 5 必須已完成並 commit。本 task 的預期命中數是以那兩個 task 做完後的狀態算的。

背景：這 25 個檔案是同一種機械式取代，由一支腳本一次做完。一個 task 涉及超過 5 個檔案是因為拆開沒有意義——拆成五批還是同一支腳本、同一個 diff 形狀。

腳本做兩件事，都只碰整行符合的行，程式碼區塊內的行不碰：

1. 常見問題區塊內整段粗體的行改成 h3，並拿掉開頭的 `Q1：` 這類編號。例：`**Q1：為什麼連不上？**` 變成 `### 為什麼連不上？`
2. 文字完全等於 `參考資料`、`延伸閱讀`、`相關文章`、`參考資料及延伸閱讀` 的 h2 改成 `## 參考資料與延伸閱讀`

Step 1: 建立一次性腳本

建立 `scripts/tmp-migrate-article-blocks.mjs`（不 commit）：

```js
// 一次性遷移腳本：跑完即刪，不進版控。
// 預設 dry-run，只印命中數；加 --apply 才寫檔。
import { readFileSync, writeFileSync } from 'node:fs';
import { globSync } from 'glob';
import { LINKS_HEADING, classifyBlockHeading, headingText } from './lib/article-blocks.mjs';

const apply = process.argv.includes('--apply');
const LINKS_ALIASES = new Set(['參考資料', '延伸閱讀', '相關文章', '參考資料及延伸閱讀']);
const BOLD_QUESTION = /^\*\*(?:Q\d+\s*[:：.、．]?\s*)?(.+?)\*\*\s*$/;

let questionLines = 0;
let questionFiles = 0;
let headingLines = 0;
let headingFiles = 0;

for (const file of globSync('src/content/posts/**/*.md').sort()) {
  const raw = readFileSync(file, 'utf8');
  const eol = raw.includes('\r\n') ? '\r\n' : '\n';
  let fence = null;
  let inFaq = false;
  let questions = 0;
  let headings = 0;

  const out = raw.split(/\r?\n/).map((line) => {
    const fenceMatch = line.match(/^\s*(```+|~~~+)/);
    if (fenceMatch) {
      const marker = fenceMatch[1][0];
      if (fence === null) fence = marker;
      else if (fence === marker) fence = null;
      return line;
    }
    if (fence !== null) return line;

    const h2 = line.match(/^##\s+(.+)$/);
    if (h2) {
      const text = headingText(h2[1]);
      if (LINKS_ALIASES.has(text)) {
        inFaq = false;
        headings += 1;
        return `## ${LINKS_HEADING}`;
      }
      inFaq = classifyBlockHeading(text) === 'faq';
      return line;
    }

    if (!inFaq) return line;
    const bold = line.match(BOLD_QUESTION);
    if (!bold) return line;
    questions += 1;
    return `### ${bold[1].trim()}`;
  });

  if (questions > 0) {
    questionLines += questions;
    questionFiles += 1;
  }
  if (headings > 0) {
    headingLines += headings;
    headingFiles += 1;
  }
  if (questions + headings > 0) {
    console.log(`${file.replace(/\\/g, '/')}  題目 ${questions}  標題 ${headings}`);
    if (apply) writeFileSync(file, out.join(eol), 'utf8');
  }
}

console.log(`題目 ${questionLines} 行／${questionFiles} 篇，標題 ${headingLines} 行／${headingFiles} 篇`);
console.log(apply ? '已寫入。' : 'dry-run，未寫入任何檔案。');
```

Step 2: dry-run，核對命中數

Run: `node scripts/tmp-migrate-article-blocks.mjs`
Expected: 最後兩行是

```
題目 99 行／18 篇，標題 15 行／15 篇
dry-run，未寫入任何檔案。
```

數字不符就停下來回報，不要加 `--apply`。數字不符代表 Task 4、5 沒做完，或文章在計畫寫成後被改過。

Step 3: 寫入

Run: `node scripts/tmp-migrate-article-blocks.mjs --apply`
Expected: 最後一行 `已寫入。`

Step 4: 核對 diff

Run: `git diff --stat | tail -1`
Expected: ` 25 files changed, 114 insertions(+), 114 deletions(-)`

Run: `git diff -U0 src/content/posts | grep -E '^[+-][^+-]' | grep -vcE '^(-\*\*.+\*\*\s*$|\+### .+|-## (參考資料|延伸閱讀|相關文章|參考資料及延伸閱讀)\s*$|\+## 參考資料與延伸閱讀$)'`
Expected: `0`（diff 裡每一行都屬於上述四種形狀之一，沒有改到別的東西）

Run: `npm run check:posts`
Expected: `結構檢查：52 篇，0 條違規`，結束碼 0

Step 5: 刪掉一次性腳本並 commit

```bash
rm scripts/tmp-migrate-article-blocks.mjs
git status --short | grep -c tmp-migrate
```

Expected: `0`

```bash
git add src/content/posts
git commit -m "content: 常見問題的粗體題目改成 h3，文末連結標題統一為「參考資料與延伸閱讀」"
```

---

### Task 7: sync-from-vault 擋下結構違規的草稿

Implements: `article-blocks.md` #R9
Review: deep

Files:
- Modify: `scripts/lib/vault-post.mjs`（`transformPost()` 與檔頭 import）
- Modify: `scripts/lib/vault-post.test.mjs`（檔尾追加）
- Modify: `scripts/sync-from-vault.mjs`（import 與 `main()` 的報告段）

Interfaces:
- Consumes: `checkPostStructure(markdown: string): Array<{ rule, line, heading, message }>`（`scripts/lib/article-blocks.mjs`，Task 1）
- Produces: `STRUCTURE_ISSUE_PREFIX: string`（值為 `'結構檢查'`，由 `scripts/lib/vault-post.mjs` 匯出）。`transformPost` 對有結構違規的正文回傳 `status: 'blocked'`，每條違規在 `issues` 佔一個字串，格式 `結構檢查 E2「常見問題」：題目要寫成「### 題目」，不寫整段粗體`

Done when: `npm test` 輸出 `# pass 244`、`# fail 0`；Step 6 的實測指令結束碼為 1、輸出含 `結構檢查 E2`，且 `src/content/posts/zz-structure-fixture` 不存在。

背景：`transformPost(data, body, options)` 是 vault 草稿能不能落地的判定點——回 `status: 'blocked'` 的文章，`sync-from-vault.mjs` 的 `main()` 只會把它列在「不合規」報告裡，`--apply` 也不會寫入。所以把結構檢查接進 `transformPost`，dry-run 報告與 `--apply` 的擋下兩件事就都成立；`main()` 只需要補結束碼。

範圍：不動 `transformPost` 既有的欄位檢查與回傳形狀。既有測試一個都不改。

Step 1: 寫失敗的測試

在 `scripts/lib/vault-post.test.mjs` 檔尾追加（`validData` 是該檔既有的 helper，回傳一份會通過所有檢查的 vault frontmatter）：

```js
test('transformPost：常見問題區塊的題目寫成粗體段落判為 blocked', () => {
  const body = '## 常見問題\n\n### 第一題？\n\n答案\n\n**Q2：第二題？**\n\n答案';
  const r = transformPost(validData(), body);
  assert.equal(r.status, 'blocked');
  assert.deepEqual(r.issues, ['結構檢查 E2「常見問題」：題目要寫成「### 題目」，不寫整段粗體']);
});

test('transformPost：區塊寫法合規的正文照常轉出', () => {
  const body = '## 常見問題\n\n### 第一題？\n\n答案\n\n## 參考資料與延伸閱讀\n\n- [來源](https://example.com)';
  const r = transformPost(validData(), body);
  assert.equal(r.status, 'ok');
});

test('transformPost：結構違規與欄位缺漏一次報完', () => {
  const r = transformPost(validData({ cover_image: '' }), '## 延伸閱讀\n\n- [文章](/post/)');
  assert.equal(r.status, 'blocked');
  assert.equal(r.issues.length, 2);
});
```

Step 2: 跑測試確認失敗

Run: `npm test`
Expected: `# fail 2`（第一、三個新測試失敗；第二個本來就會過）

Step 3: 把結構檢查接進 transformPost

`scripts/lib/vault-post.mjs` 的檔頭 import 區加一行（放在既有 import 之後）：

```js
import { checkPostStructure } from './article-blocks.mjs';
```

在 `export function transformPost(` 這一行的上方、它的 JSDoc 註解之前，加上：

```js
/** sync-from-vault 靠這個前綴認出「因結構檢查被擋」的文章，決定結束碼。 */
export const STRUCTURE_ISSUE_PREFIX = '結構檢查';

```

`transformPost` 函式內，把這一行：

```js
  if (issues.length > 0) return { slug, status: 'blocked', issues, warnings };
```

換成：

```js
  // 區塊標題與常見問題的寫法（docs/specs/article-blocks.md R8）。放在這裡而不是落地之後，
  // 是因為落地只新增不覆蓋：寫錯的稿一旦進了 repo，就得在 repo 端再改一次。
  for (const v of checkPostStructure(body)) {
    issues.push(`${STRUCTURE_ISSUE_PREFIX} ${v.rule}「${v.heading}」：${v.message}`);
  }

  if (issues.length > 0) return { slug, status: 'blocked', issues, warnings };
```

Step 4: 跑測試確認通過

Run: `npm test`
Expected: 輸出含 `# pass 244` 與 `# fail 0`

Step 5: --apply 遇到結構違規時回非零結束碼

`scripts/sync-from-vault.mjs`，把這一行：

```js
import { transformPost, renderPostFile, parsePublishAt } from './lib/vault-post.mjs';
```

換成：

```js
import {
  transformPost,
  renderPostFile,
  parsePublishAt,
  STRUCTURE_ISSUE_PREFIX,
} from './lib/vault-post.mjs';
```

同檔 `main()` 內，把這一行：

```js
  console.log(`略過：repo 已有 ${skippedExisting} 篇、已發布或狀態不適用 ${skippedOther} 篇`);
```

換成：

```js
  console.log(`略過：repo 已有 ${skippedExisting} 篇、已發布或狀態不適用 ${skippedOther} 篇`);

  // 缺封面、缺欄位的草稿在 vault 裡是常態，不該讓每次 --apply 都回非零；
  // 結構違規不一樣——那是寫完的稿寫錯了格式，要讓呼叫端（blog:publish）當下就知道。
  const structureBlocked = blocked.filter(({ result }) =>
    result.issues.some((issue) => issue.startsWith(STRUCTURE_ISSUE_PREFIX)),
  );
  if (args.apply && structureBlocked.length > 0) {
    console.error(
      `\n結構檢查未通過 ${structureBlocked.length} 篇，這幾篇不會落地。回 vault 原稿修正後再跑。`,
    );
    process.exitCode = 1;
  }
```

Step 6: 用假的 vault 實測

Run:

```bash
FIXTURE=$(mktemp -d)
cat > "$FIXTURE/fixture.md" <<'EOF'
---
type: tutorial
slug: zz-structure-fixture
title: 結構檢查測試稿
description: 挑選 UPS 電池要看的規格與常見地雷：容量怎麼換算成實際撐機時間、原廠與副廠電池差在哪、換電池前該量哪幾個數字、買回來之後多久要重測一次，還有哪些規格表上的數字其實看了也沒用。這篇把選購到驗收的順序一次講完，讓你不必在停電當下才發現買錯。
category: 硬體維護
cover_image: attachments/cover.png
created: 2026-03-06
content_status: draft
---

## 常見問題

**Q1：第一題？**

答案
EOF
node scripts/sync-from-vault.mjs --vault "$FIXTURE" --slug zz-structure-fixture --apply; echo "exit=$?"
ls src/content/posts/zz-structure-fixture 2>&1 | head -1
rm -rf "$FIXTURE"
```

Expected: 輸出含 `x zz-structure-fixture`、`結構檢查 E1「常見問題」`、`結構檢查 E2「常見問題」`、`結構檢查未通過 1 篇` 與 `exit=1`；`ls` 那行回報找不到該目錄（`No such file or directory`）。

Step 7: Commit

```bash
git add scripts/lib/vault-post.mjs scripts/lib/vault-post.test.mjs scripts/sync-from-vault.mjs
git commit -m "feat(sync-from-vault): 結構違規的草稿不落地，--apply 回非零結束碼"
```

---

### Task 8: pre-commit 與 CI 接上結構檢查，更新專案文件

Implements: `article-blocks.md` #R9

Files:
- Modify: `.githooks/pre-commit`（檔尾）
- Modify: `.github/workflows/seo-pr.yml`（`單元測試` 那一步之後）
- Modify: `CLAUDE.md`
- Modify: `AGENTS.md`

Interfaces:
- Consumes: CLI `node scripts/check-post-structure.mjs --staged <檔案...>` 與 npm script `check:posts`（Task 1）
- Produces: 無

Done when: Step 3 的實測中，hook 對違規的 staged 文章結束碼為 1 且輸出含 `E1「常見問題」` 與 `文章結構檢查未通過`；清掉測試檔後 `git status --short` 沒有 `zz-hook-fixture`。

前置：Task 6 必須已完成（全部文章零違規），否則 CI 那一步一上線就是紅的。

Step 1: pre-commit 加上結構檢查

`.githooks/pre-commit` 檔尾現在是：

```bash
' -- "${FILES[@]}"

exit $?
```

換成：

```bash
' -- "${FILES[@]}"
FRONTMATTER_STATUS=$?

# 區塊標題與常見問題的寫法（docs/specs/article-blocks.md R8）。兩道檢查都跑完才結束，
# 一次 commit 就能看到所有要修的地方，不必修一項才看到下一項。
node scripts/check-post-structure.mjs --staged "${FILES[@]}"
STRUCTURE_STATUS=$?
if [ $STRUCTURE_STATUS -ne 0 ]; then
  echo "" >&2
  echo "[pre-commit] 文章結構檢查未通過，commit 已擋下。" >&2
fi

if [ $FRONTMATTER_STATUS -ne 0 ] || [ $STRUCTURE_STATUS -ne 0 ]; then
  exit 1
fi
exit 0
```

Step 2: CI 加一步

`.github/workflows/seo-pr.yml`，在這兩行之後：

```yaml
      - name: 單元測試（WP 遷移工具鏈）
        run: npm test
```

插入（前面空一行，縮排與相鄰的 step 相同）：

```yaml

      # 掃全部文章而不只是這個 PR 動到的：pre-commit 只看 staged 的檔，可以被 --no-verify 跳過，
      # publish-scheduled 的自動 commit 也不經過 hook。位置與 npm test 同理，fail fast。
      - name: 文章結構檢查（區塊標題與常見問題寫法）
        run: npm run check:posts
```

Step 3: 實測 hook

Run:

```bash
mkdir -p src/content/posts/zz-hook-fixture
cat > src/content/posts/zz-hook-fixture/index.md <<'EOF'
---
title: hook 測試稿
description: 挑選 UPS 電池要看的規格與常見地雷：容量怎麼換算成實際撐機時間、原廠與副廠電池差在哪、換電池前該量哪幾個數字、買回來之後多久要重測一次，還有哪些規格表上的數字其實看了也沒用。這篇把選購到驗收的順序一次講完，讓你不必在停電當下才發現買錯。
date: 2026-11-26
category: tools
---

## 常見問題

- 第一題？

答案
EOF
git add src/content/posts/zz-hook-fixture/index.md
bash .githooks/pre-commit; echo "exit=$?"
git rm -q --cached src/content/posts/zz-hook-fixture/index.md
rm -rf src/content/posts/zz-hook-fixture
git status --short | grep -c zz-hook-fixture
```

Expected: 輸出含 `E1「常見問題」常見問題區塊內沒有任何「### 題目」`、`[pre-commit] 文章結構檢查未通過，commit 已擋下。`、`exit=1`，最後一行是 `0`。

Step 4: 更新 CLAUDE.md

第一處，Commands 節裡 `npm test` 的註解。把：

```
npm test           # 212 unit tests covering scripts/lib/ (WordPress migration toolchain + markdown
```

換成：

```
npm test           # 244 unit tests covering scripts/lib/ (WordPress migration toolchain + markdown
```

同一段註解的最後一行，把：

```
                    # post-id.mjs 文章路徑→id 推導，astro.config.mjs 與 indexnow.mjs 共用)
```

換成：

```
                    # post-id.mjs 文章路徑→id 推導，astro.config.mjs 與 indexnow.mjs 共用 +
                    # article-blocks.mjs 區塊標題辨識與結構檢查 +
                    # rehype-article-blocks.mjs 風琴與框的 HTML 改寫)
```

第二處，CI 那一段。把：

```
**CI:** `.github/workflows/seo-pr.yml` runs `npm test` + `check:functions` + build + `verify:seo` +
```

換成：

```
**CI:** `.github/workflows/seo-pr.yml` runs `npm test` + `check:posts` + `check:functions` + build + `verify:seo` +
```

同一段的最後一句，把：

```
via the `prepare` script) validates frontmatter on staged posts only — seconds-fast, no build.
```

換成：

```
via the `prepare` script) validates frontmatter and article-block structure on staged posts only —
seconds-fast, no build.
```

第三處，在 `## Updating a published post` 這一行之前插入一整節：

```markdown
## Article blocks

Three h2 titles switch the layout of the section under them. Recognition is by the h2's plain text
only — h3 and below never count. Spec: `docs/specs/article-blocks.md`; vocabulary: `CONTEXT.md`.

| h2 text | Block | Rendered as |
|---------|-------|-------------|
| contains 「常見問題」 | 常見問題區塊 | accordion — each `###` is one question, collapsed by default |
| starts with 「故障排除」 | 故障排除區塊 | the whole section in one box |
| equals 「參考資料與延伸閱讀」 | 文末連結區塊 | the whole section in one box |

A title matching both 「常見問題」 and 「故障排除」 is a 常見問題區塊. Anything before the first `###`
in a 常見問題區塊 is the intro and stays outside the accordion.

Writing rules, enforced by `checkPostStructure()` in `scripts/lib/article-blocks.mjs`:
questions are `### 問題？`, never `**Q1：…**`; a 常見問題區塊 must not hold a closing section
(總結／結語／下一步) as an h3 — make it an h2; aliases are rejected (常見問答, a bare FAQ,
疑難排解, and 參考資料／延伸閱讀／相關文章 on their own); one 常見問題區塊 and one 文末連結區塊
per post at most.

The check runs in three places off the same function: `transformPost()` (so `sync-from-vault`
refuses to land a violating draft and `--apply` exits non-zero), `.githooks/pre-commit` (staged
posts), and `npm run check:posts` in CI (all posts).

`classifyBlockHeading()` is the single source for "which block is this h2" —
`scripts/lib/rehype-article-blocks.mjs` and the check both call it. Add a second copy of that logic
and the check will start passing posts the page doesn't actually style.

The wrapping happens in rehype, so the `.md` variants (built from `post.body`) never see it, and
the RSS feed's `sanitizeHtml` whitelist strips `details`/`summary`/`div` while keeping their content.

```

Step 5: 更新 AGENTS.md

把：

```
npm test              # scripts/lib/ 的單元測試（WordPress 匯入工具鏈 + markdown 匯出 + DNS-AID 解析／評估）
```

換成：

```
npm test              # scripts/lib/ 的單元測試（WordPress 匯入工具鏈 + markdown 匯出 + DNS-AID 解析／評估）
npm run check:posts   # 文章結構檢查：區塊標題與常見問題寫法（規則見 docs/specs/article-blocks.md）
```

把：

```
.githooks/pre-commit  文章 frontmatter 快速檢查（commit 時擋）
```

換成：

```
.githooks/pre-commit  文章 frontmatter 與區塊結構快速檢查（commit 時擋）
```

Step 6: Commit

```bash
git add .githooks/pre-commit .github/workflows/seo-pr.yml CLAUDE.md AGENTS.md
git commit -m "ci(article-blocks): pre-commit 與 PR 稽核接上文章結構檢查"
```

---

### Task 9: 整體驗收

Implements: `article-blocks.md` #R2, #R5, #R6, #R7；`design-system.md` #R5, #R6

Files: 無

Interfaces:
- Consumes: 前面所有 task 的產出
- Produces: 無

Done when: 下列 Step 1 到 Step 3 的每個指令都符合預期輸出，Step 4 的六項瀏覽器檢查全部成立。

Step 1: 測試與檢查

Run: `npm test`
Expected: `# pass 244`、`# fail 0`

Run: `npm run check:posts`
Expected: `結構檢查：52 篇，0 條違規`

Run: `npm run check:functions`
Expected: 無輸出、結束碼 0

Step 2: build 與 SEO 驗證

Run: `npm run build && npm run verify:seo`
Expected: 兩者都成功結束

Step 3: 產物檢查

Run: `grep -rlE '<details|faq-item|prose-block' dist --include='*.md' | wc -l`
Expected: `0`（markdown 變體不含版型標記）

Run: `grep -o 'class="faq-item"' dist/n8n-canva-oauth-setup/index.html | wc -l`
Expected: `8`

Run: `grep -o 'class="prose-block"' dist/n8n-canva-oauth-setup/index.html | wc -l`
Expected: `2`（故障排除指南一個、參考資料與延伸閱讀一個）

Run: `grep -c '<details' dist/rss.xml`
Expected: `0`

Step 4: 瀏覽器實看

Run: `npm run preview`，開 `http://localhost:4321/n8n-canva-oauth-setup/`，逐項確認：

1. 「常見問題 FAQ」底下是一個有邊框的區塊，8 題各佔一列、全部收合，列與列之間有分隔線，右側是 `+`
2. 點任一題展開答案，`+` 變成 `−`；再點另一題，前一題維持展開
3. 用 Tab 移到題目列出現橘色焦點外框，按 Enter 可開合
4. 「故障排除指南」與「參考資料與延伸閱讀」的標題在框外，內容在框內；框沒有左側橘色粗線
5. 正文的無號列表有圓點、有號列表有數字，顏色比正文淡
6. 捲到頁尾，上一篇／下一篇與 footer 之間有明顯留白；把視窗縮到 400px 寬再看一次，留白仍在

再開 `http://localhost:4321/kicad-mcp-autoroute/`，點側邊目錄中常見問題底下的任一題，確認頁面捲到該題的題目列。

最後開 `http://localhost:4321/privacy-policy/`（它也用 `.prose`），確認列表有符號、版面沒有因為列表樣式而跑掉。

任何一項不成立就回報是哪一項、實際看到什麼，不要自行調整樣式數值以外的東西。

---

### Task 10: 回寫 vault 的 blog plugin 寫作約定

Implements: `article-blocks.md` #R9

Files: 無

本 task 不動 repo 內的檔案，修改的是 repo 外的兩個檔（絕對路徑）：

- `C:/Users/Frank/obsidian-vault/.claude/plugins/blog/skills/write/SKILL.md`（`## 格式規範` 與 `## 文章結構`），下文簡稱 `write/SKILL.md`
- `C:/Users/Frank/obsidian-vault/.claude/plugins/blog/skills/publish/SKILL.md`（`## 硬約束` 與「落地（第 5 步）」的第 4 步），下文簡稱 `publish/SKILL.md`

Interfaces:
- Consumes: Task 7 定案的錯誤訊息用詞（`結構檢查`）
- Produces: 無

Done when: `grep -c '參考資料與延伸閱讀' "C:/Users/Frank/obsidian-vault/.claude/plugins/blog/skills/write/SKILL.md"` 輸出 `2`；`grep -c '結構檢查' "C:/Users/Frank/obsidian-vault/.claude/plugins/blog/skills/publish/SKILL.md"` 輸出 `2`。

背景：這兩個檔案在 Obsidian vault，不在本 repo，也不在 git 版控下（vault 用 Syncthing 同步）。用 Edit 工具修改即可，沒有 commit 步驟。檢查邏輯只存在 repo，這裡只改文字約定。

範圍：只改下列四處。不新增檔案，不動 `preflight.py`。

Step 1: blog:write 的格式規範

`write/SKILL.md`，把這一行：

```markdown
- FAQ 答案寫成描述式段落、50 字以內：不用列表或表格，多個項目以頓號串成一句，只留解決問題的核心，問題標題照原樣
```

換成：

```markdown
- FAQ 的 h2 要含「常見問題」四個字（前後可加主題詞），每題寫成 `### 問題？`，不寫 `**Q1：…**`、不加編號；答案寫成描述式段落、50 字以內：不用列表或表格，多個項目以頓號串成一句，只留解決問題的核心
- 排錯或注意事項章節的 h2 以「故障排除」開頭；文末的來源與站內連結只放一節，h2 固定寫 `## 參考資料與延伸閱讀`。astro-blog 依這三種標題套版型，寫成別名（常見問答、疑難排解、單獨的參考資料或延伸閱讀）落地時會被擋
```

Step 2: blog:write 的文章結構

同檔，把這兩行：

```markdown
5. 常見問題 FAQ（視需要）
6. 結語/下一步（視需要）
```

換成：

```markdown
5. 常見問題（視需要）
6. 結語/下一步（視需要）
7. 參考資料與延伸閱讀（視需要）
```

Step 3: blog:publish 的硬約束

`publish/SKILL.md`，在這一行之後：

```markdown
- **排程訊號只能住 repo**。vault 的 `schedule_wordpress` 是行事曆，CI runner 看不到 vault
```

加一行：

```markdown
- **正文的區塊標題必須合規**。常見問題的題目要是 `###`、文末連結的 h2 只能是 `參考資料與延伸閱讀`；違規的文章 `sync-from-vault` 會列出「結構檢查」開頭的訊息、該篇不落地、`--apply` 結束碼非零。要回 vault 原稿改，不是在 repo 端修
```

Step 4: blog:publish 的 dry-run 步驟

同檔，把這一行：

```markdown
4. **dry-run**：不加 `--apply` 先看報告。確認「可搬 1 篇」而且分類、圖片張數都對
```

換成：

```markdown
4. **dry-run**：不加 `--apply` 先看報告。確認「可搬 1 篇」而且分類、圖片張數都對，報告裡沒有「結構檢查」開頭的訊息
```

Step 5: 確認

Run: `grep -c '參考資料與延伸閱讀' "C:/Users/Frank/obsidian-vault/.claude/plugins/blog/skills/write/SKILL.md"`
Expected: `2`

Run: `grep -c '結構檢查' "C:/Users/Frank/obsidian-vault/.claude/plugins/blog/skills/publish/SKILL.md"`
Expected: `2`
