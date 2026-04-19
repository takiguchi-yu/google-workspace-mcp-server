import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import type { ToolArgs, ToolDefinition } from '../../../types/mcp.js';
import type { Command } from '../../base/command.interface.js';
import { createErrorResult } from '../../base/command.interface.js';

/**
 * スライド内の要素を削除するコマンド
 */
export class DeleteElementCommand implements Command {
  constructor(private readonly auth: OAuth2Client) {}

  getToolDefinition(): ToolDefinition {
    return {
      name: 'slides_delete_element',
      description: 'Delete a specific element (shape, text box, image, etc.) from a slide.',
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
            description: 'The object ID of the element to delete.',
          },
        },
        required: ['presentationId', 'pageObjectId', 'elementObjectId'],
      },
    };
  }

  async execute(args: ToolArgs): Promise<CallToolResult> {
    const presentationId = typeof args.presentationId === 'string' ? args.presentationId : '';
    const pageObjectId = typeof args.pageObjectId === 'string' ? args.pageObjectId : '';
    const elementObjectId = typeof args.elementObjectId === 'string' ? args.elementObjectId : '';

    if (presentationId === '') {
      return createErrorResult('presentationId が指定されていません。');
    }
    if (pageObjectId === '') {
      return createErrorResult('pageObjectId が指定されていません。');
    }
    if (elementObjectId === '') {
      return createErrorResult('elementObjectId が指定されていません。');
    }

    const slides = google.slides({ version: 'v1', auth: this.auth });

    try {
      const requests = [
        {
          deleteObject: {
            objectId: elementObjectId,
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
            text: `要素を削除しました。\nプレゼンテーションID: ${presentationId}`,
          },
        ],
      };
    } catch (error) {
      return createErrorResult(`要素の削除に失敗しました: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
