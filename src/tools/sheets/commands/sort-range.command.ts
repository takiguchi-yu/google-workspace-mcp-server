import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import type { ToolArgs, ToolDefinition } from '../../../types/mcp.js';
import type { Command } from '../../base/command.interface.js';
import { createErrorResult } from '../../base/command.interface.js';
import { toGridIndexes } from '../grid-range.js';
import { fetchSheetIds } from '../sheet-id-resolver.js';
import { describeSortSpecs, sortSpecSchema, toSortSpecs } from '../sort-spec.js';

/**
 * 範囲の中身を並べ替えるコマンド。
 *
 * 並べ替えは範囲の中だけで起きるので、**見出し行を範囲に含めないこと**が要点になる。
 * 含めると見出しもデータとして並べ替えられてしまう。
 */
export class SortRangeCommand implements Command {
  getToolDefinition(): ToolDefinition {
    return {
      name: 'sheets_sort_range',
      description:
        'Sort the rows of a range by one or more columns. Exclude the header row from the range (e.g., "Sheet1!A2:D100"), otherwise the header is sorted along with the data. This rewrites the cells; it does not add a filter.',
      inputSchema: {
        type: 'object',
        properties: {
          spreadsheetId: {
            type: 'string',
            description: 'The ID of the spreadsheet to modify.',
          },
          range: {
            type: 'string',
            description:
              'The range to sort in A1 notation, excluding the header row (e.g., "Sheet1!A2:D100"). Without a sheet name the first sheet is used.',
          },
          sortSpecs: {
            type: 'array',
            description:
              'Columns to sort by, in priority order. Example: [{"column": "C", "order": "DESCENDING"}, {"column": "A"}].',
            items: sortSpecSchema as unknown as Record<string, unknown>,
          },
        },
        required: ['spreadsheetId', 'range', 'sortSpecs'],
      },
    };
  }

  async execute(args: ToolArgs, auth: OAuth2Client): Promise<CallToolResult> {
    const spreadsheetId = typeof args.spreadsheetId === 'string' ? args.spreadsheetId : '';
    const range = typeof args.range === 'string' ? args.range : '';

    if (spreadsheetId === '') {
      return createErrorResult('spreadsheetId が指定されていません。');
    }
    if (range === '') {
      return createErrorResult('range が指定されていません。');
    }

    const sheets = google.sheets({ version: 'v4', auth });

    try {
      const sortSpecs = toSortSpecs(args.sortSpecs, 'sortSpecs');
      const sheetIds = await fetchSheetIds(sheets, spreadsheetId);

      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              sortRange: {
                range: { sheetId: sheetIds.of(range), ...toGridIndexes(range) },
                sortSpecs,
              },
            },
          ],
        },
      });

      return {
        content: [
          {
            type: 'text',
            text: `範囲を並べ替えました。\n対象: ${range}\n並べ替えのキー: ${describeSortSpecs(sortSpecs)}\nスプレッドシートURL: https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
          },
        ],
      };
    } catch (error) {
      return createErrorResult(
        `範囲の並べ替えに失敗しました: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
