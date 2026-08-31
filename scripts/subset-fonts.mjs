import { glob } from 'glob';
import matter from 'gray-matter';
import subsetFont from 'subset-font';
import fs from 'node:fs/promises';

const SITE_NAME = '下班後的工程師筆記';
const TAGLINE = '白天上班，下班寫 Side Project。';
// 短標籤（site-meta.ts 的 CATEGORY_BADGE_LABEL）逐字串接：OG 圖用的是這組字元，
// 新增分類時漏了這裡，那幾個字在 OG 圖上會變成 tofu。
const CATEGORY_LABELS = 'n8nFlutterDevOpsRaspberry Pi工具硬體';
const STATIC_TEXT = `${SITE_NAME}${TAGLINE}${CATEGORY_LABELS}frankchen.tw`;

const files = await glob('src/content/posts/**/*.md');
const chars = new Set(STATIC_TEXT);

for (const f of files) {
  const raw = await fs.readFile(f, 'utf-8');
  const { data } = matter(raw);
  if (data.draft) continue;
  for (const c of data.title ?? '') chars.add(c);
}

const text = [...chars].join('');
// OG 圖字型堆疊為 'Noto Sans TC, Inter, sans-serif'，satori 逐字元 fallback：
// ASCII 由 Inter（latin-700 unicode-range U+0000-00FF，完整涵蓋）渲染，Noto Sans TC 的
// text= 請求無需含 ASCII。過濾半形 ASCII 只影響 Noto，全形標點（≥U+3000）仍留在 CJK subset。
const cjkChars = new Set([...chars].filter((c) => !/[\x00-\x7F]/.test(c)));
const cjkText = [...cjkChars].join('');
console.log(`[subset-fonts] unique chars: ${chars.size} total, ${cjkChars.size} CJK-only`);

/**
 * 子集由誰產生，2026-08-31 換人了。
 *
 * 原本靠 Google Fonts css2 的 `text=` 回一份現成子集，本地的 subsetFont 只做 woff2→woff
 * 的格式轉換；於是那個參數失效就等於子集失效，前面兩道守門（>700 字 throw、來源 >512KB
 * throw）都是在替它把關。而 Google 現在對 Noto Sans TC 一律忽略 `text=`——實測送三個字
 * 也回 4,519,440 bytes 的整套字型，與字數無關，所以那兩道門是在擋一個沒辦法避開的常態。
 *
 * 改成不依賴它：`text=` 照送（哪天恢復就省 4.5MB 頻寬），但無論回整套或子集，一律由本地
 * subsetFont 依 cjkText 重新裁一次。這條路兩種回應都成立，也就不必再猜 Google 的行為。
 * 代價是每次 build 多下載 4.5MB；真正的永久修法是連下載都不要、字型入庫，見 Issue #2。
 *
 * 守門改守輸出：來源字型缺字形時 subsetFont 不會報錯，只會安靜地少裁幾個字，OG 圖照樣
 * 豆腐字而 build 綠燈——那才是這支腳本從頭到尾要防的事，而且與 Google 怎麼回無關。
 */

// CJK: 向 Google Fonts 取字型來源（回整套或子集都可以，本地會再裁一次）
const cjkUrl = `https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@700&text=${encodeURIComponent(cjkText)}`;
const cssRes = await fetch(cjkUrl, {
  headers: {
    // 用 Mac Safari UA 確保拿到 woff2
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
  },
});
if (!cssRes.ok) throw new Error(`Google Fonts CSS fetch failed: ${cssRes.status}`);
const css = await cssRes.text();
const woffMatch = css.match(/url\(["']?(https:\/\/[^"')]+)["']?\)/);
if (!woffMatch) throw new Error('Could not extract font URL from Google Fonts CSS');
const fontRes = await fetch(woffMatch[1]);
if (!fontRes.ok) throw new Error(`Font binary fetch failed: ${fontRes.status}`);
const cjkSrc = Buffer.from(await fontRes.arrayBuffer());
const srcKind = cjkSrc.length > 512 * 1024 ? '整套字型（text= 被忽略）' : '子集（text= 生效）';
console.log(`[subset-fonts] fetched CJK source: ${cjkSrc.length} bytes — ${srcKind}`);

// subset-font 依 cjkText 裁出子集，並把 woff2 轉為 woff（satori 不接 woff2）
const cjkSubset = await subsetFont(cjkSrc, cjkText, { targetFormat: 'woff' });

/**
 * 輸出驗收：CJK 字形一個約 200 bytes（2026-08-31 實測 283 字得 59,124 bytes，209 bytes/字）。
 * 門檻取 50 保守留四倍餘裕——它要抓的是「來源缺字形、裁出來剩沒幾個字」那種數量級的落差，
 * 不是字形繁簡造成的正常浮動。這是全腳本唯一擋得住 OG 圖豆腐字的檢查，別為了讓 build 過而放寬它。
 *
 * 侷限：woff 的表頭是固定開銷，字數少時會把 bytes/字 墊高（實測拿只含 3 字形的來源裁 24 字
 * 仍有 45 bytes/字），所以這道門在小樣本下偏寬鬆。偏寬鬆的方向是安全的——本站字數在數百量級，
 * 表頭佔比可以忽略，真的缺字形時比值會掉到個位數。
 */
const MIN_BYTES_PER_CJK_CHAR = 50;
const minExpected = cjkChars.size * MIN_BYTES_PER_CJK_CHAR;
if (cjkSubset.length < minExpected) {
  throw new Error(
    `[subset-fonts] subset 後僅 ${cjkSubset.length} bytes，低於 ${cjkChars.size} 字的預期下限 ${minExpected} bytes` +
    `（約 ${(cjkSubset.length / cjkChars.size).toFixed(1)} bytes/字）；` +
    `來源字型可能缺字形，OG 圖會出現豆腐字。來源為 ${srcKind}，${cjkSrc.length} bytes。`
  );
}

await fs.mkdir('src/assets/og-fonts', { recursive: true });
await fs.writeFile('src/assets/og-fonts/noto-sans-tc-subset.woff', cjkSubset);
console.log(
  `[subset-fonts] noto-sans-tc-subset.woff: ${cjkSubset.length} bytes ` +
  `(${(cjkSubset.length / cjkChars.size).toFixed(1)} bytes/字，下限 ${MIN_BYTES_PER_CJK_CHAR})`
);

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
