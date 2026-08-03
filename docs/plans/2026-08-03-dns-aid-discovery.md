# DNS 層的 agent 入口宣告（DNS-AID）Implementation Plan

Goal: 在 `_index._agents.frankchen.tw` 發布一筆 ServiceMode HTTPS 記錄宣告本網域的 agent 入口，
並在 repo 內建立一支能持續守住這條 zone 層記錄的驗證腳本。

Architecture: DNS 記錄本身在 Cloudflare zone（不在 repo，人工建立）。repo 的產出是
`scripts/lib/dns-aid.mjs`（純函數：presentation format 解析 + 斷言評估，有單元測試）與
`scripts/verify-dns-aid.mjs`（I/O：DoH 查詢 + 入口主機探測 + 逐項輸出），定位與既有
`verify:headers` / `verify:robots` 相同——打線上、驗 zone 的東西、吃 origin 參數。

Tech Stack: Node.js ESM（`.mjs`）、`node:test` + `node:assert/strict`、內建 `fetch`。不新增相依套件。

Spec: `docs/specs/agent-markdown.md`（Pending Changes 的 R9 / S9 / D11）

Design: `docs/plans/2026-08-03-dns-aid-discovery-design.md`

## Global Constraints

- Canonical host 是 **non-www**（`https://frankchen.tw`）。任何程式碼、文件、DNS 記錄皆不得出現 www URL。
- 語言 zh-TW：程式碼註解、console 輸出訊息一律正體中文台灣用語。
- `npm test` 的 glob 是 `node --test "scripts/lib/*.test.mjs"`——**測試檔必須放在 `scripts/lib/` 且以 `.test.mjs` 結尾**，否則不會被跑到。雙引號是刻意的（由 Node 展開而非 shell）。
- `scripts/` 底下一律 ESM `.mjs`；純邏輯放 `scripts/lib/`（可被 `npm test` 涵蓋），I/O 放 `scripts/*.mjs`。
- 不新增任何 npm 相依套件，全部用 Node 內建能力。
- 無 linter；TypeScript strict 只涵蓋 `src/`，`scripts/` 不進型別檢查。
- `verify:*` 腳本預設打 **https://frankchen.tw（正式站）**，第一個位置參數可覆寫 origin。任一項不符即 `process.exit(1)`。
- **不得宣告本站未實際提供的 agent 協定端點**（spec R9）：`_a2a._agents`、`_mcp._agents` 必須維持不存在，這是需求不是疏漏。
- 記錄只使用已由 IANA 註冊的 SvcParamKey（`alpn`、`port`），不使用 draft 專屬、尚待配號的實驗性 key，不加 `mandatory`。
- CI 不動：不改 `.github/workflows/seo-pr.yml` 與 `seo-daily.yml`。

---

## 人工步驟（zone 層，subagent 無法執行）

DNS 記錄不在 repo，implementer 沒有 Cloudflare 憑證，**Task 1-3 全部完成後由使用者手動執行**：

Cloudflare Dashboard → frankchen.tw → DNS → Records → Add record

| 欄位 | 值 |
|---|---|
| Type | `HTTPS` |
| Name | `_index._agents` |
| TTL | `1 hour`（3600） |
| Priority | `1` |
| Target | `frankchen.tw.`（**含尾點**，不可留空、不可填 `.`） |
| Value | `alpn="h2,http/1.1" port=443` |

等同的 zone file 表示：

```
_index._agents.frankchen.tw. 3600 IN HTTPS 1 frankchen.tw. alpn="h2,http/1.1" port=443
```

**Priority 不可填 0**——0 是 AliasMode，掃描器會算進 `aliasRecordCount` 而非 `serviceRecordCount`，
記錄看起來建好了卻不算數。**Target 不可填 `.`**——`.` 在 SVCB 語意上代表 owner name，
即 `_index._agents.frankchen.tw`，含底線，違反 draft §3.2 的 MUST（該處要用公開 x.509 憑證通訊）。

