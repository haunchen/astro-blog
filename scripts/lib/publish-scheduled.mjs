/**
 * 排程發布的純函式：判定哪篇到期、以及怎麼改寫它的 frontmatter。
 *
 * 抽 lib 不只是為了測試——Frankify 的 Discord 發布介面會是同一份邏輯的第二個消費端，
 * 寫進 CLI 就得抄第二份。與 vault-post.mjs 同一個形狀，理由也相同。
 *
 * 設計文件：docs/plans/2026-08-23-scheduled-publish-design.md
 */

/**
 * `en-CA` 的日期輸出恰好就是 `YYYY-MM-DD`，不必自己補零拼字串。
 */
const TAIPEI_DAY = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Taipei',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/**
 * 把一個時間點歸算成台北的日曆日。
 *
 * 「2026-08-28 發布」講的是台北時間的 8/28，但 cron 一律 UTC、gray-matter 又把裸日期
 * 解析成 UTC 午夜。直接比時間戳的話，現在（cron 設在台北早上八點＝UTC 00:00）剛好會對，
 * 但只要哪天把 cron 往前挪就會整批錯一天。歸算成日曆日再比字串就沒有這個脆弱點。
 *
 * @param {Date | string} value
 * @returns {string | null} `YYYY-MM-DD`，無法解析回 null
 */
export function toTaipeiDay(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return TAIPEI_DAY.format(d);
}

/**
 * 這篇今天該不該翻牌。
 *
 * 兩個條件都要成立：是草稿、而且有一個已到期的 publishAt。後者是安全性質——還在寫的稿
 * 沒有 publishAt，所以永遠落在這個述詞外面。
 *
 * @param {Record<string, unknown>} data frontmatter 物件
 * @param {string} today 台北日曆日 `YYYY-MM-DD`
 * @returns {boolean}
 */
export function isDue(data, today) {
  if (data?.draft !== true) return false;
  const raw = data.publishAt;
  if (raw === undefined || raw === null) return false;
  if (!(raw instanceof Date) && typeof raw !== 'string') return false;
  const day = toTaipeiDay(raw);
  if (!day) return false;
  return day <= today;
}

/** frontmatter 的分隔線，前後可有空白但不可縮排。 */
const FM_DELIM = /^---\s*$/;

/**
 * 把一篇草稿的 frontmatter 改寫成已發布的樣子。
 *
 * 刻意做行級文字操作而不是 gray-matter 讀出來再序列化寫回：站上標題大量使用全形冒號，
 * toYamlFrontmatter 的 JSON 逃逸規則是為此而寫，整份重寫多一條分岔風險；`updated` 有
 * 「與 date 同日時不輸出」的條件，重寫會讓它跑掉；而且無關欄位的格式會產生大量與這次
 * 改動無關的 diff，出事時看不出是哪一行造成的。
 *
 * `draft: false` 不是留著而是整行刪掉——schema 的 default 就是 false，留著等於寫一個
 * 沒有資訊量的值。
 *
 * @param {string} raw md 全文
 * @returns {{ text: string, publishedOn: string } | null} 不具備翻牌條件時回 null
 */
export function flipToPublished(raw) {
  const lines = raw.split('\n');
  if (!FM_DELIM.test(lines[0] ?? '')) return null;

  // 只找第一個結束分隔線：正文裡的 --- 在它之後，不會被誤判。
  let end = -1;
  for (let i = 1; i < lines.length; i++) {
    if (FM_DELIM.test(lines[i])) {
      end = i;
      break;
    }
  }
  if (end === -1) return null;

  /** @type {string | null} */
  let publishedOn = null;
  let dateIndex = -1;
  /** @type {Set<number>} */
  const drop = new Set();

  for (let i = 1; i < end; i++) {
    const line = lines[i];
    const pub = /^publishAt:\s*(.+?)\s*$/.exec(line);
    if (pub) {
      publishedOn = pub[1];
      drop.add(i);
      continue;
    }
    if (/^draft:\s*/.test(line)) {
      drop.add(i);
      continue;
    }
    // 只認第一個頂層 date，行首不允許縮排，所以巢狀結構下的同名鍵不會被誤抓。
    if (dateIndex === -1 && /^date:\s*/.test(line)) dateIndex = i;
  }

  if (publishedOn === null || dateIndex === -1) return null;

  // 直接沿用 publishAt 的字面值，不做格式正規化——避免把 `2026-08-28` 寫成
  // `2026-08-28T00:00:00.000Z` 這種與既有 36 篇不一致的形狀。
  lines[dateIndex] = `date: ${publishedOn}`;

  return {
    text: lines.filter((_, i) => !drop.has(i)).join('\n'),
    publishedOn,
  };
}
