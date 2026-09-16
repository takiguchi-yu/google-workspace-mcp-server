/**
 * A1 記法の範囲を、Sheets API が書式のリクエストで要求する行列番号に変換する。
 *
 * 書式のリクエストは範囲を GridRange（0 始まり・終端は含まない行列番号）で受け取るが、
 * ツールの引数はすべて A1 記法に統一しているため、この橋渡しが要る。
 * API の呼び出しも sheetId の解決も持ち込まない。
 *
 * 列の記号と番号の対応は Slides の表の範囲とも共用するので shared に置いてある。
 * 呼び出し元がそのまま使えるよう、ここから再輸出する。
 */

import { cellReferenceOf } from './a1-range.js';
import { columnIndexOf, columnLettersOf } from '../shared/column-letters.js';

// 列の記号の変換は Slides の表とも共用するため shared に置いた。
// 既存の呼び出し元がそのまま使えるよう、ここから再輸出する
export { columnIndexOf, columnLettersOf };

/**
 * GridRange のうち、A1 記法だけから決まる部分。
 *
 * 列だけ・行だけを指した範囲（`B:D` や `2:5`）では、指定されなかった側のキーが落ちる。
 * Sheets API はキーの無い辺を「シートの端まで」と解釈する。
 */
export interface GridIndexes {
  startRowIndex?: number;
  endRowIndex?: number;
  startColumnIndex?: number;
  endColumnIndex?: number;
}

/** `A1` / `B` / `10` のいずれか。列は最大 3 文字（Sheets の最終列は ZZZ） */
const CELL_PATTERN = /^([A-Za-z]{1,3})?([0-9]+)?$/;

/**
 * A1 記法の範囲を行列番号に変換する。シート名は付いていてもよく、付いていれば無視する。
 *
 * `A1:D10` のような両端指定のほか、`B:D`（列だけ）、`2:5`（行だけ）、`A1`（単一セル）、
 * シート名だけの指定（シート全体）を受ける。`D10:A1` のように逆順で書かれていても正しい向きに直す。
 *
 * @param range A1 記法の範囲
 * @throws 範囲として解釈できない文字列を渡した場合
 */
export const toGridIndexes = (range: string): GridIndexes => {
  const cellReference = cellReferenceOf(range);

  if (cellReference === '') {
    return {};
  }

  try {
    const [start, end] = splitCells(cellReference, range);
    const from = parseCell(start, range);
    const to = parseCell(end, range);

    return {
      ...span('startRowIndex', 'endRowIndex', from.row, to.row),
      ...span('startColumnIndex', 'endColumnIndex', from.column, to.column),
    };
  } catch (error) {
    // `!` が無い範囲は仕様上シート名を含まない。シート名だけを渡した取り違えがよく起きるので名指しする
    if (!range.includes('!')) {
      throw new Error(
        `範囲を解釈できません: ${range}\nシート全体を指すときは "${range}!A:ZZZ" のようにシート名の後ろに ! を付けてください。`,
        { cause: error },
      );
    }

    throw error;
  }
};

/** 範囲を始点と終点に分ける。`:` が無ければ単一セルとして同じ値を両端に置く */
const splitCells = (cellReference: string, range: string): [string, string] => {
  const parts = cellReference.split(':');

  if (parts.length === 1) {
    return [parts[0]!, parts[0]!];
  }
  if (parts.length === 2) {
    return [parts[0]!, parts[1]!];
  }

  throw new Error(`範囲を解釈できません: ${range}`);
};

/** `A1` 形式のセルを 0 始まりの行番号・列番号に分解する。欠けている側は undefined */
const parseCell = (cell: string, range: string): { row?: number; column?: number } => {
  const matched = CELL_PATTERN.exec(cell.trim());

  if (matched === null || (matched[1] === undefined && matched[2] === undefined)) {
    throw new Error(`範囲を解釈できません: ${range}`);
  }

  return {
    ...(matched[2] !== undefined && { row: Number(matched[2]) - 1 }),
    ...(matched[1] !== undefined && { column: columnIndexOf(matched[1]) }),
  };
};

/**
 * 両端から GridRange の 1 辺ぶんのキーを組み立てる。
 *
 * 片側しか分からない範囲（`A1:D` は行の終端が無い）では、分かっている側のキーだけを返す。
 * Sheets API はキーの無い辺をシートの端として扱う。終端は含まないので +1 する。
 */
const span = (
  startKey: 'startRowIndex' | 'startColumnIndex',
  endKey: 'endRowIndex' | 'endColumnIndex',
  from: number | undefined,
  to: number | undefined,
): GridIndexes => {
  if (from !== undefined && to !== undefined) {
    return { [startKey]: Math.min(from, to), [endKey]: Math.max(from, to) + 1 };
  }
  if (from !== undefined) {
    return { [startKey]: from };
  }
  if (to !== undefined) {
    return { [endKey]: to + 1 };
  }

  return {};
};

/**
 * 行列番号を A1 記法に戻す。利用者に範囲を見せるときに使う。
 *
 * 行または列のキーが無い範囲は `B:D` や `2:5` になり、どちらも無ければシート全体として
 * シート名だけを返す。
 *
 * @param indexes GridRange の行列番号
 * @param sheetTitle 付けるシート名。省略すると範囲だけを返す
 */
export const toA1Range = (indexes: GridIndexes, sheetTitle?: string): string => {
  const { startRowIndex, endRowIndex, startColumnIndex, endColumnIndex } = indexes;
  const prefix = sheetTitle === undefined ? '' : `${quoteSheetTitle(sheetTitle)}!`;

  const startColumn = startColumnIndex === undefined ? '' : columnLettersOf(startColumnIndex);
  const endColumn = endColumnIndex === undefined ? '' : columnLettersOf(endColumnIndex - 1);
  const startRow = startRowIndex === undefined ? '' : String(startRowIndex + 1);
  const endRow = endRowIndex === undefined ? '' : String(endRowIndex);

  if (startColumn === '' && endColumn === '' && startRow === '' && endRow === '') {
    return sheetTitle === undefined ? '' : quoteSheetTitle(sheetTitle);
  }

  return `${prefix}${startColumn}${startRow}:${endColumn}${endRow}`;
};

/** シート名を A1 記法に埋め込める形にする。記号を含む名前はクォートして `'` を重ねる */
const quoteSheetTitle = (title: string): string =>
  /^[A-Za-z_][A-Za-z0-9_]*$/.test(title) ? title : `'${title.replaceAll("'", "''")}'`;

/** 列の記号として受け付ける形。Sheets の最終列は ZZZ なので最大 3 文字 */
const COLUMN_LETTERS_PATTERN = /^[A-Za-z]{1,3}$/;

/**
 * 列の記号だけを受け取って 0 始まりの列番号に変換する。並べ替えやフィルタの対象列を
 * A1 記法の列（`B`、`AA`）で受けるために使う。
 *
 * @param value ツール引数として受け取った値
 * @param name エラー文面に出す引数名
 * @throws 列の記号として解釈できない値を渡した場合
 */
export const toColumnIndex = (value: unknown, name: string): number => {
  if (typeof value !== 'string' || !COLUMN_LETTERS_PATTERN.test(value.trim())) {
    throw new Error(`${name} は列の記号で指定してください（例: "A", "B", "AA"）。受け取った値: ${String(value)}`);
  }

  return columnIndexOf(value.trim());
};