若 Cloudflare 拒絕建立 HTTPS 記錄，或建好後查詢發現 params 被吃掉：退路是改建 `SVCB` 型別
（同樣 priority 1 / target / value），並在 `scripts/lib/dns-aid.mjs` 補一個 RFC 3597 wire-format
解析器——`parseServiceBinding()` 已經會把這種輸入標成 `mode: 'wire-format'` 並給明確訊息，
不會靜默失敗。詳見 design doc「為何是 HTTPS(65) 而非 SVCB(64)」。

建立後 DNS 傳播需數分鐘，接著跑驗收（見文末）。

---

### Task 1: SVCB/HTTPS presentation format 解析器

Implements: `agent-markdown.md` #R9

Files:
- Create: `scripts/lib/dns-aid.mjs`
- Test: `scripts/lib/dns-aid.test.mjs`

Interfaces:
- Consumes: 無（本 task 是這條線的起點）
- Produces:
  - `parseServiceBinding(data: string): { mode, priority, target, params, reason }`
    - `mode`：`'service'`（priority ≠ 0）｜`'alias'`（priority = 0）｜`'wire-format'`（RFC 3597 十六進位）｜`'unparsable'`
    - `priority`：`number | null`
    - `target`：`string | null`（原樣保留，含尾點與大小寫）
    - `params`：`Map<string, string>`（key 一律小寫、值已去引號）
    - `reason`：`string | null`（僅 `wire-format` / `unparsable` 時有值，供錯誤訊息使用）
  - `normalizeTargetName(target: string, ownerName: string): string`
    （`.` 展開為 ownerName；一律小寫並補尾點）
- Task 2 會在**同一個檔案**加上 `evaluateDnsAid()`，Task 3 的 `scripts/verify-dns-aid.mjs`
  會 import 這三個具名匯出。

Step 1: 寫失敗的測試

建立 `scripts/lib/dns-aid.test.mjs`：

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseServiceBinding, normalizeTargetName } from './dns-aid.mjs';

test('parseServiceBinding：ServiceMode 記錄取出 priority、target 與參數', () => {
  const r = parseServiceBinding('1 frankchen.tw. alpn="h2,http/1.1" port=443');
  assert.equal(r.mode, 'service');
  assert.equal(r.priority, 1);
  assert.equal(r.target, 'frankchen.tw.');
  assert.equal(r.params.get('alpn'), 'h2,http/1.1');
  assert.equal(r.params.get('port'), '443');
});

test('parseServiceBinding：未加引號的參數值一樣取得到', () => {
  // Cloudflare 的 DoH JSON 實際就是這種形狀（實測 cloudflare.com 的 HTTPS 記錄）
  const r = parseServiceBinding('1 . alpn=h3,h2 ipv4hint=104.16.132.229,104.16.133.229');
  assert.equal(r.mode, 'service');
  assert.equal(r.target, '.');
  assert.equal(r.params.get('alpn'), 'h3,h2');
  assert.equal(r.params.get('ipv4hint'), '104.16.132.229,104.16.133.229');
});

test('parseServiceBinding：priority 為 0 是 AliasMode', () => {
  const r = parseServiceBinding('0 frankchen.tw.');
  assert.equal(r.mode, 'alias');
  assert.equal(r.priority, 0);
  assert.equal(r.target, 'frankchen.tw.');
  assert.equal(r.params.size, 0);
});

test('parseServiceBinding：RFC 3597 十六進位格式被辨識為 wire-format 而非解析失敗', () => {
  // CF 與 Google 的 DoH JSON 對 SVCB(64) 回的就是這種格式，必須給得出可行動的訊息
  const r = parseServiceBinding('\\# 103 00 01 03 6f 6e 65 03 6f 6e 65 00 00 01 00 06 02 68 32');
  assert.equal(r.mode, 'wire-format');
  assert.equal(r.priority, null);
  assert.equal(r.target, null);
  assert.match(r.reason, /SVCB/);
});

