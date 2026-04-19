import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import type { ToolArgs, ToolDefinition } from '../../../types/mcp.js';
import type { Command } from '../../base/command.interface.js';
import { createErrorResult } from '../../base/command.interface.js';

/**
 * スプレッドシートの指定範囲のセルをクリアするコマンド
 */
export class ClearSheetValuesCommand implements Command {
  constructor(private readonly auth: OAuth2Client) {}

  getToolDefinition(): ToolDefinition {
    return {
      name: 'sheets_clear_sheet_values',
      description: 'Clears values from a specific range in a Google Sheet. Formatting is preserved.',
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
              'The range to clear in A1 notation (e.g., "Sheet1!A1:D10", "A1:Z1000"). Only values are cleared; formatting is preserved.',
          },
        },
        required: ['spreadsheetId', 'range'],
      },
    };
  }

  async execute(args: ToolArgs): Promise<CallToolResult> {
    const spreadsheetId = typeof args.spreadsheetId === 'string' ? args.spreadsheetId : '';
    const range = typeof args.range === 'string' ? args.range : '';

    if (spreadsheetId === '') {
      return createErrorResult('spreadsheetId が指定されていません。');
    }
    if (range === '') {
      return createErrorResult('range が指定されていません。');
    }

    const sheets = google.sheets({ version: 'v4', auth: this.auth });

    try {
      const response = await sheets.spreadsheets.values.clear({
        spreadsheetId,
        range,
      });

      const clearedRange = response.data.clearedRange ?? range;

      return {
        content: [
          {
            type: 'text',
            text: `セルの値をクリアしました。\nクリア範囲: ${clearedRange}`,
          },
        ],
      };
    } catch (error) {
      return createErrorResult(`セルのクリアに失敗しました: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
