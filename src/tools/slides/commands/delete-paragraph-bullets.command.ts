import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import type { slides_v1 } from 'googleapis';
import type { ToolArgs, ToolDefinition } from '../../../types/mcp.js';
import type { Command } from '../../base/command.interface.js';
import { createErrorResult } from '../../base/command.interface.js';
import { textRangeSchema, toTextRange } from '../text-range.js';

/**
 * 箇条書きを解除するコマンド。
 *
 * slides_create_paragraph_bullets の対になる操作を別ツールにしてある。
 * 設定ツールの引数の省略が解除に化けると、戻す手立てのないまま体裁が消えるため。
 *
 * **解除するとインデントが書き換わる。** 実機で確かめた値（入れ子 3 段の箇条書き）:
 * 解除前 indentStart 36 / 72 / 108pt → 解除後 なし / 36 / 72pt。
 * 入れ子の深さは残るが、箇条書きが足していたぶんは消えるため、先頭の段落は余白まで戻る。
 */
export class DeleteParagraphBulletsCommand implements Command {
  getToolDefinition(): ToolDefinition {
    return {
      name: 'slides_delete_paragraph_bullets',
      description:
        'Remove bullets or numbering from the paragraphs of a shape or text box, keeping the text. Nested paragraphs keep an indent that reflects how deep they were, but top-level ones go back to the margin: the indent the bullet itself added is removed, and any indent you set earlier is overwritten. Call slides_update_paragraph_style afterwards if you need a particular indent. Applies to all paragraphs unless startIndex and endIndex are given.',
      inputSchema: {
        type: 'object',
        properties: {
          presentationId: {
            type: 'string',
            description: 'The ID of the presentation.',
          },
          objectId: {
            type: 'string',
            description: 'The object ID of the shape or text box holding the text.',
          },
          ...textRangeSchema,
        },
        required: ['presentationId', 'objectId'],
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

    let textRange: slides_v1.Schema$Range;

    try {
      textRange = toTextRange(args.startIndex, args.endIndex);
    } catch (error) {
      return createErrorResult(error instanceof Error ? error.message : String(error));
    }

    const slides = google.slides({ version: 'v1', auth });

    try {
      await slides.presentations.batchUpdate({
        presentationId,
        requestBody: { requests: [{ deleteParagraphBullets: { objectId, textRange } }] },
      });

      return { content: [{ type: 'text', text: `要素 ${objectId} の箇条書きを解除しました。` }] };
    } catch (error) {
      return createErrorResult(
        `箇条書きの解除に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
