import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import type { sheets_v4 } from 'googleapis';
import type { ToolArgs, ToolDefinition } from '../../../types/mcp.js';
import type { Command } from '../../base/command.interface.js';
import { createErrorResult } from '../../base/command.interface.js';
import { toGridIndexes } from '../grid-range.js';
import { fetchSheetIds } from '../sheet-id-resolver.js';

/**
 * 列幅・行高を変えるコマンド。
 *
 * ピクセル数を指定するか、内容に合わせて自動調整する。範囲は A1 記法で受け、
 * `Sheet1!B:D` のような列指定、`Sheet1!2:5` のような行指定をそのまま渡せる。
 */
export class ResizeDimensionCommand implements Command {
  getToolDefinition(): ToolDefinition {
    return {
      name: 'sheets_resize_dimension',
      description:
        'Set the width of columns or the height of rows, or auto-resize them to fit their contents. The range is given in A1 notation (e.g., "Sheet1!B:D" for columns, "Sheet1!2:5" for rows).',
      inputSchema: {
        type: 'object',
        properties: {
          spreadsheetId: {
            type: 'string',
            description: 'The ID of the spreadsheet to modify.',
          },
          resizes: {
            type: 'array',
            description:
              'Resizes to apply. Example: [{"range": "Sheet1!A:C", "dimension": "COLUMNS", "autoResize": true}, {"range": "Sheet1!1:1", "dimension": "ROWS", "pixelSize": 40}].',
            items: {
              type: 'object',
              properties: {
                range: {
                  type: 'string',
                  description:
                    'The rows or columns to resize in A1 notation (e.g., "Sheet1!B:D", "Sheet1!2:5"). Without a sheet name the first sheet is used.',
                },
                dimension: {
                  type: 'string',
                  description: 'Whether the range refers to rows or columns.',
                  enum: ['ROWS', 'COLUMNS'],
                },
                pixelSize: {
                  type: 'number',
                  description: 'The new width or height in pixels. Ignored when autoResize is true.',
                },
                autoResize: {
                  type: 'boolean',
                  description: 'Whether to size the rows or columns to fit their contents. Defaults to false.',
                  default: false,
                },
              },
              required: ['range', 'dimension'],
            },
          },
        },
        required: ['spreadsheetId', 'resizes'],
      },
    };
  }

  async execute(args: ToolArgs, auth: OAuth2Client): Promise<CallToolResult> {
    const spreadsheetId = typeof args.spreadsheetId === 'string' ? args.spreadsheetId : '';
    const resizes = args.resizes;

    if (spreadsheetId === '') {
      return createErrorResult('spreadsheetId が指定されていません。');
    }
    if (!Array.isArray(resizes) || resizes.length === 0) {
      return createErrorResult('resizes は 1 つ以上の要素を持つ配列で指定してください。');
    }

    const sheets = google.sheets({ version: 'v4', auth });

    try {
      const sheetIds = await fetchSheetIds(sheets, spreadsheetId);
      const requests: sheets_v4.Schema$Request[] = [];

      for (const entry of resizes as unknown[]) {
        if (typeof entry !== 'object' || entry === null) {
          return createErrorResult('resizes の要素はオブジェクトで指定してください。');
        }

        const spec = entry as Record<string, unknown>;
        const range = typeof spec.range === 'string' ? spec.range : '';
        const dimension = spec.dimension;
        const autoResize = spec.autoResize === true;

        if (range === '') {
          return createErrorResult('resizes の各要素には range（A1 記法）が必要です。');
        }
        if (dimension !== 'ROWS' && dimension !== 'COLUMNS') {
          return createErrorResult('dimension は ROWS または COLUMNS を指定してください。');
        }

        const dimensionRange = toDimensionRange(sheetIds.of(range), range, dimension);

        if (autoResize) {
          requests.push({ autoResizeDimensions: { dimensions: dimensionRange } });
          continue;
        }

        if (typeof spec.pixelSize !== 'number') {
          return createErrorResult(`range "${range}" には pixelSize か autoResize のどちらかが必要です。`);
        }

        requests.push({
          updateDimensionProperties: {
            range: dimensionRange,
            properties: { pixelSize: spec.pixelSize },
            fields: 'pixelSize',
          },
        });
      }

      await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } });

      const ranges = (resizes as Record<string, unknown>[]).map((spec) => String(spec.range)).join(', ');

      return {
        content: [
          { type: 'text', text: `${String(requests.length)} 件の行・列の大きさを変更しました。\n対象: ${ranges}` },
        ],
      };
    } catch (error) {
      return createErrorResult(
        `行・列の大きさの変更に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

/** A1 記法の範囲を、行または列の DimensionRange に読み替える */
const toDimensionRange = (
  sheetId: number,
  range: string,
  dimension: 'ROWS' | 'COLUMNS',
): sheets_v4.Schema$DimensionRange => {
  const indexes = toGridIndexes(range);
  const startIndex = dimension === 'ROWS' ? indexes.startRowIndex : indexes.startColumnIndex;
  const endIndex = dimension === 'ROWS' ? indexes.endRowIndex : indexes.endColumnIndex;

  if (startIndex === undefined || endIndex === undefined) {
    const example = dimension === 'ROWS' ? '"Sheet1!2:5"' : '"Sheet1!B:D"';
    throw new Error(`range "${range}" から ${dimension} の範囲を読み取れません。${example} のように指定してください。`);
  }

  return { sheetId, dimension, startIndex, endIndex };
};
