import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import type { ToolArgs, ToolDefinition } from '../../../types/mcp.js';
import type { Command } from '../../base/command.interface.js';
import { createErrorResult } from '../../base/command.interface.js';
import type { TransformTarget } from '../element-transform.js';
import { toAbsoluteTransform, toPlacement } from '../element-transform.js';
import { toOptionalNumber } from '../number-argument.js';
import { fetchElementGeometry } from '../presentation-lookup.js';

/**
 * 既存の要素を動かす・大きさを変える・回すコマンド。
 *
 * 位置と大きさはポイントで受ける。API の updatePageElementTransform は transform しか
 * 受け付けず、実寸は `size × 倍率` で決まるため、現在の size を読んでから倍率を逆算する。
 * 変換は element-transform.ts、読み取りは presentation-lookup.ts に分けてある。
 */
export class UpdateElementTransformCommand implements Command {
  getToolDefinition(): ToolDefinition {
    return {
      name: 'slides_update_element_transform',
      description:
        'Move, resize, or rotate an existing element (shape, text box, image, line, table, or group). Lengths are in points: a slide is 720 x 405 pt. Only the properties you specify are changed. Position is the anchor corner of the element before rotation, not the corner of its rotated bounding box.',
      inputSchema: {
        type: 'object',
        properties: {
          presentationId: {
            type: 'string',
            description: 'The ID of the presentation.',
          },
          objectId: {
            type: 'string',
            description: 'The object ID of the element to move, resize, or rotate.',
          },
          left: { type: 'number', description: 'New distance from the left edge of the slide, in points.' },
          top: { type: 'number', description: 'New distance from the top edge of the slide, in points.' },
          width: { type: 'number', description: 'New width in points.' },
          height: { type: 'number', description: 'New height in points.' },
          rotation: {
            type: 'number',
            description: 'New clockwise rotation in degrees. 0 is upright. Replaces the current rotation.',
          },
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

    let target: TransformTarget;

    try {
      target = {
        left: toOptionalNumber(args.left, 'left'),
        top: toOptionalNumber(args.top, 'top'),
        width: toOptionalNumber(args.width, 'width'),
        height: toOptionalNumber(args.height, 'height'),
        rotation: toOptionalNumber(args.rotation, 'rotation'),
      };
    } catch (error) {
      return createErrorResult(error instanceof Error ? error.message : String(error));
    }

    if (Object.values(target).every((value) => value === undefined)) {
      return createErrorResult('変更する項目を 1 つ以上指定してください（left、top、width、height、rotation）。');
    }

    const slides = google.slides({ version: 'v1', auth });

    try {
      const geometry = await fetchElementGeometry(slides, presentationId, objectId);
      const transform = toAbsoluteTransform(geometry, target);

      await slides.presentations.batchUpdate({
        presentationId,
        requestBody: { requests: [{ updatePageElementTransform: { objectId, applyMode: 'ABSOLUTE', transform } }] },
      });

      const placement = toPlacement({ ...geometry, transform });

      return {
        content: [
          {
            type: 'text',
            text:
              `要素 ${objectId} の配置を更新しました。\n` +
              `位置: ${String(placement.left)}, ${String(placement.top)} pt\n` +
              `大きさ: ${String(placement.width)} × ${String(placement.height)} pt\n` +
              `回転: ${String(placement.rotation)} 度`,
          },
        ],
      };
    } catch (error) {
      return createErrorResult(`配置の更新に失敗しました: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
