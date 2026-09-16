import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import type { slides_v1 } from 'googleapis';
import type { ToolArgs, ToolDefinition } from '../../../types/mcp.js';
import type { Command } from '../../base/command.interface.js';
import { createErrorResult } from '../../base/command.interface.js';
import { toNumber } from '../number-argument.js';
import { fetchTableSize } from '../presentation-lookup.js';
import { DIMENSIONS, toDimension, toDimensionIndex } from '../table-dimension.js';
import type { TableSize } from '../table-range.js';

/**
 * 表の行の高さと列の幅を変えるコマンド。
 *
 * 位置を省略すると全行・全列にかかる。行の高さは「最低の高さ」で、中身が入り切らなければ
 * 実際の行はそれより高くなる（API の minRowHeight）。
 * 要素そのものの大きさは slides_update_element_transform が受け持つ。
 */
export class ResizeTableCommand implements Command {
  getToolDefinition(): ToolDefinition {
    return {
      name: 'slides_resize_table',
      description:
        'Set the height of rows or the width of columns of a table, in points. Name the rows or columns the way A1 notation does ("2" is the second row, "B" is the second column); omit "at" to apply to all of them. Row height is a minimum: a row grows taller when its text does not fit. To resize the table as a whole, use slides_update_element_transform.',
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
          resizes: {
            type: 'array',
            description: 'The rows or columns to resize and their new size.',
            items: {
              type: 'object',
              properties: {
                dimension: {
                  type: 'string',
                  description: 'Whether this entry resizes rows or columns.',
                  enum: [...DIMENSIONS],
                },
                at: {
                  type: 'string',
                  description:
                    'Which row or column, counted the way A1 notation does ("2" for the second row, "B" for the second column). Omit to apply to every row or column.',
                },
                size: {
                  type: 'number',
                  description:
                    'New size in points: the minimum height for ROWS, the width for COLUMNS. Must be greater than 0.',
                },
              },
              required: ['dimension', 'size'],
            },
          },
        },
        required: ['presentationId', 'objectId', 'resizes'],
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
    if (!Array.isArray(args.resizes) || args.resizes.length === 0) {
      return createErrorResult('resizes は 1 つ以上の { dimension, at, size } を持つ配列で指定してください。');
    }

    const slides = google.slides({ version: 'v1', auth });
    let size: TableSize;

    try {
      size = await fetchTableSize(slides, presentationId, objectId);
    } catch (error) {
      return createErrorResult(error instanceof Error ? error.message : String(error));
    }

    const requests: slides_v1.Schema$Request[] = [];
    const applied: string[] = [];

    try {
      for (const [index, entry] of args.resizes.entries()) {
        if (typeof entry !== 'object' || entry === null) {
          return createErrorResult(
            `resizes[${String(index)}] は { dimension, at, size } のオブジェクトで指定してください。`,
          );
        }

        const resize = entry as Record<string, unknown>;
        const dimension = toDimension(resize.dimension);
        const points = toNumber(resize.size, `resizes[${String(index)}].size`);

        if (points <= 0) {
          return createErrorResult(`resizes[${String(index)}].size は 0 より大きい値で指定してください。`);
        }

        // 位置を省略されたら indices ごと省く。API はそれを「全行・全列」と解釈する（実機で確認）
        const indices =
          resize.at === undefined
            ? undefined
            : [toDimensionIndex(resize.at, dimension, size, `resizes[${String(index)}].at`)];

        requests.push(
          dimension === 'ROWS'
            ? {
                updateTableRowProperties: {
                  objectId,
                  ...(indices === undefined ? {} : { rowIndices: indices }),
                  tableRowProperties: { minRowHeight: { magnitude: points, unit: 'PT' } },
                  fields: 'minRowHeight',
                },
              }
            : {
                updateTableColumnProperties: {
                  objectId,
                  ...(indices === undefined ? {} : { columnIndices: indices }),
                  tableColumnProperties: { columnWidth: { magnitude: points, unit: 'PT' } },
                  fields: 'columnWidth',
                },
              },
        );

        const label = dimension === 'ROWS' ? '行の高さ' : '列の幅';
        const where = resize.at === undefined ? '全体' : String(resize.at);
        applied.push(`${label}（${where}）: ${String(points)} pt`);
      }

      await slides.presentations.batchUpdate({ presentationId, requestBody: { requests } });

      return { content: [{ type: 'text', text: `表 ${objectId} の大きさを変えました。\n${applied.join('\n')}` }] };
    } catch (error) {
      return createErrorResult(
        `行高・列幅の変更に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
