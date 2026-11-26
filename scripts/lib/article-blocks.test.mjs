import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  LINKS_HEADING,
  classifyBlockHeading,
  headingText,
  checkPostStructure,
} from './article-blocks.mjs';

const rules = (markdown) => checkPostStructure(markdown).map((v) => v.rule);

test('classifyBlockHeading：含「常見問題」的標題是常見問題區塊', () => {
  assert.equal(classifyBlockHeading('Discord Bot 常見問題'), 'faq');
});

test('classifyBlockHeading：同時含「常見問題」與「故障排除」時是常見問題區塊', () => {
  assert.equal(classifyBlockHeading('常見問題與故障排除'), 'faq');
});

test('classifyBlockHeading：以「故障排除」開頭的標題是故障排除區塊', () => {
  assert.equal(classifyBlockHeading('故障排除指南'), 'troubleshooting');
});

test('classifyBlockHeading：「故障排除」不在開頭時不算區塊標題', () => {
  assert.equal(classifyBlockHeading('如何進行故障排除'), null);
});

test('classifyBlockHeading：完全等於文末連結標題才是文末連結區塊', () => {
  assert.equal(classifyBlockHeading(LINKS_HEADING), 'links');
});

test('classifyBlockHeading：只寫「參考資料」不是文末連結區塊', () => {
  assert.equal(classifyBlockHeading('參考資料'), null);
});

test('headingText：去掉粗體、行內程式碼、連結語法與結尾井號', () => {
  assert.equal(headingText('**n8n** `節點` [常見問題](https://example.com) ##'), 'n8n 節點 常見問題');
});

test('checkPostStructure：三種區塊都照約定寫的文章沒有違規', () => {
  const markdown = [
    '## 前言',
    '',
    '內文',
    '',
    '## 故障排除：連線逾時',
    '',
    '**先檢查這個**',
    '',
    '## 常見問題',
    '',
    '引言',
    '',
    '### 第一題？',
    '',
    '答案',
    '',
    `## ${LINKS_HEADING}`,
    '',
    '- [來源](https://example.com)',
  ].join('\n');
  assert.deepEqual(checkPostStructure(markdown), []);
});

test('checkPostStructure：常見問題區塊內沒有 h3 回報 E1，行號指向該 h2', () => {
  const markdown = ['## 前言', '', '## 常見問題', '', '- 第一題？', '', '答案'].join('\n');
  assert.deepEqual(checkPostStructure(markdown), [
    {
      rule: 'E1',
      line: 3,
      heading: '常見問題',
      message: '常見問題區塊內沒有任何「### 題目」',
    },
  ]);
});

test('checkPostStructure：常見問題區塊內整段粗體的段落回報 E2', () => {
  const markdown = ['## 常見問題', '', '### 第一題？', '', '答案', '', '**Q2：第二題？**', '', '答案'].join('\n');
  assert.deepEqual(checkPostStructure(markdown), [
    {
      rule: 'E2',
      line: 7,
      heading: '常見問題',
      message: '題目要寫成「### 題目」，不寫整段粗體',
    },
  ]);
});

test('checkPostStructure：常見問題區塊內的收尾型 h3 回報 E3', () => {
  const markdown = ['## 常見問題', '', '### 第一題？', '', '答案', '', '### 總結與下一步', '', '內文'].join('\n');
  assert.deepEqual(rules(markdown), ['E3']);
});

test('checkPostStructure：h2 寫成「常見問答」回報 E4', () => {
  assert.deepEqual(rules('## 常見問答\n\n### 第一題？\n\n答案'), ['E4']);
});

test('checkPostStructure：h2 只寫 FAQ 而沒有「常見問題」回報 E4', () => {
  assert.deepEqual(rules('## FAQ\n\n### 第一題？\n\n答案'), ['E4']);
});

test('checkPostStructure：h2 以「疑難排解」開頭回報 E4', () => {
  assert.deepEqual(rules('## 疑難排解：連線逾時\n\n內文'), ['E4']);
});

test('checkPostStructure：第二個常見問題區塊回報 E5', () => {
  const markdown = ['## 常見問題', '', '### 第一題？', '', '答案', '', '## 進階常見問題', '', '### 第二題？', '', '答案'].join('\n');
  assert.deepEqual(rules(markdown), ['E5']);
});

test('checkPostStructure：文末連結用了別名標題回報 E6', () => {
  assert.deepEqual(rules('## 延伸閱讀\n\n- [文章](/post/)'), ['E6']);
});

test('checkPostStructure：文末連結標題出現第二次回報 E6', () => {
  const markdown = [`## ${LINKS_HEADING}`, '', '- [甲](/a/)', '', `## ${LINKS_HEADING}`, '', '- [乙](/b/)'].join('\n');
  assert.deepEqual(rules(markdown), ['E6']);
});

test('checkPostStructure：程式碼區塊裡的 h2 與粗體行不列入檢查', () => {
  const markdown = ['## 常見問題', '', '### 第一題？', '', '```markdown', '## 常見問答', '**Q1：範例**', '```'].join('\n');
  assert.deepEqual(checkPostStructure(markdown), []);
});

test('checkPostStructure：故障排除區塊內的整段粗體不算違規', () => {
  assert.deepEqual(checkPostStructure('## 故障排除指南\n\n**問題一：連不上**\n\n處置'), []);
});

test('checkPostStructure：h3 層級寫「常見問題」不構成常見問題區塊', () => {
  assert.deepEqual(checkPostStructure('## 原因分析\n\n### 常見問題：為什麼會這樣？\n\n**粗體段落**'), []);
});
