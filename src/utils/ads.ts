// AdSense 設定單一來源（docs/specs/monetization.md）。
//
// publisher ID 直接寫在這裡而非環境變數：它本來就要公開在 /ads.txt 與每一個廣告單元的
// data-ad-client 屬性裡，不是秘密。藏進環境變數只會多一道「各環境不一致」的來源，
// 而 spec R8 要求廣告在 CI、preview、正式站的行為完全一致（見 spec D6）。
export const ADSENSE_CLIENT = 'ca-pub-5544842849576289';

// 廣告單元 ID，取自 AdSense 後台「廣告 → 依廣告單元」。三個版位分開建立單元，
// 才能在後台分別看到各版位的表現；共用一個單元會讓三處的數據混成一筆。
export const AD_SLOTS = {
  sideLeft: '4732356388',
  sideRight: '2386995389',
  articleEnd: '4958822751',
} as const;

// 兩側固定版位的顯示門檻（px）。
//
// 算式：文章頁容器是 --width-max 1200px，兩側各需 160px 廣告 + 20px 間距，
// 合計 1200 + 180 × 2 = 1560px，取 1600 留 20px 邊距餘裕。
//
// 這個值同時出現在 AdSide.astro 的 media query 裡，兩邊必須一致：CSS 負責隱藏，
// JS 負責不送廣告請求，只要有一邊走鐘，就會在 display:none 的容器上初始化廣告，
// 拿到 availableWidth=0 並在 console 報錯——而 console error 是 Lighthouse
// Best Practices 的稽核項（spec R9 要求該分數有門檻）。
export const SIDE_AD_MIN_WIDTH = 1600;
