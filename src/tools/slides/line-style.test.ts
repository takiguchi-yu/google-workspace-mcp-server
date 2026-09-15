import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ARROW_STYLES, DASH_STYLES, LINE_CATEGORIES, toLineProperties } from './line-style.js';

describe('列挙', () => {
  it('実機で全値の通過を確かめた個数と一致する', () => {
    assert.equal(LINE_CATEGORIES.length, 3);
    assert.equal(DASH_STYLES.length, 6);
    assert.equal(ARROW_STYLES.length, 10);
  });

  it('未指定を表す値を含めない', () => {
    for (const values of [LINE_CATEGORIES, DASH_STYLES, ARROW_STYLES] as readonly (readonly string[])[]) {
      assert.ok(!values.some((value) => value.endsWith('_UNSPECIFIED')));
    }
  });
});

describe('toLineProperties', () => {
  it('指定が無ければ空の見た目と空の項目を返す', () => {
    assert.deepEqual(toLineProperties({ startX: 0 }), { lineProperties: {}, fields: [] });
  });

  it('色を 0〜1 の RGB に直して入れる', () => {
    const { lineProperties, fields } = toLineProperties({ color: '#FF0000' });

    assert.deepEqual(lineProperties.lineFill, { solidFill: { color: { rgbColor: { red: 1, green: 0, blue: 0 } } } });
    assert.deepEqual(fields, ['lineFill']);
  });

  it('太さをポイントで組み立てる', () => {
    const { lineProperties } = toLineProperties({ weight: 4 });

    assert.deepEqual(lineProperties.weight, { magnitude: 4, unit: 'PT' });
  });

  it('破線と両端の飾りを項目ごとに拾う', () => {
    const { lineProperties, fields } = toLineProperties({
      dashStyle: 'DASH_DOT',
      startArrow: 'NONE',
      endArrow: 'FILL_ARROW',
    });

    assert.equal(lineProperties.dashStyle, 'DASH_DOT');
    assert.equal(lineProperties.startArrow, 'NONE');
    assert.equal(lineProperties.endArrow, 'FILL_ARROW');
    assert.deepEqual(fields, ['dashStyle', 'startArrow', 'endArrow']);
  });

  it('破線に矢印の値を渡すような取り違えを弾く', () => {
    assert.throws(() => toLineProperties({ dashStyle: 'FILL_ARROW' }), /dashStyle は SOLID \/ DOT/);
    assert.throws(() => toLineProperties({ endArrow: 'DASH' }), /endArrow は NONE \/ STEALTH_ARROW/);
  });

  it('色として読めない文字列と数値でない太さを弾く', () => {
    assert.throws(() => toLineProperties({ color: 'red' }), /16 進数で指定してください/);
    assert.throws(() => toLineProperties({ weight: '4' }), /weight は数値で指定してください/);
  });
});
