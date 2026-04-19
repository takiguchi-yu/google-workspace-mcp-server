import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import type { ToolArgs, ToolDefinition } from '../../../types/mcp.js';
import type { Command } from '../../base/command.interface.js';
import { createErrorResult } from '../../base/command.interface.js';

/**
 * 既存のスプレッドシートに新しいシートを追加するコマンド
 */
export class AddSheetCommand implements Command {
  constructor(private readonly auth: OAuth2Client) {}

  getToolDefinition(): ToolDefinition {
    return {
      name: 'sheets_add_sheet',
      description: 'Adds a new sheet (tab) to an existing Google Spreadsheet.',
      inputSchema: {
        type: 'object',
        properties: {
          spreadsheetId: {
            type: 'string',
            description: 'The ID of the spreadsheet to add a sheet to.',
          },
          title: {
            type: 'string',
            description: 'The title of the new sheet.',
          },
        },
        required: ['spreadsheetId', 'title'],
      },
    };
  }

  async execute(args: ToolArgs): Promise<CallToolResult> {
    const spreadsheetId = typeof args.spreadsheetId === 'string' ? args.spreadsheetId : '';
    const title = typeof args.title === 'string' ? args.title : '';

    if (spreadsheetId === '') {
      return createErrorResult('spreadsheetId が指定されていません。');
    }
    if (title === '') {
      return createErrorResult('title が指定されていません。');
    }

    const sheets = google.sheets({ version: 'v4', auth: this.auth });

    try {
      const response = await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: { title },
              },
            },
          ],
        },
      });

      const addedSheet = response.data.replies?.[0]?.addSheet?.properties;
      const sheetTitle = addedSheet?.title ?? title;
      const sheetId = addedSheet?.sheetId ?? 0;

      return {
        content: [
          {
            type: 'text',
            text: `シートを追加しました。\nシート名: ${sheetTitle}\nシートID: ${String(sheetId)}\nスプレッドシートURL: https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
          },
        ],
      };
    } catch (error) {
      return createErrorResult(`シートの追加に失敗しました: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
