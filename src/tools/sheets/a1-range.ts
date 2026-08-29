/**
 * A1 記法の範囲を読むためのヘルパー。
 *
 * Sheets API の範囲は `'シート名'!K186:N602` / `K186:N602` / `Sheet1!A:C` のように
 * 表記の揺れが大きい。ここでは「その範囲がシートの何行目から始まるか」だけを扱う。
 */

/**
 * A1 記法のセル参照。
 * 列は最大 3 文字（Sheets の最終列は ZZZ）なので、シート名との取り違えを防ぐために長さを制限する。
 */
const CELL_REFERENCE_PATTERN = /^(?:[A-Za-z]{1,3})?([0-9]+)?$/;

/**
 * 範囲がシートの何行目から始まるかを返す。
 *
 * 開始行を特定できない場合（列だけの指定、シート名だけの指定、解釈できない文字列）は
 * シートの先頭から読まれたものとみなして 1 を返す。
 *
 * @param range A1 記法の範囲。`spreadsheets.values.get` のレスポンスの `range` を渡すのが最も確実
 */
export const startRowOf = (range: string | null | undefined): number => {
  if (typeof range !== 'string') {
    return 1;
  }

  const cellReference = stripSheetName(range.trim());
  const startCell = cellReference.split(':')[0] ?? '';
  const row = CELL_REFERENCE_PATTERN.exec(startCell)?.[1];

  return row === undefined ? 1 : Number(row);
};

/**
 * 範囲からシート名の部分を取り除き、セル参照の部分だけを返す。
 * シート名がクォートされている場合は、名前に含まれる `!` や `''`（エスケープされた `'`）を考慮する。
 */
const stripSheetName = (range: string): string => {
  if (range.startsWith("'")) {
    const closingQuote = findClosingQuote(range);
    if (closingQuote === -1) {
      return '';
    }
    const rest = range.slice(closingQuote + 1);
    return rest.startsWith('!') ? rest.slice(1) : '';
  }

  const separator = range.indexOf('!');
  return separator === -1 ? range : range.slice(separator + 1);
};

/** クォートされたシート名の閉じクォートの位置を返す。見つからなければ -1 */
const findClosingQuote = (range: string): number => {
  for (let i = 1; i < range.length; i++) {
    if (range[i] !== "'") {
      continue;
    }
    // `''` はシート名に含まれる `'` のエスケープなので閉じクォートではない
    if (range[i + 1] === "'") {
      i++;
      continue;
    }
    return i;
  }

  return -1;
};
