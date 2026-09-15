import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { toTextStyle } from './text-style.js';

describe('toTextStyle', () => {
  it('指定が無ければ空の書式と空の項目を返す', () => {
    assert.deepEqual(toTextStyle({ presentationId: 'p', objectId: 'o' }), { style: {}, fields: [] });
  });

  it('真偽値の装飾を項目ごとに拾う', () => {
    const { style, fields } = toTextStyle({ bold: true, italic: false });

    assert.equal(style.bold, true);
    assert.equal(style.italic, false);
    assert.deepEqual(fields, ['bold', 'italic']);
  });

  it('フォントサイズをポイントで組み立てる', () => {
    const { style, fields } = toTextStyle({ fontSize: 24 });

    assert.deepEqual(style.fontSize, { magnitude: 24, unit: 'PT' });
    assert.deepEqual(fields, ['fontSize']);
  });

  it('色を 0〜1 の RGB に直して入れる', () => {
    const { style, fields } = toTextStyle({ foregroundColor: '#FF0000', backgroundColor: '#000' });

    assert.deepEqual(style.foregroundColor, { opaqueColor: { rgbColor: { red: 1, green: 0, blue: 0 } } });
    assert.deepEqual(style.backgroundColor, { opaqueColor: { rgbColor: { red: 0, green: 0, blue: 0 } } });
    assert.deepEqual(fields, ['foregroundColor', 'backgroundColor']);
  });

  it('色として読めない文字列を弾く', () => {
    assert.throws(() => toTextStyle({ foregroundColor: 'red' }), /16 進数で指定してください/);
  });

  it('指定されなかった項目には触れない', () => {
    const { fields } = toTextStyle({ fontFamily: 'Noto Sans JP', bold: true });

    assert.deepEqual(fields, ['bold', 'fontFamily']);
  });
});
