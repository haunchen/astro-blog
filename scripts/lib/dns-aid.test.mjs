import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseServiceBinding,
  normalizeTargetName,
  evaluateDnsAid,
  isNameAbsent,
} from './dns-aid.mjs';

// 取自 2026-08-03 對 frankchen.tw（已啟用 DNSSEC）的實際 DoH 回應。
// Cloudflare 走 compact denial of existence，不存在的名稱回 NOERROR 而非 NXDOMAIN。
const COMPACT_DENIAL = {
  Status: 0,
  Authority: [
    { name: 'frankchen.tw', type: 6, data: 'edward.ns.cloudflare.com. dns.cloudflare.com. 2411220037 10000 2400 604800 1800' },
    { name: 'frankchen.tw', type: 46, data: 'SOA ECDSAP256SHA256 2 1800 1785824950 1785644950 34505 frankchen.tw. WrKC...' },
    { name: '_a2a._agents.frankchen.tw', type: 47, data: '\\000._a2a._agents.frankchen.tw. RRSIG NSEC NXNAME' },
    { name: '_a2a._agents.frankchen.tw', type: 46, data: 'NSEC ECDSAP256SHA256 4 1800 1785824761 1785644761 34505 frankchen.tw. sUFw...' },
  ],
};

test('isNameAbsent：NXDOMAIN 視為不存在', () => {
  assert.equal(isNameAbsent({ Status: 3 }, '_a2a._agents.frankchen.tw'), true);
});

test('isNameAbsent：DNSSEC compact denial（NOERROR + NXNAME）視為不存在', () => {
  assert.equal(isNameAbsent(COMPACT_DENIAL, '_a2a._agents.frankchen.tw'), true);
});

test('isNameAbsent：名稱與大小寫、尾點差異不影響比對', () => {
  assert.equal(isNameAbsent(COMPACT_DENIAL, '_A2A._Agents.FrankChen.TW.'), true);
});

test('isNameAbsent：NSEC 屬於別的名稱時不可誤判為不存在', () => {
  assert.equal(isNameAbsent(COMPACT_DENIAL, '_mcp._agents.frankchen.tw'), false);
});

test('isNameAbsent：NODATA（名稱存在、只是沒有該型別）不算不存在', () => {
  const nodata = {
    Status: 0,
    Authority: [{ name: 'frankchen.tw', type: 6, data: 'edward.ns.cloudflare.com. ...' }],
  };
  assert.equal(isNameAbsent(nodata, '_a2a._agents.frankchen.tw'), false);
});

test('isNameAbsent：NXNAME 為其他 token 子字串時不可誤判', () => {
  const bogus = {
    Status: 0,
    Authority: [
      { name: '_a2a._agents.frankchen.tw', type: 47, data: '\\000._a2a._agents.frankchen.tw. RRSIG NSEC NXNAMEX' },
    ],
  };
  assert.equal(isNameAbsent(bogus, '_a2a._agents.frankchen.tw'), false);
});

test('isNameAbsent：SERVFAIL 等其他狀態不得當作不存在', () => {
  assert.equal(isNameAbsent({ Status: 2 }, '_a2a._agents.frankchen.tw'), false);
  assert.equal(isNameAbsent(null, '_a2a._agents.frankchen.tw'), false);
});

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

test('parseServiceBinding：RFC 3597 wire-format 解出的結構與 presentation format 相同', () => {
  // 實測記錄（2026-08-03）：_index._agents.frankchen.tw 的真實內容。
  // 手動在 Dashboard 建立的記錄，CF DoH 回的就是這種十六進位格式而非 presentation format。
  const r = parseServiceBinding(
    '\\# 38 00 01 09 66 72 61 6e 6b 63 68 65 6e 02 74 77 00 00 01 00 0c 02 68 32 08 68 74 74 70 2f 31 2e 31 00 03 00 02 01 bb',
  );
  assert.equal(r.mode, 'service');
  assert.equal(r.priority, 1);
  assert.equal(r.target, 'frankchen.tw.');
  assert.equal(r.params.get('alpn'), 'h2,http/1.1');
  assert.equal(r.params.get('port'), '443');
  assert.equal(r.reason, null);
});

