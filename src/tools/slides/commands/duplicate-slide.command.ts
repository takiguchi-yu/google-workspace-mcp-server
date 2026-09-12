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

  async execute(args: ToolArgs, auth: OAuth2Client): Promise<CallToolResult> {
    const presentationId = typeof args.presentationId === 'string' ? args.presentationId : '';
    const pageObjectId = typeof args.pageObjectId === 'string' ? args.pageObjectId : '';
    const insertIndex = typeof args.insertIndex === 'number' ? args.insertIndex : -1;

    if (presentationId === '') {
      return createErrorResult('presentationId が指定されていません。');
    }
    if (pageObjectId === '') {
      return createErrorResult('pageObjectId が指定されていません。');
    }

    const slides = google.slides({ version: 'v1', auth });

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

      // 複製されたスライドは元の直後に入る。位置を指定されたときだけ後から動かす。
      // そのために複製先の ID をこちらで決めておく（未指定だと API が乱数で付ける）。
      const duplicateObjectId = `slide_${Date.now()}`;

      const requests: Record<string, unknown>[] = [
        {
          duplicateObject: {
            objectId: pageObjectId,
            objectIds: { [pageObjectId]: duplicateObjectId },
          },
        },
      ];

      if (insertIndex >= 0) {
        requests.push({
          updateSlidesPosition: { slideObjectIds: [duplicateObjectId], insertionIndex: insertIndex },
        });
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (slides.presentations as any).batchUpdate({
        presentationId,
        requestBody: { requests },
      });

      const position =
        insertIndex >= 0 ? `${String(insertIndex)} 番目` : `元のスライド（${String(sourceSlideIndex)} 番目）の直後`;

      return {
        content: [
          {
            type: 'text',
            text: `スライドを複製しました。\n複製先の objectId: ${duplicateObjectId}\n挿入位置: ${position}`,
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
