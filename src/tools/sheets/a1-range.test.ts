import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { sheetNameOf, startRowOf } from './a1-range.js';

describe('startRowOf', () => {
  it('シート名付きの範囲から開始行を取り出す', () => {
    assert.equal(startRowOf('レストランページ編集!K186:N602'), 186);
    assert.equal(startRowOf('Sheet1!A1:D10'), 1);
  });

  it('シート名を省略した範囲から開始行を取り出す', () => {
    assert.equal(startRowOf('K186:N602'), 186);
    assert.equal(startRowOf('A1:D10'), 1);
  });

  it('クォートされたシート名を読み飛ばす', () => {
    assert.equal(startRowOf("'レストランページ編集'!K186:N602"), 186);
    assert.equal(startRowOf("'My!Sheet'!A5:B20"), 5);
    assert.equal(startRowOf("'It''s a sheet'!C7:D9"), 7);
  });

  it('行番号を省略した列指定は 1 とみなす', () => {
    assert.equal(startRowOf('A:C'), 1);
    assert.equal(startRowOf('Sheet1!A:C'), 1);
    assert.equal(startRowOf('A5:C'), 5);
  });

  it('行のみの範囲から開始行を取り出す', () => {
    assert.equal(startRowOf('186:602'), 186);
    assert.equal(startRowOf('Sheet1!3:8'), 3);
  });

  it('単一セルの範囲から開始行を取り出す', () => {
    assert.equal(startRowOf('B12'), 12);
    assert.equal(startRowOf('Sheet1!B12'), 12);
  });

  it('シート名だけの範囲はシート全体を指すため 1 とみなす', () => {
    assert.equal(startRowOf('Sheet1'), 1);
    assert.equal(startRowOf('Sheet3'), 1);
    assert.equal(startRowOf("'レストランページ編集'"), 1);
  });

  it('解釈できない入力は 1 とみなす', () => {
    assert.equal(startRowOf(''), 1);
    assert.equal(startRowOf(undefined), 1);
    assert.equal(startRowOf(null), 1);
    assert.equal(startRowOf('Sheet1!'), 1);
    assert.equal(startRowOf('!!!'), 1);
  });
});

describe('sheetNameOf', () => {
  it('シート名付きの範囲からシート名を取り出す', () => {
    assert.equal(sheetNameOf('restedit_field!K186:N602'), 'restedit_field');
    assert.equal(sheetNameOf('Sheet1!A1'), 'Sheet1');
  });

  it('クォートを外し、エスケープされた引用符を戻す', () => {
    assert.equal(sheetNameOf("'レストランページ編集'!K186:N602"), 'レストランページ編集');
    assert.equal(sheetNameOf("'My!Sheet'!A1:B2"), 'My!Sheet');
    assert.equal(sheetNameOf("'It''s a sheet'!C7:D9"), "It's a sheet");
  });

  it('セル参照だけの範囲は null を返す', () => {
    assert.equal(sheetNameOf('A1:D10'), null);
    assert.equal(sheetNameOf('K186:N602'), null);
  });

  it('シート名を特定できない入力は null を返す', () => {
    assert.equal(sheetNameOf(''), null);
    assert.equal(sheetNameOf(undefined), null);
    assert.equal(sheetNameOf(null), null);
    assert.equal(sheetNameOf('!A1'), null);
    assert.equal(sheetNameOf("'閉じていない!A1"), null);
  });
});
