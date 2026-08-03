/**
 * 解析與評估 DNS-AID 的 `_index._agents` 記錄（SVCB/HTTPS，RFC 9460）。
 *
 * 用途只有一個：讓 scripts/verify-dns-aid.mjs 能斷言 zone 層那筆記錄還在、還是對的。
 * DNS 記錄不在 repo——`_headers` 至少 repo 裡有一份「請求」，DNS 則是一行程式碼都不會
 * 產生它，zone 是唯一事實來源而且沒有版控、沒有 code review。這支解析器加上
 * verify-dns-aid.mjs 是唯一會在記錄被改壞或刪掉時叫出來的東西。
 */

/**
 * 把 presentation format 切成 token：以空白分隔，但引號字串內的空白不切。
 * 參數值合法地可以含空白（`key65280="a b"`），直接 split(/\s+/) 會切碎。
 */
function splitTokens(text) {
  const tokens = [];
  let current = '';
  let inQuote = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuote) {
      // quoted-pair：反斜線逃逸的下一個字元原樣帶過，避免 \" 被當成引號結束
      if (ch === '\\' && i + 1 < text.length) {
        current += ch + text[i + 1];
        i++;
        continue;
      }
      if (ch === '"') inQuote = false;
      current += ch;
      continue;
    }

    if (ch === '"') {
      inQuote = true;
      current += ch;
      continue;
    }
    if (/\s/.test(ch)) {
      if (current) tokens.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  if (current) tokens.push(current);

  return tokens;
}

/** 取出參數值：引號字串去引號並還原逃逸，token 則原樣。 */
function unquote(raw) {
  if (raw.length >= 2 && raw.startsWith('"') && raw.endsWith('"')) {
    return raw.slice(1, -1).replace(/\\(.)/g, '$1');
  }
  return raw;
}

function unparsable(reason) {
  return { mode: 'unparsable', priority: null, target: null, params: new Map(), reason };
}

/**
 * 解析一筆 SVCB/HTTPS 記錄的 DoH JSON `data` 值。
 *
 * 為什麼要辨識 wire-format：實測 Cloudflare 與 Google 的 DoH JSON **只把 HTTPS(65) 轉成
 * presentation format，SVCB(64) 回的是 RFC 3597 的 `\# <長度> <十六進位>`**。若記錄被
 * 改建成 SVCB 型別，這裡不特別辨識的話會退化成「解析失敗」，訊息指向錯誤的方向。
 *
 * @param {string} data
 * @returns {{ mode: 'service'|'alias'|'wire-format'|'unparsable', priority: number|null,
 *             target: string|null, params: Map<string,string>, reason: string|null }}
 */
export function parseServiceBinding(data) {
  if (typeof data !== 'string' || data.trim() === '') return unparsable('空值或非字串');

  const text = data.trim();
  if (text.startsWith('\\#')) {
    return {
      mode: 'wire-format',
      priority: null,
      target: null,
      params: new Map(),
      reason:
        'DoH 回傳 RFC 3597 十六進位格式，代表這筆是 SVCB(64) 而非 HTTPS(65)——' +
        '解析器目前只讀 presentation format',
    };
  }

  const tokens = splitTokens(text);
  if (tokens.length < 2) return unparsable(`token 不足（需要 priority 與 target）：${text}`);

  const [priorityToken, target, ...paramTokens] = tokens;
  if (!/^\d+$/.test(priorityToken)) return unparsable(`priority 非非負整數：${priorityToken}`);
  const priority = Number(priorityToken);
  if (priority > 65535) return unparsable(`priority 超出範圍：${priorityToken}`);

  const params = new Map();
  for (const token of paramTokens) {
    const eq = token.indexOf('=');
    // RFC 9460 允許無值的參數（如 no-default-alpn）；記成空字串而非略過，
    // 呼叫端才能分辨「沒有這個 key」與「有這個 key 但沒有值」。
    const key = (eq === -1 ? token : token.slice(0, eq)).toLowerCase();
    params.set(key, eq === -1 ? '' : unquote(token.slice(eq + 1)));
  }

  return { mode: priority === 0 ? 'alias' : 'service', priority, target, params, reason: null };
}

/**
 * 正規化 TargetName 以供比對：一律小寫、補尾點。
 *
 * `.` 在 SVCB 語意上代表 owner name。這裡刻意展開而非另外標記，因為展開後正好會露出
 * 問題——owner name 是 `_index._agents.<host>`，含底線，違反 draft §3.2 的 MUST
 * （該處要用公開 x.509 憑證通訊）。展開讓底線檢查自然涵蓋這個情況。
 */
export function normalizeTargetName(target, ownerName) {
  const name = target === '.' ? ownerName : target;
  const lower = name.toLowerCase();
  return lower.endsWith('.') ? lower : `${lower}.`;
}
