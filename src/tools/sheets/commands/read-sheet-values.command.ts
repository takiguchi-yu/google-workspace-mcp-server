import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import type { ToolArgs, ToolDefinition } from '../../../types/mcp.js';
import type { Command } from '../../base/command.interface.js';
import { createErrorResult } from '../../base/command.interface.js';
import { startRowOf } from '../a1-range.js';

/**
 * スプレッドシートのセル範囲のデータを読み取るコマンド
 */
export class ReadSheetValuesCommand implements Command {
  getToolDefinition(): ToolDefinition {
    return {
      name: 'sheets_read_sheet_values',
      description:
        'Reads values from a specific range in a Google Sheet. Row numbers in the output are the actual row numbers in the sheet, not offsets within the range.',
      inputSchema: {
        type: 'object',
        properties: {
          spreadsheetId: {
            type: 'string',
            description: 'The ID of the spreadsheet.',
          },
          range: {
            type: 'string',
            description: 'The range to read (e.g., "Sheet1!A1:D10", "A1:D10"). Defaults to "A1:Z1000".',
            default: 'A1:Z1000',
          },
        },
        required: ['spreadsheetId'],
      },
    };
  }

  async execute(args: ToolArgs, auth: OAuth2Client): Promise<CallToolResult> {
    const spreadsheetId = typeof args.spreadsheetId === 'string' ? args.spreadsheetId : '';
    const range = typeof args.range === 'string' ? args.range : 'A1:Z1000';

    if (spreadsheetId === '') {
      return createErrorResult('spreadsheetId が指定されていません。');
    }

    const sheets = google.sheets({ version: 'v4', auth });

    try {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range,
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
      let result = `範囲 "${range}" のデータを取得しました (${String(values.length)} 行):\n\n`;

      // ヘッダー行があると仮定して表形式で表示
      const maxColumns = Math.max(...values.map((row) => (Array.isArray(row) ? row.length : 0)));

      for (let i = 0; i < values.length; i++) {
        const row = values[i] as unknown;
        if (Array.isArray(row)) {
          // シート上の実際の行番号を添える
          const rowNum = startRow + i;
          const cells = Array.from({ length: maxColumns }, (_, j) => {
            const cell = row[j] as unknown;
            return typeof cell === 'string' || typeof cell === 'number' ? String(cell) : '';
          });
          result += `行 ${String(rowNum)}: ${cells.join(' | ')}\n`;
        }
      }

      return {
        content: [{ type: 'text', text: result }],
      };
    } catch (error) {
      return createErrorResult(
        `シートデータの読み取りに失敗しました: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
