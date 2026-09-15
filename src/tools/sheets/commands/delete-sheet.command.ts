import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import type { ToolArgs, ToolDefinition } from '../../../types/mcp.js';
import type { Command } from '../../base/command.interface.js';
import { createErrorResult } from '../../base/command.interface.js';
import { fetchSheetIds } from '../sheet-id-resolver.js';

/**
 * シート（タブ）ごと削除するコマンド。
 *
 * 中身ごと消える取り返しのつかない操作なので、シート名は省略できない。
 * 既定のシートに暗黙で当たると事故になるため、他のツールのように「省略したら先頭」にはしない。
 */
export class DeleteSheetCommand implements Command {
  getToolDefinition(): ToolDefinition {
    return {
      name: 'sheets_delete_sheet',
      description:
        'Delete a sheet (tab) and everything on it from a spreadsheet. The sheet name is required — there is no default. A spreadsheet must keep at least one sheet, so the last remaining one cannot be deleted.',
      inputSchema: {
        type: 'object',
        properties: {
          spreadsheetId: {
            type: 'string',
            description: 'The ID of the spreadsheet to modify.',
          },
          sheetName: {
            type: 'string',
            description: 'The name of the sheet to delete. Required; there is no default sheet for this tool.',
          },
        },
        required: ['spreadsheetId', 'sheetName'],
      },
    };
  }

  async execute(args: ToolArgs, auth: OAuth2Client): Promise<CallToolResult> {
    const spreadsheetId = typeof args.spreadsheetId === 'string' ? args.spreadsheetId : '';
    const sheetName = typeof args.sheetName === 'string' ? args.sheetName : '';

    if (spreadsheetId === '') {
      return createErrorResult('spreadsheetId が指定されていません。');
    }
    if (sheetName === '') {
      return createErrorResult('sheetName が指定されていません。削除するシートは明示してください。');
    }

    const sheets = google.sheets({ version: 'v4', auth });

    try {
      const sheetIds = await fetchSheetIds(sheets, spreadsheetId);
      const sheetId = sheetIds.byTitle(sheetName);

      if (sheetIds.titles.length === 1) {
        return createErrorResult(
          `"${sheetName}" はこのスプレッドシートに残る最後のシートです。スプレッドシートはシートを 1 つ以上持つ必要があるため削除できません。`,
        );
      }

      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests: [{ deleteSheet: { sheetId } }] },
      });

      const remaining = sheetIds.titles.filter((title) => title !== sheetName);

      return {
        content: [
          {
            type: 'text',
            text: `シート "${sheetName}" を削除しました。\n残っているシート: ${remaining.join(', ')}\nスプレッドシートURL: https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
          },
        ],
      };
    } catch (error) {
      return createErrorResult(`シートの削除に失敗しました: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
