import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CONTENT_ALIGNMENTS } from './content-alignment.js';
import { BORDER_POSITIONS, toTableBorderProperties, toTableCellProperties } from './table-style.js';

describe('列挙', () => {
  it('実機で全値の通過を確かめた個数と一致する', () => {
    assert.equal(BORDER_POSITIONS.length, 9);
    assert.equal(CONTENT_ALIGNMENTS.length, 3);
  });
});

describe('toTableCellProperties', () => {
  it('指定が無ければ空の見た目と空の項目を返す', () => {
    assert.deepEqual(toTableCellProperties({ range: 'A1' }), { properties: {}, fields: [] });
  });

  it('塗りを 0〜1 の RGB に直して入れる', () => {
    const { properties, fields } = toTableCellProperties({ fillColor: '#E8F0FE' });

    assert.equal(properties.tableCellBackgroundFill?.propertyState, 'RENDERED');
    assert.deepEqual(properties.tableCellBackgroundFill?.solidFill?.color?.rgbColor, {
      red: 232 / 255,
      green: 240 / 255,
      blue: 254 / 255,
    });
    assert.deepEqual(fields, ['tableCellBackgroundFill']);
  });

  it('NONE で塗りを消す', () => {
    const { properties } = toTableCellProperties({ fillColor: 'NONE' });

    assert.deepEqual(properties.tableCellBackgroundFill, { propertyState: 'NOT_RENDERED' });
  });

  it('大文字小文字を問わず NONE として読む', () => {
    assert.deepEqual(toTableCellProperties({ fillColor: 'none' }).properties.tableCellBackgroundFill, {
      propertyState: 'NOT_RENDERED',
    });
  });

  it('縦揃えを拾う', () => {
    const { properties, fields } = toTableCellProperties({ contentAlignment: 'MIDDLE' });

    assert.equal(properties.contentAlignment, 'MIDDLE');
    assert.deepEqual(fields, ['contentAlignment']);
  });

  it('列挙に無い縦揃えと色として読めない文字列を弾く', () => {
    assert.throws(
      () => toTableCellProperties({ contentAlignment: 'CENTER' }),
      /contentAlignment は TOP \/ MIDDLE \/ BOTTOM/,
    );
    assert.throws(() => toTableCellProperties({ fillColor: 'blue' }), /16 進数で指定してください/);
  });
});

describe('toTableBorderProperties', () => {
  it('指定が無ければ空の見た目と空の項目を返す', () => {
    assert.deepEqual(toTableBorderProperties({}), { properties: {}, fields: [] });
  });

  it('色・太さ・破線を項目ごとに拾う', () => {
    const { properties, fields } = toTableBorderProperties({ color: '#202124', weight: 2, dashStyle: 'DASH' });

    assert.deepEqual(properties.weight, { magnitude: 2, unit: 'PT' });
    assert.equal(properties.dashStyle, 'DASH');
    assert.deepEqual(fields, ['tableBorderFill', 'weight', 'dashStyle']);
  });

  it('太さ 0 以下を弾く（API が受け付けず、罫線は消せないため）', () => {
    assert.throws(() => toTableBorderProperties({ weight: 0 }), /0 より大きい値で指定してください/);
    assert.throws(() => toTableBorderProperties({ weight: -1 }), /罫線は消せない/);
  });

  it('列挙に無い破線を弾く', () => {
    assert.throws(() => toTableBorderProperties({ dashStyle: 'DOTTED' }), /dashStyle は SOLID \/ DOT/);
  });
});
