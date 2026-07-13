import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import type { ToolArgs, ToolDefinition } from '../../../types/mcp.js';
import type { Command } from '../../base/command.interface.js';
import { createErrorResult } from '../../base/command.interface.js';

/**
 * スプレッドシートの指定範囲の末尾にデータを追記するコマンド
 */
export class AppendSheetValuesCommand implements Command {
  constructor(private readonly auth: OAuth2Client) {}

  getToolDefinition(): ToolDefinition {
    return {
      name: 'sheets_append_values',
      description: 'Appends rows of data after the last row in a Google Sheet range.',
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
              'The range to search for existing data and append after (e.g., "Sheet1!A1", "A1:B1"). The API automatically finds the last row with data in the range.',
          },
          values: {
            type: 'array',
            description: 'A 2D array of values to append. Each inner array represents a row.',
            items: {
              type: 'array',
              items: {
                type: 'string',
              },
            },
          },
          valueInputOption: {
            type: 'string',
            description:
              'How the input data should be interpreted. "USER_ENTERED" (default) parses formulas and dates; "RAW" treats all values as strings.',
            enum: ['USER_ENTERED', 'RAW'],
            default: 'USER_ENTERED',
          },
        },
        required: ['spreadsheetId', 'range', 'values'],
      },
    };
  }

  async execute(args: ToolArgs): Promise<CallToolResult> {
    const spreadsheetId = typeof args.spreadsheetId === 'string' ? args.spreadsheetId : '';
    const range = typeof args.range === 'string' ? args.range : '';
    const valueInputOption =
      args.valueInputOption === 'RAW' || args.valueInputOption === 'USER_ENTERED'
        ? args.valueInputOption
        : 'USER_ENTERED';

    if (spreadsheetId === '') {
      return createErrorResult('spreadsheetId が指定されていません。');
    }
    if (range === '') {
      return createErrorResult('range が指定されていません。');
    }
    if (!Array.isArray(args.values)) {
      return createErrorResult(
        'values が指定されていません。2次元配列で指定してください。例: [["A1", "B1"], ["A2", "B2"]]',
      );
    }
    if ((args.values as unknown[]).length === 0) {
      return createErrorResult('values が空です。最低1行以上のデータが必要です。');
    }

    // values を string[][] に変換、詳細なバリデーション付き
    let values: string[][];
    try {
      values = (args.values as unknown[]).map((row, rowIndex) => {
        if (!Array.isArray(row)) {
          throw new Error(`行 ${rowIndex} が配列ではありません。各行は配列で指定してください。`);
        }
        return (row as unknown[]).map((cell) => this.convertToString(cell));
      });
    } catch (validationError) {
      return createErrorResult(
        `values の形式が無効です: ${validationError instanceof Error ? validationError.message : String(validationError)}`,
      );
    }

    const sheets = google.sheets({ version: 'v4', auth: this.auth });

    try {
      const response = await sheets.spreadsheets.values.append({
        spreadsheetId,
        range,
        valueInputOption,
        requestBody: { values },
      });

      const updatedRange = response.data.updates?.updatedRange ?? range;
      const updatedRows = response.data.updates?.updatedRows ?? 0;

      return {
        content: [
          {
            type: 'text',
            text: `データを追記しました。\n追記範囲: ${updatedRange}\n追記行数: ${String(updatedRows)} 行`,
          },
        ],
      };
    } catch (error) {
      return createErrorResult(`データの追記に失敗しました: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * セルの値を文字列に変換
   * 複数の型に対応（string、number、boolean、Date など）
   */
  private convertToString(cell: unknown): string {
    if (cell === null || cell === undefined) {
      return '';
    }
    if (typeof cell === 'string') {
      return cell;
    }
    if (typeof cell === 'number' || typeof cell === 'boolean') {
      return String(cell);
    }
    if (cell instanceof Date) {
      return cell.toISOString();
    }
    if (typeof cell === 'object') {
      return JSON.stringify(cell);
    }
    return String(cell);
  }
}
