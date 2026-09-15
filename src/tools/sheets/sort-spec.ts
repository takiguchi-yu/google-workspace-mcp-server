import type { sheets_v4 } from 'googleapis';
import { columnLettersOf, toColumnIndex } from './grid-range.js';

/**
 * ツール引数の並べ替え指定を、Sheets API の SortSpec に組み立てる。
 *
 * 範囲の並べ替え（`sortRange`）とフィルタの既定の並び（`setBasicFilter`）が同じ形を使う。
 * 対象の列は A1 記法の列の記号で受け、**シート上の絶対の列番号**に変換する。
 * GridRange の中での相対位置ではない。
 */

/** 並べ替えの向きとして受け付ける値 */
export const SORT_ORDERS = ['ASCENDING', 'DESCENDING'] as const;

/** 並べ替えのキー 1 つぶんのスキーマ。ツール定義から参照する */
export const sortSpecSchema = {
  type: 'object',
  properties: {
    column: {
      type: 'string',
      description: 'The column to sort by, as an A1 column letter (e.g., "B"). Must be a column of the sheet.',
    },
    order: {
      type: 'string',
      description: 'The sort direction. Defaults to ASCENDING.',
      enum: [...SORT_ORDERS],
      default: 'ASCENDING',
    },
  },
  required: ['column'],
} as const;

/**
 * 並べ替え指定の配列を SortSpec の配列に変換する。
 *
 * @param value ツール引数として受け取った並べ替え指定の配列
 * @param name エラー文面に出す引数名
 * @throws 配列でない、空、列の記号として解釈できない、向きが列挙にない場合
 */
export const toSortSpecs = (value: unknown, name: string): sheets_v4.Schema$SortSpec[] => {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${name} は 1 つ以上の { column, order } を持つ配列で指定してください。`);
  }

  return value.map((entry, index) => {
    if (typeof entry !== 'object' || entry === null) {
      throw new Error(`${name}[${String(index)}] は { column, order } のオブジェクトで指定してください。`);
    }

    const { column, order } = entry as Record<string, unknown>;
    const sortOrder = order === undefined ? 'ASCENDING' : order;

    if (typeof sortOrder !== 'string' || !(SORT_ORDERS as readonly string[]).includes(sortOrder)) {
      throw new Error(
        `${name}[${String(index)}].order は ${SORT_ORDERS.join(' / ')} のいずれかで指定してください（受け取った値: ${String(order)}）。`,
      );
    }

    return {
      dimensionIndex: toColumnIndex(column, `${name}[${String(index)}].column`),
      sortOrder,
    };
  });
};

/**
 * 組み立てた SortSpec を、実行結果の文面に出せる形に戻す。
 *
 * @param specs `toSortSpecs` が返した並べ替え仕様
 */
export const describeSortSpecs = (specs: readonly sheets_v4.Schema$SortSpec[]): string =>
  specs
    .map(
      (spec) => `${columnLettersOf(spec.dimensionIndex ?? 0)} 列 ${spec.sortOrder === 'DESCENDING' ? '降順' : '昇順'}`,
    )
    .join(' → ');
