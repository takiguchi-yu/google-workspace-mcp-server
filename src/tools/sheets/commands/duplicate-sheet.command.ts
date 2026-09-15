import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import type { sheets_v4 } from 'googleapis';
import type { ToolArgs, ToolDefinition } from '../../../types/mcp.js';
import type { Command } from '../../base/command.interface.js';
import { createErrorResult } from '../../base/command.interface.js';
import { fetchSheetIds } from '../sheet-id-resolver.js';

/**
 * シート（タブ）を中身ごと複製するコマンド。
 *
 * 書式・条件付き書式・数式を含めてそのまま複製されるので、雛形のシートから
 * 月次のシートを起こすような使い方ができる。
 */
export class DuplicateSheetCommand implements Command {
  getToolDefinition(): ToolDefinition {
    return {
      name: 'sheets_duplicate_sheet',
      description:
        'Duplicate a sheet (tab) within the same spreadsheet, including its values, formulas, and formatting. Useful for creating a new sheet from a template sheet.',
      inputSchema: {
        type: 'object',
        properties: {
          spreadsheetId: {
            type: 'string',
            description: 'The ID of the spreadsheet to modify.',
          },
          sheetName: {
            type: 'string',
            description: 'The name of the sheet to duplicate. Defaults to the first sheet.',
          },
          newSheetName: {
            type: 'string',
            description:
              'The name of the new sheet. If omitted, Google picks one (e.g., "Copy of Sheet1"). Must not collide with an existing sheet name.',
          },
          insertIndex: {
            type: 'number',
            description:
              'Zero-based position of the new sheet among the tabs. 0 puts it first. If omitted, it is placed right after the source sheet.',
          },
        },
        required: ['spreadsheetId'],
      },
    };
  }

  async execute(args: ToolArgs, auth: OAuth2Client): Promise<CallToolResult> {
    const spreadsheetId = typeof args.spreadsheetId === 'string' ? args.spreadsheetId : '';
    const sheetName = typeof args.sheetName === 'string' ? args.sheetName : null;
    const newSheetName = typeof args.newSheetName === 'string' ? args.newSheetName : undefined;
    const insertIndex = typeof args.insertIndex === 'number' ? args.insertIndex : undefined;

    if (spreadsheetId === '') {
      return createErrorResult('spreadsheetId が指定されていません。');
    }
    if (newSheetName !== undefined && newSheetName === '') {
      return createErrorResult('newSheetName が空文字です。省略するか、シート名を指定してください。');
    }

    const sheets = google.sheets({ version: 'v4', auth });

    try {
      const sheetIds = await fetchSheetIds(sheets, spreadsheetId);
      const sourceSheetId = sheetIds.byTitle(sheetName);

      if (newSheetName !== undefined && sheetIds.titles.includes(newSheetName)) {
        return createErrorResult(
          `シート名 "${newSheetName}" は既に存在します。別の名前を指定してください。\n現在のシート: ${sheetIds.titles.join(', ')}`,
        );
      }

      const request: sheets_v4.Schema$DuplicateSheetRequest = { sourceSheetId };
      if (newSheetName !== undefined) {
        request.newSheetName = newSheetName;
      }
      if (insertIndex !== undefined) {
        request.insertSheetIndex = insertIndex;
      }

      const response = await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests: [{ duplicateSheet: request }] },
      });

      const created = response.data.replies?.[0]?.duplicateSheet?.properties;
      const createdTitle = created?.title ?? newSheetName ?? '（名前を取得できませんでした）';
      const createdIndex = created?.index;

      return {
        content: [
          {
            type: 'text',
            text:
              `シート "${sheetName ?? sheetIds.titles[0]!}" を複製しました。\n` +
              `複製先のシート名: ${createdTitle}\n` +
              `タブの位置: ${createdIndex === undefined || createdIndex === null ? '不明' : String(createdIndex)}\n` +
              `スプレッドシートURL: https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
          },
        ],
      };
    } catch (error) {
      return createErrorResult(`シートの複製に失敗しました: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
