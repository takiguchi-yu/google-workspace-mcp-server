import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { toTextRange } from './text-range.js';

describe('toTextRange', () => {
  it('どちらも省略されたら全体を指す', () => {
    assert.deepEqual(toTextRange(undefined, undefined), { type: 'ALL' });
  });

  it('両端が揃っていれば固定範囲にする', () => {
    assert.deepEqual(toTextRange(0, 5), { type: 'FIXED_RANGE', startIndex: 0, endIndex: 5 });
  });

  it('片方だけの指定を弾く', () => {
    assert.throws(() => toTextRange(3, undefined), /両方を渡してください/);
    assert.throws(() => toTextRange(undefined, 3), /両方を渡してください/);
  });

  it('数値でない値を弾く', () => {
    assert.throws(() => toTextRange('0', '5'), /数値で指定してください/);
  });

  it('整数でない値を弾く', () => {
    assert.throws(() => toTextRange(0.5, 5), /整数で指定してください/);
  });

  it('負の開始位置を弾く', () => {
    assert.throws(() => toTextRange(-1, 5), /0 以上で指定してください/);
  });

  it('長さが 0 以下になる範囲を弾く', () => {
    assert.throws(() => toTextRange(5, 5), /startIndex より大きい値/);
    assert.throws(() => toTextRange(5, 3), /startIndex より大きい値/);
  });
});
