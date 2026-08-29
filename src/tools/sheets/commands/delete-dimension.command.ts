import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import type { ToolArgs, ToolDefinition } from '../../../types/mcp.js';
import type { Command } from '../../base/command.interface.js';
import { createErrorResult } from '../../base/command.interface.js';

/**
 * スプレッドシートの指定範囲の行または列を削除するコマンド
 */
export class DeleteDimensionCommand implements Command {
  getToolDefinition(): ToolDefinition {
    return {
      name: 'sheets_delete_dimension',
      description: 'Deletes rows or columns from a specific range in a sheet.',
      inputSchema: {
        type: 'object',
        properties: {
          spreadsheetId: {
            type: 'string',
            description: 'The ID of the spreadsheet to modify.',
          },
          sheetId: {
            type: 'number',
            description: 'The ID of the sheet to delete rows/columns from.',
          },
          dimension: {
            type: 'string',
            enum: ['ROWS', 'COLUMNS'],
            description: 'Whether to delete rows (ROWS) or columns (COLUMNS).',
          },
          startIndex: {
            type: 'number',
            description: 'The zero-based start index of the range to delete (inclusive).',
          },
          endIndex: {
            type: 'number',
            description: 'The zero-based end index of the range to delete (exclusive).',
          },
        },
        required: ['spreadsheetId', 'sheetId', 'dimension', 'startIndex', 'endIndex'],
      },
    };
  }

  async execute(args: ToolArgs, auth: OAuth2Client): Promise<CallToolResult> {
    const spreadsheetId = typeof args.spreadsheetId === 'string' ? args.spreadsheetId : '';
    const sheetId = typeof args.sheetId === 'number' ? args.sheetId : undefined;
    const dimension = args.dimension === 'ROWS' || args.dimension === 'COLUMNS' ? args.dimension : undefined;
    const startIndex = typeof args.startIndex === 'number' ? args.startIndex : undefined;
    const endIndex = typeof args.endIndex === 'number' ? args.endIndex : undefined;

    if (spreadsheetId === '') {
      return createErrorResult('spreadsheetId が指定されていません。');
    }
    if (sheetId === undefined) {
      return createErrorResult('sheetId が指定されていません。');
    }
    if (dimension === undefined) {
      return createErrorResult('dimension は ROWS または COLUMNS を指定してください。');
    }
    if (startIndex === undefined) {
      return createErrorResult('startIndex が指定されていません。');
    }
    if (endIndex === undefined) {
      return createErrorResult('endIndex が指定されていません。');
    }

    const sheets = google.sheets({ version: 'v4', auth });

    try {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              deleteDimension: {
                range: {
                  sheetId,
                  dimension,
                  startIndex,
                  endIndex,
                },
              },
            },
          ],
        },
      });

      return {
        content: [
          {
            type: 'text',
            text: `sheetId=${String(sheetId)} の ${dimension} を startIndex=${String(startIndex)}〜endIndex=${String(endIndex)} の範囲で削除しました。`,
          },
        ],
      };
    } catch (error) {
      return createErrorResult(`行・列の削除に失敗しました: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