test('parseServiceBinding：引號內的空白不切開參數', () => {
  const r = parseServiceBinding('1 x.example. key65280="a b" port=443');
  assert.equal(r.params.get('key65280'), 'a b');
  assert.equal(r.params.get('port'), '443');
});

test('parseServiceBinding：參數名正規化為小寫', () => {
  const r = parseServiceBinding('1 x.example. ALPN="h2"');
  assert.equal(r.params.get('alpn'), 'h2');
});

test('parseServiceBinding：無值的裸參數記為空字串而非被略過', () => {
  const r = parseServiceBinding('1 x.example. no-default-alpn port=443');
  assert.equal(r.params.has('no-default-alpn'), true);
  assert.equal(r.params.get('no-default-alpn'), '');
});

test('parseServiceBinding：缺 target、空值與非字串皆為 unparsable', () => {
  for (const input of ['1', '', '   ', null, undefined, 42]) {
    assert.equal(parseServiceBinding(input).mode, 'unparsable', `輸入：${String(input)}`);
  }
});

test('parseServiceBinding：priority 非整數為 unparsable', () => {
  assert.equal(parseServiceBinding('abc frankchen.tw.').mode, 'unparsable');
  assert.equal(parseServiceBinding('-1 frankchen.tw.').mode, 'unparsable');
});

test('normalizeTargetName：一律小寫並補尾點', () => {
  assert.equal(normalizeTargetName('FrankChen.tw', '_index._agents.frankchen.tw'), 'frankchen.tw.');
  assert.equal(normalizeTargetName('frankchen.tw.', '_index._agents.frankchen.tw'), 'frankchen.tw.');
});

test('normalizeTargetName：`.` 展開為 owner name（因此會帶著底線）', () => {
  assert.equal(
    normalizeTargetName('.', '_index._agents.frankchen.tw'),
    '_index._agents.frankchen.tw.',
  );
});
```

Step 2: 跑測試確認失敗

Run: `npm test`
Expected: FAIL——`Cannot find module ... dns-aid.mjs`（檔案還不存在）

Step 3: 寫最小實作讓測試通過

建立 `scripts/lib/dns-aid.mjs`：

```js
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
```

Step 4: 跑測試確認通過

Run: `npm test`
Expected: PASS（既有 33 項 + 本 task 新增 11 項全綠）

Step 5: Commit

```bash
git add scripts/lib/dns-aid.mjs scripts/lib/dns-aid.test.mjs
git commit -m "feat(dns-aid): SVCB/HTTPS presentation format 解析器"
```

---

### Task 2: DNS-AID 斷言評估器

Implements: `agent-markdown.md` #R9, #S9

Files:
- Modify: `scripts/lib/dns-aid.mjs`（在檔尾追加 `evaluateDnsAid`，不動既有匯出）
- Test: `scripts/lib/dns-aid.test.mjs`（追加測試，不動既有測試）

Interfaces:
- Consumes: Task 1 的 `parseServiceBinding(data)` 與 `normalizeTargetName(target, ownerName)`，
  簽名見 Task 1 的 Produces。
- Produces:
  - `evaluateDnsAid(input): Array<{ name: string, problem: string | null }>`
    - `input.host: string` — 正規主機名（如 `frankchen.tw`）
    - `input.indexStatus: number` — `_index._agents.<host>` 查詢的 DoH `Status`（0 = NOERROR、3 = NXDOMAIN）
    - `input.indexData: string[]` — 該查詢中 HTTPS 記錄的 `data` 值陣列（呼叫端已濾掉 RRSIG）
    - `input.forbiddenPresent: string[]` — 查到有記錄的禁用名稱清單（如 `['_a2a._agents.frankchen.tw (HTTPS)']`）
    - `input.entrypoint: { ok: boolean, status?: number, hasLinkHeader?: boolean, error?: string } | null`
      — 對 TargetName 主機的 HEAD 探測結果；`null` 代表因前面的問題而未探測
    - 回傳固定 6 項檢查，`problem` 為 `null` 表示通過。**順序固定**，Task 3 直接依序輸出。
- Task 3 的 `scripts/verify-dns-aid.mjs` 負責把 DoH 與 HEAD 的實際回應組成 `input`。

Step 1: 寫失敗的測試

在 `scripts/lib/dns-aid.test.mjs` **檔尾追加**（import 那行也要補上 `evaluateDnsAid`）：

```js
// ↑ 檔頭的 import 改成：
// import { parseServiceBinding, normalizeTargetName, evaluateDnsAid } from './dns-aid.mjs';

