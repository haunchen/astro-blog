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

test('checkPostStructure：四反引號圍欄內的三反引號行不會關閉圍欄', () => {
  const markdown = ['## 常見問題', '', '````markdown', '```js', '## 常見問答', '```', '**Q1**', '````', '', '### 題目？'].join('\n');
  assert.deepEqual(checkPostStructure(markdown), []);
});

test('checkPostStructure：~~~ 圍欄內的 h2 不列入檢查', () => {
  assert.deepEqual(checkPostStructure(['~~~', '## 常見問答', '~~~'].join('\n')), []);
});

test('checkPostStructure：圍欄內帶語言名稱的三反引號行不會關閉圍欄', () => {
  assert.deepEqual(checkPostStructure(['```', '```js', '## 常見問答', '```'].join('\n')), []);
});

test('checkPostStructure：行首三反引號的行內程式碼不開啟圍欄', () => {
  assert.deepEqual(rules(['```js``` 是行內程式碼', '', '## 常見問答'].join('\n')), ['E4']);
});

test('checkPostStructure：前置三個空白的「常見問答」h2 回報 E4', () => {
  assert.deepEqual(rules('   ## 常見問答\n\n### 第一題？\n\n答案'), ['E4']);
});

test('checkPostStructure：底線式的「常見問答」h2 回報 E4，行號指向標題行', () => {
  const markdown = ['內文', '', '常見問答', '---', '', '### 第一題？', '', '答案'].join('\n');
  assert.deepEqual(checkPostStructure(markdown), [
    {
      rule: 'E4',
      line: 3,
      heading: '常見問答',
      message: '區塊標題用了別名：問答用「常見問題」，排錯章節以「故障排除」開頭',
    },
  ]);
});

test('checkPostStructure：空白行之後的 --- 是分隔線，不把前面的內容當標題', () => {
  assert.deepEqual(checkPostStructure(['常見問答', '', '---'].join('\n')), []);
});

test('checkPostStructure：清單項目下一行的 --- 不當成標題', () => {
  assert.deepEqual(checkPostStructure(['- 常見問答', '---'].join('\n')), []);
});

test('checkPostStructure：清單項目延續行的下一行 --- 不當成標題', () => {
  assert.deepEqual(checkPostStructure(['- 項目', '常見問答', '---'].join('\n')), []);
});

test('checkPostStructure：連續兩行分隔線不把第一行當標題', () => {
  const markdown = ['## 常見問題', '', '### 第一題？', '', '---', '---', '', '**Q2：第二題？**'].join('\n');
  assert.deepEqual(rules(markdown), ['E2']);
});

test('checkPostStructure：常見問題區塊內以整段粗體寫的底線式 h2 不回報 E2', () => {
  const markdown = ['## 常見問題', '', '### 第一題？', '', '答案', '', '**下一節**', '---'].join('\n');
  assert.deepEqual(checkPostStructure(markdown), []);
});

test('checkPostStructure：底線式 h2 結束沒有 h3 的常見問題區塊並回報 E1', () => {
  const markdown = ['## 常見問題', '', '- 第一題？', '', '下一節', '---', '', '### 小節'].join('\n');
  assert.deepEqual(rules(markdown), ['E1']);
});

test('checkPostStructure：常見問題區塊之後的底線式 h2 是第二個常見問題區塊時回報 E5', () => {
  const markdown = ['## 常見問題', '', '### 第一題？', '', '答案', '', '進階常見問題', '---', '', '### 第二題？'].join('\n');
  assert.deepEqual(rules(markdown), ['E5']);
});

test('checkPostStructure：沒有 h3 的常見問題區塊後面接別的 h2 仍回報 E1', () => {
  const markdown = ['## 常見問題', '', '- 第一題？', '', '## 下一節', '', '### 小節', '', '內文'].join('\n');
  assert.deepEqual(rules(markdown), ['E1']);
});

