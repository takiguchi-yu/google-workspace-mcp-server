import type { sheets_v4 } from 'googleapis';
import { sheetNameOf } from './a1-range.js';

/**
 * A1 記法のシート名から sheetId を引くための対応表。
 *
 * 書式のリクエストは範囲を sheetId で指すが、ツールの引数は A1 記法に統一しているため、
 * コマンドはこの対応表を 1 度作ってから、受け取ったすべての範囲を解決する。
 * 1 回の呼び出しで何範囲を渡されても、スプレッドシートを読むのは 1 度だけになる。
 */
export interface SheetIds {
  /**
   * 範囲が指すシートの sheetId を返す。シート名を含まない範囲では先頭のシートを指す。
   * @throws 範囲が実在しないシートを指していた場合
   */
  of(range: string): number;

  /**
   * シート名から sheetId を返す。null を渡すと先頭のシートを指す。
   * @throws 実在しないシート名を渡した場合
   */
  byTitle(title: string | null): number;

  /** スプレッドシートに実在するシート名。先頭が既定のシート */
  readonly titles: readonly string[];
}

/**
 * スプレッドシートのシート一覧を引いて対応表を作る。
 *
 * @param sheets 認証済みの Sheets API クライアント
 * @param spreadsheetId 対象のスプレッドシート
 * @throws シートを 1 つも読み取れなかった場合
 */
export const fetchSheetIds = async (sheets: sheets_v4.Sheets, spreadsheetId: string): Promise<SheetIds> => {
  const response = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets.properties(sheetId,title)',
  });

  const entries = (response.data.sheets ?? []).flatMap((sheet) => {
    const { sheetId, title } = sheet.properties ?? {};
    return typeof sheetId === 'number' && typeof title === 'string' ? [[title, sheetId] as const] : [];
  });

  const first = entries[0];
  if (first === undefined) {
    throw new Error(`スプレッドシート ${spreadsheetId} からシートを読み取れませんでした。`);
  }

  const idsByTitle = new Map(entries);
  const titles = entries.map(([title]) => title);

  const byTitle = (title: string | null): number => {
    if (title === null) {
      return first[1];
    }

    const sheetId = idsByTitle.get(title);
    if (sheetId === undefined) {
      throw new Error(`シート名 "${title}" が見つかりません。\n利用可能なシート: ${titles.join(', ')}`);
    }

    return sheetId;
  };

  return {
    titles,
    byTitle,
    of: (range: string): number => byTitle(sheetNameOf(range)),
  };
};
