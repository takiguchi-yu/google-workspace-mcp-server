import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import type { sheets_v4 } from 'googleapis';
import type { ToolArgs, ToolDefinition } from '../../../types/mcp.js';
import type { Command } from '../../base/command.interface.js';
import { createErrorResult } from '../../base/command.interface.js';
import { hexToRgb } from '../../shared/color.js';
import { fetchSheetIds } from '../sheet-id-resolver.js';

/**
 * シート（タブ）そのものの属性を変えるコマンド。
 *
 * リネーム・タブの色・タブの並び順・非表示を扱う。**行や列の固定は扱わない** —
 * 同じ SheetProperties にあるが、`sheets_freeze_panes` の責務なので入口を 2 つ作らない。
 */
export class UpdateSheetPropertiesCommand implements Command {
  getToolDefinition(): ToolDefinition {
    return {
      name: 'sheets_update_sheet_properties',
      description:
        'Rename a sheet (tab), change its tab color, move it to another position among the tabs, or hide/show it. Only the properties you specify are changed. To freeze rows or columns, use sheets_freeze_panes instead.',
      inputSchema: {
        type: 'object',
        properties: {
          spreadsheetId: {
            type: 'string',
            description: 'The ID of the spreadsheet to modify.',
          },
          sheetName: {
            type: 'string',
            description: 'The name of the sheet to change. Defaults to the first sheet.',
          },
          title: {
            type: 'string',
            description: 'The new name of the sheet. Must not collide with an existing sheet name.',
          },
          tabColor: {
            type: 'string',
            description: 'The color of the tab as an RGB hex color (e.g., "#4285F4").',
          },
          index: {
            type: 'number',
            description: 'Zero-based position of the sheet among the tabs. 0 moves it to the front.',
          },
          hidden: {
            type: 'boolean',
            description: 'Whether the sheet is hidden from the tab bar. A spreadsheet must keep one visible sheet.',
          },
        },
        required: ['spreadsheetId'],
      },
    };
  }

  async execute(args: ToolArgs, auth: OAuth2Client): Promise<CallToolResult> {
    const spreadsheetId = typeof args.spreadsheetId === 'string' ? args.spreadsheetId : '';
    const sheetName = typeof args.sheetName === 'string' ? args.sheetName : null;
    const title = typeof args.title === 'string' ? args.title : undefined;
    const tabColor = typeof args.tabColor === 'string' ? args.tabColor : undefined;
    const index = typeof args.index === 'number' ? args.index : undefined;
    const hidden = typeof args.hidden === 'boolean' ? args.hidden : undefined;

    if (spreadsheetId === '') {
      return createErrorResult('spreadsheetId が指定されていません。');
    }
    if (title === undefined && tabColor === undefined && index === undefined && hidden === undefined) {
      return createErrorResult('title / tabColor / index / hidden のうち、変更したいものを 1 つ以上指定してください。');
    }
    if (title === '') {
      return createErrorResult('title が空文字です。シート名は 1 文字以上で指定してください。');
    }

    const sheets = google.sheets({ version: 'v4', auth });

    try {
      const sheetIds = await fetchSheetIds(sheets, spreadsheetId);
      const sheetId = sheetIds.byTitle(sheetName);
      const currentTitle = sheetName ?? sheetIds.titles[0]!;

      if (title !== undefined && title !== currentTitle && sheetIds.titles.includes(title)) {
        return createErrorResult(
          `シート名 "${title}" は既に存在します。別の名前を指定してください。\n現在のシート: ${sheetIds.titles.join(', ')}`,
        );
      }

      const properties: sheets_v4.Schema$SheetProperties = { sheetId };
      const fields: string[] = [];
      const changes: string[] = [];

      if (title !== undefined) {
        properties.title = title;
        fields.push('title');
        changes.push(`シート名: ${currentTitle} → ${title}`);
      }
      if (tabColor !== undefined) {
        properties.tabColor = hexToRgb(tabColor);
        fields.push('tabColor');
        changes.push(`タブの色: ${tabColor}`);
      }
      if (index !== undefined) {
        properties.index = index;
        fields.push('index');
        changes.push(`タブの位置: ${String(index)}`);
      }
      if (hidden !== undefined) {
        properties.hidden = hidden;
        fields.push('hidden');
        changes.push(hidden ? 'タブを非表示にする' : 'タブを表示する');
      }

      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests: [{ updateSheetProperties: { properties, fields: fields.join(',') } }] },
      });

      return {
        content: [
          {
            type: 'text',
            text: `シート "${currentTitle}" の設定を変更しました。\n${changes.map((change) => `  - ${change}`).join('\n')}\nスプレッドシートURL: https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
          },
        ],
      };
    } catch (error) {
      return createErrorResult(
        `シートの設定変更に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
