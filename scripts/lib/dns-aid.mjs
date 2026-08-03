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

/**
 * 評估一次 DNS-AID 查詢結果，回傳固定六項檢查。
 *
 * 為什麼回傳「檢查陣列」而不是「問題陣列」：verify 腳本要能逐項印 PASS/FAIL，
 * 讓通過的項目也看得見——只印失敗的話，某項檢查因為程式錯誤而沒跑到時，
 * 輸出看起來與「全部通過」一模一樣。
 *
 * 前四項刻意都對「同一批記錄」求值而非串成 if-else：記錄同時有兩個毛病時
 * （例如 AliasMode 又缺 alpn），一次全部報出來，不必修一個跑一次。
 *
 * @param {{ host: string, indexStatus: number, indexData: string[],
 *           forbiddenPresent: string[],
 *           entrypoint: { ok: boolean, status?: number, hasLinkHeader?: boolean,
 *                         error?: string } | null }} input
 * @returns {Array<{ name: string, problem: string | null }>}
 */
export function evaluateDnsAid(input) {
  const { host, indexStatus, indexData, forbiddenPresent, entrypoint } = input;
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
    if (modes.includes('wire-format')) {
      serviceMode =
        `記錄為 SVCB(64)：DoH 只把 HTTPS(65) 轉成 presentation format，SVCB 回十六進位 wire format。` +
        `掃描器走同一條 DoH，改建成 HTTPS 型別，或為本解析器補 wire-format 支援`;
    } else if (modes.includes('alias')) {
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
  ];
}
