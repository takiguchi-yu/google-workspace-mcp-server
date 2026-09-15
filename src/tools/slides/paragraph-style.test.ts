import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { toParagraphStyle } from './paragraph-style.js';

describe('toParagraphStyle', () => {
  it('指定が無ければ空の書式と空の項目を返す', () => {
    assert.deepEqual(toParagraphStyle({ presentationId: 'p', objectId: 'o' }), { style: {}, fields: [] });
  });

  it('揃え方をそのまま入れる', () => {
    const { style, fields } = toParagraphStyle({ alignment: 'CENTER' });

    assert.equal(style.alignment, 'CENTER');
    assert.deepEqual(fields, ['alignment']);
  });

  it('列挙に無い揃え方を弾く', () => {
    assert.throws(() => toParagraphStyle({ alignment: 'LEFT' }), /alignment は START \/ CENTER \/ END \/ JUSTIFIED/);
  });

  it('行間は百分率なので単位を付けない', () => {
    const { style } = toParagraphStyle({ lineSpacing: 150 });

    assert.equal(style.lineSpacing, 150);
  });

  it('長さの項目はポイントで組み立てる', () => {
    const { style, fields } = toParagraphStyle({ spaceAbove: 12, indentFirstLine: 27 });

    assert.deepEqual(style.spaceAbove, { magnitude: 12, unit: 'PT' });
    assert.deepEqual(style.indentFirstLine, { magnitude: 27, unit: 'PT' });
    assert.deepEqual(fields, ['spaceAbove', 'indentFirstLine']);
  });

  it('0 を指定されたら「指定なし」と区別して入れる', () => {
    const { style, fields } = toParagraphStyle({ indentStart: 0 });

    assert.deepEqual(style.indentStart, { magnitude: 0, unit: 'PT' });
    assert.deepEqual(fields, ['indentStart']);
  });

  it('数値でない長さを弾く', () => {
    assert.throws(() => toParagraphStyle({ spaceBelow: '6' }), /spaceBelow は数値で指定してください/);
  });
});
