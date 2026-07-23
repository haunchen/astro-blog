/**
 * 驗證正式站實際供應的 robots.txt。
 *
 * 為什麼需要這支：robots.txt 是「固定網址、內容會變」的檔案，repo 裡是對的不代表
 * 爬蟲拿到的是對的。2026-07-23 實測踩到兩次——
 *
 *   1. 非標準 directive `Llms-txt:` 讓 Lighthouse 判 robots.txt invalid、SEO 從
 *      100 掉到 92。改成註解並部署後問題沒有立刻消失。
 *   2. 因為正式站仍在供應部署前就進了邊緣快取的舊副本（`Age: 37386`、
 *      `cf-cache-status: HIT`，帶著舊的 `max-age=86400`）。後來把 TTL 降到 3600
 *      只對之後新建的快取項生效，救不了已經在快取裡的那一份。
 *
 * 兩次都是純看 repo 完全發現不了的：檔案是對的、build 綠燈、部署成功，只有爬蟲
 * 實際拿到的內容不對。既有的檢查也都擋不住——`verify-seo.mjs` 只確認
 * `dist/robots.txt` 存在，`verify-headers.mjs` 只看它的 Cache-Control。
 *
 * 刻意不加 cache-busting query string：加了就會繞過邊緣快取，量到的是「原始檔
 * 對不對」，而那個 repo 裡就看得到。這支要問的是「爬蟲此刻拿到什麼」，所以必須
 * 用跟爬蟲一樣的裸網址請求。
 *
 * 用法：
 *   node scripts/verify-robots.mjs                 # 檢查 https://frankchen.tw
 *   node scripts/verify-robots.mjs <origin>        # 檢查指定來源（例如 preview）
 *
 * 任一項不符即 exit 1。
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ORIGIN = (process.argv[2] ?? 'https://frankchen.tw').replace(/\/$/, '');
const PROJECT_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const SOURCE_FILE = path.join(PROJECT_ROOT, 'public', 'robots.txt');

/**
 * 允許的 directive 名稱。
 *
 * 前四個是 RFC 9309 的正式 directive；後三個是規格外但主流爬蟲長期支援、稽核
 * 工具也不會判錯的擴充。這份清單刻意只放「確定不會被判為 unknown directive」的，
 * 想加新的 directive 前請先確認 Lighthouse 的 robots-txt 稽核不會扣分——
 * 否則 CI 會過但 Lighthouse SEO 分數會掉，那正是這支腳本要防的情況。
 *
 * 真正的兜底是下面的「與 repo 版本逐字比對」：就算這份白名單跟稽核工具的認知
 * 有出入，只要線上內容跟 repo 不一致就會被抓出來。
 */
const KNOWN_DIRECTIVES = new Set([
  'user-agent',
  'disallow',
  'allow',
  'sitemap',
  'crawl-delay',
  'host',
  'clean-param',
]);

const failures = [];
const notes = [];

console.log(`檢查來源：${ORIGIN}\n`);

const res = await fetch(`${ORIGIN}/robots.txt`, { redirect: 'follow' });
if (!res.ok) {
  console.log('[FAIL] robots.txt 可取得');
  console.log(`       ${ORIGIN}/robots.txt → 回應 ${res.status} ${res.statusText}`);
  process.exit(1);
}
console.log('[PASS] robots.txt 可取得');

const served = await res.text();
const age = Number(res.headers.get('age') ?? 0);
const cacheStatus = res.headers.get('cf-cache-status') ?? '?';
const cacheControl = res.headers.get('cache-control') ?? '（無）';

// --- 檢查 1：語法（無未知 directive）------------------------------------

const unknown = [];
served.split(/\r?\n/).forEach((rawLine, i) => {
  const line = rawLine.trim();
  if (!line || line.startsWith('#')) return;
  const colon = line.indexOf(':');
  if (colon === -1) {
    unknown.push({ line: i + 1, text: line, reason: '不是 `名稱: 值` 的格式' });
    return;
  }
  const name = line.slice(0, colon).trim().toLowerCase();
  if (!KNOWN_DIRECTIVES.has(name)) {
    unknown.push({ line: i + 1, text: line, reason: `未知的 directive「${name}」` });
  }
});

