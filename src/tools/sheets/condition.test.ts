import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  CONDITIONAL_FORMAT_CONDITION_TYPES,
  DATA_VALIDATION_CONDITION_TYPES,
  FILTER_CONDITION_TYPES,
  toBooleanCondition,
} from './condition.js';

describe('toBooleanCondition', () => {
  it('値を持たない条件は type だけを返す', () => {
    const condition = toBooleanCondition({ type: 'BLANK' }, CONDITIONAL_FORMAT_CONDITION_TYPES, 'condition');

    assert.deepEqual(condition, { type: 'BLANK' });
  });

  it('値は userEnteredValue の配列に包む', () => {
    const condition = toBooleanCondition(
      { type: 'NUMBER_BETWEEN', values: ['1', '10'] },
      CONDITIONAL_FORMAT_CONDITION_TYPES,
      'condition',
    );

    assert.deepEqual(condition, {
      type: 'NUMBER_BETWEEN',
      values: [{ userEnteredValue: '1' }, { userEnteredValue: '10' }],
    });
  });

  it('数値で渡された値も文字列にする', () => {
    const condition = toBooleanCondition(
      { type: 'NUMBER_GREATER', values: [100] },
      CONDITIONAL_FORMAT_CONDITION_TYPES,
      'condition',
    );

    assert.deepEqual(condition.values, [{ userEnteredValue: '100' }]);
  });

  it('空の values はキーごと落とす', () => {
    const condition = toBooleanCondition(
      { type: 'NOT_BLANK', values: [] },
      CONDITIONAL_FORMAT_CONDITION_TYPES,
      'condition',
    );

    assert.deepEqual(condition, { type: 'NOT_BLANK' });
  });

  it('許可集合にない type は用途を添えて弾く', () => {
    assert.throws(
      () => toBooleanCondition({ type: 'ONE_OF_LIST' }, CONDITIONAL_FORMAT_CONDITION_TYPES, 'condition'),
      /condition\.type がこの用途で使える ConditionType ではありません/,
    );
  });

  it('同じ type でも用途が違えば通る', () => {
    const condition = toBooleanCondition(
      { type: 'ONE_OF_LIST', values: ['Todo', 'Done'] },
      DATA_VALIDATION_CONDITION_TYPES,
      'condition',
    );

    assert.equal(condition.type, 'ONE_OF_LIST');
  });

  it('オブジェクト以外を渡すと形を示して弾く', () => {
    assert.throws(
      () => toBooleanCondition('NUMBER_GREATER', CONDITIONAL_FORMAT_CONDITION_TYPES, 'condition'),
      /condition は \{ type, values \} のオブジェクトで指定してください/,
    );
  });

  it('エラー文面には引数名がそのまま出る', () => {
    assert.throws(
      () => toBooleanCondition({ type: 'BOGUS' }, FILTER_CONDITION_TYPES, 'criteria[0].condition'),
      /criteria\[0\]\.condition\.type/,
    );
  });
});

describe('ConditionType の集合', () => {
  it('条件付き書式で使えない値は入力規則側にだけある', () => {
    for (const type of ['ONE_OF_LIST', 'ONE_OF_RANGE', 'BOOLEAN', 'DATE_BETWEEN']) {
      assert.ok(!(CONDITIONAL_FORMAT_CONDITION_TYPES as readonly string[]).includes(type), type);
      assert.ok((DATA_VALIDATION_CONDITION_TYPES as readonly string[]).includes(type), type);
    }
  });

  it('入力規則で使えない値は条件付き書式側にだけある', () => {
    for (const type of ['TEXT_STARTS_WITH', 'TEXT_ENDS_WITH', 'BLANK', 'NOT_BLANK']) {
      assert.ok((CONDITIONAL_FORMAT_CONDITION_TYPES as readonly string[]).includes(type), type);
      assert.ok(!(DATA_VALIDATION_CONDITION_TYPES as readonly string[]).includes(type), type);
    }
  });

  it('フィルタは条件付き書式の集合に等しくないことを問う 2 つを足したもの', () => {
    assert.deepEqual(
      [...FILTER_CONDITION_TYPES],
      [...CONDITIONAL_FORMAT_CONDITION_TYPES, 'TEXT_NOT_EQ', 'DATE_NOT_EQ'],
    );
  });
});
