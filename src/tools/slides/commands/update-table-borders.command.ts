import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import type { slides_v1 } from 'googleapis';
import type { ToolArgs, ToolDefinition } from '../../../types/mcp.js';
import type { Command } from '../../base/command.interface.js';
import { createErrorResult } from '../../base/command.interface.js';
import { pickEnum } from '../enum-argument.js';
import { DASH_STYLES } from '../line-style.js';
import { fetchTableSize } from '../presentation-lookup.js';
import type { TableSize } from '../table-range.js';
import { describeTableRange, toTableRange, wholeTable } from '../table-range.js';
import { BORDER_POSITIONS, toTableBorderProperties } from '../table-style.js';

/**
 * 表に罫線を引くコマンド。
 *
 * 範囲は A1 記法、位置は全体・外周・内側・各辺から選ぶ。外周と内側で見た目を変えるのは
 * よくある指定なので、sheets_set_borders と同じく複数まとめて受ける。
 *
 * **罫線は消せない**（太さ 0 を API が拒否する）ので、見えなくしたいときは背景と同じ色を渡す。
 */
export class UpdateTableBordersCommand implements Command {
  getToolDefinition(): ToolDefinition {
    return {
      name: 'slides_update_table_borders',
      description:
        'Draw borders on a table: color, thickness, and dash pattern. Each entry takes a range in A1 notation over the table ("A1:C3", "B:B", "2:3"; omit it to cover the whole table) and a position saying which edges inside that range are drawn. Several entries can be given, applied in order, so an outer border and an inner grid can be drawn in one call. Borders cannot be erased — to hide one, give it the same color as the background.',
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
          borders: {
            type: 'array',
            description: 'The borders to draw.',
            items: {
              type: 'object',
              properties: {
                range: {
                  type: 'string',
                  description:
                    'The cells whose borders to draw, in A1 notation over the table (e.g., "A1:C3"). Omit to cover the whole table.',
                },
                position: {
                  type: 'string',
                  description:
                    'Which edges to draw. ALL is every edge, OUTER only the outside of the range, INNER only the edges between cells.',
                  enum: [...BORDER_POSITIONS],
                  default: 'ALL',
                },
                color: { type: 'string', description: 'Border color as an RGB hex color (e.g., "#202124").' },
                weight: { type: 'number', description: 'Border thickness in points. Must be greater than 0.' },
                dashStyle: { type: 'string', description: 'Dash pattern of the border.', enum: [...DASH_STYLES] },
              },
            },
          },
        },
        required: ['presentationId', 'objectId', 'borders'],
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
    if (!Array.isArray(args.borders) || args.borders.length === 0) {
      return createErrorResult(
        'borders は 1 つ以上の { range, position, color, weight, dashStyle } を持つ配列で指定してください。',
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
      for (const [index, entry] of args.borders.entries()) {
        if (typeof entry !== 'object' || entry === null) {
          return createErrorResult(
            `borders[${String(index)}] は { range, position, color, weight } のオブジェクトで指定してください。`,
          );
        }

        const border = entry as Record<string, unknown>;
        const borderPosition =
          border.position === undefined
            ? 'ALL'
            : pickEnum(border.position, BORDER_POSITIONS, `borders[${String(index)}].position`);
        const tableRange =
          border.range === undefined
            ? wholeTable(size)
            : toTableRange(border.range, size, `borders[${String(index)}].range`);
        const { properties, fields } = toTableBorderProperties(border);

        if (fields.length === 0) {
          return createErrorResult(
            `borders[${String(index)}] に変更する見た目がありません（color、weight、dashStyle のいずれかを指定してください）。`,
          );
        }

        requests.push({
          updateTableBorderProperties: {
            objectId,
            borderPosition,
            tableRange,
            tableBorderProperties: properties,
            fields: fields.join(','),
          },
        });
        applied.push(`${describeTableRange(tableRange)} の ${borderPosition}: ${fields.join(', ')}`);
      }
    } catch (error) {
      return createErrorResult(error instanceof Error ? error.message : String(error));
    }

    try {
      await slides.presentations.batchUpdate({ presentationId, requestBody: { requests } });

      return {
        content: [{ type: 'text', text: `表 ${objectId} に罫線を引きました。\n${applied.join('\n')}` }],
      };
    } catch (error) {
      return createErrorResult(`罫線の更新に失敗しました: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
