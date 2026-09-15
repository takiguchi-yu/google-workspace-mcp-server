import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { toCellTextRequests, toTableGrid } from './table-grid.js';

describe('toTableGrid', () => {
  it('中身から行数と列数を数える', () => {
    const grid = toTableGrid(
      [
        ['名前', '担当'],
        ['設計', '田中'],
        ['実装', '佐藤'],
      ],
      'rows',
    );

    assert.equal(grid.rows, 3);
    assert.equal(grid.columns, 2);
  });

  it('短い行をいちばん長い行に合わせて空文字で埋める', () => {
    const grid = toTableGrid([['a', 'b', 'c'], ['d'], []], 'rows');

    assert.equal(grid.columns, 3);
    assert.deepEqual(grid.cells, [
      ['a', 'b', 'c'],
      ['d', '', ''],
      ['', '', ''],
    ]);
  });

  it('配列でない値と空の配列を弾く', () => {
    assert.throws(() => toTableGrid('a,b', 'rows'), /配列の配列で指定してください/);
    assert.throws(() => toTableGrid([], 'rows'), /配列の配列で指定してください/);
  });

  it('行が配列でない指定を弾く', () => {
    assert.throws(() => toTableGrid([['a'], 'b'], 'rows'), /rows\[1\] は 1 行ぶんのセルの配列/);
  });

  it('文字列でないセルを弾く', () => {
    assert.throws(() => toTableGrid([['a', 2]], 'rows'), /rows\[0\]\[1\] は文字列で指定してください/);
  });

  it('空の行しかない指定を弾く', () => {
    assert.throws(() => toTableGrid([[], []], 'rows'), /1 列以上のセルを指定してください/);
  });
});

describe('toCellTextRequests', () => {
  it('セルの位置を添えて insertText を組み立てる', () => {
    const grid = toTableGrid([['A1', 'B1']], 'rows');

    assert.deepEqual(toCellTextRequests('table_1', grid), [
      { insertText: { objectId: 'table_1', cellLocation: { rowIndex: 0, columnIndex: 0 }, text: 'A1' } },
      { insertText: { objectId: 'table_1', cellLocation: { rowIndex: 0, columnIndex: 1 }, text: 'B1' } },
    ]);
  });

  it('空のセルにはリクエストを作らない', () => {
    const grid = toTableGrid(
      [
        ['A1', ''],
        ['', 'B2'],
      ],
      'rows',
    );
    const requests = toCellTextRequests('table_1', grid);

    assert.equal(requests.length, 2);
    assert.equal(requests[1]?.insertText?.cellLocation?.rowIndex, 1);
    assert.equal(requests[1]?.insertText?.cellLocation?.columnIndex, 1);
  });
});
