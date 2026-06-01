import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

/**
 * 從 Markdown 內文抓出所有 http(s) 圖片 URL，去重且保序。
 * @param {string} markdown
 * @returns {string[]}
 */
export function collectImageUrls(markdown) {
  const re = /!\[[^\]]*\]\((https?:\/\/[^)]+)\)/g;
  const seen = new Set();
  const out = [];
  let m;
  while ((m = re.exec(markdown)) !== null) {
    if (!seen.has(m[1])) {
      seen.add(m[1]);
      out.push(m[1]);
    }
  }
  return out;
}

/**
 * 規劃本地檔名：cover → cover.webp，內文圖 → img-N.webp。
 * @param {string|null} coverUrl
 * @param {string[]} contentUrls
 * @returns {{ cover: {url:string, localName:string}|null, content: {url:string, localName:string}[] }}
 */
export function planImageNames(coverUrl, contentUrls) {
  return {
    cover: coverUrl ? { url: coverUrl, localName: 'cover.webp' } : null,
    content: contentUrls.map((url, i) => ({ url, localName: `img-${i + 1}.webp` })),
  };
}

/**
 * 下載單張圖片並以 sharp 轉換為 WebP（quality 82）。
 * 失敗時 console.warn 並回傳 false，不 throw（R7：不中斷整批）。
 *
 * @param {string} url
 * @param {string} destPath
 * @param {function} fetchImpl - 可注入 mock，預設為全域 fetch
 * @returns {Promise<boolean>}
 */
export async function downloadAndConvert(url, destPath, fetchImpl = fetch) {
  try {
    const res = await fetchImpl(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    await mkdir(path.dirname(destPath), { recursive: true });
    await sharp(buf).webp({ quality: 82 }).toFile(destPath);
    return true;
  } catch (err) {
    console.warn(`  [IMG FAIL] ${url} -> ${err.message}`);
    return false;
  }
}
