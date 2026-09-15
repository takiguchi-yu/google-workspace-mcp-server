import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import type { slides_v1 } from 'googleapis';
import type { ToolArgs, ToolDefinition } from '../../../types/mcp.js';
import type { Command } from '../../base/command.interface.js';
import { createErrorResult } from '../../base/command.interface.js';
import { pickEnum } from '../enum-argument.js';
import { textRangeSchema, toTextRange } from '../text-range.js';

/**
 * 箇条書きの体裁。Slides API の BulletGlyphPreset の全値（実機で全 15 種の通過を確認）。
 *
 * 名前は入れ子の階層ごとの記号を並べたもの。BULLET_DISC_CIRCLE_SQUARE なら
 * 1 段目が ●、2 段目が ○、3 段目が ■ になる。
 */
const BULLET_PRESETS = [
  'BULLET_DISC_CIRCLE_SQUARE',
  'BULLET_DIAMONDX_ARROW3D_SQUARE',
  'BULLET_CHECKBOX',
  'BULLET_ARROW_DIAMOND_DISC',
  'BULLET_STAR_CIRCLE_SQUARE',
  'BULLET_ARROW3D_CIRCLE_SQUARE',
  'BULLET_LEFTTRIANGLE_DIAMOND_DISC',
  'BULLET_DIAMONDX_HOLLOWDIAMOND_SQUARE',
  'BULLET_DIAMOND_CIRCLE_SQUARE',
  'NUMBERED_DIGIT_ALPHA_ROMAN',
  'NUMBERED_DIGIT_ALPHA_ROMAN_PARENS',
  'NUMBERED_DIGIT_NESTED',
  'NUMBERED_UPPERALPHA_ALPHA_ROMAN',
  'NUMBERED_UPPERROMAN_UPPERALPHA_DIGIT',
  'NUMBERED_ZERODIGIT_ALPHA_ROMAN',
] as const;

/**
 * 段落を箇条書き・番号付きリストにするコマンド。
 *
 * 解除は slides_delete_paragraph_bullets が引き受ける。引数の省略が解除に化けないよう、
 * Sheets の入力規則と同じく設定と解除をツールとして分けてある。
 */
export class CreateParagraphBulletsCommand implements Command {
  getToolDefinition(): ToolDefinition {
    return {
      name: 'slides_create_paragraph_bullets',
      description:
        'Turn the paragraphs of a shape or text box into a bulleted or numbered list. Names describe the glyphs per nesting level, so BULLET_DISC_CIRCLE_SQUARE is a disc at level 1, a circle at level 2, a square at level 3. NUMBERED_* presets are numbered lists. Applies to all paragraphs unless startIndex and endIndex are given. Use slides_delete_paragraph_bullets to remove them.',
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
          bulletPreset: {
            type: 'string',
            description: 'The glyphs to use. Defaults to BULLET_DISC_CIRCLE_SQUARE.',
            enum: [...BULLET_PRESETS],
            default: 'BULLET_DISC_CIRCLE_SQUARE',
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

    let bulletPreset: string;
    let textRange: slides_v1.Schema$Range;

    try {
      bulletPreset =
        args.bulletPreset === undefined
          ? 'BULLET_DISC_CIRCLE_SQUARE'
          : pickEnum(args.bulletPreset, BULLET_PRESETS, 'bulletPreset');
      textRange = toTextRange(args.startIndex, args.endIndex);
    } catch (error) {
      return createErrorResult(error instanceof Error ? error.message : String(error));
    }

    const slides = google.slides({ version: 'v1', auth });

    try {
      await slides.presentations.batchUpdate({
        presentationId,
        requestBody: { requests: [{ createParagraphBullets: { objectId, textRange, bulletPreset } }] },
      });

      return {
        content: [{ type: 'text', text: `要素 ${objectId} を箇条書きにしました。\n体裁: ${bulletPreset}` }],
      };
    } catch (error) {
      return createErrorResult(
        `箇条書きの設定に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
