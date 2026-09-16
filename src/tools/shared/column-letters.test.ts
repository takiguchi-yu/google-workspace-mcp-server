import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { columnIndexOf, columnLettersOf } from './column-letters.js';

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

describe('columnIndexOf と columnLettersOf', () => {
  it('記号と番号を往復できる', () => {
    for (const index of [0, 25, 26, 51, 701, 702, 18277]) {
      assert.equal(columnIndexOf(columnLettersOf(index)), index);
    }
  });
});
