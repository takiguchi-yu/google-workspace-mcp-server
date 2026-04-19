import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import type { ToolArgs, ToolDefinition } from '../../../types/mcp.js';
import type { Command } from '../../base/command.interface.js';
import { createErrorResult } from '../../base/command.interface.js';

/**
 * スプレッドシートの指定範囲のセルを更新するコマンド
 */
export class UpdateSheetValuesCommand implements Command {
  constructor(private readonly auth: OAuth2Client) {}

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
      return createErrorResult('values が指定されていません。2次元配列で指定してください。');
    }

    // values を string[][] に変換
    const values: string[][] = (args.values as unknown[]).map((row) => {
      if (!Array.isArray(row)) return [];
      return (row as unknown[]).map((cell) =>
        typeof cell === 'string' || typeof cell === 'number' ? String(cell) : '',
      );
    });

    const sheets = google.sheets({ version: 'v4', auth: this.auth });

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
        `シートデータの更新に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
