import type { slides_v1 } from 'googleapis';

/**
 * 表の中身を 2 次元配列で受け取るためのヘルパー。
 *
 * 行数と列数は中身から決める。呼ぶ側が行数・列数と中身を別々に渡すと食い違いが起きるため、
 * 数えるのはサーバーの仕事にしてある。
 */

/** 行数・列数を決めたあとの表。cells は必ず rows × columns の長方形になる */
export interface TableGrid {
  readonly rows: number;
  readonly columns: number;
  readonly cells: readonly (readonly string[])[];
}

/**
 * 2 次元配列を表の中身に直す。
 *
 * 行ごとに長さが違うときは、いちばん長い行に合わせて空文字で埋める。
 *
 * @param value ツール引数として受け取った値
 * @param name エラー文面に出す引数名
 * @throws 配列でない、空、行が配列でない、文字列以外が混ざっている場合
 */
export const toTableGrid = (value: unknown, name: string): TableGrid => {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${name} は 1 行以上の配列の配列で指定してください（例: [["見出し1","見出し2"],["値1","値2"]]）。`);
  }

  const rows = value.map((row, rowIndex) => {
    if (!Array.isArray(row)) {
      throw new Error(`${name}[${String(rowIndex)}] は 1 行ぶんのセルの配列で指定してください。`);
    }

    return row.map((cell, columnIndex) => {
      if (typeof cell !== 'string') {
        throw new Error(`${name}[${String(rowIndex)}][${String(columnIndex)}] は文字列で指定してください。`);
      }

      return cell;
    });
  });

  const columns = Math.max(...rows.map((row) => row.length));

  if (columns === 0) {
    throw new Error(`${name} に空の行しかありません。1 列以上のセルを指定してください。`);
  }

  return {
    rows: rows.length,
    columns,
    cells: rows.map((row) => [...row, ...Array.from({ length: columns - row.length }, () => '')]),
  };
};

/**
 * 表のセルを埋める insertText のリクエストを組み立てる。
 *
 * 空のセルには insertText を送らない。API は空文字を受け付けないうえ、
 * 送る必要のないリクエストで 1 回の batchUpdate が膨らむため。
 *
 * @param objectId 表の objectId
 * @param grid 行数・列数を決めたあとの表
 */
export const toCellTextRequests = (objectId: string, grid: TableGrid): slides_v1.Schema$Request[] =>
  grid.cells.flatMap((row, rowIndex) =>
    row.flatMap((text, columnIndex) =>
      text === '' ? [] : [{ insertText: { objectId, cellLocation: { rowIndex, columnIndex }, text } }],
    ),
  );
