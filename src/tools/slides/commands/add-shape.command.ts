import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import type { ToolArgs, ToolDefinition } from '../../../types/mcp.js';
import type { Command } from '../../base/command.interface.js';
import { createErrorResult } from '../../base/command.interface.js';

/**
 * スライドに図形を追加するコマンド
 */
export class AddShapeCommand implements Command {
  constructor(private readonly auth: OAuth2Client) {}

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
              'Type of shape to create. Examples: RECTANGLE, OVAL, TRIANGLE, DIAMOND, ARROW_EAST, ARROW_WEST, CLOUD, HEART, STAR.',
            enum: [
              'RECTANGLE',
              'OVAL',
              'TRIANGLE',
              'DIAMOND',
              'ARROW_EAST',
              'ARROW_WEST',
              'ARROW_NORTH',
              'ARROW_SOUTH',
              'CLOUD',
              'HEART',
              'STAR',
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
            description: 'Border width in EMUs. Defaults to 12700 (0.014 inches).',
            default: 12_700,
          },
        },
        required: ['presentationId', 'pageObjectId', 'shapeType'],
      },
    };
  }

  private hexToRgb(hex: string): { red: number; green: number; blue: number } {
    const cleanHex = hex.replace(/^#/, '');
    const red = parseInt(cleanHex.substring(0, 2), 16) / 255;
    const green = parseInt(cleanHex.substring(2, 4), 16) / 255;
    const blue = parseInt(cleanHex.substring(4, 6), 16) / 255;
    return { red, green, blue };
  }

  async execute(args: ToolArgs): Promise<CallToolResult> {
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

    const slides = google.slides({ version: 'v1', auth: this.auth });

    try {
      const shapeObjectId = `shape_${Date.now()}`;

      const shapeProperties: Record<string, unknown> = {
        shapeType,
        transform: {
          scaleX: { magnitude: width, unit: 'EMU' },
          scaleY: { magnitude: height, unit: 'EMU' },
          translateX: { magnitude: left, unit: 'EMU' },
          translateY: { magnitude: top, unit: 'EMU' },
        },
      };

      // Fill color の設定
      if (fillColor) {
        const rgb = this.hexToRgb(fillColor);
        shapeProperties.shapeBackgroundFill = {
          solidFill: {
            color: {
              rgbColor: rgb,
            },
          },
        };
      }

      // Stroke (border) の設定
      const strokeRgb = this.hexToRgb(strokeColor);
      shapeProperties.outline = {
        color: {
          rgbColor: strokeRgb,
        },
        weight: {
          magnitude: strokeWidth,
          unit: 'EMU',
        },
      };

      const requests = [
        {
          createShape: {
            objectId: shapeObjectId,
            shapeType,
            elementProperties: {
              pageObjectId,
              transform: {
                scaleX: { magnitude: width },
                scaleY: { magnitude: height },
                translateX: { magnitude: left },
                translateY: { magnitude: top },
              },
            },
          },
        },
        {
          updateShapeProperties: {
            objectId: shapeObjectId,
            shapeProperties,
            fields: 'shapeBackgroundFill,outline',
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
