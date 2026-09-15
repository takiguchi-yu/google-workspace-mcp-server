import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import type { ToolArgs, ToolDefinition } from '../../../types/mcp.js';
import type { Command } from '../../base/command.interface.js';
import { createErrorResult } from '../../base/command.interface.js';
import { toObjectIds } from '../object-ids.js';

/**
 * グループを解除するコマンド。
 *
 * slides_group_elements の対になる操作を別ツールにしてある。中身の要素は残り、
 * グループだけが無くなる。
 */
export class UngroupElementsCommand implements Command {
  getToolDefinition(): ToolDefinition {
    return {
      name: 'slides_ungroup_elements',
      description:
        'Take groups apart, leaving the elements inside on the slide. Pass the object IDs of the groups themselves, not of their children.',
      inputSchema: {
        type: 'object',
        properties: {
          presentationId: {
            type: 'string',
            description: 'The ID of the presentation.',
          },
          objectIds: {
            type: 'array',
            description: 'Object IDs of the groups to take apart.',
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

    let objectIds: string[];

    try {
      objectIds = toObjectIds(args.objectIds, 'objectIds', 1);
    } catch (error) {
      return createErrorResult(error instanceof Error ? error.message : String(error));
    }

    const slides = google.slides({ version: 'v1', auth });

    try {
      await slides.presentations.batchUpdate({
        presentationId,
        requestBody: { requests: [{ ungroupObjects: { objectIds } }] },
      });

      return {
        content: [{ type: 'text', text: `${String(objectIds.length)} 個のグループを解除しました。` }],
      };
    } catch (error) {
      return createErrorResult(
        `グループの解除に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
