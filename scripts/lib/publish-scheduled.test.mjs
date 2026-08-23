import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toTaipeiDay, isDue, flipToPublished } from './publish-scheduled.mjs';

test('toTaipeiDay：YAML 解析出的 UTC 午夜 Date 歸算回同一個日曆日', () => {
  // gray-matter 把裸日期 `2026-08-28` 解析成 2026-08-28T00:00:00Z，
  // 台北是同日早上八點，不能因為時區位移就變成 8/29。
  assert.equal(toTaipeiDay(new Date('2026-08-28T00:00:00Z')), '2026-08-28');
});

test('toTaipeiDay：UTC 當日下午四點之後在台北已是隔天', () => {
  assert.equal(toTaipeiDay(new Date('2026-08-27T16:30:00Z')), '2026-08-28');
  assert.equal(toTaipeiDay(new Date('2026-08-27T15:30:00Z')), '2026-08-27');
});

test('toTaipeiDay：接受字串，無法解析回 null', () => {
  assert.equal(toTaipeiDay('2026-08-28'), '2026-08-28');
  assert.equal(toTaipeiDay('不是日期'), null);
  assert.equal(toTaipeiDay(''), null);
});

test('isDue：draft 且 publishAt 是過去或今天才算到期', () => {
  const today = '2026-08-28';
  assert.equal(isDue({ draft: true, publishAt: new Date('2026-08-27T00:00:00Z') }, today), true);
  assert.equal(isDue({ draft: true, publishAt: new Date('2026-08-28T00:00:00Z') }, today), true);
  assert.equal(isDue({ draft: true, publishAt: new Date('2026-08-29T00:00:00Z') }, today), false);
});

test('isDue：沒有 publishAt 的草稿永遠不動', () => {
  // 這是整個設計的安全性質：還在寫的稿只有 draft 沒有 publishAt，
  // 不論腳本出什麼錯都不可能被發出去。
  const today = '2026-08-28';
  assert.equal(isDue({ draft: true }, today), false);
  assert.equal(isDue({ draft: true, publishAt: null }, today), false);
  assert.equal(isDue({ draft: true, publishAt: '不是日期' }, today), false);
});

test('isDue：已上站的文章不動，即使帶著 publishAt', () => {
  const today = '2026-08-28';
  assert.equal(isDue({ publishAt: new Date('2026-08-01T00:00:00Z') }, today), false);
  assert.equal(isDue({ draft: false, publishAt: new Date('2026-08-01T00:00:00Z') }, today), false);
});

const SAMPLE = `---
title: 這是一篇文章：副標題也有全形冒號
date: 2026-08-01
updated: 2026-08-05
description: 描述文字
category: devops
tags:
  - n8n
  - 自動化
cover: ./images/cover.webp
draft: true
publishAt: 2026-08-28
---

正文第一段。

---

分隔線後的第二段，這裡的三個減號不是 frontmatter 結尾。
`;

test('flipToPublished：date 換成 publishAt，draft、publishAt、updated 三行整行移除', () => {
  // SAMPLE 的 updated（8/5）早於 publishAt（8/28），會產出 dateModified 早於
  // datePublished 的 JSON-LD，所以連同 draft、publishAt 一起整行刪掉。
  const result = flipToPublished(SAMPLE);
  assert.notEqual(result, null);
  assert.equal(result.publishedOn, '2026-08-28');
  assert.match(result.text, /^date: 2026-08-28$/m);
  assert.doesNotMatch(result.text, /^draft:/m);
  assert.doesNotMatch(result.text, /^publishAt:/m);
  assert.doesNotMatch(result.text, /^updated:/m);
});

test('flipToPublished：除了那四行以外一個字元都不動', () => {
  const result = flipToPublished(SAMPLE);
  const before = SAMPLE.split('\n');
  const after = result.text.split('\n');
  // 預期少三行（draft、publishAt、updated），date 那行換值，其餘逐行相同。
  assert.equal(after.length, before.length - 3);
  const survivors = before.filter((l) => !/^(draft|publishAt|updated):/.test(l));
  survivors[survivors.findIndex((l) => /^date:/.test(l))] = 'date: 2026-08-28';
  assert.deepEqual(after, survivors);
});

test('flipToPublished：updated 晚於或等於 publishAt 時保留原樣', () => {
  const sampleWithLateUpdate = SAMPLE.replace('updated: 2026-08-05', 'updated: 2026-08-29');
  const result = flipToPublished(sampleWithLateUpdate);
  assert.notEqual(result, null);
  assert.match(result.text, /^updated: 2026-08-29$/m);
  assert.doesNotMatch(result.text, /^draft:/m);
  assert.doesNotMatch(result.text, /^publishAt:/m);
});

test('flipToPublished：正文裡的 --- 不會被當成 frontmatter 結尾', () => {
  const result = flipToPublished(SAMPLE);
  assert.match(result.text, /分隔線後的第二段/);
  assert.match(result.text, /\n---\n\n分隔線後的第二段/);
});

test('flipToPublished：沒有 publishAt 或沒有 date 時回 null', () => {
  const noPublishAt = SAMPLE.replace(/^publishAt: .*$/m, '');
  assert.equal(flipToPublished(noPublishAt), null);
  const noDate = SAMPLE.replace(/^date: .*$/m, '');
  assert.equal(flipToPublished(noDate), null);
});

test('flipToPublished：沒有 frontmatter 的檔回 null 而不是丟例外', () => {
  assert.equal(flipToPublished('沒有 frontmatter 的純文字'), null);
  assert.equal(flipToPublished('---\n只有開頭沒有結尾\n'), null);
});
