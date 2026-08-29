import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { startRowOf } from './a1-range.js';

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
