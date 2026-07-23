/**
 * 驗證正式站頁面引用的靜態資產都真的取得到。
 *
 * 為什麼需要這支：2026-07-23 正式站曾經整站沒有樣式，而所有既有檢查都是綠的——
 * build 成功、Pages 部署 success、`verify-seo` 全過（它只看 dist/，本機產物沒問題）、
 * `verify-headers` 全過（它只看標頭，不看頁面引用了什麼）。實際情況是：
 *
 *   frankchen.tw 的 HTML 引用 /_astro/_slug_.C7rrCjH0.css
 *   該 URL 回 404（cf-cache-status: HIT、Age 543）
 *   同一個檔案在該次部署的專屬 pages.dev URL 上回 200
 *
 * 也就是資產在來源端好好的，是邊緣把一個 404 快取住了。成因是 zone 上的
 * 「Cache Static Assets」規則以副檔名比對並「忽略快取控制標頭並使用此 TTL」，
 * 沒有設定狀態代碼 TTL，於是部署傳播空窗期內偶然發生的 404 被連同長 TTL 一起
 * 存了下來。zone 上已補設 400–499 → 無存放區，但那是 dashboard 設定、不在 repo 裡，
 * 隨時可能被改掉或在新 zone 上重演，所以這裡用「實際抓得到嗎」做最終斷言。
 *
 * 檢查的是**引用關係**而不是單一檔案：只要頁面上的 <link>/<script> 指向一個拿不到
 * 的 URL，不管原因是快取毒化、部署漏檔、還是路徑寫錯，都會被抓出來。
 *
 * 用法：
 *   node scripts/verify-assets.mjs                 # 檢查 https://frankchen.tw
 *   node scripts/verify-assets.mjs <origin>        # 檢查指定來源（例如 preview）
 *
 * 任一資產非 200 即 exit 1。
 */

const ORIGIN = (process.argv[2] ?? 'https://frankchen.tw').replace(/\/$/, '');

/**
 * 一律帶 `Connection: close`。
 *
 * 不這樣做的話，undici 的 keep-alive 連線池會把事件迴圈撐住，行程印完結論後還會
 * 卡好幾分鐘不結束（在 CI 上就是 step 一路掛到 job timeout）。而用 process.exit()
 * 強制收掉又會在還有 socket 未關閉時觸發 libuv 斷言，Windows 上實測退出碼會變成
 * 127 而不是預期的 1——CI 雖然一樣算失敗，但退出碼不可信就不該留著。
 * 讓伺服器主動關連線，行程就能自然結束，兩個問題一起沒有。
 */
function get(url) {
  return fetch(url, { headers: { connection: 'close' } });
}

// 代表頁：涵蓋每一種版面（首頁／列表／分類／標籤／內頁／文章頁），因為不同版面
// 引用的 CSS chunk 不同——只驗首頁會漏掉只有文章頁才載入的那幾支。
// 不掃全站是刻意的：日檢要快，而同版面的頁面引用的資產集合是一樣的。
const PAGES = [
  '/',
  '/articles/',
  '/about/',
  '/n8n-resources/',
  '/contact-frank/',
  '/privacy-policy/',
  '/category/',
  '/category/n8n/',
  '/tag/',
];

// 頁面引用的資產路徑：只看自家的靜態產物目錄，外部連結與 data: URI 不在範圍內。
const ASSET_RE = /(?:href|src)="((?:\/_astro\/|\/fonts\/)[^"]+)"/g;

/** 從 sitemap 取一篇文章頁當樣本——文章 slug 會增減，寫死遲早對到已下架的文章。 */
async function sampleArticlePath() {
  const res = await get(`${ORIGIN}/sitemap.xml`);
  if (!res.ok) return null;
  const xml = await res.text();
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  for (const loc of locs) {
    const { pathname } = new URL(loc);
    const depth = pathname.split('/').filter(Boolean).length;
    // 文章頁是單層路徑（/slug/），列表頁與內頁都在 PAGES 裡已經涵蓋
    if (depth === 1 && !PAGES.includes(pathname)) return pathname;
  }
  return null;
}

const failures = [];
const pageFailures = [];

console.log(`檢查來源：${ORIGIN}\n`);

