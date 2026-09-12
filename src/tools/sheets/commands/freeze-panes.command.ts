import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import type { sheets_v4 } from 'googleapis';
import type { ToolArgs, ToolDefinition } from '../../../types/mcp.js';
import type { Command } from '../../base/command.interface.js';
import { createErrorResult } from '../../base/command.interface.js';
import { fetchSheetIds } from '../sheet-id-resolver.js';

/**
 * 先頭の行・列を固定するコマンド。
 *
 * 見出し行をスクロールしても残すための操作。固定を解くときは 0 を渡す。
 */
export class FreezePanesCommand implements Command {
  getToolDefinition(): ToolDefinition {
    return {
      name: 'sheets_freeze_panes',
      description:
        'Freeze the first rows and/or columns of a sheet so they stay visible while scrolling. Pass 0 to unfreeze. Freezing applies to a whole sheet, not a range.',
      inputSchema: {
        type: 'object',
        properties: {
          spreadsheetId: {
            type: 'string',
            description: 'The ID of the spreadsheet to modify.',
          },
          sheetName: {
            type: 'string',
            description: 'The name of the sheet to freeze. Defaults to the first sheet.',
          },
          frozenRowCount: {
            type: 'number',
            description: 'How many rows from the top stay visible. 1 freezes the header row, 0 unfreezes.',
          },
          frozenColumnCount: {
            type: 'number',
            description: 'How many columns from the left stay visible. 0 unfreezes.',
          },
        },
        required: ['spreadsheetId'],
      },
    };
  }

  async execute(args: ToolArgs, auth: OAuth2Client): Promise<CallToolResult> {
    const spreadsheetId = typeof args.spreadsheetId === 'string' ? args.spreadsheetId : '';
    const sheetName = typeof args.sheetName === 'string' ? args.sheetName : null;
    const frozenRowCount = typeof args.frozenRowCount === 'number' ? args.frozenRowCount : undefined;
    const frozenColumnCount = typeof args.frozenColumnCount === 'number' ? args.frozenColumnCount : undefined;

    if (spreadsheetId === '') {
      return createErrorResult('spreadsheetId が指定されていません。');
    }
    if (frozenRowCount === undefined && frozenColumnCount === undefined) {
      return createErrorResult('frozenRowCount か frozenColumnCount のどちらかを指定してください。');
    }

    const sheets = google.sheets({ version: 'v4', auth });

    try {
      const sheetIds = await fetchSheetIds(sheets, spreadsheetId);
      const gridProperties: sheets_v4.Schema$GridProperties = {};
      const fields: string[] = [];

      if (frozenRowCount !== undefined) {
        gridProperties.frozenRowCount = frozenRowCount;
        fields.push('gridProperties.frozenRowCount');
      }
      if (frozenColumnCount !== undefined) {
        gridProperties.frozenColumnCount = frozenColumnCount;
        fields.push('gridProperties.frozenColumnCount');
      }

      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              updateSheetProperties: {
                properties: { sheetId: sheetIds.byTitle(sheetName), gridProperties },
                fields: fields.join(','),
              },
            },
          ],
        },
      });

      const target = sheetName ?? sheetIds.titles[0] ?? '先頭のシート';
      const frozen = [
        frozenRowCount === undefined ? null : `行: ${String(frozenRowCount)}`,
        frozenColumnCount === undefined ? null : `列: ${String(frozenColumnCount)}`,
      ]
        .filter((part) => part !== null)
        .join(', ');

      return { content: [{ type: 'text', text: `シート "${target}" の固定を更新しました。（${frozen}）` }] };
    } catch (error) {
      return createErrorResult(`行・列の固定に失敗しました: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
