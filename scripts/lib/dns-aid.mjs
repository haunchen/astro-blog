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

/** wire-format 解析中途失敗時內部丟出，統一在 parseWireFormat 邊界轉成 unparsable，不讓例外穿出去。 */
class WireFormatError extends Error {}

/** IANA 已註冊的 SvcParamKey 名稱（RFC 9460 §14.3.2）；未列出的一律走 keyNNNNN。 */
function svcParamKeyName(key) {
  switch (key) {
    case 0:
      return 'mandatory';
    case 1:
      return 'alpn';
    case 2:
      return 'no-default-alpn';
    case 3:
      return 'port';
    case 4:
      return 'ipv4hint';
    case 5:
      return 'ech';
    case 6:
      return 'ipv6hint';
    default:
      return `key${key}`;
  }
}

/** 位元組陣列轉連續小寫十六進位字串（未特別解讀的 SvcParam 值原樣呈現）。 */
function bytesToHex(bytes) {
  return bytes.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** 位元組陣列轉 ASCII 字串（TargetName 的 label、alpn 的每個值皆為可印字元）。 */
function bytesToAscii(bytes) {
  return String.fromCharCode(...bytes);
}

/**
 * 解出單一 SvcParam 的值，回傳與 presentation format 同義的字串，讓兩條解析路徑
 * 產生的 params Map 可以互換。只特別解讀本專案斷言會用到的 key；其餘（含
 * ipv4hint／ipv6hint／ech）一律以連續十六進位字串呈現，不特別解讀——YAGNI。
 */
function decodeSvcParamValue(key, valueBytes) {
  switch (key) {
    case 1: {
      // alpn：一串 <長度位元組><該長度的字串>
      const parts = [];
      let i = 0;
      while (i < valueBytes.length) {
        const len = valueBytes[i];
        i += 1;
        if (i + len > valueBytes.length) {
          throw new WireFormatError('alpn 參數格式錯誤：內部長度超出剩餘位元組');
        }
        parts.push(bytesToAscii(valueBytes.slice(i, i + len)));
        i += len;
      }
      return parts.join(',');
    }
    case 3: {
      // port：固定 2 bytes
      if (valueBytes.length !== 2) {
        throw new WireFormatError(`port 參數長度須為 2 bytes，實際 ${valueBytes.length}`);
      }
      return String((valueBytes[0] << 8) | valueBytes[1]);
    }
    case 0: {
      // mandatory：一串 uint16 key 編號，轉成對應的 key 名稱
      if (valueBytes.length % 2 !== 0) {
        throw new WireFormatError(`mandatory 參數長度須為偶數，實際 ${valueBytes.length}`);
      }
      const names = [];
      for (let i = 0; i < valueBytes.length; i += 2) {
        names.push(svcParamKeyName((valueBytes[i] << 8) | valueBytes[i + 1]));
      }
      return names.join(',');
    }
    case 2:
      // no-default-alpn：無值的裸參數，與 presentation 分支對裸參數的處理一致，記為空字串
      return '';
    default:
      return bytesToHex(valueBytes);
  }
}

/**
 * 解析 RFC 3597 十六進位 wire format（`\# <總位元組數> <空白分隔十六進位>`），
 * 依 RFC 9460 §2.2 拆出 SVCB/HTTPS RDATA，回傳與 presentation format 分支
 * 完全相同的結構，讓下游 evaluateDnsAid／verify-dns-aid.mjs 完全不必知道資料來自哪種格式。
 *
 * 手動在 Cloudflare Dashboard 建立的記錄，DoH JSON 回的就是這種格式；只有 CF 對
 * proxied 名稱自動產生的 HTTPS 記錄才會被轉成 presentation format（實測 2026-08-03）。
 *
 * 輸入來自外部 DoH 服務，任何畸形都不可讓例外穿出去中斷整支 verify 腳本——
 * 一律歸類到 unparsable 並在 reason 寫明是哪一種畸形。
 */
function parseWireFormat(text) {
  const tokens = text.split(/\s+/).filter(Boolean);
  if (tokens[0] !== '\\#') return unparsable(`wire-format 開頭不是 \\#：${text}`);
  if (tokens.length < 2 || !/^\d+$/.test(tokens[1])) {
    return unparsable(`wire-format 缺長度欄位或非數字：${text}`);
  }
  const declaredLength = Number(tokens[1]);

  const hexTokens = tokens.slice(2);
  const bytes = [];
  for (const hex of hexTokens) {
    if (!/^[0-9a-fA-F]{2}$/.test(hex)) {
      return unparsable(`wire-format 含非法十六進位 token：${hex}`);
    }
    bytes.push(parseInt(hex, 16));
  }
  if (bytes.length !== declaredLength) {
    return unparsable(`wire-format 宣告長度 ${declaredLength}，實際 ${bytes.length} bytes`);
  }

  let offset = 0;
  const need = (n) => {
    if (offset + n > bytes.length) {
      throw new WireFormatError(`位元組不足（在 offset ${offset} 需要 ${n} bytes，僅剩 ${bytes.length - offset}）`);
    }
  };

  try {
    need(2);
    const priority = (bytes[offset] << 8) | bytes[offset + 1];
    offset += 2;

    // TargetName：<長度位元組><該長度的位元組> 重複出現，以 0x00 終結
    let target = '';
    for (;;) {
      need(1);
      const len = bytes[offset];
      offset += 1;
      if (len === 0) break;
      need(len);
      target += bytesToAscii(bytes.slice(offset, offset + len)) + '.';
      offset += len;
    }
    if (target === '') target = '.';

    // SvcParams：零或多組 <key uint16><length uint16><value>，依 key 遞增排列
    const params = new Map();
    while (offset < bytes.length) {
      need(4);
      const key = (bytes[offset] << 8) | bytes[offset + 1];
      const len = (bytes[offset + 2] << 8) | bytes[offset + 3];
      offset += 4;
      need(len);
      const valueBytes = bytes.slice(offset, offset + len);
      offset += len;
      params.set(svcParamKeyName(key), decodeSvcParamValue(key, valueBytes));
    }

    return { mode: priority === 0 ? 'alias' : 'service', priority, target, params, reason: null };
  } catch (err) {
    if (err instanceof WireFormatError) return unparsable(`wire-format ${err.message}`);
    throw err;
  }
}

/**
 * 解析一筆 SVCB/HTTPS 記錄的 DoH JSON `data` 值，presentation format 與
 * RFC 3597 wire format 兩種來源皆支援，回傳結構完全相同。
 *
 * @param {string} data
 * @returns {{ mode: 'service'|'alias'|'unparsable', priority: number|null,
 *             target: string|null, params: Map<string,string>, reason: string|null }}
 */
export function parseServiceBinding(data) {
  if (typeof data !== 'string' || data.trim() === '') return unparsable('空值或非字串');

  const text = data.trim();
  if (text.startsWith('\\#')) return parseWireFormat(text);

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

/**
 * 評估一次 DNS-AID 查詢結果，回傳固定七項檢查。
 *
 * 為什麼回傳「檢查陣列」而不是「問題陣列」：verify 腳本要能逐項印 PASS/FAIL，
 * 讓通過的項目也看得見——只印失敗的話，某項檢查因為程式錯誤而沒跑到時，
 * 輸出看起來與「全部通過」一模一樣。
 *
 * 前四項刻意都對「同一批記錄」求值而非串成 if-else：記錄同時有兩個毛病時
 * （例如 AliasMode 又缺 alpn），一次全部報出來，不必修一個跑一次。
 *
 * @param {{ host: string, indexStatus: number, indexData: string[],
 *           forbiddenPresent: string[], forbiddenUnchecked: string[],
 *           entrypoint: { ok: boolean, status?: number, hasLinkHeader?: boolean,
 *                         error?: string } | null, dnssecValidated: boolean }} input
 * @returns {Array<{ name: string, problem: string | null }>}
 */
export function evaluateDnsAid(input) {
  const {
    host,
    indexStatus,
    indexData,
    forbiddenPresent,
    forbiddenUnchecked = [],
    entrypoint,
    dnssecValidated,
  } = input;
  const ownerName = `_index._agents.${host}`;
  const expectedTarget = normalizeTargetName(host, ownerName);

  const parsed = indexData.map((data) => ({ data, record: parseServiceBinding(data) }));
  const service = parsed.filter(({ record }) => record.mode === 'service');

  // 存在性
  const existence =
    parsed.length > 0
      ? null
      : indexStatus === 3
        ? `${ownerName} 回 NXDOMAIN（記錄不存在）`
        : `${ownerName} 查詢 Status=${indexStatus}，但沒有任何 HTTPS 記錄`;

  // ServiceMode：priority = 0 的 AliasMode 不算數，掃描器會歸到 aliasRecordCount
  let serviceMode = null;
  if (existence) {
    serviceMode = '無記錄可判定';
  } else if (service.length === 0) {
    const modes = parsed.map(({ record }) => record.mode);
    if (modes.includes('alias')) {
      serviceMode =
        'priority = 0 是 AliasMode，掃描器會算進 aliasRecordCount 而非 serviceRecordCount。' +
        'Cloudflare DNS 的 Priority 欄位要填 1';
    } else {
      serviceMode = `記錄無法解析：${parsed.map(({ record }) => record.reason).join('｜')}`;
    }
  }

  // TargetName：須為正規主機、且不含底線（draft §3.2 的 MUST，該處要用公開 x.509 憑證）
  let targetName = null;
  if (service.length === 0) {
    targetName = existence ? '無記錄可判定' : '無 ServiceMode 記錄可判定';
  } else {
    const actual = service.map(({ record }) => normalizeTargetName(record.target, ownerName));
    if (!actual.includes(expectedTarget)) {
      const underscored = actual.filter((name) => name.includes('_'));
      targetName = underscored.length
        ? `TargetName 含底線（${underscored.join('、')}），違反 draft §3.2——` +
          '該處要用公開 x.509 憑證通訊。Cloudflare DNS 的 Target 欄位要填 ' +
          `${expectedTarget}，不可留空或填 "."`
        : `TargetName 應為 ${expectedTarget}，實際為 ${actual.join('、')}`;
    }
  }

  // alpn：CF 若把 value 吃掉，記錄還在但參數沒了，任何存在性檢查都抓不到
  let alpn = null;
  if (service.length === 0) {
    alpn = existence ? '無記錄可判定' : '無 ServiceMode 記錄可判定';
  } else if (!service.some(({ record }) => (record.params.get('alpn') ?? '') !== '')) {
    alpn = `SvcParams 缺 alpn（或值為空）：${service.map(({ data }) => data).join('｜')}`;
  }

  return [
    { name: `${ownerName} 記錄存在`, problem: existence },
    { name: '記錄為 ServiceMode（priority ≠ 0）', problem: serviceMode },
    { name: `TargetName 為 ${expectedTarget}`, problem: targetName },
    { name: 'SvcParams 含 alpn', problem: alpn },
    {
      name: '未宣告本站未提供的 agent 端點（_a2a／_mcp）',
      problem: forbiddenPresent.length
        ? `查到不該存在的記錄：${forbiddenPresent.join('、')}。` +
          '本站沒有 A2A agent 也沒有 MCP server，宣告它們會讓 agent 連過來撲空（spec R9）'
        : forbiddenUnchecked.length
          ? `${forbiddenUnchecked.length} 項查詢失敗，未能查證是否誤宣告：` +
            `${forbiddenUnchecked.join('、')}。DoH 兩家 resolver 都查詢失敗不代表沒有誤宣告，` +
            '不可視為通過'
          : null,
    },
    {
      name: '入口主機服務中且回 Link 標頭',
      problem: !entrypoint
        ? '未探測（前面的檢查已失敗，沒有可信的 TargetName）'
        : !entrypoint.ok
          ? `HEAD 請求失敗：${entrypoint.error ?? `回應 ${entrypoint.status}`}`
          : entrypoint.hasLinkHeader
            ? null
            : '回應沒有 Link 標頭——DNS 宣告的入口指不到本站的機器可讀資源（spec R8）',
    },
    {
      name: 'DNSSEC 已驗證（AD flag）',
      problem: dnssecValidated
        ? null
        : 'DoH 回應的 AD flag 為 false，代表 DNSSEC 未驗證。' +
          '須至 Cloudflare Dashboard → frankchen.tw → DNS → Settings → DNSSEC 取得 DS 記錄，' +
          '上傳到 .tw 註冊商完成簽署；父區（.tw）更新有延遲，上傳後不會立即生效',
    },
  ];
}
