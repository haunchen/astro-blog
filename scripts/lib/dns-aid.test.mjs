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
