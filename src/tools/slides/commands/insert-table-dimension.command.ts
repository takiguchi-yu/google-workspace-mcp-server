import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import type { ToolArgs, ToolDefinition } from '../../../types/mcp.js';
import type { Command } from '../../base/command.interface.js';
import { createErrorResult } from '../../base/command.interface.js';
import { toNumber } from '../number-argument.js';
import { fetchTableSize } from '../presentation-lookup.js';
import { dimensionSchema, toDimension, toDimensionIndex } from '../table-dimension.js';

/**
 * 表に行・列を足すコマンド。
 *
 * 位置は A1 記法と同じ数え方（行は 1 から、列は A から）で受け、
 * その行・列の前と後ろのどちらに差し込むかを選ぶ。削除は別ツール。
 */
export class InsertTableDimensionCommand implements Command {
  getToolDefinition(): ToolDefinition {
    return {
      name: 'slides_insert_table_dimension',
      description:
        'Add rows or columns to an existing table. Say which row or column to insert next to, counted the way A1 notation does ("2" is the second row, "B" is the second column), and whether the new ones go before or after it. New cells are empty; use slides_update_text_shape to fill them.',
      inputSchema: {
        type: 'object',
        properties: {
          presentationId: {
            type: 'string',
            description: 'The ID of the presentation.',
          },
          objectId: {
            type: 'string',
            description: 'The object ID of the table.',
          },
          ...dimensionSchema,
          after: {
            type: 'boolean',
            description: 'Whether the new rows or columns go after the given one. Defaults to true.',
            default: true,
          },
          count: {
            type: 'number',
            description: 'How many rows or columns to add. Defaults to 1.',
            default: 1,
          },
        },
        required: ['presentationId', 'objectId', 'dimension', 'at'],
      },
    };
  }

  async execute(args: ToolArgs, auth: OAuth2Client): Promise<CallToolResult> {
    const presentationId = typeof args.presentationId === 'string' ? args.presentationId : '';
    const objectId = typeof args.objectId === 'string' ? args.objectId : '';

    if (presentationId === '') {
      return createErrorResult('presentationId が指定されていません。');
    }
    if (objectId === '') {
      return createErrorResult('objectId が指定されていません。');
    }

    const slides = google.slides({ version: 'v1', auth });
    let dimension: 'ROWS' | 'COLUMNS';
    let after: boolean;
    let count: number;

    try {
      dimension = toDimension(args.dimension);
      after = typeof args.after === 'boolean' ? args.after : true;
      count = args.count === undefined ? 1 : toNumber(args.count, 'count');

      if (!Number.isInteger(count) || count < 1) {
        return createErrorResult(`count は 1 以上の整数で指定してください（受け取った値: ${String(args.count)}）。`);
      }
    } catch (error) {
      return createErrorResult(error instanceof Error ? error.message : String(error));
    }

    let cellLocation: { rowIndex: number; columnIndex: number };

    try {
      const size = await fetchTableSize(slides, presentationId, objectId);
      const index = toDimensionIndex(args.at, dimension, size, 'at');
      cellLocation = dimension === 'ROWS' ? { rowIndex: index, columnIndex: 0 } : { rowIndex: 0, columnIndex: index };
    } catch (error) {
      return createErrorResult(error instanceof Error ? error.message : String(error));
    }

    try {
      await slides.presentations.batchUpdate({
        presentationId,
        requestBody: {
          requests: [
            dimension === 'ROWS'
              ? { insertTableRows: { tableObjectId: objectId, cellLocation, insertBelow: after, number: count } }
              : { insertTableColumns: { tableObjectId: objectId, cellLocation, insertRight: after, number: count } },
          ],
        },
      });

      const label = dimension === 'ROWS' ? '行' : '列';

      return {
        content: [
          {
            type: 'text',
            text: `表 ${objectId} に${label}を ${String(count)} つ足しました。\n${String(args.at)} の${after ? '後ろ' : '前'}に差し込みました。`,
          },
        ],
      };
    } catch (error) {
      return createErrorResult(`行・列の追加に失敗しました: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
