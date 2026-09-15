import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import type { ToolArgs, ToolDefinition } from '../../../types/mcp.js';
import type { Command } from '../../base/command.interface.js';
import { createErrorResult } from '../../base/command.interface.js';
import { fetchSheetIds } from '../sheet-id-resolver.js';

/**
 * シートのフィルタを取り除くコマンド。
 *
 * 隠れていた行が戻るだけで、セルの中身は変わらない。
 */
export class ClearBasicFilterCommand implements Command {
  getToolDefinition(): ToolDefinition {
    return {
      name: 'sheets_clear_basic_filter',
      description:
        'Remove the basic filter from a sheet. Rows hidden by the filter become visible again; cell contents are not changed.',
      inputSchema: {
        type: 'object',
        properties: {
          spreadsheetId: {
            type: 'string',
            description: 'The ID of the spreadsheet to modify.',
          },
          sheetName: {
            type: 'string',
            description: 'The name of the sheet to clear the filter from. Defaults to the first sheet.',
          },
        },
        required: ['spreadsheetId'],
      },
    };
  }

  async execute(args: ToolArgs, auth: OAuth2Client): Promise<CallToolResult> {
    const spreadsheetId = typeof args.spreadsheetId === 'string' ? args.spreadsheetId : '';
    const sheetName = typeof args.sheetName === 'string' ? args.sheetName : null;

    if (spreadsheetId === '') {
      return createErrorResult('spreadsheetId が指定されていません。');
    }

    const sheets = google.sheets({ version: 'v4', auth });

    try {
      const sheetIds = await fetchSheetIds(sheets, spreadsheetId);
      const sheetId = sheetIds.byTitle(sheetName);

      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests: [{ clearBasicFilter: { sheetId } }] },
      });

      return {
        content: [
          {
            type: 'text',
            text: `シート "${sheetName ?? sheetIds.titles[0]!}" のフィルタを取り除きました。\nスプレッドシートURL: https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
          },
        ],
      };
    } catch (error) {
      return createErrorResult(
        `フィルタの削除に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
