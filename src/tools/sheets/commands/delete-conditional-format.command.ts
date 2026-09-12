import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import type { ToolArgs, ToolDefinition } from '../../../types/mcp.js';
import type { Command } from '../../base/command.interface.js';
import { createErrorResult } from '../../base/command.interface.js';
import { fetchSheetIds } from '../sheet-id-resolver.js';

/**
 * 条件付き書式のルールを削除するコマンド。
 *
 * ルールはシートごとに 0 から順番が振られており、削除するとそれより後ろの番号が繰り上がる。
 * 複数消すときは番号の大きい方から消す必要があるので、現在の番号を確かめてから呼ぶ。
 */
export class DeleteConditionalFormatCommand implements Command {
  getToolDefinition(): ToolDefinition {
    return {
      name: 'sheets_delete_conditional_format',
      description:
        'Delete a conditional formatting rule by its index. Indexes shift down when a rule is removed, so call sheets_list_conditional_formats first, and delete from the highest index when removing several.',
      inputSchema: {
        type: 'object',
        properties: {
          spreadsheetId: {
            type: 'string',
            description: 'The ID of the spreadsheet to modify.',
          },
          sheetName: {
            type: 'string',
            description: 'The name of the sheet holding the rule. Defaults to the first sheet.',
          },
          index: {
            type: 'number',
            description: 'The zero-based index of the rule to delete, as reported by sheets_list_conditional_formats.',
          },
        },
        required: ['spreadsheetId', 'index'],
      },
    };
  }

  async execute(args: ToolArgs, auth: OAuth2Client): Promise<CallToolResult> {
    const spreadsheetId = typeof args.spreadsheetId === 'string' ? args.spreadsheetId : '';
    const sheetName = typeof args.sheetName === 'string' ? args.sheetName : null;
    const index = typeof args.index === 'number' ? args.index : undefined;

    if (spreadsheetId === '') {
      return createErrorResult('spreadsheetId が指定されていません。');
    }
    if (index === undefined) {
      return createErrorResult('index が指定されていません。sheets_list_conditional_formats で確認してください。');
    }

    const sheets = google.sheets({ version: 'v4', auth });

    try {
      const sheetIds = await fetchSheetIds(sheets, spreadsheetId);

      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [{ deleteConditionalFormatRule: { sheetId: sheetIds.byTitle(sheetName), index } }],
        },
      });

      const target = sheetName ?? sheetIds.titles[0] ?? '先頭のシート';

      return {
        content: [
          {
            type: 'text',
            text: `シート "${target}" の条件付き書式 index=${String(index)} を削除しました。\n（残りのルールの index は繰り上がっています）`,
          },
        ],
      };
    } catch (error) {
      return createErrorResult(
        `条件付き書式の削除に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
