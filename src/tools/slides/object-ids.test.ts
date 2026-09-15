import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { toObjectIds } from './object-ids.js';

describe('toObjectIds', () => {
  it('文字列の配列をそのまま返す', () => {
    assert.deepEqual(toObjectIds(['a1', 'b2'], 'objectIds', 1), ['a1', 'b2']);
  });

  it('配列でない値を弾く', () => {
    assert.throws(() => toObjectIds('a1', 'objectIds', 1), /objectId の配列で指定してください/);
    assert.throws(() => toObjectIds(undefined, 'objectIds', 1), /objectId の配列で指定してください/);
  });

  it('必要な個数に足りない指定を弾く', () => {
    assert.throws(() => toObjectIds([], 'objectIds', 1), /1 個以上指定してください/);
    assert.throws(() => toObjectIds(['a1'], 'objectIds', 2), /2 個以上指定してください/);
  });

  it('空文字と文字列以外が混ざった指定を弾く', () => {
    assert.throws(() => toObjectIds(['a1', ''], 'objectIds', 1), /objectIds\[1\] は空でない/);
    assert.throws(() => toObjectIds(['a1', 3], 'objectIds', 1), /objectIds\[1\] は空でない/);
  });
});
