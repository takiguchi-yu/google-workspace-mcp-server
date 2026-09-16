import { pickEnum } from './enum-argument.js';
import type { TableSize } from './table-range.js';
import { columnIndexOf } from '../shared/column-letters.js';

/**
 * 表の「行か列か」と「何番目か」を受け取るためのヘルパー。
 *
 * 向きの語は Sheets の `sheets_insert_dimension` / `sheets_delete_dimension` と同じ
 * ROWS / COLUMNS に揃える。位置は A1 記法と同じ数え方で受け、行は 1 から、列は A から。
 * 0 始まりの番号はツール引数に出さない（CONTEXT.md の「範囲」）。
 */

/** 行か列か。Sheets の dimension と同じ語 */
export const DIMENSIONS = ['ROWS', 'COLUMNS'] as const;

/** 行か列かの引数スキーマ。ツール定義から展開して使う */
export const dimensionSchema = {
  dimension: {
    type: 'string',
    description: 'Whether the operation works on rows or columns.',
    enum: [...DIMENSIONS],
  },
  at: {
    type: 'string',
    description:
      'Which row or column, counted the way A1 notation does: "1" is the first row, "A" is the first column. For ROWS give a number, for COLUMNS give a letter.',
  },
} as const;

/**
 * 向きの引数を読む。
 *
 * @param value ツール引数として受け取った値
 * @throws 列挙に無い値を渡した場合
 */
export const toDimension = (value: unknown): 'ROWS' | 'COLUMNS' => pickEnum(value, DIMENSIONS, 'dimension');

/**
 * 位置の引数を 0 始まりの番号に直す。
 *
 * 行なら `"2"` を 1 に、列なら `"B"` を 1 にする。表の中に収まっているかも確かめる。
 *
 * @param value ツール引数として受け取った値
 * @param dimension 行か列か
 * @param size 対象の表の行数・列数
 * @param name エラー文面に出す引数名
 * @throws 読めない、または表の外を指す場合
 */
export const toDimensionIndex = (
  value: unknown,
  dimension: 'ROWS' | 'COLUMNS',
  size: TableSize,
  name: string,
): number => {
  if (typeof value !== 'string') {
    throw new Error(
      dimension === 'ROWS'
        ? `${name} は行番号で指定してください（1 が最初の行）。`
        : `${name} は列の記号で指定してください（A が最初の列）。`,
    );
  }

  const text = value.trim();
  const index = dimension === 'ROWS' ? rowIndexOf(text, name) : letterIndexOf(text, name);
  const count = dimension === 'ROWS' ? size.rows : size.columns;

  if (index < 0 || index >= count) {
    throw new Error(
      `${name} が表の外を指しています: ${text}（この表は ${String(size.rows)} 行 × ${String(size.columns)} 列）。`,
    );
  }

  return index;
};

/** `"2"` を 1 に直す。行番号は 1 から数える */
const rowIndexOf = (text: string, name: string): number => {
  if (!/^[0-9]+$/.test(text)) {
    throw new Error(`${name} は行番号で指定してください（1 が最初の行。受け取った値: ${text}）。`);
  }

  return Number(text) - 1;
};

/** `"B"` を 1 に直す。列は A から数える */
const letterIndexOf = (text: string, name: string): number => {
  if (!/^[A-Za-z]{1,3}$/.test(text)) {
    throw new Error(`${name} は列の記号で指定してください（A が最初の列。受け取った値: ${text}）。`);
  }

  return columnIndexOf(text);
};
