/**
 * 解析 HTTP `Link` 標頭（RFC 8288）的值。
 *
 * 用途只有一個：讓 scripts/verify-headers.mjs 能把線上站回傳的 Link 標頭拆成
 * `(target, rel)` 的集合來比對。為什麼不能用 `value.includes('rel="describedby"')`
 * 那種整串比對——理由與同檔案 parseCsp 的註解完全一樣：
 *   (a) link-value 的順序改變（語意相同）會誤報失敗；
 *   (b) 更嚴重——zone 層若偷偷多塞一條指向別處的 link，includes 仍然為真，
 *       完全偵測不到。而 verify-headers 存在的唯一理由就是偵測 zone 層的靜默竄改。
 *
 * 刻意只取 target 與 rel：type 之類的參數錯了不影響 agent 取得資源，納入比對只會讓
 * 斷言對無關的改動變敏感。
 */

/**
 * 把標頭值切成一個個 link-value。
 *
 * 逗號是 link-value 的分隔符，但它也可能合法地出現在角括號內的 URI（`</a,b>`）
 * 或引號字串內（`title="x, y"`），直接 split(',') 會把單一 link-value 切碎。
 */
function splitLinkValues(value) {
  const parts = [];
  let current = '';
  let inAngle = false;
  let inQuote = false;

  for (let i = 0; i < value.length; i++) {
    const ch = value[i];

    if (inQuote) {
      // quoted-pair：反斜線逃逸的下一個字元原樣帶過，避免 \" 被當成引號結束
      if (ch === '\\' && i + 1 < value.length) {
        current += ch + value[i + 1];
        i++;
        continue;
      }
      if (ch === '"') inQuote = false;
      current += ch;
      continue;
    }

    if (ch === '"') inQuote = true;
    else if (ch === '<') inAngle = true;
    else if (ch === '>') inAngle = false;
    else if (ch === ',' && !inAngle) {
      parts.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  parts.push(current);

  return parts.map((part) => part.trim()).filter(Boolean);
}

/**
 * 把單一 link-value 的參數段切成一條條 link-param。
 * 分號同樣可能出現在引號字串內，不能直接 split(';')。
 */
function splitParams(text) {
  const parts = [];
  let current = '';
  let inQuote = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuote) {
      if (ch === '\\' && i + 1 < text.length) {
        current += ch + text[i + 1];
        i++;
        continue;
      }
      if (ch === '"') inQuote = false;
      current += ch;
      continue;
    }

    if (ch === '"') inQuote = true;
    else if (ch === ';') {
      parts.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  parts.push(current);

  return parts.map((part) => part.trim()).filter(Boolean);
}

/** 取出 link-param 的值：引號字串去引號並還原逃逸，token 則原樣。 */
function unquote(raw) {
  if (raw.length >= 2 && raw.startsWith('"') && raw.endsWith('"')) {
    return raw.slice(1, -1).replace(/\\(.)/g, '$1');
  }
  return raw;
}

/**
 * @param {string | null | undefined} value 標頭原值
 * @returns {Array<{ target: string, rel: string | null }>}
 *   rel 為多值（`rel="alternate index"`）時展開成多筆；
 *   缺 rel 的 link-value 回 `rel: null`（而非略過），讓呼叫端能把它當成未預期的項目報出來。
 */
export function parseLinkHeader(value) {
  if (!value) return [];

  const links = [];
  for (const raw of splitLinkValues(value)) {
    const matched = raw.match(/^<([^>]*)>(.*)$/s);
    if (!matched) continue;

    const target = matched[1].trim();
    let rel = null;
    for (const param of splitParams(matched[2])) {
      const eq = param.indexOf('=');
      if (eq === -1) continue;
      // RFC 8288：同名參數重複出現時只有第一個生效
      if (param.slice(0, eq).trim().toLowerCase() !== 'rel' || rel !== null) continue;
      rel = unquote(param.slice(eq + 1).trim()).toLowerCase();
    }

    if (!rel) {
      links.push({ target, rel: null });
      continue;
    }
    for (const single of rel.split(/\s+/).filter(Boolean)) {
      links.push({ target, rel: single });
    }
  }
  return links;
}
