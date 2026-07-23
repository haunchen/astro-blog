/**
 * 建置期產生「只含站上實際用到分片」的 web font CSS。
 *
 * 問題：直接 import @fontsource(-variable) 的 index.css 會帶進整套 unicode-range 分片
 * （Noto Sans TC 105 個、Noto Serif TC 108 個、latin 家族各含 cyrillic/greek/vietnamese），
 * 打包後主 CSS 達 284KB 且為 render-blocking，是本站 LCP/FCP 的最大單點。
 *
 * 作法：掃出全站實際出現的字元集合，逐一比對每個 @font-face 的 unicode-range，
 * 只保留有交集的分片，並把對應 woff2 複製到 public/fonts/ 自 host。
 * 分片機制本身不變——瀏覽器仍只下載當前頁面需要的那幾片，這裡砍掉的純粹是永遠不會命中的宣告。
 *
 * 安全性：字元集合來自 src/content（文章原文）與 src/**（UI 字串），本站為全靜態、
 * 無使用者產生內容，故集合即為完整值域。若哪天引入動態內容，未涵蓋的字會 fallback
 * 到系統字型（不會是豆腐字），降級可接受。
 *
 * 產出（皆為 build artifact，已列入 .gitignore）：
 *   public/fonts/*.woff2
 *   src/styles/fonts.css
 */
import { glob } from 'glob';
import fs from 'node:fs/promises';
import subsetFont from 'subset-font';
import path from 'node:path';

const OUT_CSS = 'src/styles/fonts.css';
const OUT_DIR = 'public/fonts';

// 與 BaseLayout 原本的 @fontsource import 一一對應。
// preload: 首屏一定會用到的分片（latin），輸出 <link rel=preload> 供 BaseLayout 使用。
const FAMILIES = [
  { pkg: '@fontsource/merriweather', css: '400.css' },
  { pkg: '@fontsource/merriweather', css: '700.css' },
  { pkg: '@fontsource/merriweather', css: '400-italic.css' },
  { pkg: '@fontsource/inter', css: '400.css' },
  { pkg: '@fontsource/inter', css: '500.css' },
  { pkg: '@fontsource/inter', css: '600.css' },
  { pkg: '@fontsource/inter', css: '700.css' },
  { pkg: '@fontsource/jetbrains-mono', css: '400.css' },
  { pkg: '@fontsource/jetbrains-mono', css: '500.css' },
  { pkg: '@fontsource-variable/noto-serif-tc', css: 'index.css' },
  { pkg: '@fontsource-variable/noto-sans-tc', css: 'index.css' },
];

/** 站上實際出現的字元集合 */
async function collectChars() {
  const chars = new Set();
  const files = [
    ...(await glob('src/content/**/*.md')),
    ...(await glob('src/**/*.{astro,ts,tsx,js,mjs}')),
    ...(await glob('scripts/**/*.mjs')),
  ];
  for (const f of files) {
    for (const c of await fs.readFile(f, 'utf-8')) chars.add(c);
  }
  return chars;
}

/** 'U+4e00-9fff, U+ff??' → [[start, end], ...] */
function parseUnicodeRange(value) {
  return value.split(',').map((raw) => {
    const t = raw.trim().replace(/^U\+/i, '');
    if (t.includes('-')) {
      const [a, z] = t.split('-');
      return [parseInt(a, 16), parseInt(z, 16)];
    }
    if (t.includes('?')) {
      return [parseInt(t.replace(/\?/g, '0'), 16), parseInt(t.replace(/\?/g, 'F'), 16)];
    }
    const cp = parseInt(t, 16);
    return [cp, cp];
  });
}

const chars = await collectChars();
const codePoints = [...chars].map((c) => c.codePointAt(0));

await fs.rm(OUT_DIR, { recursive: true, force: true });
await fs.mkdir(OUT_DIR, { recursive: true });

const out = [
  '/* 由 scripts/build-font-css.mjs 產生，請勿手動編輯。改字型請改該腳本的 FAMILIES。 */',
];
const preloads = [];
let kept = 0;
let dropped = 0;
let subsetBytes = 0;
let originalBytes = 0;

