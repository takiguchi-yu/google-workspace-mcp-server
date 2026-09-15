import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import type { ToolArgs, ToolDefinition } from '../../../types/mcp.js';
import type { Command } from '../../base/command.interface.js';
import { createErrorResult } from '../../base/command.interface.js';
import { toObjectIds } from '../object-ids.js';

/**
 * 複数の要素を 1 つのグループにまとめるコマンド。
 *
 * まとめたあとは、グループの objectId を slides_update_element_transform に渡せば
 * 中身ごと動かせる。解除は slides_ungroup_elements が引き受ける。
 *
 * **まとめられない要素がある。** 実機で確かめた結果、図形・テキストボックス・線・画像は
 * まとめられるが、表とレイアウト由来のプレースホルダは API に断られる。
 * すでに別のグループに入っている要素も対象にできない。
 */
export class GroupElementsCommand implements Command {
  getToolDefinition(): ToolDefinition {
    return {
      name: 'slides_group_elements',
      description:
        'Group two or more elements on the same slide so they move and resize together. Shapes, text boxes, lines, images, and existing groups can be grouped; tables and placeholders inherited from the layout cannot, and neither can an element that already belongs to another group. The returned group object ID can be passed to slides_update_element_transform or slides_delete_element. Use slides_ungroup_elements to take the group apart.',
      inputSchema: {
        type: 'object',
        properties: {
          presentationId: {
            type: 'string',
            description: 'The ID of the presentation.',
          },
          objectIds: {
            type: 'array',
            description:
              'Object IDs of at least two elements to group. They must all be on the same slide, and none of them may be a table, a placeholder inherited from the layout, or an element that is already inside another group.',
            items: { type: 'string' },
          },
        },
        required: ['presentationId', 'objectIds'],
      },
    };
  }

  async execute(args: ToolArgs, auth: OAuth2Client): Promise<CallToolResult> {
    const presentationId = typeof args.presentationId === 'string' ? args.presentationId : '';

    if (presentationId === '') {
      return createErrorResult('presentationId が指定されていません。');
    }

    let childrenObjectIds: string[];

    try {
      childrenObjectIds = toObjectIds(args.objectIds, 'objectIds', 2);
    } catch (error) {
      return createErrorResult(error instanceof Error ? error.message : String(error));
    }

    const slides = google.slides({ version: 'v1', auth });
    const groupObjectId = `group_${String(Date.now())}`;

    try {
      await slides.presentations.batchUpdate({
        presentationId,
        requestBody: { requests: [{ groupObjects: { groupObjectId, childrenObjectIds } }] },
      });

      return {
        content: [
          {
            type: 'text',
            text: `${String(childrenObjectIds.length)} 個の要素をグループにまとめました。\nグループの objectId: ${groupObjectId}`,
          },
        ],
      };
    } catch (error) {
      return createErrorResult(`グループ化に失敗しました: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