test('parseServiceBinding：wire-format 多記錄真實樣本（_dns.resolver.arpa，取自 CF DoH）', () => {
  // 含 ipv4hint／ipv6hint／未知 key(7)，這些依 brief 不特別解讀，只要不讓整筆變 unparsable
  const r = parseServiceBinding(
    '\\# 103 00 01 03 6f 6e 65 03 6f 6e 65 03 6f 6e 65 03 6f 6e 65 00 00 01 00 06 02 68 32 02 68 33 00 03 00 02 01 bb 00 04 00 08 01 01 01 01 01 00 00 01 00 06 00 20 26 06 47 00 47 00 00 00 00 00 00 00 00 00 11 11 26 06 47 00 47 00 00 00 00 00 00 00 00 00 10 01 00 07 00 10 2f 64 6e 73 2d 71 75 65 72 79 7b 3f 64 6e 73 7d',
  );
  assert.equal(r.mode, 'service');
  assert.equal(r.priority, 1);
  assert.equal(r.target, 'one.one.one.one.');
  assert.equal(r.params.get('alpn'), 'h2,h3');
  assert.equal(r.params.get('port'), '443');
  assert.equal(r.params.has('ipv4hint'), true);
  assert.equal(r.params.has('ipv6hint'), true);
  assert.equal(r.params.has('key7'), true);
  assert.equal(r.reason, null);
});

test('parseServiceBinding：wire-format priority 0 是 AliasMode', () => {
  // \# 16 = 2(priority) + 10(len9 "frankchen") + 3(len2 "tw") + 1(terminator) = 16
  const r = parseServiceBinding(
    '\\# 16 00 00 09 66 72 61 6e 6b 63 68 65 6e 02 74 77 00',
  );
  assert.equal(r.mode, 'alias');
  assert.equal(r.priority, 0);
  assert.equal(r.target, 'frankchen.tw.');
});

test('parseServiceBinding：wire-format target 為單一 0x00（owner name）解為 "."', () => {
  const r = parseServiceBinding('\\# 3 00 01 00');
  assert.equal(r.mode, 'service');
  assert.equal(r.target, '.');
});

test('parseServiceBinding：wire-format 含 mandatory 與 no-default-alpn', () => {
  // \# 13 = 2(priority) + 1(target "." 單一 0x00)
  //        + mandatory：key(00 00) length(00 02) value(00 03=key3/port) = 6 bytes
  //        + no-default-alpn：key(00 02) length(00 00) = 4 bytes
  const r = parseServiceBinding('\\# 13 00 01 00 00 00 00 02 00 03 00 02 00 00');
  assert.equal(r.mode, 'service');
  assert.equal(r.params.get('mandatory'), 'port');
  assert.equal(r.params.has('no-default-alpn'), true);
  assert.equal(r.params.get('no-default-alpn'), '');
});

test('parseServiceBinding：wire-format 未知 key 走 keyNNNNN 並以十六進位呈現', () => {
  // \# 9 = 2(priority) + 1(target ".") + key(ff 00=65280) length(00 02) value(ab cd)
  const r = parseServiceBinding('\\# 9 00 01 00 ff 00 00 02 ab cd');
  assert.equal(r.mode, 'service');
  assert.equal(r.params.get('key65280'), 'abcd');
});

test('parseServiceBinding：wire-format 宣告長度與實際位元組數不符為 unparsable', () => {
  const r = parseServiceBinding('\\# 10 00 01 00');
  assert.equal(r.mode, 'unparsable');
  assert.match(r.reason, /宣告長度/);
});

test('parseServiceBinding：wire-format TargetName 未終止（位元組耗盡）為 unparsable', () => {
  // 宣告一個 label 長度 9，但後面位元組不夠
  const r = parseServiceBinding('\\# 5 00 01 09 61 62');
  assert.equal(r.mode, 'unparsable');
  assert.match(r.reason, /wire-format/);
});

