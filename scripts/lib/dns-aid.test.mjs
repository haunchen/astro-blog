import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseServiceBinding, normalizeTargetName, evaluateDnsAid } from './dns-aid.mjs';

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