test('checkPostStructure：常見問題區塊之後那一節的整段粗體不回報 E2', () => {
  const markdown = ['## 常見問題', '', '### 第一題？', '', '答案', '', '## 下一節', '', '**粗體段落**'].join('\n');
  assert.deepEqual(checkPostStructure(markdown), []);
});

test('checkPostStructure：違規依行號由小到大排列', () => {
  const markdown = ['## 常見問題', '', '**Q1：第一題？**', '', '答案'].join('\n');
  assert.deepEqual(checkPostStructure(markdown), [
    {
      rule: 'E1',
      line: 1,
      heading: '常見問題',
      message: '常見問題區塊內沒有任何「### 題目」',
    },
    {
      rule: 'E2',
      line: 3,
      heading: '常見問題',
      message: '題目要寫成「### 題目」，不寫整段粗體',
    },
  ]);
});

test('checkPostStructure：~~~ 圍欄內的三反引號行不會關閉圍欄', () => {
  assert.deepEqual(checkPostStructure(['~~~', '```', '## 常見問答', '~~~'].join('\n')), []);
});

test('checkPostStructure：前置四個空白的三反引號行不開啟圍欄', () => {
  assert.deepEqual(rules(['    ```', '## 常見問答'].join('\n')), ['E4']);
});

test('checkPostStructure：前置四個空白的三反引號行不會關閉圍欄', () => {
  assert.deepEqual(checkPostStructure(['```', '    ```', '## 常見問答', '```'].join('\n')), []);
});

test('checkPostStructure：常見問題區塊內前置三個空白的 h3 算一題', () => {
  assert.deepEqual(checkPostStructure(['## 常見問題', '', '   ### 第一題？', '', '答案'].join('\n')), []);
});

test('checkPostStructure：h3 的下一行 --- 不把 h3 當成 h2', () => {
  assert.deepEqual(checkPostStructure(['## 常見問題', '', '### 第一題？', '---'].join('\n')), []);
});

test('checkPostStructure：前置四個空白的行下一行接 --- 不當成標題', () => {
  assert.deepEqual(checkPostStructure(['    常見問答', '---'].join('\n')), []);
});

test('checkPostStructure：清單項目內縮排的段落下一行接頂格 --- 不當成標題', () => {
  assert.deepEqual(checkPostStructure(['- 項目', '', '  常見問答', '---'].join('\n')), []);
});

test('checkPostStructure：HTML 區塊開頭的行下一行接 --- 不當成標題', () => {
  assert.deepEqual(checkPostStructure(['<div>常見問答', '---'].join('\n')), []);
});

test('checkPostStructure：引用區塊下一行的 --- 不當成標題', () => {
  assert.deepEqual(checkPostStructure(['> 常見問答', '---'].join('\n')), []);
});

test('checkPostStructure：數字清單項目下一行的 --- 不當成標題', () => {
  assert.deepEqual(checkPostStructure(['1. 常見問答', '---'].join('\n')), []);
});

test('checkPostStructure：連結參照定義下一行的 --- 不當成標題', () => {
  assert.deepEqual(checkPostStructure(['[常見問答]: /x', '---'].join('\n')), []);
});

test('checkPostStructure：註腳定義下一行的 --- 不當成標題', () => {
  assert.deepEqual(checkPostStructure(['正文[^1]', '', '[^1]: 常見問答', '---'].join('\n')), []);
});

test('checkPostStructure：常見問題區塊內的連結參照定義接 --- 不結束區塊', () => {
  assert.deepEqual(
    rules(['## 常見問題', '', '### 題？', '', '[x]: /url', '---', '', '**Q2**'].join('\n')),
    ['E2'],
  );
});

test('checkPostStructure：以 | 開頭的單行段落接 --- 是標題', () => {
  assert.deepEqual(
    checkPostStructure(['| 常見問答 |', '---'].join('\n')).map((v) => [v.rule, v.line]),
    [['E4', 1]],
  );
});
