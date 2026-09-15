import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import type { slides_v1 } from 'googleapis';
import type { ToolArgs, ToolDefinition } from '../../../types/mcp.js';
import type { Command } from '../../base/command.interface.js';
import { createErrorResult } from '../../base/command.interface.js';
import { pickEnum } from '../enum-argument.js';
import { toLineElementProperties } from '../line-geometry.js';
import { LINE_CATEGORIES, lineStyleSchema, toLineProperties } from '../line-style.js';
import { toNumber } from '../number-argument.js';

/**
 * スライドに線を引くコマンド。
 *
 * 線は始点・終点で受ける。API の createLine は位置と大きさの矩形でしか受けないので、
 * 2 点から矩形と符号付きの倍率に直す（line-geometry.ts）。
 * 色・太さ・破線・矢印の頭も同じツールで設定して、objectId を受け取って次の呼び出しに
 * 渡す往復を省いている。
 */
export class AddLineCommand implements Command {
  getToolDefinition(): ToolDefinition {
    return {
      name: 'slides_add_line',
      description:
        'Draw a line or arrow on a slide between two points. Coordinates are in points from the top-left corner of the slide, which is 720 x 405 pt. Color, thickness, dash style, and the arrowheads at each end are all set here, so no follow-up call is needed.',
      inputSchema: {
        type: 'object',
        properties: {
          presentationId: {
            type: 'string',
            description: 'The ID of the presentation.',
          },
          pageObjectId: {
            type: 'string',
            description: 'The object ID of the slide to draw on.',
          },
          startX: { type: 'number', description: 'X coordinate of the start point, in points from the left edge.' },
          startY: { type: 'number', description: 'Y coordinate of the start point, in points from the top edge.' },
          endX: { type: 'number', description: 'X coordinate of the end point, in points from the left edge.' },
          endY: { type: 'number', description: 'Y coordinate of the end point, in points from the top edge.' },
          lineCategory: {
            type: 'string',
            description: 'Shape of the line between the two points. Defaults to STRAIGHT.',
            enum: [...LINE_CATEGORIES],
            default: 'STRAIGHT',
          },
          ...lineStyleSchema,
        },
        required: ['presentationId', 'pageObjectId', 'startX', 'startY', 'endX', 'endY'],
      },
    };
  }

  async execute(args: ToolArgs, auth: OAuth2Client): Promise<CallToolResult> {
    const presentationId = typeof args.presentationId === 'string' ? args.presentationId : '';
    const pageObjectId = typeof args.pageObjectId === 'string' ? args.pageObjectId : '';

    if (presentationId === '') {
      return createErrorResult('presentationId が指定されていません。');
    }
    if (pageObjectId === '') {
      return createErrorResult('pageObjectId が指定されていません。');
    }

    const objectId = `line_${String(Date.now())}`;
    const requests: slides_v1.Schema$Request[] = [];
    let ends;

    try {
      ends = {
        startX: toNumber(args.startX, 'startX'),
        startY: toNumber(args.startY, 'startY'),
        endX: toNumber(args.endX, 'endX'),
        endY: toNumber(args.endY, 'endY'),
      };

      requests.push({
        createLine: {
          objectId,
          elementProperties: toLineElementProperties(pageObjectId, ends),
          lineCategory:
            args.lineCategory === undefined ? 'STRAIGHT' : pickEnum(args.lineCategory, LINE_CATEGORIES, 'lineCategory'),
        },
      });

      const { lineProperties, fields } = toLineProperties(args);

      if (fields.length > 0) {
        requests.push({ updateLineProperties: { objectId, lineProperties, fields: fields.join(',') } });
      }
    } catch (error) {
      return createErrorResult(error instanceof Error ? error.message : String(error));
    }

    const slides = google.slides({ version: 'v1', auth });

    try {
      await slides.presentations.batchUpdate({ presentationId, requestBody: { requests } });

      return {
        content: [
          {
            type: 'text',
            text:
              `線を引きました。\n` +
              `始点: ${String(ends.startX)}, ${String(ends.startY)} pt\n` +
              `終点: ${String(ends.endX)}, ${String(ends.endY)} pt\n` +
              `objectId: ${objectId}`,
          },
        ],
      };
    } catch (error) {
      return createErrorResult(`線の追加に失敗しました: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
