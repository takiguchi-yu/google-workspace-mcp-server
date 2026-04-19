import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import type { ToolArgs, ToolDefinition } from '../../../types/mcp.js';
import type { Command } from '../../base/command.interface.js';
import { createErrorResult } from '../../base/command.interface.js';

/**
 * スライドに新しいテキストボックスを追加するコマンド
 */
export class AddTextBoxCommand implements Command {
  constructor(private readonly auth: OAuth2Client) {}

  getToolDefinition(): ToolDefinition {
    return {
      name: 'slides_add_text_box',
      description: 'Add a new text box to a slide with custom position and content.',
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
          text: {
            type: 'string',
            description: 'The text content for the text box.',
          },
          left: {
            type: 'number',
            description: 'Left position in EMUs (English Metric Units). 1 inch = 914400 EMUs. Defaults to 0.',
            default: 0,
          },
          top: {
            type: 'number',
            description: 'Top position in EMUs. Defaults to 0.',
            default: 0,
          },
          width: {
            type: 'number',
            description: 'Box width in EMUs. Defaults to 1828800 (2 inches).',
            default: 1_828_800,
          },
          height: {
            type: 'number',
            description: 'Box height in EMUs. Defaults to 914400 (1 inch).',
            default: 914_400,
          },
        },
        required: ['presentationId', 'pageObjectId', 'text'],
      },
    };
  }

  async execute(args: ToolArgs): Promise<CallToolResult> {
    const presentationId = typeof args.presentationId === 'string' ? args.presentationId : '';
    const pageObjectId = typeof args.pageObjectId === 'string' ? args.pageObjectId : '';
    const text = typeof args.text === 'string' ? args.text : '';
    const left = typeof args.left === 'number' ? args.left : 0;
    const top = typeof args.top === 'number' ? args.top : 0;
    const width = typeof args.width === 'number' ? args.width : 1_828_800;
    const height = typeof args.height === 'number' ? args.height : 914_400;

    if (presentationId === '') {
      return createErrorResult('presentationId が指定されていません。');
    }
    if (pageObjectId === '') {
      return createErrorResult('pageObjectId が指定されていません。');
    }
    if (text === '') {
      return createErrorResult('text が指定されていません。');
    }

    const slides = google.slides({ version: 'v1', auth: this.auth });

    try {
      const shapeObjectId = `textbox_${Date.now()}`;
      const requests = [
        {
          createShape: {
            objectId: shapeObjectId,
            shapeType: 'TEXT_BOX',
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
          insertText: {
            objectId: shapeObjectId,
            text,
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
            text: `テキストボックスを追加しました。\nプレゼンテーションID: ${presentationId}`,
          },
        ],
      };
    } catch (error) {
      return createErrorResult(
        `テキストボックスの追加に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