/** 產生一組全部通過的輸入，個別測試只覆寫要驗的那一項。 */
function passingInput(overrides = {}) {
  return {
    host: 'frankchen.tw',
    indexStatus: 0,
    indexData: ['1 frankchen.tw. alpn="h2,http/1.1" port=443'],
    forbiddenPresent: [],
    entrypoint: { ok: true, status: 200, hasLinkHeader: true },
    ...overrides,
  };
}

/** 取某一項檢查的 problem；找不到該項就讓測試失敗（避免斷言靜默跳過）。 */
function problemOf(checks, keyword) {
  const found = checks.filter((c) => c.name.includes(keyword));
  assert.equal(found.length, 1, `應恰有一項檢查含「${keyword}」，實際 ${found.length} 項`);
  return found[0].problem;
}

test('evaluateDnsAid：全部符合時六項檢查皆通過', () => {
  const checks = evaluateDnsAid(passingInput());
  assert.equal(checks.length, 6);
  assert.deepEqual(checks.filter((c) => c.problem).map((c) => c.name), []);
});

test('evaluateDnsAid：NXDOMAIN 時回報記錄不存在', () => {
  const checks = evaluateDnsAid(passingInput({ indexStatus: 3, indexData: [], entrypoint: null }));
  assert.match(problemOf(checks, '存在'), /NXDOMAIN|不存在/);
});

test('evaluateDnsAid：查詢成功但無 HTTPS 記錄一樣算不存在', () => {
  const checks = evaluateDnsAid(passingInput({ indexStatus: 0, indexData: [], entrypoint: null }));
  assert.notEqual(problemOf(checks, '存在'), null);
});

test('evaluateDnsAid：AliasMode 被擋下並點名 serviceRecordCount', () => {
  const checks = evaluateDnsAid(passingInput({ indexData: ['0 frankchen.tw.'] }));
  assert.match(problemOf(checks, 'ServiceMode'), /AliasMode|serviceRecordCount/);
});

test('evaluateDnsAid：wire-format 回應點名記錄型別問題', () => {
  const checks = evaluateDnsAid(passingInput({ indexData: ['\\# 48 00 01 03 6f 6e 65'] }));
  assert.match(problemOf(checks, 'ServiceMode'), /SVCB/);
});

test('evaluateDnsAid：target 指向別的主機要被擋下', () => {
  const checks = evaluateDnsAid(passingInput({ indexData: ['1 example.com. alpn="h2"'] }));
  assert.match(problemOf(checks, 'TargetName'), /example\.com/);
});

test('evaluateDnsAid：target 為 `.`（展開後含底線）違反 draft §3.2', () => {
  const checks = evaluateDnsAid(passingInput({ indexData: ['1 . alpn="h2"'] }));
  assert.match(problemOf(checks, 'TargetName'), /底線/);
});

test('evaluateDnsAid：大小寫與尾點差異不算問題', () => {
  const checks = evaluateDnsAid(passingInput({ indexData: ['1 FrankChen.TW alpn="h2"'] }));
  assert.equal(problemOf(checks, 'TargetName'), null);
});

test('evaluateDnsAid：params 缺 alpn 要被擋下（CF 把 value 吃掉的情況）', () => {
  const checks = evaluateDnsAid(passingInput({ indexData: ['1 frankchen.tw.'] }));
  assert.match(problemOf(checks, 'alpn'), /alpn/);
});

