import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import type { sheets_v4 } from 'googleapis';
import type { ToolArgs, ToolDefinition } from '../../../types/mcp.js';
import type { Command } from '../../base/command.interface.js';
import { createErrorResult } from '../../base/command.interface.js';
import { toGridIndexes } from '../grid-range.js';
import { fetchSheetIds } from '../sheet-id-resolver.js';

/** 結合の仕方。UNMERGE だけが結合を解く */
const MERGE_TYPES = ['MERGE_ALL', 'MERGE_COLUMNS', 'MERGE_ROWS', 'UNMERGE'] as const;

/**
 * セルを結合・解除するコマンド。
 *
 * 見出しを列にまたがらせる、表題を 1 行に広げるといった用途で使う。
 */
export class MergeCellsCommand implements Command {
  getToolDefinition(): ToolDefinition {
    return {
      name: 'sheets_merge_cells',
      description:
        'Merge or unmerge cell ranges. MERGE_ALL makes the range a single cell, MERGE_COLUMNS merges each column, MERGE_ROWS merges each row, and UNMERGE splits existing merges back apart.',
      inputSchema: {
        type: 'object',
        properties: {
          spreadsheetId: {
            type: 'string',
            description: 'The ID of the spreadsheet to modify.',
          },
          merges: {
            type: 'array',
            description:
              'Merges to apply, one entry per range. Example: [{"range": "Sheet1!A1:D1", "mergeType": "MERGE_ALL"}].',
            items: {
              type: 'object',
              properties: {
                range: {
                  type: 'string',
                  description:
                    'The range to merge or unmerge in A1 notation (e.g., "Sheet1!A1:D1"). Without a sheet name the first sheet is used.',
                },
                mergeType: {
                  type: 'string',
                  description: 'How the range is merged. Defaults to MERGE_ALL.',
                  enum: [...MERGE_TYPES],
                  default: 'MERGE_ALL',
                },
              },
              required: ['range'],
            },
          },
        },
        required: ['spreadsheetId', 'merges'],
      },
    };
  }

  async execute(args: ToolArgs, auth: OAuth2Client): Promise<CallToolResult> {
    const spreadsheetId = typeof args.spreadsheetId === 'string' ? args.spreadsheetId : '';
    const merges = args.merges;

    if (spreadsheetId === '') {
      return createErrorResult('spreadsheetId が指定されていません。');
    }
    if (!Array.isArray(merges) || merges.length === 0) {
      return createErrorResult('merges は 1 つ以上の要素を持つ配列で指定してください。');
    }

    const sheets = google.sheets({ version: 'v4', auth });

    try {
      const sheetIds = await fetchSheetIds(sheets, spreadsheetId);
      const requests: sheets_v4.Schema$Request[] = [];

      for (const entry of merges as unknown[]) {
        if (typeof entry !== 'object' || entry === null) {
          return createErrorResult('merges の要素はオブジェクトで指定してください。');
        }

        const spec = entry as Record<string, unknown>;
        const range = typeof spec.range === 'string' ? spec.range : '';
        const mergeType = spec.mergeType === undefined ? 'MERGE_ALL' : spec.mergeType;

        if (range === '') {
          return createErrorResult('merges の各要素には range（A1 記法）が必要です。');
        }
        if (typeof mergeType !== 'string' || !(MERGE_TYPES as readonly string[]).includes(mergeType)) {
          return createErrorResult(`mergeType は ${MERGE_TYPES.join(' / ')} のいずれかで指定してください。`);
        }

        const gridRange = { sheetId: sheetIds.of(range), ...toGridIndexes(range) };

        requests.push(
          mergeType === 'UNMERGE'
            ? { unmergeCells: { range: gridRange } }
            : { mergeCells: { range: gridRange, mergeType } },
        );
      }

      await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } });

      const ranges = (merges as Record<string, unknown>[]).map((spec) => String(spec.range)).join(', ');

      return {
        content: [{ type: 'text', text: `${String(requests.length)} 件の範囲の結合を更新しました。\n対象: ${ranges}` }],
      };
    } catch (error) {
      return createErrorResult(`セルの結合に失敗しました: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
