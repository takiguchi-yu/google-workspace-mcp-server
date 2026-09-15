import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import type { ToolArgs, ToolDefinition } from '../../../types/mcp.js';
import type { Command } from '../../base/command.interface.js';
import { createErrorResult } from '../../base/command.interface.js';
import { hexToRgb } from '../../shared/color.js';

/**
 * スライドに図形を追加するコマンド
 */
export class AddShapeCommand implements Command {
  getToolDefinition(): ToolDefinition {
    return {
      name: 'slides_add_shape',
      description:
        'Add a geometric shape (rectangle, circle, triangle, etc.) to a slide with custom position, size, and colors.',
      inputSchema: {
        type: 'object',
        properties: {
          presentationId: {
            type: 'string',
            description: 'The ID of the presentation.',
          },
          pageObjectId: {
            type: 'string',
            description: 'The object ID of the slide.',
          },
          shapeType: {
            type: 'string',
            description:
              'Type of shape to create. Examples: RECTANGLE, ELLIPSE, TRIANGLE, DIAMOND, RIGHT_ARROW, LEFT_ARROW, CLOUD, HEART, STAR_5.',
            enum: [
              'RECTANGLE',
              'ROUND_RECTANGLE',
              'ELLIPSE',
              'TRIANGLE',
              'DIAMOND',
              'RIGHT_ARROW',
              'LEFT_ARROW',
              'UP_ARROW',
              'DOWN_ARROW',
              'CLOUD',
              'HEART',
              'STAR_5',
              'PENTAGON',
              'HEXAGON',
              'OCTAGON',
              'PLUS',
            ],
          },
          left: {
            type: 'number',
            description: 'Left position in EMUs. Defaults to 0.',
            default: 0,
          },
          top: {
            type: 'number',
            description: 'Top position in EMUs. Defaults to 0.',
            default: 0,
          },
          width: {
            type: 'number',
            description: 'Shape width in EMUs. Defaults to 914400 (1 inch).',
            default: 914_400,
          },
          height: {
            type: 'number',
            description: 'Shape height in EMUs. Defaults to 914400 (1 inch).',
            default: 914_400,
          },
          fillColor: {
            type: 'string',
            description: 'RGB hex color for fill (e.g., "#FF5733"). Defaults to no fill.',
          },
          strokeColor: {
            type: 'string',
            description: 'RGB hex color for border (e.g., "#000000"). Defaults to black.',
            default: '#000000',
          },
          strokeWidth: {
            type: 'number',
            description: 'Border width in EMUs (12700 EMU = 1 pt). Defaults to 12700, which is 1 pt.',
            default: 12_700,
          },
        },
        required: ['presentationId', 'pageObjectId', 'shapeType'],
      },
    };
  }

  async execute(args: ToolArgs, auth: OAuth2Client): Promise<CallToolResult> {
    const presentationId = typeof args.presentationId === 'string' ? args.presentationId : '';
    const pageObjectId = typeof args.pageObjectId === 'string' ? args.pageObjectId : '';
    const shapeType = typeof args.shapeType === 'string' ? args.shapeType : '';
    const left = typeof args.left === 'number' ? args.left : 0;
    const top = typeof args.top === 'number' ? args.top : 0;
    const width = typeof args.width === 'number' ? args.width : 914_400;
    const height = typeof args.height === 'number' ? args.height : 914_400;
    const fillColor = typeof args.fillColor === 'string' ? args.fillColor : '';
    const strokeColor = typeof args.strokeColor === 'string' ? args.strokeColor : '#000000';
    const strokeWidth = typeof args.strokeWidth === 'number' ? args.strokeWidth : 12_700;

    if (presentationId === '') {
      return createErrorResult('presentationId が指定されていません。');
    }
    if (pageObjectId === '') {
      return createErrorResult('pageObjectId が指定されていません。');
    }
    if (shapeType === '') {
      return createErrorResult('shapeType が指定されていません。');
    }

    const slides = google.slides({ version: 'v1', auth });

    try {
      const shapeObjectId = `shape_${Date.now()}`;

      const shapeProperties: Record<string, unknown> = {
        // 枠線。色は outline.color ではなく outlineFill.solidFill.color に入れる
        outline: {
          outlineFill: { solidFill: { color: { rgbColor: hexToRgb(strokeColor) } } },
          weight: { magnitude: strokeWidth, unit: 'EMU' },
        },
      };
      const fields = ['outline'];

      if (fillColor) {
        shapeProperties.shapeBackgroundFill = { solidFill: { color: { rgbColor: hexToRgb(fillColor) } } };
        fields.push('shapeBackgroundFill');
      }

      const requests = [
        {
          createShape: {
            objectId: shapeObjectId,
            shapeType,
            elementProperties: {
              pageObjectId,
              // 大きさは size で渡す。transform の scale は倍率（スカラー）であって寸法ではない
              size: {
                width: { magnitude: width, unit: 'EMU' },
                height: { magnitude: height, unit: 'EMU' },
              },
              transform: { scaleX: 1, scaleY: 1, translateX: left, translateY: top, unit: 'EMU' },
            },
          },
        },
        {
          updateShapeProperties: {
            objectId: shapeObjectId,
            shapeProperties,
            fields: fields.join(','),
          },
        },
      ];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (slides.presentations as any).batchUpdate({
        presentationId,
        requestBody: { requests },
      });

      return {
        content: [
          {
            type: 'text',
            text: `図形を追加しました。\nタイプ: ${shapeType}\nプレゼンテーションID: ${presentationId}`,
          },
        ],
      };
    } catch (error) {
      return createErrorResult(`図形の追加に失敗しました: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