test('parseServiceBinding：wire-format 參數長度超出剩餘位元組為 unparsable', () => {
  // key1(alpn)、宣告 length=10，但剩餘位元組不足
  const r = parseServiceBinding('\\# 8 00 01 00 00 01 00 0a 02');
  assert.equal(r.mode, 'unparsable');
  assert.match(r.reason, /wire-format/);
});

test('parseServiceBinding：wire-format 含非法十六進位 token 為 unparsable', () => {
  const r = parseServiceBinding('\\# 3 zz 01 00');
  assert.equal(r.mode, 'unparsable');
  assert.match(r.reason, /非法十六進位/);
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

/** 產生一組全部通過的輸入，個別測試只覆寫要驗的那一項。 */
function passingInput(overrides = {}) {
  return {
    host: 'frankchen.tw',
    indexStatus: 0,
    indexData: ['1 frankchen.tw. alpn="h2,http/1.1" port=443'],
    forbiddenPresent: [],
    forbiddenUnchecked: [],
    entrypoint: { ok: true, status: 200, hasLinkHeader: true },
    dnssecValidated: true,
    ...overrides,
  };
}

/** 取某一項檢查的 problem；找不到該項就讓測試失敗（避免斷言靜默跳過）。 */
function problemOf(checks, keyword) {
  const found = checks.filter((c) => c.name.includes(keyword));
  assert.equal(found.length, 1, `應恰有一項檢查含「${keyword}」，實際 ${found.length} 項`);
  return found[0].problem;
}

test('evaluateDnsAid：全部符合時七項檢查皆通過', () => {
  const checks = evaluateDnsAid(passingInput());
  assert.equal(checks.length, 7);
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

test('evaluateDnsAid：wire-format 記錄現在能正確解出內容，不再被誤判為型別問題', () => {
  // 實測記錄（2026-08-03）：手動建立的記錄 CF DoH 回 wire format，內容其實完全正確
  const checks = evaluateDnsAid(
    passingInput({
      indexData: [
        '\\# 38 00 01 09 66 72 61 6e 6b 63 68 65 6e 02 74 77 00 00 01 00 0c 02 68 32 08 68 74 74 70 2f 31 2e 31 00 03 00 02 01 bb',
      ],
    }),
  );
  assert.equal(problemOf(checks, 'ServiceMode'), null);
  assert.equal(problemOf(checks, 'TargetName'), null);
  assert.equal(problemOf(checks, 'alpn'), null);
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

test('evaluateDnsAid：兩家 DoH resolver 都查詢失敗時不能誤報 PASS', () => {
  // forbiddenPresent 空陣列不等於「查證過確實沒有」——可能只是沒查成
  const checks = evaluateDnsAid(
    passingInput({
      forbiddenPresent: [],
      forbiddenUnchecked: ['_a2a._agents.frankchen.tw (HTTPS)：Cloudflare 請求失敗｜Google 請求失敗'],
    }),
  );
  assert.notEqual(problemOf(checks, '未提供的 agent 端點'), null);
  assert.match(problemOf(checks, '未提供的 agent 端點'), /未能查證/);
});

test('evaluateDnsAid：偷加的記錄與查詢失敗同時發生時，訊息以偷加的記錄為主', () => {
  const checks = evaluateDnsAid(
    passingInput({
      forbiddenPresent: ['_a2a._agents.frankchen.tw (HTTPS)'],
      forbiddenUnchecked: ['_mcp._agents.frankchen.tw (SVCB)：Cloudflare 請求失敗｜Google 請求失敗'],
    }),
  );
  assert.match(problemOf(checks, '未提供的 agent 端點'), /查到不該存在的記錄/);
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

test('evaluateDnsAid：DNSSEC 已驗證（AD flag 為 true）時通過', () => {
  const checks = evaluateDnsAid(passingInput({ dnssecValidated: true }));
  assert.equal(problemOf(checks, 'DNSSEC'), null);
});

test('evaluateDnsAid：DNSSEC 未驗證（AD flag 為 false）要被擋下並指路 DS 記錄上傳', () => {
  const checks = evaluateDnsAid(passingInput({ dnssecValidated: false }));
  assert.match(problemOf(checks, 'DNSSEC'), /DS 記錄|DNSSEC/);
});