test('evaluateDnsAid：多筆記錄中只要有一筆合格即可', () => {
  const checks = evaluateDnsAid(
    passingInput({ indexData: ['0 frankchen.tw.', '1 frankchen.tw. alpn="h2" port=443'] }),
  );
  assert.equal(problemOf(checks, 'ServiceMode'), null);
  assert.equal(problemOf(checks, 'TargetName'), null);
  assert.equal(problemOf(checks, 'alpn'), null);
});

test('evaluateDnsAid：偷加的 _a2a／_mcp 記錄要被擋下', () => {
  const checks = evaluateDnsAid(
    passingInput({ forbiddenPresent: ['_a2a._agents.frankchen.tw (HTTPS)'] }),
  );
  assert.match(problemOf(checks, '未提供的 agent 端點'), /_a2a/);
});

test('evaluateDnsAid：入口主機連不上要被擋下', () => {
  const checks = evaluateDnsAid(
    passingInput({ entrypoint: { ok: false, error: 'getaddrinfo ENOTFOUND' } }),
  );
  assert.match(problemOf(checks, '入口主機'), /ENOTFOUND/);
});

test('evaluateDnsAid：入口主機沒有 Link 標頭要被擋下', () => {
  const checks = evaluateDnsAid(
    passingInput({ entrypoint: { ok: true, status: 200, hasLinkHeader: false } }),
  );
  assert.match(problemOf(checks, '入口主機'), /Link/);
});

test('evaluateDnsAid：因前面的問題而未探測入口時，該項標為未探測而非通過', () => {
  const checks = evaluateDnsAid(passingInput({ indexStatus: 3, indexData: [], entrypoint: null }));
  assert.notEqual(problemOf(checks, '入口主機'), null);
});
```

Step 2: 跑測試確認失敗

Run: `npm test`
Expected: FAIL——`evaluateDnsAid is not a function`

Step 3: 寫最小實作讓測試通過

在 `scripts/lib/dns-aid.mjs` **檔尾追加**：

```js
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
```

Step 4: 跑測試確認通過

Run: `npm test`
Expected: PASS（Task 1 的 11 項 + 本 task 的 14 項，加既有 33 項）

Step 5: Commit

```bash
git add scripts/lib/dns-aid.mjs scripts/lib/dns-aid.test.mjs
git commit -m "feat(dns-aid): _index._agents 記錄的斷言評估器"
```

---

### Task 3: 驗證腳本、npm script 與部署文件

Implements: `agent-markdown.md` #R9, #S9

Files:
- Create: `scripts/verify-dns-aid.mjs`
- Modify: `package.json`（`scripts` 區塊，在 `verify:assets` 那一項後追加 `verify:dns-aid`）
- Modify: `docs/deployment.md`（檔尾追加「DNS 記錄（zone 層，不在 repo）」一節）

Interfaces:
- Consumes: Task 1 的 `parseServiceBinding`／`normalizeTargetName`、Task 2 的 `evaluateDnsAid`，
  簽名見各自的 Produces。本腳本 import 的具名匯出為
  `import { parseServiceBinding, normalizeTargetName, evaluateDnsAid } from './lib/dns-aid.mjs';`
- Produces: 可執行的 `npm run verify:dns-aid [origin]`，任一項不符 exit 1。

Step 1: 建立驗證腳本

建立 `scripts/verify-dns-aid.mjs`：

```js
/**
 * 驗證 zone 層的 DNS-AID 記錄（`_index._agents.<host>`）還在、還是對的。
 *
 * 為什麼需要這支：DNS 記錄不在 repo。`_headers` 至少 repo 裡有一份「請求」，
 * DNS 則是一行程式碼都不會產生它——zone 是唯一事實來源，而 zone 沒有版控、
 * 沒有 code review。有人在 Dashboard 手滑刪掉、或把 Priority 改成 0，
 * 站台一切正常、build 綠燈，只有這支腳本會叫。
 *
 * 刻意走 DoH（Cloudflare 優先、失敗改 Google）而不是系統 resolver：
 * isitagentready 的掃描器走的就是 `cloudflare-dns.com/dns-query`，
 * 驗同一條路徑才驗得到掃描器會看到的東西，而不是驗到我們自己的想像。
 *
 * 用法：
 *   node scripts/verify-dns-aid.mjs                    # 檢查 https://frankchen.tw
 *   node scripts/verify-dns-aid.mjs <origin>           # 檢查指定來源
 *
 * 任一項不符即 exit 1。
 */

