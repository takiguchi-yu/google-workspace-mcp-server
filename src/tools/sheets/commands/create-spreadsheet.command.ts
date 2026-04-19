import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import type { ToolArgs, ToolDefinition } from '../../../types/mcp.js';
import type { Command } from '../../base/command.interface.js';
import { createErrorResult } from '../../base/command.interface.js';

/**
 * 新規スプレッドシートを作成するコマンド
 */
export class CreateSpreadsheetCommand implements Command {
  constructor(private readonly auth: OAuth2Client) {}

  getToolDefinition(): ToolDefinition {
    return {
      name: 'sheets_create_spreadsheet',
      description: 'Creates a new Google Spreadsheet with a specified title.',
      inputSchema: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: 'The title of the new spreadsheet.',
          },
          sheetTitle: {
            type: 'string',
            description: 'The title of the first sheet. Defaults to "Sheet1".',
            default: 'Sheet1',
          },
        },
        required: ['title'],
      },
    };
  }

  async execute(args: ToolArgs): Promise<CallToolResult> {
    const title = typeof args.title === 'string' ? args.title : '';
    const sheetTitle = typeof args.sheetTitle === 'string' ? args.sheetTitle : 'Sheet1';

    if (title === '') {
      return createErrorResult('title が指定されていません。');
    }

    const sheets = google.sheets({ version: 'v4', auth: this.auth });

    try {
      const response = await sheets.spreadsheets.create({
        requestBody: {
          properties: { title },
          sheets: [
            {
              properties: { title: sheetTitle },
            },
          ],
        },
      });

      const spreadsheetId = response.data.spreadsheetId ?? 'unknown';
      const spreadsheetTitle = response.data.properties?.title ?? title;

      return {
        content: [
          {
            type: 'text',
            text: `スプレッドシートを作成しました。\nタイトル: ${spreadsheetTitle}\nID: ${spreadsheetId}\nURL: https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
          },
        ],
      };
    } catch (error) {
      return createErrorResult(
        `スプレッドシートの作成に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
