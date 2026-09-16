import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DIMENSIONS, toDimension, toDimensionIndex } from './table-dimension.js';

const SIZE = { rows: 4, columns: 3 };

describe('toDimension', () => {
  it('Sheets と同じ語を受ける', () => {
    assert.deepEqual([...DIMENSIONS], ['ROWS', 'COLUMNS']);
    assert.equal(toDimension('ROWS'), 'ROWS');
    assert.equal(toDimension('COLUMNS'), 'COLUMNS');
  });

  it('列挙に無い値を弾く', () => {
    assert.throws(() => toDimension('ROW'), /dimension は ROWS \/ COLUMNS/);
    assert.throws(() => toDimension(undefined), /dimension は ROWS \/ COLUMNS/);
  });
});

describe('toDimensionIndex', () => {
  it('行番号を 0 始まりに直す', () => {
    assert.equal(toDimensionIndex('1', 'ROWS', SIZE, 'at'), 0);
    assert.equal(toDimensionIndex('4', 'ROWS', SIZE, 'at'), 3);
  });

  it('数値で渡された行番号は受けない（引数スキーマが文字列のため）', () => {
    assert.throws(() => toDimensionIndex(2, 'ROWS', SIZE, 'at'), /at は行番号で指定してください/);
  });

  it('列の記号を 0 始まりに直す', () => {
    assert.equal(toDimensionIndex('A', 'COLUMNS', SIZE, 'at'), 0);
    assert.equal(toDimensionIndex('c', 'COLUMNS', SIZE, 'at'), 2);
  });

  it('表の外を指す指定を弾く', () => {
    assert.throws(
      () => toDimensionIndex('5', 'ROWS', SIZE, 'at'),
      /at が表の外を指しています: 5（この表は 4 行 × 3 列）。/,
    );
    assert.throws(() => toDimensionIndex('D', 'COLUMNS', SIZE, 'at'), /表の外を指しています/);
    assert.throws(() => toDimensionIndex('0', 'ROWS', SIZE, 'at'), /表の外を指しています/);
  });

  it('行に列の記号、列に行番号を渡す取り違えを弾く', () => {
    assert.throws(() => toDimensionIndex('B', 'ROWS', SIZE, 'at'), /at は行番号で指定してください/);
    assert.throws(() => toDimensionIndex('2', 'COLUMNS', SIZE, 'at'), /at は列の記号で指定してください/);
  });

  it('文字列でも数値でもない値を弾く', () => {
    assert.throws(() => toDimensionIndex(null, 'ROWS', SIZE, 'at'), /at は行番号で指定してください/);
    assert.throws(() => toDimensionIndex(undefined, 'COLUMNS', SIZE, 'at'), /at は列の記号で指定してください/);
    assert.throws(() => toDimensionIndex(true, 'ROWS', SIZE, 'at'), /at は行番号で指定してください/);
  });
});
