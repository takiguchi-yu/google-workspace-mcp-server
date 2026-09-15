import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { describeSortSpecs, toSortSpecs } from './sort-spec.js';

describe('toSortSpecs', () => {
  it('列の記号をシート上の列番号に直す', () => {
    assert.deepEqual(toSortSpecs([{ column: 'A' }], 'sortSpecs'), [{ dimensionIndex: 0, sortOrder: 'ASCENDING' }]);
    assert.deepEqual(toSortSpecs([{ column: 'AA' }], 'sortSpecs'), [{ dimensionIndex: 26, sortOrder: 'ASCENDING' }]);
  });

  it('向きを省略すると昇順になる', () => {
    assert.deepEqual(toSortSpecs([{ column: 'B' }], 'sortSpecs'), [{ dimensionIndex: 1, sortOrder: 'ASCENDING' }]);
  });

  it('優先順にそのまま並べる', () => {
    assert.deepEqual(toSortSpecs([{ column: 'C', order: 'DESCENDING' }, { column: 'A' }], 'sortSpecs'), [
      { dimensionIndex: 2, sortOrder: 'DESCENDING' },
      { dimensionIndex: 0, sortOrder: 'ASCENDING' },
    ]);
  });

  it('小文字の列も受ける', () => {
    assert.deepEqual(toSortSpecs([{ column: 'b' }], 'sortSpecs'), [{ dimensionIndex: 1, sortOrder: 'ASCENDING' }]);
  });

  it('列番号で渡されたら列の記号を促す', () => {
    assert.throws(() => toSortSpecs([{ column: '2' }], 'sortSpecs'), /列の記号で指定してください/);
  });

  it('範囲付きの指定は弾く', () => {
    assert.throws(() => toSortSpecs([{ column: 'Sheet1!B' }], 'sortSpecs'), /列の記号で指定してください/);
  });

  it('列挙にない向きは候補を添えて弾く', () => {
    assert.throws(() => toSortSpecs([{ column: 'A', order: 'ASC' }], 'sortSpecs'), /ASCENDING \/ DESCENDING/);
  });

  it('空の配列は弾く', () => {
    assert.throws(() => toSortSpecs([], 'sortSpecs'), /1 つ以上の \{ column, order \} を持つ配列/);
  });

  it('エラー文面には何番目かが出る', () => {
    assert.throws(() => toSortSpecs([{ column: 'A' }, { column: '' }], 'sortSpecs'), /sortSpecs\[1\]\.column/);
  });
});

describe('describeSortSpecs', () => {
  it('列番号を列の記号に戻して並べる', () => {
    const specs = toSortSpecs([{ column: 'C', order: 'DESCENDING' }, { column: 'A' }], 'sortSpecs');

    assert.equal(describeSortSpecs(specs), 'C 列 降順 → A 列 昇順');
  });
});
