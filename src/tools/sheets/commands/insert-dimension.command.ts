import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import type { ToolArgs, ToolDefinition } from '../../../types/mcp.js';
import type { Command } from '../../base/command.interface.js';
import { createErrorResult } from '../../base/command.interface.js';

/**
 * スプレッドシートの指定位置に行または列を挿入するコマンド
 */
export class InsertDimensionCommand implements Command {
  constructor(private readonly auth: OAuth2Client) {}

  getToolDefinition(): ToolDefinition {
    return {
      name: 'sheets_insert_dimension',
      description: 'Inserts new rows or columns at a specific position in a sheet.',
      inputSchema: {
        type: 'object',
        properties: {
          spreadsheetId: {
            type: 'string',
            description: 'The ID of the spreadsheet to modify.',
          },
          sheetId: {
            type: 'number',
            description: 'The ID of the sheet to insert rows/columns into.',
          },
          dimension: {
            type: 'string',
            enum: ['ROWS', 'COLUMNS'],
            description: 'Whether to insert rows (ROWS) or columns (COLUMNS).',
          },
          startIndex: {
            type: 'number',
            description: 'The zero-based start index of the range to insert (inclusive).',
          },
          endIndex: {
            type: 'number',
            description: 'The zero-based end index of the range to insert (exclusive).',
          },
          inheritFromBefore: {
            type: 'boolean',
            description:
              'Whether the inserted rows/columns should inherit properties from the dimension before them. Defaults to false. Must be false when startIndex is 0.',
          },
        },
        required: ['spreadsheetId', 'sheetId', 'dimension', 'startIndex', 'endIndex'],
      },
    };
  }

  async execute(args: ToolArgs): Promise<CallToolResult> {
    const spreadsheetId = typeof args.spreadsheetId === 'string' ? args.spreadsheetId : '';
    const sheetId = typeof args.sheetId === 'number' ? args.sheetId : undefined;
    const dimension = args.dimension === 'ROWS' || args.dimension === 'COLUMNS' ? args.dimension : undefined;
    const startIndex = typeof args.startIndex === 'number' ? args.startIndex : undefined;
    const endIndex = typeof args.endIndex === 'number' ? args.endIndex : undefined;
    const inheritFromBefore = typeof args.inheritFromBefore === 'boolean' ? args.inheritFromBefore : false;

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

    const sheets = google.sheets({ version: 'v4', auth: this.auth });

    try {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              insertDimension: {
                range: {
                  sheetId,
                  dimension,
                  startIndex,
                  endIndex,
                },
                inheritFromBefore,
              },
            },
          ],
        },
      });

      return {
        content: [
          {
            type: 'text',
            text: `sheetId=${String(sheetId)} の ${dimension} を startIndex=${String(startIndex)}〜endIndex=${String(endIndex)} に挿入しました。（inheritFromBefore: ${String(inheritFromBefore)}）`,
          },
        ],
      };
    } catch (error) {
      return createErrorResult(`行・列の挿入に失敗しました: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
