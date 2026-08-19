import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tagSlug, assertNoTagSlugCollisions, TAG_SLUG_EXCEPTIONS } from './tag-slug.mjs';

// 下面的期望值不是自己訂的，是 WordPress.2026-05-31.xml 的 <wp:tag_slug> 實際值。
// 改動規則時請回頭比對那份封存，別照直覺調——這支的唯一目的就是對上舊網址。

test('tagSlug：英文轉小寫', () => {
  assert.equal(tagSlug('AI'), 'ai');
  assert.equal(tagSlug('SEO'), 'seo');
  assert.equal(tagSlug('WordPress'), 'wordpress');
  assert.equal(tagSlug('DataTable'), 'datatable');
});

test('tagSlug：空白轉連字號', () => {
  assert.equal(tagSlug('Google Cloud'), 'google-cloud');
});

test('tagSlug：點號直接移除而不是轉連字號', () => {
  // WP 實際值就是 nodejs。轉成 node-js 會對不上舊網址。
  assert.equal(tagSlug('Node.js'), 'nodejs');
});

test('tagSlug：撇號移除、空白仍轉連字號', () => {
  assert.equal(tagSlug("Let's Encrypt"), 'lets-encrypt');
  // 全形右單引號（macOS 智慧引號）走同一條路
  assert.equal(tagSlug('Let’s Encrypt'), 'lets-encrypt');
});

test('tagSlug：中文原樣保留', () => {
  assert.equal(tagSlug('工作流程'), '工作流程');
  assert.equal(tagSlug('記憶體優化'), '記憶體優化');
  assert.equal(tagSlug('NFC門禁卡'), 'nfc門禁卡');
});

test('tagSlug：例外表優先於規則', () => {
  // 規則會給 v0dev，但 WP 舊網址是 v0-dev
  assert.equal(tagSlug('v0.dev'), 'v0-dev');
  // 規則會給「模板」，但 WP 人工指定成英文 template
  assert.equal(tagSlug('模板'), 'template');
});

test('tagSlug：頭尾不留連字號', () => {
  assert.equal(tagSlug('  Docker  '), 'docker');
  assert.equal(tagSlug('(Beta)'), 'beta');
});

test('tagSlug：連續符號折成單一連字號', () => {
  assert.equal(tagSlug('CI / CD'), 'ci-cd');
});

test('TAG_SLUG_EXCEPTIONS 只收 WP 舊網址對不上的兩筆', () => {
  // 這張表長大時應該要有人看一眼——它不是給新標籤取別名用的。
  assert.deepEqual([...TAG_SLUG_EXCEPTIONS.keys()].sort(), ['v0.dev', '模板']);
});

test('assertNoTagSlugCollisions：無撞名時安靜通過', () => {
  assert.doesNotThrow(() => assertNoTagSlugCollisions(['AI', 'SEO', '工作流程', 'Node.js']));
});

test('assertNoTagSlugCollisions：撞名時丟錯並指出是哪幾個標籤', () => {
  // 'Node.js' 與 'NodeJS' 都會變成 nodejs
  assert.throws(
    () => assertNoTagSlugCollisions(['Node.js', 'NodeJS']),
    (err) => {
      assert.match(err.message, /撞名/);
      assert.match(err.message, /\/tag\/nodejs\//);
      assert.match(err.message, /「Node\.js」/);
      assert.match(err.message, /「NodeJS」/);
      return true;
    },
  );
});

test('assertNoTagSlugCollisions：大小寫不同的同名標籤也算撞名', () => {
  assert.throws(() => assertNoTagSlugCollisions(['Docker', 'docker']), /撞名/);
});
