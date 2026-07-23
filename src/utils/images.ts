import type { GetImageResult } from 'astro';

/**
 * 響應式圖片的版位定義（單一來源）。
 *
 * 為什麼要集中：同一張 LCP 圖會在兩個地方被描述——元件裡的 <Image> 與
 * BaseLayout 輸出的 <link rel="preload">。兩邊的 widths/sizes 只要有一個字不一樣，
 * 瀏覽器就會 preload 到 A 候選圖、實際渲染時再抓 B 候選圖，變成下載兩份。
 * 所以兩邊一律從這裡取值，不各自寫字面量。
 *
 * sizes 的數字取自實測（2026-07-23，dist build + 瀏覽器量測）：
 *   .container       max-width 1200px、padding 0 24px（≤768px 時 0 16px）
 *   .card--featured  桌機 grid-template-columns: 1fr 1fr，圖佔一半
 *   .card-grid--three 桌機三欄、欄距 24px
 *   ≤768px 兩者都塌成單欄，圖寬 = 內容寬
 * 版面改了這裡就要跟著改，否則瀏覽器會依過期的宣告挑到偏大或偏小的候選圖。
 */

/**
 * 候選寬度。
 *
 * 上限取 1200 而非版位的 576：高 DPI 手機在 ≤768px 斷點的版位可達 736 CSS px，
 * 乘上 DPR 2～3 會要到 1472～2208 實體像素，而原圖本身只有 1200 寬，取到 1200 為止。
 * 下限 400 對應行動裝置 DPR 1 的情況。
 */
export const CARD_IMAGE_WIDTHS = [400, 600, 800, 1200];

/** featured 卡（首頁首屏最大的圖，等於 LCP 元素）的版位寬度 */
export const FEATURED_IMAGE_SIZES =
  '(max-width: 768px) calc(100vw - 32px), (max-width: 1248px) calc((100vw - 48px) / 2), 576px';

/** 三欄卡片的版位寬度 */
export const CARD_IMAGE_SIZES =
  '(max-width: 768px) calc(100vw - 32px), (max-width: 1248px) calc((100vw - 96px) / 3), 368px';

/**
 * 文章頁封面的版位寬度。
 *
 * .article-header 為 max-width 960px、左右 padding 各 24px 且不隨斷點變動
 * （實測 1280px 視窗下圖寬 912px），所以只有一個轉折點。
 */
export const ARTICLE_COVER_SIZES = '(max-width: 960px) calc(100vw - 48px), 912px';

/**
 * 把 getImage() 的結果轉成 BaseLayout 的 preloadImage 需要的形狀。
 *
 * getImage() 回傳的 srcSet 是 { values, attribute } 物件，attribute 才是可以直接
 * 放進 HTML 的 srcset 字串；sizes 則不在回傳值裡，要由呼叫端把當初傳進去的那個
 * 常數再給一次。這兩件事在每個呼叫端各拆一次就是重複，而拆錯的後果（preload 與
 * <img> 挑到不同候選圖、下載兩份）不會有任何錯誤訊息，所以集中在這裡。
 */
export function toPreloadImage(
  image: GetImageResult,
  sizes: string,
): { src: string; srcSet?: string; sizes?: string } {
  return { src: image.src, srcSet: image.srcSet.attribute || undefined, sizes };
}
