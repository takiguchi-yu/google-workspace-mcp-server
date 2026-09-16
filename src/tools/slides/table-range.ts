import type { slides_v1 } from 'googleapis';
import { columnIndexOf, columnLettersOf } from '../shared/column-letters.js';

/**
 * 表の中の長方形を A1 記法で受け取り、Slides API の TableRange に直すヘルパー。
 *
 * Sheets の書式ツールが範囲を A1 記法に統一しているのに合わせた（ADR 0001）。
 * ただし Slides の TableRange は「始点 + 行数・列数」で、**span は必ず正の数**でなければ
 * ならない（省略も 0 も API に拒否される）。`A:C` のように端が開いた範囲を受けるには
 * 表の行数・列数が要るため、変換には表の大きさを渡す。
 */

/** 表の大きさ。presentation-lookup.ts が API から引く */
export interface TableSize {
  readonly rows: number;
  readonly columns: number;
}

/** `A1` / `B` / `10` のいずれか。列は最大 3 文字 */
const CELL_PATTERN = /^([A-Za-z]{1,3})?([0-9]+)?$/;

/**
 * A1 記法の範囲を TableRange に直す。
 *
 * `A1:C2`（長方形）、`B2`（1 セル）、`A:C`（列ぜんぶ）、`2:3`（行ぜんぶ）を受ける。
 * 端が開いている側は表の端で閉じる。`C1:A2` のように逆順で書かれていても正しい向きに直す。
 *
 * @param range A1 記法の範囲
 * @param size 対象の表の行数・列数
 * @param name エラー文面に出す引数名
 * @throws 範囲として解釈できない、または表からはみ出す場合
 */
export const toTableRange = (range: unknown, size: TableSize, name: string): slides_v1.Schema$TableRange => {
  if (typeof range !== 'string' || range.trim() === '') {
    throw new Error(`${name} は "A1:C2" のような A1 記法で指定してください。`);
  }

  const cells = range.trim().split(':');

  if (cells.length > 2) {
    throw new Error(`${name} を解釈できません: ${range}`);
  }

  const from = parseCell(cells[0] ?? '', range, name);
  const to = parseCell(cells[1] ?? cells[0] ?? '', range, name);

  const rows = closed(from.row, to.row, size.rows);
  const columns = closed(from.column, to.column, size.columns);

  if (rows.start >= size.rows || columns.start >= size.columns) {
    throw new Error(
      `${name} が表の外を指しています: ${range}（この表は ${String(size.rows)} 行 × ${String(size.columns)} 列）。`,
    );
  }

  return {
    location: { rowIndex: rows.start, columnIndex: columns.start },
    rowSpan: Math.min(rows.end, size.rows - 1) - rows.start + 1,
    columnSpan: Math.min(columns.end, size.columns - 1) - columns.start + 1,
  };
};

/**
 * 表ぜんぶを指す TableRange を作る。範囲を省略されたときに使う。
 *
 * @param size 対象の表の行数・列数
 */
export const wholeTable = (size: TableSize): slides_v1.Schema$TableRange => ({
  location: { rowIndex: 0, columnIndex: 0 },
  rowSpan: size.rows,
  columnSpan: size.columns,
});

/** TableRange を人が読める A1 記法に戻す。実行結果の文面に出す */
export const describeTableRange = (tableRange: slides_v1.Schema$TableRange): string => {
  const rowIndex = tableRange.location?.rowIndex ?? 0;
  const columnIndex = tableRange.location?.columnIndex ?? 0;
  const lastRow = rowIndex + (tableRange.rowSpan ?? 1) - 1;
  const lastColumn = columnIndex + (tableRange.columnSpan ?? 1) - 1;
  const start = `${columnLettersOf(columnIndex)}${String(rowIndex + 1)}`;

  return rowIndex === lastRow && columnIndex === lastColumn
    ? start
    : `${start}:${columnLettersOf(lastColumn)}${String(lastRow + 1)}`;
};

/**
 * `A1` 形式のセルを 0 始まりの行番号・列番号に分解する。欠けている側は undefined。
 *
 * 行番号は 1 始まりで受ける。`A0` を通すと始点が -1 になり、API には
 * 「表の外」ではなく不正な値として届くので、ここで弾く。
 */
const parseCell = (cell: string, range: string, name: string): { row?: number; column?: number } => {
  const matched = CELL_PATTERN.exec(cell.trim());

  if (matched === null || (matched[1] === undefined && matched[2] === undefined)) {
    throw new Error(`${name} を解釈できません: ${range}`);
  }

  const row = matched[2] === undefined ? undefined : Number(matched[2]) - 1;

  if (row !== undefined && row < 0) {
    throw new Error(`${name} を解釈できません: ${range}（行番号は 1 から数えます）。`);
  }

  return {
    ...(row !== undefined && { row }),
    ...(matched[1] !== undefined && { column: columnIndexOf(matched[1]) }),
  };
};

/**
 * 端が開いている側を表の端で閉じ、始点と終点を小さい順に並べる。
 *
 * 両端とも欠けている（`A:C` の行、`2:3` の列）ときは 0 から最後までを指す。
 */
const closed = (from: number | undefined, to: number | undefined, count: number): { start: number; end: number } => {
  if (from === undefined && to === undefined) {
    return { start: 0, end: count - 1 };
  }

  const first = from ?? 0;
  const second = to ?? count - 1;

  return { start: Math.min(first, second), end: Math.max(first, second) };
};
