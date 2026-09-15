import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import type { ToolArgs, ToolDefinition } from '../../../types/mcp.js';
import type { Command } from '../../base/command.interface.js';
import { createErrorResult } from '../../base/command.interface.js';
import { startRowOf } from '../a1-range.js';
import { sheetsErrorMessage } from '../sheets-error.js';

/**
 * 既定で読む範囲。列は Sheets の最終列 ZZZ まで、行は 1000 行までに抑える。
 * 列を Z で切ると AA 以降が黙って読み落とされるため、列側は制限しない。
 */
const DEFAULT_RANGE = 'A1:ZZZ1000';

/** セルの値の見せ方として受け付ける値 */
const VALUE_RENDER_OPTIONS = ['FORMATTED_VALUE', 'UNFORMATTED_VALUE', 'FORMULA'] as const;

/**
 * スプレッドシートのセル範囲のデータを読み取るコマンド
 */
export class ReadSheetValuesCommand implements Command {
  getToolDefinition(): ToolDefinition {
    return {
      name: 'sheets_read_sheet_values',
      description:
        'Reads values from a specific range in a Google Sheet. Row numbers in the output are the actual row numbers in the sheet, not offsets within the range. By default cells are returned as they are displayed; pass valueRenderOption to read the underlying formulas or raw values instead.',
      inputSchema: {
        type: 'object',
        properties: {
          spreadsheetId: {
            type: 'string',
            description: 'The ID of the spreadsheet.',
          },
          range: {
            type: 'string',
            description:
              'The range to read (e.g., "Sheet1!A1:D10", "A1:D10"). Defaults to the first 1000 rows of every column ("A1:ZZZ1000"). Pass just a sheet name (e.g., "Sheet1") to read the whole sheet.',
            default: DEFAULT_RANGE,
          },
          valueRenderOption: {
            type: 'string',
            description:
              'How cells are rendered. FORMATTED_VALUE (default) returns what is displayed, including number and date formatting. UNFORMATTED_VALUE returns the underlying numbers and booleans without formatting. FORMULA returns the formula itself (e.g., "=SUM(A1:A9)") for cells that have one.',
            enum: [...VALUE_RENDER_OPTIONS],
            default: 'FORMATTED_VALUE',
          },
        },
        required: ['spreadsheetId'],
      },
    };
  }

  async execute(args: ToolArgs, auth: OAuth2Client): Promise<CallToolResult> {
    const spreadsheetId = typeof args.spreadsheetId === 'string' ? args.spreadsheetId : '';
    const range = typeof args.range === 'string' && args.range !== '' ? args.range : DEFAULT_RANGE;
    const valueRenderOption =
      typeof args.valueRenderOption === 'string' &&
      (VALUE_RENDER_OPTIONS as readonly string[]).includes(args.valueRenderOption)
        ? args.valueRenderOption
        : 'FORMATTED_VALUE';

    if (spreadsheetId === '') {
      return createErrorResult('spreadsheetId が指定されていません。');
    }

    const sheets = google.sheets({ version: 'v4', auth });

    try {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range,
        valueRenderOption,
      });

      const values = response.data.values ?? [];

      if (values.length === 0) {
        return {
          content: [{ type: 'text', text: '指定された範囲にデータが見つかりませんでした。' }],
        };
      }

      // 出力する行番号はシート上の実際の行を指す。レスポンスの range は実際に読まれた範囲なので、
      // リクエストの range を自前で解析するより開始行の特定が確実
      const startRow = startRowOf(response.data.range ?? range);

      // データを整形して表示
      const renderNote = valueRenderOption === 'FORMATTED_VALUE' ? '' : `, ${valueRenderOption}`;
      let result = `範囲 "${range}" のデータを取得しました (${String(values.length)} 行${renderNote}):\n\n`;

      // ヘッダー行があると仮定して表形式で表示
      const maxColumns = Math.max(...values.map((row) => (Array.isArray(row) ? row.length : 0)));

      for (let i = 0; i < values.length; i++) {
        const row = values[i] as unknown;
        if (Array.isArray(row)) {
          // シート上の実際の行番号を添える
          const rowNum = startRow + i;
          const cells = Array.from({ length: maxColumns }, (_, j) => {
            const cell = row[j] as unknown;
            // UNFORMATTED_VALUE では真偽値がそのまま返る。ここで弾くと TRUE/FALSE が空セルに見えてしまう
            return typeof cell === 'string' || typeof cell === 'number' || typeof cell === 'boolean'
              ? String(cell)
              : '';
          });
          result += `行 ${String(rowNum)}: ${cells.join(' | ')}\n`;
        }
      }

      return {
        content: [{ type: 'text', text: result }],
      };
    } catch (error) {
      return createErrorResult(
        `シートデータの読み取りに失敗しました: ${await sheetsErrorMessage(error, sheets, spreadsheetId)}`,
      );
    }
  }
}
