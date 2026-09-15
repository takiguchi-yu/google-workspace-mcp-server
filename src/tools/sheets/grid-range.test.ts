import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { columnIndexOf, columnLettersOf, toA1Range, toColumnIndex, toGridIndexes } from './grid-range.js';

describe('columnIndexOf', () => {
  it('1 文字の列を 0 始まりの番号に変換する', () => {
    assert.equal(columnIndexOf('A'), 0);
    assert.equal(columnIndexOf('Z'), 25);
  });

  it('2 文字以上の列を 26 進数として数える', () => {
    assert.equal(columnIndexOf('AA'), 26);
    assert.equal(columnIndexOf('AZ'), 51);
    assert.equal(columnIndexOf('BA'), 52);
    assert.equal(columnIndexOf('ZZZ'), 18277);
  });

  it('小文字も受け付ける', () => {
    assert.equal(columnIndexOf('ab'), columnIndexOf('AB'));
  });
});

describe('toGridIndexes', () => {
  it('両端を指定した範囲を行列番号に変換する', () => {
    assert.deepEqual(toGridIndexes('A1:D10'), {
      startRowIndex: 0,
      endRowIndex: 10,
      startColumnIndex: 0,
      endColumnIndex: 4,
    });
  });

  it('シート名が付いていても無視する', () => {
    assert.deepEqual(toGridIndexes('Sheet1!B2:C3'), toGridIndexes('B2:C3'));
    assert.deepEqual(toGridIndexes("'It''s a sheet'!B2:C3"), toGridIndexes('B2:C3'));
  });

  it('列だけの範囲では行のキーを落とす', () => {
    assert.deepEqual(toGridIndexes('B:D'), { startColumnIndex: 1, endColumnIndex: 4 });
  });

  it('行だけの範囲では列のキーを落とす', () => {
    assert.deepEqual(toGridIndexes('2:5'), { startRowIndex: 1, endRowIndex: 5 });
  });

  it('単一セルを 1 セルぶんの範囲にする', () => {
    assert.deepEqual(toGridIndexes('C7'), {
      startRowIndex: 6,
      endRowIndex: 7,
      startColumnIndex: 2,
      endColumnIndex: 3,
    });
  });

  it('シート名だけの指定はシート全体として空になる', () => {
    assert.deepEqual(toGridIndexes('Sheet1!'), {});
    assert.deepEqual(toGridIndexes("'売上 2026'!"), {});
  });

  it('! の無いシート名は、範囲と区別が付かないので名指しで断る', () => {
    assert.throws(() => toGridIndexes('Sheet1'), /シート名の後ろに ! を付けてください/);
  });

  it('逆順に書かれた範囲を正しい向きに直す', () => {
    assert.deepEqual(toGridIndexes('D10:A1'), toGridIndexes('A1:D10'));
  });

  it('片側しか決まらない範囲では決まった側のキーだけを返す', () => {
    assert.deepEqual(toGridIndexes('A1:D'), { startRowIndex: 0, startColumnIndex: 0, endColumnIndex: 4 });
  });

  it('範囲として解釈できない文字列は受け付けない', () => {
    assert.throws(() => toGridIndexes('Sheet1!A1:B2:C3'), /範囲を解釈できません/);
    assert.throws(() => toGridIndexes('Sheet1!1A'), /範囲を解釈できません/);
  });
});

describe('columnLettersOf', () => {
  it('列番号を記号に戻す', () => {
    assert.equal(columnLettersOf(0), 'A');
    assert.equal(columnLettersOf(25), 'Z');
    assert.equal(columnLettersOf(26), 'AA');
    assert.equal(columnLettersOf(51), 'AZ');
    assert.equal(columnLettersOf(18277), 'ZZZ');
  });

  it('columnIndexOf と往復する', () => {
    for (const letters of ['A', 'M', 'Z', 'AA', 'BQ', 'ZZ', 'ABC']) {
      assert.equal(columnLettersOf(columnIndexOf(letters)), letters);
    }
  });
});

describe('toA1Range', () => {
  it('行列番号を A1 記法に戻す', () => {
    assert.equal(toA1Range({ startRowIndex: 0, endRowIndex: 10, startColumnIndex: 0, endColumnIndex: 4 }), 'A1:D10');
  });

  it('シート名を付けられる', () => {
    assert.equal(
      toA1Range({ startRowIndex: 1, endRowIndex: 5, startColumnIndex: 1, endColumnIndex: 2 }, 'Sheet1'),
      'Sheet1!B2:B5',
    );
  });

  it('記号を含むシート名はクォートする', () => {
    assert.equal(toA1Range({}, '売上 2026'), "'売上 2026'");
    assert.equal(toA1Range({ startRowIndex: 0, endRowIndex: 1 }, "It's"), "'It''s'!1:1");
  });

  it('列だけ・行だけの範囲を復元する', () => {
    assert.equal(toA1Range({ startColumnIndex: 1, endColumnIndex: 4 }), 'B:D');
    assert.equal(toA1Range({ startRowIndex: 1, endRowIndex: 5 }), '2:5');
  });

  it('toGridIndexes と往復する', () => {
    for (const range of ['A1:D10', 'B:D', '2:5', 'C7:C7']) {
      assert.equal(toA1Range(toGridIndexes(range)), range);
    }
  });
});

describe('toColumnIndex', () => {
  it('列の記号を 0 始まりの列番号にする', () => {
    assert.equal(toColumnIndex('A', 'column'), 0);
    assert.equal(toColumnIndex('Z', 'column'), 25);
    assert.equal(toColumnIndex('AA', 'column'), 26);
    assert.equal(toColumnIndex('ZZZ', 'column'), 18277);
  });

  it('前後の空白は無視する', () => {
    assert.equal(toColumnIndex(' B ', 'column'), 1);
  });

  it('列の記号でない値は引数名を添えて弾く', () => {
    assert.throws(() => toColumnIndex('1', 'sortSpecs[0].column'), /sortSpecs\[0\]\.column は列の記号で/);
    assert.throws(() => toColumnIndex('A1', 'column'), /列の記号で/);
    assert.throws(() => toColumnIndex('ZZZZ', 'column'), /列の記号で/);
    assert.throws(() => toColumnIndex(2, 'column'), /列の記号で/);
    assert.throws(() => toColumnIndex(undefined, 'column'), /列の記号で/);
  });
});
