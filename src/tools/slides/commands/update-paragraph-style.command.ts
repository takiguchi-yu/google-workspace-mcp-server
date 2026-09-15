import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import type { slides_v1 } from 'googleapis';
import type { ToolArgs, ToolDefinition } from '../../../types/mcp.js';
import type { Command } from '../../base/command.interface.js';
import { createErrorResult } from '../../base/command.interface.js';
import { paragraphStyleSchema, toParagraphStyle } from '../paragraph-style.js';
import { textRangeSchema, toTextRange } from '../text-range.js';

/**
 * 段落の書式（揃え・行間・インデント・段落前後の空き）を変えるコマンド。
 *
 * slides_update_text_style が受け持つのは文字 1 つ 1 つの見た目で、行の配置は変えられない。
 * 段落は文字とは別の書式の単位なので、ツールも分けてある。
 */
export class UpdateParagraphStyleCommand implements Command {
  getToolDefinition(): ToolDefinition {
    return {
      name: 'slides_update_paragraph_style',
      description:
        'Change paragraph-level formatting of a shape or text box: alignment, line spacing, indentation, and space before/after. Only the properties you specify are changed. Applies to all paragraphs unless startIndex and endIndex are given. Lengths are in points.',
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
          ...paragraphStyleSchema,
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

    let style: slides_v1.Schema$ParagraphStyle;
    let fields: string[];
    let textRange: slides_v1.Schema$Range;

    try {
      ({ style, fields } = toParagraphStyle(args));
      textRange = toTextRange(args.startIndex, args.endIndex);
    } catch (error) {
      return createErrorResult(error instanceof Error ? error.message : String(error));
    }

    if (fields.length === 0) {
      return createErrorResult('変更する書式を 1 つ以上指定してください（alignment、lineSpacing、indentStart など）。');
    }

    const slides = google.slides({ version: 'v1', auth });

    try {
      await slides.presentations.batchUpdate({
        presentationId,
        requestBody: {
          requests: [{ updateParagraphStyle: { objectId, style, textRange, fields: fields.join(',') } }],
        },
      });

      return {
        content: [
          { type: 'text', text: `要素 ${objectId} の段落の書式を更新しました。\n変更した項目: ${fields.join(', ')}` },
        ],
      };
    } catch (error) {
      return createErrorResult(
        `段落の書式の更新に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
