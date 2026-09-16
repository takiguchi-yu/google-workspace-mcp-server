import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { describeTableRange, toTableRange, wholeTable } from './table-range.js';

/** 4 行 × 4 列の表 */
const SIZE = { rows: 4, columns: 4 };

describe('toTableRange', () => {
  it('両端を指定した長方形を始点と行数列数に直す', () => {
    assert.deepEqual(toTableRange('A1:C2', SIZE, 'range'), {
      location: { rowIndex: 0, columnIndex: 0 },
      rowSpan: 2,
      columnSpan: 3,
    });
  });

  it('1 セルの指定は行数列数が 1 になる', () => {
    assert.deepEqual(toTableRange('B2', SIZE, 'range'), {
      location: { rowIndex: 1, columnIndex: 1 },
      rowSpan: 1,
      columnSpan: 1,
    });
  });

  it('列だけの指定は表の全行にかかる', () => {
    assert.deepEqual(toTableRange('A:C', SIZE, 'range'), {
      location: { rowIndex: 0, columnIndex: 0 },
      rowSpan: 4,
      columnSpan: 3,
    });
  });

  it('行だけの指定は表の全列にかかる', () => {
    assert.deepEqual(toTableRange('2:3', SIZE, 'range'), {
      location: { rowIndex: 1, columnIndex: 0 },
      rowSpan: 2,
      columnSpan: 4,
    });
  });

  it('逆順に書かれた範囲を正しい向きに直す', () => {
    assert.deepEqual(toTableRange('C2:A1', SIZE, 'range'), toTableRange('A1:C2', SIZE, 'range'));
  });

  it('表からはみ出す終端は表の端で閉じる', () => {
    assert.deepEqual(toTableRange('A1:Z99', SIZE, 'range'), {
      location: { rowIndex: 0, columnIndex: 0 },
      rowSpan: 4,
      columnSpan: 4,
    });
  });

  it('span は必ず 1 以上になる（API が 0 を受け付けないため）', () => {
    for (const range of ['A1', 'A1:A1', 'B:B', '3:3', 'A1:D4']) {
      const tableRange = toTableRange(range, SIZE, 'range');
      assert.ok((tableRange.rowSpan ?? 0) >= 1, `${range} の rowSpan`);
      assert.ok((tableRange.columnSpan ?? 0) >= 1, `${range} の columnSpan`);
    }
  });

  it('始点が表の外にある範囲を弾く', () => {
    assert.throws(
      () => toTableRange('E1', SIZE, 'range'),
      /range が表の外を指しています: E1（この表は 4 行 × 4 列）。/,
    );
    assert.throws(() => toTableRange('A5', SIZE, 'range'), /表の外を指しています/);
  });

  it('0 行目のような 1 始まりでない指定を弾く', () => {
    assert.throws(() => toTableRange('A0', SIZE, 'range'), /range を解釈できません: A0/);
  });

  it('範囲として読めない文字列を弾く', () => {
    assert.throws(() => toTableRange('', SIZE, 'range'), /A1 記法で指定してください/);
    assert.throws(() => toTableRange(undefined, SIZE, 'range'), /A1 記法で指定してください/);
    assert.throws(() => toTableRange('A1:B2:C3', SIZE, 'range'), /range を解釈できません/);
    assert.throws(() => toTableRange('!!', SIZE, 'range'), /range を解釈できません/);
  });
});

describe('describeTableRange', () => {
  it('1 セルは単独の記法で返す', () => {
    assert.equal(describeTableRange(toTableRange('B2', SIZE, 'range')), 'B2');
  });

  it('長方形は両端の記法で返す', () => {
    assert.equal(describeTableRange(toTableRange('A1:C2', SIZE, 'range')), 'A1:C2');
  });

  it('端が開いた指定は閉じたあとの範囲で返す', () => {
    assert.equal(describeTableRange(toTableRange('B:C', SIZE, 'range')), 'B1:C4');
    assert.equal(describeTableRange(toTableRange('2:3', SIZE, 'range')), 'A2:D3');
  });
});

describe('wholeTable', () => {
  it('表ぜんぶを指す範囲を作る', () => {
    assert.deepEqual(wholeTable(SIZE), { location: { rowIndex: 0, columnIndex: 0 }, rowSpan: 4, columnSpan: 4 });
  });

  it('A1 から表の端までの指定と同じになる', () => {
    assert.deepEqual(wholeTable(SIZE), toTableRange('A1:D4', SIZE, 'range'));
    assert.equal(describeTableRange(wholeTable(SIZE)), 'A1:D4');
  });
});
