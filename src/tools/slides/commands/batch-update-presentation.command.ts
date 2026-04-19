import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import type { ToolArgs, ToolDefinition } from '../../../types/mcp.js';
import type { Command } from '../../base/command.interface.js';
import { createErrorResult } from '../../base/command.interface.js';

/**
 * プレゼンテーションに複数の更新リクエストをバッチで実行するコマンド
 */
export class BatchUpdatePresentationCommand implements Command {
  constructor(private readonly auth: OAuth2Client) {}

  getToolDefinition(): ToolDefinition {
    return {
      name: 'slides_batch_update_presentation',
      description:
        'Execute multiple update requests on a presentation in a single API call. Supports complex multi-step operations with various request types.',
      inputSchema: {
        type: 'object',
        properties: {
          presentationId: {
            type: 'string',
            description: 'The ID of the presentation.',
          },
          requests: {
            type: 'array',
            description:
              'Array of update requests. Each request is a Slides API request object (e.g., insertText, deleteObject, createShape, updatePageProperties, etc.).',
            items: {
              type: 'object',
              additionalProperties: true,
            },
          },
        },
        required: ['presentationId', 'requests'],
      },
    };
  }

  async execute(args: ToolArgs): Promise<CallToolResult> {
    const presentationId = typeof args.presentationId === 'string' ? args.presentationId : '';
    const requestsArg = args.requests;

    if (presentationId === '') {
      return createErrorResult('presentationId が指定されていません。');
    }
    if (!Array.isArray(requestsArg)) {
      return createErrorResult('requests は配列である必要があります。');
    }
    if (requestsArg.length === 0) {
      return createErrorResult('requests は少なくとも1つのリクエストを含む必要があります。');
    }

    // requests を any[] として型を緩和（ユーザーが任意の Google Slides API リクエストを渡せるように）
    const requests = requestsArg as unknown[];

    const slides = google.slides({ version: 'v1', auth: this.auth });

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = await (slides.presentations as any).batchUpdate({
        presentationId,
        requestBody: { requests },
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const replyCount = (response.data as any).replies?.length ?? 0;

      return {
        content: [
          {
            type: 'text',
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            text: `バッチ更新を実行しました。\nリクエスト数: ${String(requestsArg.length)}\nレスポンス数: ${String(replyCount)}\nプレゼンテーションID: ${presentationId}\n\n詳細: ${JSON.stringify((response.data as any).replies, null, 2)}`,
          },
        ],
      };
    } catch (error) {
      return createErrorResult(`バッチ更新に失敗しました: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
