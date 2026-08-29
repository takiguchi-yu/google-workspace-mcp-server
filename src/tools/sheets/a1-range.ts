/**
 * A1 記法の範囲を読むためのヘルパー。
 *
 * Sheets API の範囲は `'シート名'!K186:N602` / `K186:N602` / `Sheet1!A:C` のように
 * 表記の揺れが大きい。解析はこのモジュールの `splitRange` 1 箇所に閉じ、
 * 外へはシート名と開始行という「知りたいこと」だけを見せる。
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

  const { cellReference } = splitRange(range.trim());
  const startCell = cellReference.split(':')[0] ?? '';
  const row = CELL_REFERENCE_PATTERN.exec(startCell)?.[1];

  return row === undefined ? 1 : Number(row);
};

/**
 * 範囲が指しているシート名を返す。セル参照だけの範囲や、シート名を特定できない場合は null。
 *
 * @param range A1 記法の範囲
 */
export const sheetNameOf = (range: string | null | undefined): string | null => {
  if (typeof range !== 'string') {
    return null;
  }

  return splitRange(range.trim()).sheetName;
};

/**
 * 範囲をシート名の部分とセル参照の部分に分ける。
 *
 * シート名がクォートされている場合はクォートを外し、名前に含まれる `!` や
 * エスケープされた `''` を考慮する。シート名を特定できなければ sheetName は null。
 */
const splitRange = (range: string): { sheetName: string | null; cellReference: string } => {
  if (range.startsWith("'")) {
    const closingQuote = findClosingQuote(range);
    if (closingQuote === -1 || !range.slice(closingQuote + 1).startsWith('!')) {
      return { sheetName: null, cellReference: '' };
    }

    const quoted = range.slice(1, closingQuote);
    return {
      sheetName: quoted === '' ? null : quoted.replaceAll("''", "'"),
      cellReference: range.slice(closingQuote + 2),
    };
  }

  const separator = range.indexOf('!');
  if (separator === -1) {
    return { sheetName: null, cellReference: range };
  }

  return {
    sheetName: separator === 0 ? null : range.slice(0, separator),
    cellReference: range.slice(separator + 1),
  };
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
