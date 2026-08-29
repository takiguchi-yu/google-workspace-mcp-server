import type { sheets_v4 } from 'googleapis';
import { sheetNameOf } from './a1-range.js';

/**
 * Sheets API のエラーを、利用者が原因を特定できる文面に整えるヘルパー。
 *
 * Google API は存在しないシート名を渡されても `Unable to parse range` としか言わないため、
 * 文面からは「範囲の書式が不正」と読めてしまう。実際にはシートがリネームされただけ、
 * ということが起きるので、シート一覧と突き合わせて原因を名指しする。
 */

/** 範囲を解釈できなかったときに Google API が返すメッセージ。後続に問題の範囲が続く */
const UNPARSABLE_RANGE_PATTERN = /Unable to parse range:\s*(.+)/;

/**
 * エラーをシート一覧と突き合わせて、利用者に返すメッセージを組み立てる。
 *
 * 原因をシート名に帰着できないとき（範囲の解釈と無関係なエラー、シート名を含まない範囲、
 * シート名は実在する、一覧を取得できなかった）は、Google API のメッセージをそのまま返す。
 *
 * @param error 捕捉したエラー
 * @param sheetTitles スプレッドシートに実在するシート名。取得できなかった場合は null
 */
export const explainSheetsError = (error: unknown, sheetTitles: readonly string[] | null): string => {
  const message = error instanceof Error ? error.message : String(error);
  const sheetName = missingSheetNameOf(message);

  if (sheetName === null || sheetTitles === null || sheetTitles.includes(sheetName)) {
    return message;
  }

  return (
    `シート名 "${sheetName}" が見つかりません。\n` +
    `利用可能なシート: ${sheetTitles.join(', ')}\n` +
    '（シート名はリネームされることがあります。gid で特定するか、sheets_get_spreadsheet_info で現在の名前を確認してください）'
  );
};

/**
 * コマンドの catch 節から呼ぶ入口。シート一覧を引いたうえで `explainSheetsError` に委ねる。
 *
 * 一覧を引くのはシート名が原因でありうるときだけなので、通常経路のコストは変わらない。
 *
 * @param error 捕捉したエラー
 * @param sheets 認証済みの Sheets API クライアント
 * @param spreadsheetId 操作対象のスプレッドシート
 */
export const sheetsErrorMessage = async (
  error: unknown,
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
): Promise<string> => {
  const message = error instanceof Error ? error.message : String(error);

  if (missingSheetNameOf(message) === null) {
    return message;
  }

  return explainSheetsError(error, await fetchSheetTitles(sheets, spreadsheetId));
};

/** メッセージが範囲の解釈失敗を示していれば、指定されていたシート名を返す。そうでなければ null */
const missingSheetNameOf = (message: string): string | null => {
  const failedRange = UNPARSABLE_RANGE_PATTERN.exec(message)?.[1];
  return failedRange === undefined ? null : sheetNameOf(failedRange);
};

/** シート名の一覧を引く。引けなかった場合は null（エラー整形のための呼び出しなので握り潰す） */
const fetchSheetTitles = async (sheets: sheets_v4.Sheets, spreadsheetId: string): Promise<string[] | null> => {
  try {
    const response = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: 'sheets.properties.title',
    });

    return (response.data.sheets ?? []).flatMap((sheet) => {
      const title = sheet.properties?.title;
      return typeof title === 'string' ? [title] : [];
    });
  } catch {
    return null;
  }
};