const article = await sampleArticlePath();
if (article) {
  console.log(`文章頁樣本：${article}`);
} else {
  // 抓不到樣本不算失敗，但要講出來——否則會以為文章頁版面也驗過了。
  console.log('註：sitemap 內找不到文章頁樣本，本次未涵蓋文章頁版面');
}
const targets = article ? [...PAGES, article] : [...PAGES];

// 資產 → 引用它的頁面（同一支 CSS 會被多頁引用，只需驗一次，但報錯時要說得出
// 是哪些頁面會壞掉）
const assets = new Map();

for (const page of targets) {
  // 加 cache-busting：要驗的是「此刻部署的 HTML 引用了什麼」，不是邊緣的舊副本。
  // 資產本身則刻意用裸網址請求（見下），那才是使用者實際會拿到的。
  const res = await get(`${ORIGIN}${page}?_verify=${Date.now()}`);
  if (!res.ok) {
    pageFailures.push({ page, reason: `回應 ${res.status} ${res.statusText}` });
    continue;
  }
  const html = await res.text();
  for (const m of html.matchAll(ASSET_RE)) {
    if (!assets.has(m[1])) assets.set(m[1], new Set());
    assets.get(m[1]).add(page);
  }
}

if (pageFailures.length === 0) {
  console.log(`[PASS] ${targets.length} 個代表頁皆可取得`);
} else {
  console.log(`[FAIL] ${targets.length} 個代表頁皆可取得（${pageFailures.length} 個問題）`);
  for (const f of pageFailures) console.log(`       ${f.page} → ${f.reason}`);
  failures.push('page');
}

console.log(`共蒐集到 ${assets.size} 個不重複資產`);

// 逐一序列請求會讓這支跑上好幾分鐘（實測 40 多個資產）。併發度壓在 6：夠快，
// 又不會密到讓 Cloudflare 把我們當成異常流量而開始丟連線（那會產生假的失敗）。
async function mapLimit(items, limit, fn) {
  const results = [];
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (cursor < items.length) {
        const i = cursor++;
        results[i] = await fn(items[i]);
      }
    }),
  );
  return results;
}

const checked = await mapLimit([...assets.entries()], 6, async ([asset, pages]) => {
  // 裸網址、不加 query：加了就會繞過邊緣快取，量到的是「來源端有沒有這個檔」，
  // 而快取毒化的整個重點就是來源端有、使用者拿不到。必須用跟瀏覽器一樣的請求。
  const res = await get(`${ORIGIN}${asset}`);
  if (res.ok) return null;
  return {
    asset,
    status: res.status,
    pages: [...pages],
    cacheStatus: res.headers.get('cf-cache-status') ?? '?',
    age: res.headers.get('age') ?? '?',
    // 同時問一次來源端，用來區分「檔案真的不存在」與「檔案在、但邊緣供應 404」
    origin: (await get(`${ORIGIN}${asset}?_verify=${Date.now()}`)).status,
  };
});
const broken = checked.filter(Boolean);

if (broken.length === 0) {
  console.log('[PASS] 所有引用的資產皆回 200');
} else {
  failures.push('asset');
  console.log(`[FAIL] 所有引用的資產皆回 200（${broken.length} 個問題）`);
  for (const b of broken) {
    console.log(`       ${b.asset} → ${b.status}`);
    console.log(`         受影響頁面：${b.pages.join('、')}`);
    console.log(`         cf-cache-status: ${b.cacheStatus}｜Age: ${b.age}｜繞過快取後：${b.origin}`);
    if (b.origin === 200) {
      console.log(
        '         繞過快取拿得到 200，代表檔案在、是邊緣把 404 快取住了。' +
          '到 Cloudflare Dashboard → Caching → Configuration → Purge Cache 清除該 URL，' +
          '並確認 Cache Rules 的「Cache Static Assets」仍有 400–499 → 無存放區的狀態代碼 TTL。',
      );
    } else {
      console.log('         繞過快取也拿不到，檔案本身不在該次部署裡——問題在建置或部署，不是快取。');
    }
  }
}

console.log();
if (failures.length) {
  console.log(`${failures.length} 項不符。`);
  process.exitCode = 1;
} else {
  console.log('全部符合預期。');
}
