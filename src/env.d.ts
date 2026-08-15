/// <reference types="astro/client" />

/**
 * OG 圖字型目錄的絕對路徑，由 astro.config.mjs 的 `vite.define` 在編譯期注入
 * （為什麼要注入而不是用相對路徑，見該處與 src/utils/og.ts 的註解）。
 *
 * 宣告必須放在 .d.ts、不能寫在使用它的模組裡：`define` 是純文字取代，
 * 寫在 .ts 裡的 `declare const __OG_FONT_DIR__: string` 會被一起取代成
 * `declare const "/abs/path/": string`，dev 啟動時的依賴掃描會當場語法錯誤。
 * .d.ts 不進 Vite 的模組圖，不會被取代。
 */
declare const __OG_FONT_DIR__: string;