import { parseServiceBinding, normalizeTargetName, evaluateDnsAid } from './lib/dns-aid.mjs';

const ORIGIN = (process.argv[2] ?? 'https://frankchen.tw').replace(/\/$/, '');
const HOST = new URL(ORIGIN).hostname;

// DoH 的 RR type 代碼：SVCB = 64、HTTPS = 65（RFC 9460）。
// 兩種都查——本站發的是 HTTPS，但若有人改建成 SVCB，要能明確指出型別不對，
// 而不是報「記錄不存在」把人指向錯誤的方向。
const RR_TYPES = { SVCB: 64, HTTPS: 65 };

const RESOLVERS = [
  { name: 'Cloudflare', url: 'https://cloudflare-dns.com/dns-query' },
  { name: 'Google', url: 'https://dns.google/resolve' },
];

/**
 * 對一個名稱做 DoH 查詢，Cloudflare 失敗才換 Google。
 * `do=1` 要求 DNSSEC 資料，與掃描器的查詢參數一致。
 */
async function doh(name, type) {
  const problems = [];
  for (const resolver of RESOLVERS) {
    const url = `${resolver.url}?name=${encodeURIComponent(name)}&type=${type}&do=1`;
    try {
      const res = await fetch(url, { headers: { accept: 'application/dns-json' } });
      if (!res.ok) {
        problems.push(`${resolver.name} 回應 ${res.status}`);
        continue;
      }
      return { resolver: resolver.name, json: await res.json() };
    } catch (err) {
      problems.push(`${resolver.name} 請求失敗：${err.message}`);
    }
  }
  return { error: problems.join('｜') };
}

/** 取出回應中指定 RR type 的 data 值。DoH 的 Answer 會混入 RRSIG(46)，必須濾掉。 */
function answersOfType(json, typeCode) {
  return (json?.Answer ?? []).filter((a) => a.type === typeCode).map((a) => a.data);
}

console.log(`檢查來源：${ORIGIN}（主機 ${HOST}）\n`);

// 1. _index._agents：先查 HTTPS(65)，沒有才退查 SVCB(64)
const indexName = `_index._agents.${HOST}`;
const indexHttps = await doh(indexName, 'HTTPS');
if (indexHttps.error) {
  console.log(`[FAIL] ${indexName} 的 DoH 查詢`);
  console.log(`       ${indexHttps.error}`);
  process.exit(1);
}

let indexData = answersOfType(indexHttps.json, RR_TYPES.HTTPS);
let indexStatus = indexHttps.json.Status;
let usedType = 'HTTPS';

if (indexData.length === 0) {
  const indexSvcb = await doh(indexName, 'SVCB');
  const svcbData = indexSvcb.json ? answersOfType(indexSvcb.json, RR_TYPES.SVCB) : [];
  if (svcbData.length > 0) {
    indexData = svcbData;
    indexStatus = indexSvcb.json.Status;
    usedType = 'SVCB';
  }
}
console.log(`${indexName} → ${usedType} 記錄 ${indexData.length} 筆（解析器：${indexHttps.resolver}）`);

// 2. _a2a / _mcp：這兩個名稱必須不存在（spec R9 的負向需求）
const forbiddenPresent = [];
for (const label of ['_a2a', '_mcp']) {
  for (const [typeName, typeCode] of Object.entries(RR_TYPES)) {
    const name = `${label}._agents.${HOST}`;
    const result = await doh(name, typeName);
    // 查詢本身失敗不算「有記錄」——網路問題不該被誤報成偷加了端點
    if (result.error) {
      console.log(`（略過 ${name} ${typeName}：${result.error}）`);
      continue;
    }
    if (answersOfType(result.json, typeCode).length > 0) {
      forbiddenPresent.push(`${name} (${typeName})`);
    }
  }
}

