import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { toNumber, toOptionalNumber } from './number-argument.js';

describe('toNumber', () => {
  it('数値はそのまま返す', () => {
    assert.equal(toNumber(0, 'width'), 0);
    assert.equal(toNumber(-12.5, 'left'), -12.5);
  });

  it('省略を弾く', () => {
    assert.throws(() => toNumber(undefined, 'endY'), /endY が指定されていません/);
  });

  it('数値でない値と有限でない値を弾く', () => {
    assert.throws(() => toNumber('100', 'width'), /width は数値で指定してください/);
    assert.throws(() => toNumber(null, 'width'), /width は数値で指定してください/);
    assert.throws(() => toNumber(Number.NaN, 'width'), /width は数値で指定してください/);
    assert.throws(() => toNumber(Number.POSITIVE_INFINITY, 'width'), /width は数値で指定してください/);
  });
});

describe('toOptionalNumber', () => {
  it('省略されたら undefined を返す', () => {
    assert.equal(toOptionalNumber(undefined, 'width'), undefined);
  });

  it('指定されたら数値として検証する', () => {
    assert.equal(toOptionalNumber(42, 'width'), 42);
    assert.throws(() => toOptionalNumber(null, 'width'), /width は数値で指定してください/);
  });
});
