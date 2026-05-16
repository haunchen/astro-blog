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

const cjkSrcCandidates = [
  'node_modules/@fontsource-variable/noto-sans-tc/files/noto-sans-tc-chinese-traditional-wght-normal.woff2',
  'node_modules/@fontsource-variable/noto-sans-tc/files/noto-sans-tc-latin-wght-normal.woff2',
];
let cjkSrc;
for (const candidate of cjkSrcCandidates) {
  try {
    cjkSrc = await fs.readFile(candidate);
    console.log(`[subset-fonts] using ${candidate}`);
    break;
  } catch {}
}
if (!cjkSrc) {
  throw new Error('Noto Sans TC source font not found. Check @fontsource-variable/noto-sans-tc install.');
}

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
