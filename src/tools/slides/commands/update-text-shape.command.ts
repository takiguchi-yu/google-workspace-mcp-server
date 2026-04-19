import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import type { ToolArgs, ToolDefinition } from '../../../types/mcp.js';
import type { Command } from '../../base/command.interface.js';
import { createErrorResult } from '../../base/command.interface.js';

/**
 * テキスト要素（シェイプ）の内容を更新するコマンド
 */
export class UpdateTextShapeCommand implements Command {
  constructor(private readonly auth: OAuth2Client) {}

  getToolDefinition(): ToolDefinition {
    return {
      name: 'slides_update_text_shape',
      description: 'Update text content in an existing shape/text element on a slide.',
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
          elementObjectId: {
            type: 'string',
            description: 'The object ID of the shape/text element to update.',
          },
          text: {
            type: 'string',
            description: 'The new text content.',
          },
          appendText: {
            type: 'boolean',
            description: 'If true, append to existing text; if false (default), replace all text.',
            default: false,
          },
        },
        required: ['presentationId', 'pageObjectId', 'elementObjectId', 'text'],
      },
    };
  }

  async execute(args: ToolArgs): Promise<CallToolResult> {
    const presentationId = typeof args.presentationId === 'string' ? args.presentationId : '';
    const pageObjectId = typeof args.pageObjectId === 'string' ? args.pageObjectId : '';
    const elementObjectId = typeof args.elementObjectId === 'string' ? args.elementObjectId : '';
    const text = typeof args.text === 'string' ? args.text : '';
    const appendText = args.appendText === true;

    if (presentationId === '') {
      return createErrorResult('presentationId が指定されていません。');
    }
    if (pageObjectId === '') {
      return createErrorResult('pageObjectId が指定されていません。');
    }
    if (elementObjectId === '') {
      return createErrorResult('elementObjectId が指定されていません。');
    }
    if (text === '') {
      return createErrorResult('text が指定されていません。');
    }

    const slides = google.slides({ version: 'v1', auth: this.auth });

    try {
      const requests = appendText
        ? [
            {
              insertText: {
                objectId: elementObjectId,
                insertionIndex: 1_000_000, // 末尾に追加
                text: `\n${text}`,
              },
            },
          ]
        : [
            {
              deleteText: {
                objectId: elementObjectId,
                textRange: {
                  type: 'ALL',
                },
              },
            },
            {
              insertText: {
                objectId: elementObjectId,
                insertionIndex: 0,
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
            text: `テキスト要素を${appendText ? '更新' : '置換'}しました。\nプレゼンテーションID: ${presentationId}`,
          },
        ],
      };
    } catch (error) {
      return createErrorResult(
        `テキスト要素の更新に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
