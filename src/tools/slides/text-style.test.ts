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

describe('toTextStyle（0.9.0 で足した項目）', () => {
  it('スモールキャップスを拾う', () => {
    const { style, fields } = toTextStyle({ smallCaps: true });

    assert.equal(style.smallCaps, true);
    assert.deepEqual(fields, ['smallCaps']);
  });

  it('上付き・下付きを拾う', () => {
    for (const baselineOffset of ['NONE', 'SUPERSCRIPT', 'SUBSCRIPT']) {
      assert.equal(toTextStyle({ baselineOffset }).style.baselineOffset, baselineOffset);
    }
  });

  it('列挙に無い上付き指定を弾く', () => {
    assert.throws(() => toTextStyle({ baselineOffset: 'SUPER' }), /baselineOffset は NONE \/ SUPERSCRIPT \/ SUBSCRIPT/);
  });

  it('フォントの太さを fontFamily と組にして入れる', () => {
    const { style, fields } = toTextStyle({ fontFamily: 'Roboto', fontWeight: 700 });

    assert.deepEqual(style.weightedFontFamily, { fontFamily: 'Roboto', weight: 700 });
    assert.ok(fields.includes('weightedFontFamily'));
    assert.ok(fields.includes('fontFamily'));
  });

  it('100 刻みでない太さを弾く（実機で 450 が拒否されるため）', () => {
    assert.throws(() => toTextStyle({ fontFamily: 'Roboto', fontWeight: 450 }), /fontWeight は 100 \/ 200/);
    assert.throws(() => toTextStyle({ fontFamily: 'Roboto', fontWeight: 1000 }), /fontWeight は 100 \/ 200/);
  });

  it('fontFamily を伴わない太さの指定を弾く（API が組で受け取るため）', () => {
    assert.throws(() => toTextStyle({ fontWeight: 700 }), /fontFamily も渡してください/);
  });

  it('リンクを張る', () => {
    const { style, fields } = toTextStyle({ link: 'https://example.com' });

    assert.deepEqual(style.link, { url: 'https://example.com' });
    assert.deepEqual(fields, ['link']);
  });

  it('NONE でリンクを消す（値を送らず項目名だけ載せる）', () => {
    const { style, fields } = toTextStyle({ link: 'NONE' });

    assert.equal(style.link, undefined);
    assert.deepEqual(fields, ['link']);
  });

  it('大文字小文字を問わず NONE として読む', () => {
    assert.equal(toTextStyle({ link: 'none' }).style.link, undefined);
  });
});
