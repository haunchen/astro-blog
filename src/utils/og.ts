import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ogImagePath, renderOgImage } from '../../scripts/lib/og-image.mjs';
import { categoryBadgeLabel, SITE } from './site-meta';
import type { Post } from './posts';

export interface OgImage {
  /** `/og/<id>.<hash>.png` */
  path: string;
  hash: string;
  bytes: Buffer;
}

/**
 * OG 圖的單一取得管道。
 *
 * 三個消費端（og:image、BlogPosting JSON-LD 的 image、文章 .md 變體的 frontmatter image）
 * 與 /og/[...slug].png 端點全都走這裡，網址因此不可能各算各的。
 *
 * 為什麼是 memoize 而不是「先產圖再渲染頁面」：消費端在頁面渲染時就要網址，PNG 位元組
 * 卻要到端點渲染完才存在，而兩者在同一次 build 內沒有順序保證。改成誰先要到誰觸發渲染、
 * 結果快取在模組層之後，順序不再重要（見 pre-launch-infra.md D10）。
 *
 * 快取的是 Promise 不是結果：同一篇被併發要兩次時，存結果會讓兩邊都撲空而渲染兩次。
 * 正確性不依賴這層快取——同一輸入的輸出位元組完全相同，快取失效只會多花 8 毫秒。
 */
const cache = new Map<string, Promise<OgImage>>();

let fontsPromise: Promise<Parameters<typeof renderOgImage>[0]['fonts']> | undefined;

/**
 * 字型目錄的絕對路徑，由 astro.config.mjs 的 vite.define 在編譯期注入（理由見該處註解）。
 *
 * 原本是 `readFile('src/assets/og-fonts/…')`——相對於 process cwd。只有 OG 端點在用時，
 * 「執行時 cwd 一定是 repo root」這個隱含前提從沒被檢驗過；呼叫端擴大成文章頁、.md 端點、
 * OG 端點三處之後，任何非 repo root 的執行情境都會多兩個爆點，而且錯誤訊息只是 ENOENT，
 * 看不出真正的原因是 cwd。
 *
 * 為什麼不是 `new URL('../assets/…', import.meta.url)`：本模組在 build 時會被 bundle 進
 * dist/chunks/，那裡的 import.meta.url 指向 dist 而非原始碼位置，實測直接 ENOENT。
 *
 * 型別宣告在 src/env.d.ts——不能寫在這裡，理由見該檔註解。
 */
function getFonts() {
  return (fontsPromise ??= Promise.all([
    readFile(join(__OG_FONT_DIR__, 'noto-sans-tc-subset.woff')),
    readFile(join(__OG_FONT_DIR__, 'inter-bold.woff')),
  ]).then(([notoSansTC, inter]) => [
    { name: 'Noto Sans TC', data: notoSansTC, weight: 700, style: 'normal' },
    { name: 'Inter', data: inter, weight: 700, style: 'normal' },
  ]));
}

export function getOgImage(post: Post): Promise<OgImage> {
  const cached = cache.get(post.id);
  if (cached) return cached;

  const pending = (async () => {
    const { bytes, hash } = await renderOgImage({
      title: post.data.title,
      category: categoryBadgeLabel(post.data.category),
      siteName: SITE.name,
      fonts: await getFonts(),
    });
    return { path: ogImagePath(post.id, hash), hash, bytes };
  })();

  cache.set(post.id, pending);
  return pending;
}
