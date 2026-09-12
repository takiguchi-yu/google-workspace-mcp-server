import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { toCellFormat } from './cell-format.js';

describe('toCellFormat', () => {
  it('指定しなかった項目はマスクに載らない', () => {
    const { format, fields } = toCellFormat({ bold: true });

    assert.deepEqual(format, { textFormat: { bold: true } });
    assert.deepEqual([...fields], ['textFormat.bold']);
  });

  it('何も指定しなければ空になる', () => {
    const { format, fields } = toCellFormat({ range: 'Sheet1!A1:D1' });

    assert.deepEqual(format, {});
    assert.deepEqual([...fields], []);
  });

  it('色を 16 進数から RGB に変換する', () => {
    const { format, fields } = toCellFormat({ backgroundColor: '#000000', fontColor: '#FFFFFF' });

    assert.deepEqual(format.backgroundColor, { red: 0, green: 0, blue: 0 });
    assert.deepEqual(format.textFormat?.foregroundColor, { red: 1, green: 1, blue: 1 });
    assert.deepEqual([...fields].sort(), ['backgroundColor', 'textFormat.foregroundColor']);
  });

  it('文字の装飾をまとめて textFormat に入れる', () => {
    const { format, fields } = toCellFormat({
      bold: true,
      italic: false,
      fontSize: 14,
      fontFamily: 'Roboto',
    });

    assert.deepEqual(format.textFormat, { bold: true, italic: false, fontSize: 14, fontFamily: 'Roboto' });
    assert.equal(fields.length, 4);
  });

  it('配置と折り返しを受け付ける', () => {
    const { format, fields } = toCellFormat({
      horizontalAlignment: 'CENTER',
      verticalAlignment: 'MIDDLE',
      wrapStrategy: 'WRAP',
    });

    assert.equal(format.horizontalAlignment, 'CENTER');
    assert.equal(format.verticalAlignment, 'MIDDLE');
    assert.equal(format.wrapStrategy, 'WRAP');
    assert.deepEqual([...fields], ['horizontalAlignment', 'verticalAlignment', 'wrapStrategy']);
  });

  it('数値書式を type と pattern で受ける', () => {
    const { format, fields } = toCellFormat({ numberFormat: { type: 'CURRENCY', pattern: '"¥"#,##0' } });

    assert.deepEqual(format.numberFormat, { type: 'CURRENCY', pattern: '"¥"#,##0' });
    assert.deepEqual([...fields], ['numberFormat']);
  });

  it('列挙にない配置指定は受け付けない', () => {
    assert.throws(() => toCellFormat({ horizontalAlignment: 'MIDDLE' }), /horizontalAlignment は/);
  });

  it('色として解釈できない値は受け付けない', () => {
    assert.throws(() => toCellFormat({ backgroundColor: 'blue' }), /16 進数で指定してください/);
  });
});
