import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { explainSheetsError } from './sheets-error.js';

const unparsableRange = (range: string): Error => new Error(`Unable to parse range: ${range}`);

const titles = ['リソース計画', '開発WBS', 'レストランページ編集'];

describe('explainSheetsError', () => {
  it('一覧に無いシート名を指していたら、シート名が原因だと伝える', () => {
    const message = explainSheetsError(unparsableRange('restedit_field!K186:N602'), titles);

    assert.equal(
      message,
      'シート名 "restedit_field" が見つかりません。\n' +
        '利用可能なシート: リソース計画, 開発WBS, レストランページ編集\n' +
        '（シート名はリネームされることがあります。gid で特定するか、sheets_get_spreadsheet_info で現在の名前を確認してください）',
    );
  });

  it('クォートされた名前は引用符を外して突き合わせ、見つからなければ外した名前で伝える', () => {
    const message = explainSheetsError(unparsableRange("'restedit field'!A1"), titles);

    assert.equal(
      message,
      'シート名 "restedit field" が見つかりません。\n' +
        '利用可能なシート: リソース計画, 開発WBS, レストランページ編集\n' +
        '（シート名はリネームされることがあります。gid で特定するか、sheets_get_spreadsheet_info で現在の名前を確認してください）',
    );
  });

  it('クォートされたシート名も一覧と突き合わせる', () => {
    const message = explainSheetsError(unparsableRange("'開発WBS'!A1:B2"), titles);

    assert.equal(message, "Unable to parse range: '開発WBS'!A1:B2");
  });

  it('シート名が一覧にあるなら範囲の書式の問題なので、元のメッセージを返す', () => {
    const message = explainSheetsError(unparsableRange('レストランページ編集!ZZZZ1'), titles);

    assert.equal(message, 'Unable to parse range: レストランページ編集!ZZZZ1');
  });

  it('シート一覧を取得できなかった場合は元のメッセージを返す', () => {
    const message = explainSheetsError(unparsableRange('restedit_field!K186:N602'), null);

    assert.equal(message, 'Unable to parse range: restedit_field!K186:N602');
  });

  it('シート名を含まない範囲は書式の問題なので、元のメッセージを返す', () => {
    const message = explainSheetsError(unparsableRange('A1:B2'), titles);

    assert.equal(message, 'Unable to parse range: A1:B2');
  });

  it('範囲の解釈と無関係なエラーはそのまま返す', () => {
    assert.equal(
      explainSheetsError(new Error('Requested entity was not found.'), titles),
      'Requested entity was not found.',
    );
  });

  it('Error でない値も文字列にして返す', () => {
    assert.equal(explainSheetsError('boom', titles), 'boom');
  });
});
