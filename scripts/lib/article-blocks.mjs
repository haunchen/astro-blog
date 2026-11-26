// scripts/lib/article-blocks.mjs
// 區塊標題的辨識與文章的結構檢查。rehype-article-blocks.mjs（頁面版型）與結構檢查共用
// classifyBlockHeading——兩邊各寫一套的話，會出現檢查放行、頁面卻沒套版型的情況。
// 零相依：這支會被 astro.config.mjs、sync-from-vault 與 pre-commit 三個入口載入。

export const LINKS_HEADING = '參考資料與延伸閱讀';

const LINKS_ALIAS_PREFIXES = ['參考資料', '參考資源', '延伸閱讀', '相關文章'];
const TROUBLESHOOTING_ALIAS_PREFIXES = ['疑難排解', '問題排解'];
const CLOSING_H3 = /總結|結語|下一步|學習路徑|延伸閱讀/;

/**
 * 判斷一個 h2 的文字屬於哪種區塊。
 * @param {string} text h2 的純文字（不含 markdown 記號）
 * @returns {'faq' | 'troubleshooting' | 'links' | null}
 */
export function classifyBlockHeading(text) {
  const t = text.trim();
  // 「常見問題」優先於「故障排除」：`常見問題與故障排除` 是常見問題區塊。
  if (t.includes('常見問題')) return 'faq';
  if (t.startsWith('故障排除')) return 'troubleshooting';
  if (t === LINKS_HEADING) return 'links';
  return null;
}

