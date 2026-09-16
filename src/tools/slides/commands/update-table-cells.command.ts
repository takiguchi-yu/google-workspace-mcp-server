import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import type { slides_v1 } from 'googleapis';
import type { ToolArgs, ToolDefinition } from '../../../types/mcp.js';
import type { Command } from '../../base/command.interface.js';
import { createErrorResult } from '../../base/command.interface.js';
import { CONTENT_ALIGNMENTS } from '../content-alignment.js';
import { fetchTableSize } from '../presentation-lookup.js';
import type { TableSize } from '../table-range.js';
import { describeTableRange, toTableRange } from '../table-range.js';
import { toTableCellProperties } from '../table-style.js';

/**
 * 表のセルの塗りと縦揃えを変えるコマンド。
 *
 * 範囲は A1 記法で受ける（ADR 0001）。Slides の TableRange は始点と行数・列数で、
 * 行数・列数は必ず正の数でなければならないため、`A:C` のように端が開いた範囲を
 * 閉じるために表の大きさを先に読む。
 */
export class UpdateTableCellsCommand implements Command {
  getToolDefinition(): ToolDefinition {
    return {
      name: 'slides_update_table_cells',
      description:
        'Set the background color and vertical alignment of table cells. Ranges are A1 notation over the table itself: "A1:C1" is the first three cells of the header row, "B:B" is the whole second column, "2:3" is rows 2 and 3. Several ranges can be styled in one call, applied in order, so a later range wins where they overlap.',
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
          cells: {
            type: 'array',
            description: 'The ranges to style and what to do to each.',
            items: {
              type: 'object',
              properties: {
                range: {
                  type: 'string',
                  description:
                    'The cells to style, in A1 notation over the table (e.g., "A1:C1", "B:B", "2:3", "B2"). Ends that run past the table are clamped to it.',
                },
                fillColor: {
                  type: 'string',
                  description: 'Cell background as an RGB hex color (e.g., "#E8F0FE"), or "NONE" for no fill.',
                },
                contentAlignment: {
                  type: 'string',
                  description: 'Where the text sits vertically inside the cells.',
                  enum: [...CONTENT_ALIGNMENTS],
                },
              },
              required: ['range'],
            },
          },
        },
        required: ['presentationId', 'objectId', 'cells'],
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
    if (!Array.isArray(args.cells) || args.cells.length === 0) {
      return createErrorResult(
        'cells は 1 つ以上の { range, fillColor, contentAlignment } を持つ配列で指定してください。',
      );
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
      for (const [index, entry] of args.cells.entries()) {
        if (typeof entry !== 'object' || entry === null) {
          return createErrorResult(
            `cells[${String(index)}] は { range, fillColor, contentAlignment } のオブジェクトで指定してください。`,
          );
        }

        const cell = entry as Record<string, unknown>;
        const tableRange = toTableRange(cell.range, size, `cells[${String(index)}].range`);
        const { properties, fields } = toTableCellProperties(cell);

        if (fields.length === 0) {
          return createErrorResult(
            `cells[${String(index)}] に変更する見た目がありません（fillColor か contentAlignment を指定してください）。`,
          );
        }

        requests.push({
          updateTableCellProperties: {
            objectId,
            tableRange,
            tableCellProperties: properties,
            fields: fields.join(','),
          },
        });
        applied.push(`${describeTableRange(tableRange)}: ${fields.join(', ')}`);
      }
    } catch (error) {
      return createErrorResult(error instanceof Error ? error.message : String(error));
    }

    try {
      await slides.presentations.batchUpdate({ presentationId, requestBody: { requests } });

      return {
        content: [{ type: 'text', text: `表 ${objectId} のセルを更新しました。\n${applied.join('\n')}` }],
      };
    } catch (error) {
      return createErrorResult(`セルの更新に失敗しました: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
