/**
 * OG 圖的渲染與內容雜湊——純函式，不碰 astro 也不碰檔案系統。
 *
 * 抽出來的理由有兩個。一是可測：雜湊必須「內容沒變就不變」，而那要靠單元測試釘住，
 * 端點裡的程式碼跑不到 `npm test`。二是消費端與端點要拿到完全相同的網址，唯一保險的
 * 做法就是兩邊呼叫同一個函式（接線層見 src/utils/og.ts）。
 */
import satori from 'satori';
import sharp from 'sharp';
import { createHash } from 'node:crypto';

// satori 畫布尺寸。與 BaseLayout 宣告的 og:image:width/height 是同一組值，但不對外匯出
// ——BaseLayout 自己推導那兩個屬性，沒有消費端會 import 這裡的常數。
const OG_WIDTH = 1200;
const OG_HEIGHT = 630;

/** 檔名裡的雜湊長度，與 build-font-css.mjs 的字型雜湊一致。 */
const HASH_LENGTH = 8;

function ogTemplate({ title, category, siteName }) {
  return {
    type: 'div',
    props: {
      style: {
        width: `${OG_WIDTH}px`,
        height: `${OG_HEIGHT}px`,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '72px',
        backgroundColor: '#0f172a',
        color: '#E2E8F0',
        fontFamily: 'Noto Sans TC, Inter, sans-serif',
      },
      children: [
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              alignSelf: 'flex-start',
              padding: '8px 20px',
              backgroundColor: '#fb923c',
              color: '#0f172a',
              borderRadius: '999px',
              fontSize: '28px',
              fontWeight: 700,
            },
            children: category,
          },
        },
        {
          type: 'div',
          props: {
            style: {
              fontSize: '64px',
              fontWeight: 700,
              lineHeight: 1.3,
              color: '#F8FAFC',
              display: 'flex',
            },
            children: title,
          },
        },
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              borderTop: '2px solid #334155',
              paddingTop: '24px',
            },
            children: [
              {
                type: 'div',
                props: {
                  style: { fontSize: '28px', color: '#F8FAFC', fontWeight: 700 },
                  children: siteName,
                },
              },
              {
                type: 'div',
                props: {
                  style: { fontSize: '22px', color: '#94A3B8' },
                  children: 'frankchen.tw',
                },
              },
            ],
          },
        },
      ],
    },
  };
}

/**
 * 渲染一張 OG 圖，回傳 PNG 位元組與其內容雜湊。
 *
 * 雜湊取自「輸出位元組」而非「輸入欄位」：2026-08-14 實測，satori + sharp 對同一輸入
 * 的輸出是決定性的，且與字型檔本身的位元組無關（只取決於實際用到的字形輪廓）。所以
 * 這個雜湊在範本改動時會變（輸入雜湊不會，得靠人手動 bump 版本號），在 subset 字型
 * 因新文章而重算時不會變（輸入雜湊若含字型就會全站翻新）。見 pre-launch-infra.md D12。
 *
 * @param {{ title: string, category: string, siteName: string, fonts: Array<{ name: string, data: Buffer | ArrayBuffer, weight: number, style: string }> }} input
 * @returns {Promise<{ bytes: Buffer, hash: string }>}
 */
export async function renderOgImage({ title, category, siteName, fonts }) {
  const svg = await satori(ogTemplate({ title, category, siteName }), {
    width: OG_WIDTH,
    height: OG_HEIGHT,
    fonts,
  });
  const bytes = await sharp(Buffer.from(svg)).png().toBuffer();
  return { bytes, hash: createHash('sha256').update(bytes).digest('hex').slice(0, HASH_LENGTH) };
}

/**
 * OG 圖在路由裡的 slug（`/og/[...slug].png` 的 params.slug）。
 * @param {string} id
 * @param {string} hash
 * @returns {string}
 */
export function ogRouteSlug(id, hash) {
  return `${id}.${hash}`;
}

/**
 * OG 圖的站內絕對路徑。與 ogRouteSlug 共用同一份格式定義，端點與消費端不會各寫一套。
 * @param {string} id
 * @param {string} hash
 * @returns {string}
 */
export function ogImagePath(id, hash) {
  return `/og/${ogRouteSlug(id, hash)}.png`;
}
