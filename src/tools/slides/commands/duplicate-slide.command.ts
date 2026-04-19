import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import type { ToolArgs, ToolDefinition } from '../../../types/mcp.js';
import type { Command } from '../../base/command.interface.js';
import { createErrorResult } from '../../base/command.interface.js';

/**
 * スライドを複製するコマンド
 */
export class DuplicateSlideCommand implements Command {
  constructor(private readonly auth: OAuth2Client) {}

  getToolDefinition(): ToolDefinition {
    return {
      name: 'slides_duplicate_slide',
      description: 'Duplicate an existing slide within the presentation.',
      inputSchema: {
        type: 'object',
        properties: {
          presentationId: {
            type: 'string',
            description: 'The ID of the presentation.',
          },
          pageObjectId: {
            type: 'string',
            description: 'The object ID of the slide to duplicate.',
          },
          insertIndex: {
            type: 'number',
            description: 'The position for the new slide (0-based). Defaults to end of presentation.',
            default: -1,
          },
        },
        required: ['presentationId', 'pageObjectId'],
      },
    };
  }

  async execute(args: ToolArgs): Promise<CallToolResult> {
    const presentationId = typeof args.presentationId === 'string' ? args.presentationId : '';
    const pageObjectId = typeof args.pageObjectId === 'string' ? args.pageObjectId : '';
    const insertIndex = typeof args.insertIndex === 'number' ? args.insertIndex : -1;

    if (presentationId === '') {
      return createErrorResult('presentationId が指定されていません。');
    }
    if (pageObjectId === '') {
      return createErrorResult('pageObjectId が指定されていません。');
    }

    const slides = google.slides({ version: 'v1', auth: this.auth });

    try {
      // まずプレゼンテーション情報を取得してスライドのインデックスを確認
      const presentationResponse = await slides.presentations.get({
        presentationId,
      });

      const slides_list = presentationResponse.data.slides ?? [];
      const sourceSlideIndex = slides_list.findIndex((s) => s.objectId === pageObjectId);

      if (sourceSlideIndex === -1) {
        return createErrorResult('指定されたスライドが見つかりません。');
      }

      const targetIndex = insertIndex >= 0 ? insertIndex : slides_list.length;

      const requests = [
        {
          duplicateObject: {
            objectId: pageObjectId,
            objectsToDuplicateWithInheritedLineBreak: [pageObjectId],
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
            text: `スライドを複製しました。\nプレゼンテーションID: ${presentationId}\nターゲットインデックス: ${String(targetIndex)}`,
          },
        ],
      };
    } catch (error) {
      return createErrorResult(
        `スライドの複製に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
