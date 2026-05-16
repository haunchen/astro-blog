import { glob } from 'glob';
import matter from 'gray-matter';
import subsetFont from 'subset-font';
import fs from 'node:fs/promises';
import path from 'node:path';

const SITE_NAME = '下班後的工程師筆記';
const TAGLINE = '白天上班，下班寫 Side Project。';
const CATEGORY_LABELS = 'n8nFlutterDevOpsRaspberry Pi工具';
const STATIC_TEXT = `${SITE_NAME}${TAGLINE}${CATEGORY_LABELS}frankchen.tw`;

const files = await glob('src/content/posts/**/*.md');
const chars = new Set(STATIC_TEXT);

for (const f of files) {
  const raw = await fs.readFile(f, 'utf-8');
  const { data } = matter(raw);
  if (data.draft) continue;
  for (const c of data.title ?? '') chars.add(c);
  for (const c of data.description ?? '') chars.add(c);
}

const text = [...chars].join('');
console.log(`[subset-fonts] unique chars: ${chars.size}`);

// CJK: 透過 Google Fonts API 一次取得包含實際用字的 woff2
const cjkUrl = `https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@700&text=${encodeURIComponent(text)}`;
const cssRes = await fetch(cjkUrl, {
  headers: {
    // 用 Mac Safari UA 確保拿到 woff2
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
  },
});
if (!cssRes.ok) throw new Error(`Google Fonts CSS fetch failed: ${cssRes.status}`);
const css = await cssRes.text();
const woffMatch = css.match(/url\((https:\/\/[^)]+)\)/);
if (!woffMatch) throw new Error('Could not extract font URL from Google Fonts CSS');
const fontRes = await fetch(woffMatch[1]);
if (!fontRes.ok) throw new Error(`Font binary fetch failed: ${fontRes.status}`);
const cjkSrc = Buffer.from(await fontRes.arrayBuffer());
console.log(`[subset-fonts] fetched CJK source from Google Fonts: ${cjkSrc.length} bytes`);

// subset-font 把 woff2 重新轉為 woff（satori 不接 woff2）
const cjkSubset = await subsetFont(cjkSrc, text, { targetFormat: 'woff' });
await fs.mkdir('src/assets/og-fonts', { recursive: true });
await fs.writeFile('src/assets/og-fonts/noto-sans-tc-subset.woff', cjkSubset);
console.log(`[subset-fonts] noto-sans-tc-subset.woff: ${cjkSubset.length} bytes`);

const interCandidates = [
  'node_modules/@fontsource/inter/files/inter-latin-700-normal.woff',
  'node_modules/@fontsource/inter/files/inter-latin-700-normal.woff2',
];
let interSrc, interExt;
for (const candidate of interCandidates) {
  try {
    interSrc = await fs.readFile(candidate);
    interExt = candidate.endsWith('.woff2') ? '.woff2' : '.woff';
    console.log(`[subset-fonts] using ${candidate}`);
    break;
  } catch {}
}
if (!interSrc) throw new Error('Inter 700 source not found.');

// satori 需要 woff（不接 woff2）。若 only woff2 可用，subset 為 woff
if (interExt === '.woff2') {
  const interSubset = await subsetFont(interSrc, text, { targetFormat: 'woff' });
  await fs.writeFile('src/assets/og-fonts/inter-bold.woff', interSubset);
} else {
  await fs.writeFile('src/assets/og-fonts/inter-bold.woff', interSrc);
}
console.log('[subset-fonts] inter-bold.woff written');