// 3. 入口主機探測：DNS 宣告的 TargetName 必須真的服務中且回得出 Link 標頭。
//    拒發 _a2a／_mcp 的理由是「不宣告不存在的服務」，這條是對自己的同一個約束。
const ownerName = indexName;
const serviceRecord = indexData
  .map((data) => parseServiceBinding(data))
  .find((record) => record.mode === 'service');

let entrypoint = null;
if (serviceRecord) {
  const targetHost = normalizeTargetName(serviceRecord.target, ownerName).replace(/\.$/, '');
  try {
    const res = await fetch(`https://${targetHost}/`, { method: 'HEAD', redirect: 'follow' });
    entrypoint = {
      ok: res.ok,
      status: res.status,
      hasLinkHeader: Boolean(res.headers.get('link')),
    };
  } catch (err) {
    entrypoint = { ok: false, error: err.message };
  }
}

// 4. 逐項輸出
const checks = evaluateDnsAid({ host: HOST, indexStatus, indexData, forbiddenPresent, entrypoint });

let failed = 0;
for (const check of checks) {
  if (check.problem) {
    failed++;
    console.log(`[FAIL] ${check.name}`);
    console.log(`       ${check.problem}`);
  } else {
    console.log(`[PASS] ${check.name}`);
  }
}

// DNSSEC 目前是已知未做，印出狀態但不計入失敗——見 docs/deployment.md 的說明。
// 保留這行而不刪：狀況若改變（DS 上傳了、或掃描器開始要求）看得出來。
console.log(
  `\n（DNSSEC：AD flag = ${indexHttps.json.AD === true}。` +
    'draft 對無 TLSA 的記錄僅 SHOULD，本站尚未啟用，不計入失敗）',
);

console.log();
if (failed) {
  console.log(`${failed} 項不符。`);
  console.log(
    'DNS 記錄不在 repo：Cloudflare Dashboard → frankchen.tw → DNS → Records，' +
      `找 ${indexName}。欄位對照見 docs/deployment.md。`,
  );
  process.exit(1);
}
console.log('全部符合預期。');
```

Step 2: 跑腳本確認輸出為「記錄不存在」

Run: `npm run verify:dns-aid`
Expected: exit 1，且第一項為
`[FAIL] _index._agents.frankchen.tw 記錄存在` / `_index._agents.frankchen.tw 回 NXDOMAIN（記錄不存在）`。

這是**預期中的失敗**——DNS 記錄要由使用者在 Cloudflare Dashboard 手動建立（見本文件「人工步驟」）。
implementer 沒有 Cloudflare 憑證，到此為止即可，不要嘗試建立 DNS 記錄。

同時確認第五項 `[PASS] 未宣告本站未提供的 agent 端點（_a2a／_mcp）`——這項現在就該通過，
它驗的是「沒有偷加」。若這項也 FAIL，代表 zone 上有非預期的記錄，回報使用者。

Step 3: 註冊 npm script

修改 `package.json`，在 `"verify:assets"` 那行後追加（注意前一行要補逗號）：

```json
    "verify:assets": "node scripts/verify-assets.mjs",
    "verify:dns-aid": "node scripts/verify-dns-aid.mjs"
