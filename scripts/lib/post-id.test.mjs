import { test } from 'node:test';
import assert from 'node:assert/strict';
import { postIdFromPath } from './post-id.mjs';

test('postIdFromPath：目錄型文章去掉 /index.md 得出 slug', () => {
  assert.equal(postIdFromPath('src/content/posts/my-post/index.md'), 'my-post');
});

// astro.config.mjs 的 POST_LASTMOD 兩種形狀都認，這裡跟著認，否則哪天新增一篇平鋪
// 檔就會靜靜地不送。
test('postIdFromPath：平鋪型文章去掉 .md 得出 slug', () => {
  assert.equal(postIdFromPath('src/content/posts/my-post.md'), 'my-post');
});

// git 在 Windows 上仍回正斜線，但本機直接呼叫時可能拿到反斜線路徑。
test('postIdFromPath：反斜線路徑正常換算', () => {
  assert.equal(postIdFromPath('src\\content\\posts\\my-post\\index.md'), 'my-post');
});

test('postIdFromPath：非文章路徑與非 md 檔回 null', () => {
  assert.equal(postIdFromPath('src/pages/about.astro'), null);
  assert.equal(postIdFromPath('src/content/posts/my-post/cover.png'), null);
  assert.equal(postIdFromPath('docs/specs/index-submission.md'), null);
});

test('postIdFromPath：非字串輸入回 null', () => {
  assert.equal(postIdFromPath(undefined), null);
  assert.equal(postIdFromPath(null), null);
});