for (const { pkg, css } of FAMILIES) {
  const cssPath = path.join('node_modules', pkg, css);
  const source = await fs.readFile(cssPath, 'utf-8');
  // index.css 可能只是 @import 轉發，展開一層
  const forwarded = source.match(/@import\s+["']\.\/([^"']+)["']/);
  const text = forwarded
    ? await fs.readFile(path.join('node_modules', pkg, forwarded[1]), 'utf-8')
    : source;

  for (const block of text.split('@font-face').slice(1)) {
    const body = block.slice(0, block.indexOf('}') + 1);
    const rangeMatch = body.match(/unicode-range:\s*([^;]+);/);
    // 沒有 unicode-range 的分片（單一 subset 字型）一律保留
    const ranges = rangeMatch ? parseUnicodeRange(rangeMatch[1]) : null;
    const hit =
      !ranges || codePoints.some((cp) => ranges.some(([a, z]) => cp >= a && cp <= z));
    if (!hit) {
      dropped++;
      continue;
    }

    // 只取 woff2（現代瀏覽器全支援；保留 woff 只會讓 CSS 變大）
    const fileMatch = body.match(/url\(\.\/files\/([^)]+\.woff2)\)/);
    if (!fileMatch) {
      dropped++;
      continue;
    }
    const fileName = fileMatch[1];
    const srcFile = path.join('node_modules', pkg, 'files', fileName);
    const outFile = path.join(OUT_DIR, fileName);
    // 該分片內站上實際用到的字，逐檔再 subset 一次：
    // Noto CJK 一個分片動輒 40-70KB，但本站往往只用到其中十幾個字。
    const glyphText = ranges
      ? [...chars]
          .filter((c) => {
            const cp = c.codePointAt(0);
            return ranges.some(([a, z]) => cp >= a && cp <= z);
          })
          .join('')
      : null;
    if (glyphText) {
      const subset = await subsetFont(await fs.readFile(srcFile), glyphText, {
        targetFormat: 'woff2',
      });
      await fs.writeFile(outFile, subset);
      subsetBytes += subset.length;
      originalBytes += (await fs.stat(srcFile)).size;
    } else {
      await fs.copyFile(srcFile, outFile);
    }

    // Noto CJK 每個分片的 unicode-range 動輒數百個碼位，光字串就佔掉大半體積。
    // 既然已經確定只有站上用到的字會被渲染，就把 range 收斂成「本站實際命中的碼位」
    // 並合併成連續區間——語意等價（未涵蓋的字本來就不會用這個分片），體積差一個量級。
    let rewritten = body
      .replace(/src:[^;]+;/, `src: url(/fonts/${fileName}) format('woff2');`)
      .replace(/font-display:\s*[^;]+;/, 'font-display: swap;');
    if (ranges) {
      const hits = codePoints
        .filter((cp) => ranges.some(([a, z]) => cp >= a && cp <= z))
        .sort((a, b) => a - b);
      const merged = [];
      for (const cp of hits) {
        const last = merged[merged.length - 1];
        if (last && cp === last[1] + 1) last[1] = cp;
        else if (!last || cp !== last[1]) merged.push([cp, cp]);
      }
      const hex = (n) => n.toString(16).toUpperCase().padStart(4, '0');
      const narrowed = merged
        .map(([a, z]) => (a === z ? `U+${hex(a)}` : `U+${hex(a)}-${hex(z)}`))
        .join(',');
      rewritten = rewritten.replace(/unicode-range:\s*[^;]+;/, `unicode-range: ${narrowed};`);
    }
    if (!/font-display/.test(rewritten)) {
      rewritten = rewritten.replace('{', '{\n  font-display: swap;');
    }
    out.push(`@font-face${rewritten}`);
    kept++;

    // 首屏 preload：正文 Merriweather 400 與 UI Inter 400 的 latin 分片
    const isLatin = /-latin-/.test(fileName) && !/-latin-ext-/.test(fileName);
    const isCritical =
      isLatin &&
      (fileName.includes('merriweather-latin-400-normal') ||
        fileName.includes('inter-latin-400-normal'));
    if (isCritical) preloads.push(`/fonts/${fileName}`);
  }
}

await fs.writeFile(OUT_CSS, out.join('\n') + '\n');
await fs.writeFile(
  'src/styles/font-preloads.json',
  JSON.stringify(preloads, null, 2) + '\n',
);

const bytes = (await fs.stat(OUT_CSS)).size;
console.log(
  `[build-font-css] chars=${chars.size} kept=${kept} dropped=${dropped} css=${(bytes / 1024).toFixed(1)}KB preload=${preloads.length} fonts=${(subsetBytes / 1024 / 1024).toFixed(2)}MB (from ${(originalBytes / 1024 / 1024).toFixed(2)}MB)`,
);

// 守門：若哪天 fontsource 改了檔名慣例導致全數落空，讓 build 失敗而非默默出無字型的站。
if (kept === 0) {
  throw new Error('[build-font-css] 沒有保留任何 @font-face，請檢查 fontsource 套件結構。');
}
if (preloads.length === 0) {
  throw new Error('[build-font-css] 找不到可 preload 的首屏 latin 分片，請檢查檔名慣例。');
}
