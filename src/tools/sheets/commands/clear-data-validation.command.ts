import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import type { ToolArgs, ToolDefinition } from '../../../types/mcp.js';
import type { Command } from '../../base/command.interface.js';
import { createErrorResult } from '../../base/command.interface.js';
import { toGridIndexes } from '../grid-range.js';
import { fetchSheetIds } from '../sheet-id-resolver.js';

/**
 * セルの入力規則を解除するコマンド。
 *
 * Sheets API は `setDataValidation` から `rule` を省略すると解除になるが、引数の省略が
 * 破壊的操作に化けるのは事故のもとなので、設定とは別のツールにして明示させる。
 */
export class ClearDataValidationCommand implements Command {
  getToolDefinition(): ToolDefinition {
    return {
      name: 'sheets_clear_data_validation',
      description:
        'Remove data validation rules (dropdowns, checkboxes, input restrictions) from one or more cell ranges. The cell values themselves are left untouched.',
      inputSchema: {
        type: 'object',
        properties: {
          spreadsheetId: {
            type: 'string',
            description: 'The ID of the spreadsheet to modify.',
          },
          ranges: {
            type: 'array',
            description:
              'Ranges to clear the rules from, in A1 notation (e.g., ["Sheet1!C2:C100"]). Without a sheet name the first sheet is used.',
            items: { type: 'string' },
          },
        },
        required: ['spreadsheetId', 'ranges'],
      },
    };
  }

  async execute(args: ToolArgs, auth: OAuth2Client): Promise<CallToolResult> {
    const spreadsheetId = typeof args.spreadsheetId === 'string' ? args.spreadsheetId : '';
    const ranges = args.ranges;

    if (spreadsheetId === '') {
      return createErrorResult('spreadsheetId が指定されていません。');
    }
    if (!Array.isArray(ranges) || ranges.length === 0 || ranges.some((range) => typeof range !== 'string')) {
      return createErrorResult('ranges は 1 つ以上の A1 記法の文字列を持つ配列で指定してください。');
    }

    const sheets = google.sheets({ version: 'v4', auth });

    try {
      const sheetIds = await fetchSheetIds(sheets, spreadsheetId);
      const requests = (ranges as string[]).map((range) => ({
        setDataValidation: {
          range: { sheetId: sheetIds.of(range), ...toGridIndexes(range) },
        },
      }));

      await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } });

      return {
        content: [
          {
            type: 'text',
            text: `入力規則を解除しました。\n対象: ${(ranges as string[]).join(', ')}\nスプレッドシートURL: https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
          },
        ],
      };
    } catch (error) {
      return createErrorResult(
        `入力規則の解除に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
