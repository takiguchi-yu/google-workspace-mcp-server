import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import type { ToolArgs, ToolDefinition } from '../../../types/mcp.js';
import type { Command } from '../../base/command.interface.js';
import { createErrorResult } from '../../base/command.interface.js';

/**
 * スプレッドシートの詳細情報を取得するコマンド
 */
export class GetSpreadsheetInfoCommand implements Command {
  getToolDefinition(): ToolDefinition {
    return {
      name: 'sheets_get_spreadsheet_info',
      description: 'Gets information about a specific spreadsheet including its sheets, properties, and structure.',
      inputSchema: {
        type: 'object',
        properties: {
          spreadsheetId: {
            type: 'string',
            description: 'The ID of the spreadsheet to get information for.',
          },
        },
        required: ['spreadsheetId'],
      },
    };
  }

  async execute(args: ToolArgs, auth: OAuth2Client): Promise<CallToolResult> {
    const spreadsheetId = typeof args.spreadsheetId === 'string' ? args.spreadsheetId : '';
    if (spreadsheetId === '') {
      return createErrorResult('spreadsheetId が指定されていません。');
    }

    const sheets = google.sheets({ version: 'v4', auth });

    try {
      const response = await sheets.spreadsheets.get({
        spreadsheetId,
        fields:
          'spreadsheetId,properties(title,locale,timeZone),sheets(properties(title,sheetId,gridProperties(rowCount,columnCount)))',
      });

      const data = response.data;
      const title = data.properties?.title ?? 'Untitled';
      const locale = data.properties?.locale ?? '不明';
      const timeZone = data.properties?.timeZone ?? '不明';
      const sheetsList = data.sheets ?? [];

      let result = `スプレッドシート情報:\n\n`;
      result += `タイトル: ${title}\n`;
      result += `ID: ${spreadsheetId}\n`;
      result += `ロケール: ${locale}\n`;
      result += `タイムゾーン: ${timeZone}\n`;
      result += `URL: https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit\n\n`;
      result += `シート一覧 (${String(sheetsList.length)} 件):\n`;

      for (const sheet of sheetsList) {
        const sheetTitle = sheet.properties?.title ?? 'Untitled';
        const sheetId = sheet.properties?.sheetId;
        const rowCount = sheet.properties?.gridProperties?.rowCount ?? 0;
        const columnCount = sheet.properties?.gridProperties?.columnCount ?? 0;
        result += `  - ${sheetTitle} (ID: ${sheetId !== undefined ? String(sheetId) : '不明'}, 行数: ${String(rowCount)}, 列数: ${String(columnCount)})\n`;
      }

      return {
        content: [{ type: 'text', text: result }],
      };
    } catch (error) {
      return createErrorResult(
        `スプレッドシート情報の取得に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
