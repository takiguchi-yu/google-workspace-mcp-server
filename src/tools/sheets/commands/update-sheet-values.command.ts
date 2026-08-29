import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import type { ToolArgs, ToolDefinition } from '../../../types/mcp.js';
import type { Command } from '../../base/command.interface.js';
import { createErrorResult } from '../../base/command.interface.js';
import { sheetsErrorMessage } from '../sheets-error.js';

/**
 * スプレッドシートの指定範囲のセルを更新するコマンド
 */
export class UpdateSheetValuesCommand implements Command {
  getToolDefinition(): ToolDefinition {
    return {
      name: 'sheets_update_sheet_values',
      description: 'Updates values in a specific range of a Google Sheet.',
      inputSchema: {
        type: 'object',
        properties: {
          spreadsheetId: {
            type: 'string',
            description: 'The ID of the spreadsheet to update.',
          },
          range: {
            type: 'string',
            description: 'The range to update in A1 notation (e.g., "Sheet1!A1:B2", "A1:B2").',
          },
          values: {
            type: 'array',
            description: 'A 2D array of values to write. Each inner array represents a row.',
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

  async execute(args: ToolArgs, auth: OAuth2Client): Promise<CallToolResult> {
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

    const sheets = google.sheets({ version: 'v4', auth });

    try {
      const response = await sheets.spreadsheets.values.update({
        spreadsheetId,
        range,
        valueInputOption,
        requestBody: { values },
      });

      const updatedCells = response.data.updatedCells ?? 0;
      const updatedRange = response.data.updatedRange ?? range;

      return {
        content: [
          {
            type: 'text',
            text: `スプレッドシートを更新しました。\n更新範囲: ${updatedRange}\n更新セル数: ${String(updatedCells)} セル`,
          },
        ],
      };
    } catch (error) {
      return createErrorResult(
        `シートデータの更新に失敗しました: ${await sheetsErrorMessage(error, sheets, spreadsheetId)}`,
      );
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