if (unknown.length === 0) {
  console.log('[PASS] 無未知 directive');
} else {
  failures.push('unknown-directive');
  console.log(`[FAIL] 無未知 directive（${unknown.length} 個問題）`);
  for (const u of unknown.slice(0, 10)) {
    console.log(`       第 ${u.line} 行：${u.text}  ← ${u.reason}`);
  }
  console.log('       Lighthouse 的 robots-txt 稽核會因此判 invalid，連帶讓 SEO 分數掉。');
  console.log('       想放在 robots.txt 裡的補充資訊請寫成 `#` 註解，不要自創 directive。');
}

// --- 檢查 2：與 repo 版本逐字一致 ---------------------------------------
// 這條才是主防線。它不預設問題出在哪：邊緣快取沒清、部署沒生效、被 zone 層
// 規則改寫，任何一種造成「線上內容 ≠ repo 內容」的原因都會在這裡現形。

if (!existsSync(SOURCE_FILE)) {
  notes.push(`找不到 ${SOURCE_FILE}，略過與 repo 版本的比對（這支腳本需要在 checkout 過的 repo 內執行）`);
  console.log('[SKIP] 線上內容與 repo 的 public/robots.txt 一致');
} else {
  // 只正規化換行：Pages 供應的是靜態檔，除了行尾以外不該有任何差異，
  // 過度正規化（trim、忽略空白行）會把真正的內容漂移一起吃掉。
  const normalize = (s) => s.replace(/\r\n/g, '\n');
  const source = readFileSync(SOURCE_FILE, 'utf8');

  if (normalize(served) === normalize(source)) {
    console.log('[PASS] 線上內容與 repo 的 public/robots.txt 一致');
  } else {
    failures.push('content-drift');
    const servedLines = normalize(served).split('\n');
    const sourceLines = normalize(source).split('\n');
    console.log('[FAIL] 線上內容與 repo 的 public/robots.txt 一致');
    console.log(`       線上 ${servedLines.length} 行 / repo ${sourceLines.length} 行`);
    // 只列前兩處。逐行比對遇到「插入或刪除一行」時，之後每一行都會對不上，
    // 全列出來只是把同一個差異重複五次，反而蓋掉真正的第一處。
    const max = Math.max(servedLines.length, sourceLines.length);
    let shown = 0;
    for (let i = 0; i < max && shown < 2; i++) {
      if (servedLines[i] !== sourceLines[i]) {
        console.log(`       第 ${i + 1} 行起不同：`);
        console.log(`         線上：${servedLines[i] ?? '（無此行）'}`);
        console.log(`         repo：${sourceLines[i] ?? '（無此行）'}`);
        shown++;
      }
    }
    if (servedLines.length !== sourceLines.length) {
      console.log('       行數不同，第一處差異之後的行都會位移，以第一處為準。');
    }
    console.log(`       快取狀態：cf-cache-status: ${cacheStatus}｜Age: ${age}｜Cache-Control: ${cacheControl}`);
    if (age > 0) {
      console.log(
        `       Age > 0 代表這是 ${Math.round(age / 60)} 分鐘前就進了邊緣快取的副本。` +
          '最可能的原因是部署前的舊版還在快取裡——快取項會沿用它「被快取當下」的 TTL，' +
          '事後調降 public/_headers 的 max-age 救不了已經在裡面的那一份。',
      );
      console.log(
        '       處理方式：Cloudflare Dashboard → Caching → Configuration → ' +
          'Purge Cache，對 ' + ORIGIN + '/robots.txt 做單一 URL 清除；或等它自然過期。',
      );
    }
  }
}

console.log();
for (const note of notes) console.log(`註：${note}`);
if (failures.length) {
  console.log(`${failures.length} 項不符。`);
  process.exit(1);
}
console.log('全部符合預期。');