```

Step 4: 撰寫部署文件

在 `docs/deployment.md` **檔尾追加**下列內容。注意外層用四個反引號包住，是因為內容本身含
三反引號的 code fence——**貼進 `deployment.md` 時只取內層內容，不要把最外層的四反引號也抄進去**：

````markdown
## DNS 記錄（zone 層，不在 repo）

以下記錄由 Cloudflare zone 提供，**repo 裡沒有任何東西會產生它們**。唯一的守門人是
`npm run verify:dns-aid`（打線上、查 DoH），改動 zone 後請跑一次。

### DNS-AID：`_index._agents`

```
_index._agents.frankchen.tw. 3600 IN HTTPS 1 frankchen.tw. alpn="h2,http/1.1" port=443
```

Dashboard 欄位對照（DNS → Records → Add record）：

| 欄位 | 值 |
|---|---|
| Type | `HTTPS` |
| Name | `_index._agents` |
| TTL | `1 hour` |
| Priority | `1` |
| Target | `frankchen.tw.` |
| Value | `alpn="h2,http/1.1" port=443` |

兩個會靜默失效的填法：

- **Priority 填 0** → AliasMode，isitagentready 的掃描器會算進 `aliasRecordCount` 而非
  `serviceRecordCount`，記錄看起來建好了卻不算數。
- **Target 留空或填 `.`** → `.` 在 SVCB 語意上代表 owner name，即 `_index._agents.frankchen.tw`，
  含底線，違反 draft-mozleywilliams-dnsop-dnsaid §3.2 的 MUST（該處要用公開 x.509 憑證通訊）。

型別用 `HTTPS`(65) 而非 `SVCB`(64) 是實測的結果：Cloudflare 與 Google 的 DoH JSON 只把 HTTPS
轉成 presentation format，SVCB 回 RFC 3597 的十六進位 wire format，而掃描器走同一條 DoH。
理由詳見 `docs/plans/2026-08-03-dns-aid-discovery-design.md`。

**不發 `_a2a._agents` 與 `_mcp._agents`**：本站沒有 A2A agent 也沒有 MCP server，宣告它們會讓
agent 連過來撲空。`verify:dns-aid` 有一條反向斷言確保這兩個名稱維持不存在。

### DNSSEC：尚未啟用

frankchen.tw 目前沒有 DS 記錄（`AD` flag 為 false）。DNS-AID 的 draft 對未併用 TLSA 的記錄
只要求 SHOULD，因此不是缺陷而是待評估項目。

要啟用得在 Cloudflare DNS → Settings → DNSSEC 取得 DS，再到 **.tw 的註冊商**上傳——那是
Cloudflare 之外的第三方介面，設錯的後果是全站 DNS 解析失敗，量級遠大於一條發現記錄的好處。
因此列為獨立議題，不與 DNS-AID 綁著做。
````

Step 5: 確認腳本與 npm script 可運作

Run: `npm run verify:dns-aid https://frankchen.tw`
Expected: 與 Step 2 相同的輸出（記錄尚未建立），exit 1。確認 npm script 名稱可解析、無語法錯誤。

Run: `npm test`
Expected: PASS（不受本 task 影響，確認沒有誤改 lib）

Step 6: Commit

```bash
git add scripts/verify-dns-aid.mjs package.json docs/deployment.md
git commit -m "feat(dns-aid): verify:dns-aid 驗證腳本與 zone 記錄文件"
```

---

## 驗收（人工步驟完成後）

1. 依「人工步驟」在 Cloudflare Dashboard 建立記錄，等待數分鐘傳播。
2. `npm run verify:dns-aid` → 六項全 PASS、exit 0。
3. 外部檢測：

   ```bash
   curl -s -X POST https://isitagentready.com/api/scan \
     -H 'content-type: application/json' -d '{"url":"https://frankchen.tw"}' \
     | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s).checks.discoverability.dnsAid;console.log(j.status);console.log(JSON.stringify(j.details,null,1))})"
   ```

   期望 `checks.discoverability.dnsAid.status` 為 `pass`。
   **若仍非 pass**：記下 `details` 四個判定欄位的實際值——`serviceRecordCount`、`aliasRecordCount`、
   `txtIndexEntryCount`、`dnssecValidated`——寫進 design doc，作為後續評估的輸入。
   `serviceRecordCount` 已 ≥ 1 卻仍不 pass 時，線索在另外兩條：`dnssecValidated`（DNSSEC 另案）
   或 `txtIndexEntryCount`（TXT 索引，本次刻意不發，理由見 design doc）。
   **不要為了衝過檢測而加 `_a2a`／`_mcp` 記錄**（spec R9 的負向需求）。