/** 把 markdown 標題行的內容還原成純文字，結果要與 rehype 端從 HTML 取出的文字一致。 */
export function headingText(raw) {
  return raw
    .replace(/\s+#+\s*$/, '')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_`]/g, '')
    .replace(/\\(.)/g, '$1')
    .trim();
}

// 標題與圍欄的判定照 CommonMark，結構檢查才會和頁面版型（從 HTML 認 h2）看到同一批 h2。
// 反引號圍欄的 info string 不得含反引號，否則那一行是行內程式碼。
const FENCE_OPEN = /^ {0,3}(?:(`{3,})[^`]*|(~{3,}).*)$/;
const FENCE_CLOSE = /^ {0,3}(`{3,}|~{3,})\s*$/;
const ATX_H2 = /^ {0,3}##\s+(.+)$/;
const ATX_H3 = /^ {0,3}###\s+(.+)$/;
const ATX_ANY = /^ {0,3}#{1,6}(?:\s|$)/;
const SETEXT_H2_UNDERLINE = /^ {0,3}-+\s*$/;
const THEMATIC_BREAK = /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/;
const LIST_ITEM = /^ {0,3}(?:[-*+]|\d{1,9}[.)])(?:\s|$)/;
const BLANK = /^\s*$/;

/** 關閉圍欄：同字元、長度不小於開頭、後面只有空白。 */
function closesFence(line, fence) {
  const m = line.match(FENCE_CLOSE);
  return m !== null && m[1][0] === fence.char && m[1].length >= fence.length;
}

/**
 * 第 index 行是不是底線式 h2 的標題行。
 *
 * 判定刻意比 CommonMark 窄，寧可漏檢也不把分隔線前的內容誤當標題、誤報違規：
 * - 只認單行段落：標題行的上一行必須是空白行或檔頭。多行段落接底線在 CommonMark 也是 h2，
 *   但要回頭找段落起點，還得分辨清單延續、引用區塊延續這類不算段落的行，這種寫法不處理。
 * - 標題行必須頂格。前置 1–3 個空白的行在清單項目後面是項目內容，項目內容接頂格的 --- 是分隔線。
 * - 以 `<` 開頭的行可能是 HTML 區塊，HTML 區塊接 --- 也是分隔線。
 * - 以 `[…]:` 開頭的行是連結參照定義或註腳定義（`[^n]:`），不是段落文字，下一行的 --- 是分隔線。
 * - 以 `>` 開頭的行（引用區塊）、清單項目、ATX 標題、分隔線本身都不是段落文字。
 */
function isSetextH2(lines, index) {
  const line = lines[index];
  const next = lines[index + 1];
  const prev = index === 0 ? '' : lines[index - 1];
  return (
    next !== undefined &&
    SETEXT_H2_UNDERLINE.test(next) &&
    BLANK.test(prev) &&
    /^\S/.test(line) &&
    !ATX_ANY.test(line) &&
    !THEMATIC_BREAK.test(line) &&
    !LIST_ITEM.test(line) &&
    !/^[<>]/.test(line) &&
    !/^\[[^\]]*\]:/.test(line)
  );
}

/**
 * 檢查一篇文章的 markdown 正文，回傳違規清單（空陣列＝合規），依行號由小到大排列。
 * @param {string} markdown 不含 frontmatter 的正文
 * @returns {Array<{rule: string, line: number, heading: string, message: string}>}
 */
export function checkPostStructure(markdown) {
  const lines = markdown.split(/\r?\n/);
  const violations = [];
  let fence = null; // 目前所在的圍欄：{ char, length }
  let faq = null; // 目前所在的常見問題區塊：{ line, heading, h3Count }
  let faqCount = 0;
  let linksCount = 0;

  const closeFaq = () => {
    if (faq && faq.h3Count === 0) {
      violations.push({
        rule: 'E1',
        line: faq.line,
        heading: faq.heading,
        message: '常見問題區塊內沒有任何「### 題目」',
      });
    }
    faq = null;
  };

  const onH2 = (heading, lineNo) => {
    closeFaq();
    const kind = classifyBlockHeading(heading);

    if (kind === 'faq') {
      faqCount += 1;
      if (faqCount > 1) {
        violations.push({
          rule: 'E5',
          line: lineNo,
          heading,
          message: '一篇文章只能有一個常見問題區塊',
        });
      }
      faq = { line: lineNo, heading, h3Count: 0 };
      return;
    }

    if (kind === 'links') {
      linksCount += 1;
      if (linksCount > 1) {
        violations.push({
          rule: 'E6',
          line: lineNo,
          heading,
          message: `「${LINKS_HEADING}」只能出現一次`,
        });
      }
      return;
    }

    if (
      heading.includes('常見問答') ||
      /FAQ/i.test(heading) ||
      /Q\s*[&＆]\s*A/i.test(heading) ||
      TROUBLESHOOTING_ALIAS_PREFIXES.some((p) => heading.startsWith(p))
    ) {
      violations.push({
        rule: 'E4',
        line: lineNo,
        heading,
        message: '區塊標題用了別名：問答用「常見問題」，排錯章節以「故障排除」開頭',
      });
    } else if (LINKS_ALIAS_PREFIXES.some((p) => heading.startsWith(p))) {
      violations.push({
        rule: 'E6',
        line: lineNo,
        heading,
        message: `文末連結的標題只能是「${LINKS_HEADING}」`,
      });
    }
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const lineNo = index + 1;

    if (fence !== null) {
      if (closesFence(line, fence)) fence = null;
      continue;
    }
    const fenceOpen = line.match(FENCE_OPEN);
    if (fenceOpen) {
      const marker = fenceOpen[1] ?? fenceOpen[2];
      fence = { char: marker[0], length: marker.length };
      continue;
    }

    const h2 = line.match(ATX_H2);
    if (h2) {
      onH2(headingText(h2[1]), lineNo);
      continue;
    }
    // 底線式 h2 在標題行就往下看一行判定，標題行不會先被當成一般行檢查；底線那行一併跳過。
    if (isSetextH2(lines, index)) {
      onH2(headingText(line), lineNo);
      index += 1;
      continue;
    }

    if (!faq) continue;

    const h3 = line.match(ATX_H3);
    if (h3) {
      faq.h3Count += 1;
      const text = headingText(h3[1]);
      if (CLOSING_H3.test(text)) {
        violations.push({
          rule: 'E3',
          line: lineNo,
          heading: faq.heading,
          message: `「${text}」不是題目，應升成 h2 移出常見問題區塊`,
        });
      }
      continue;
    }

    if (/^\*\*[^*]+\*\*\s*$/.test(line)) {
      violations.push({
        rule: 'E2',
        line: lineNo,
        heading: faq.heading,
        message: '題目要寫成「### 題目」，不寫整段粗體',
      });
    }
  }

  closeFaq();
  // E1 在區塊結束時才推入，排在節內的 E2、E3 之後；sort 是穩定排序，同一行的違規維持推入順序。
  return violations.sort((a, b) => a.line - b.line);
}
