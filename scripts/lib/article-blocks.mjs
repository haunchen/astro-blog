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

/**
 * 檢查一篇文章的 markdown 正文，回傳違規清單（空陣列＝合規）。
 * @param {string} markdown 不含 frontmatter 的正文
 * @returns {Array<{rule: string, line: number, heading: string, message: string}>}
 */
export function checkPostStructure(markdown) {
  const lines = markdown.split(/\r?\n/);
  const violations = [];
  let fence = null;
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

  lines.forEach((line, index) => {
    const lineNo = index + 1;
    const fenceMatch = line.match(/^\s*(```+|~~~+)/);
    if (fenceMatch) {
      const marker = fenceMatch[1][0];
      if (fence === null) fence = marker;
      else if (fence === marker) fence = null;
      return;
    }
    if (fence !== null) return;

    const h2 = line.match(/^##\s+(.+)$/);
    if (h2) {
      closeFaq();
      const heading = headingText(h2[1]);
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
      return;
    }

    if (!faq) return;

    const h3 = line.match(/^###\s+(.+)$/);
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
      return;
    }

    if (/^\*\*[^*]+\*\*\s*$/.test(line)) {
      violations.push({
        rule: 'E2',
        line: lineNo,
        heading: faq.heading,
        message: '題目要寫成「### 題目」，不寫整段粗體',
      });
    }
  });

  closeFaq();
  return violations;
}
