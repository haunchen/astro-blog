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
let dnssecValidated = indexHttps.json.AD === true;

if (indexData.length === 0) {
  const indexSvcb = await doh(indexName, 'SVCB');
  const svcbData = indexSvcb.json ? answersOfType(indexSvcb.json, RR_TYPES.SVCB) : [];
  if (svcbData.length > 0) {
    indexData = svcbData;
    indexStatus = indexSvcb.json.Status;
    usedType = 'SVCB';
    dnssecValidated = indexSvcb.json.AD === true;
  }
}
console.log(`${indexName} → ${usedType} 記錄 ${indexData.length} 筆（解析器：${indexHttps.resolver}）`);

// 2. _a2a / _mcp：這兩個名稱必須不存在（spec R9 的負向需求），字面要求是 NXDOMAIN。
//    只看「有沒有 HTTPS/SVCB 答案」不夠：名稱若因其他記錄型別而存在
//    （NOERROR + NODATA），一樣違反「不存在」，只是查不到我們要的那個 RR type。
const forbiddenPresent = [];
const forbiddenUnchecked = [];
for (const label of ['_a2a', '_mcp']) {
  for (const [typeName, typeCode] of Object.entries(RR_TYPES)) {
    const name = `${label}._agents.${HOST}`;
    const result = await doh(name, typeName);
    // 查詢本身失敗不算「有記錄」，但也不能就此當作「沒有記錄」——
    // 網路問題不該被誤報成偷加了端點，但也不能讓它悄悄變成一個沒查過就通過的 PASS。
    if (result.error) {
      console.log(`（未能查證 ${name} ${typeName}：${result.error}）`);
      forbiddenUnchecked.push(`${name} (${typeName})：${result.error}`);
      continue;
    }
    const hasAnswer = answersOfType(result.json, typeCode).length > 0;
    const isNxdomain = result.json.Status === 3;
    if (hasAnswer || !isNxdomain) {
      forbiddenPresent.push(`${name} (${typeName})`);
    }
  }
}

// 3. 入口主機探測：DNS 宣告的 TargetName 必須真的服務中且回得出 Link 標頭。
//    拒發 _a2a／_mcp 的理由是「不宣告不存在的服務」，這條是對自己的同一個約束。
//    挑記錄時要挑 evaluateDnsAid 會認可的那一筆（TargetName 正規化後等於本站主機），
//    而不是陣列裡第一筆 ServiceMode 記錄——TargetName／alpn 兩項檢查採「任一筆合格即
//    通過」，第一筆不一定是合格的那筆，探測挑錯記錄會對別的主機發請求。
const ownerName = indexName;
const expectedTarget = normalizeTargetName(HOST, ownerName);
const serviceRecord = indexData
  .map((data) => parseServiceBinding(data))
  .find(
    (record) =>
      record.mode === 'service' && normalizeTargetName(record.target, ownerName) === expectedTarget,
  );

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
const checks = evaluateDnsAid({
  host: HOST,
  indexStatus,
  indexData,
  forbiddenPresent,
  forbiddenUnchecked,
  entrypoint,
  dnssecValidated,
});

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
