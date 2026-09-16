import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import type { ToolArgs, ToolDefinition } from '../../../types/mcp.js';
import type { Command } from '../../base/command.interface.js';
import { createErrorResult } from '../../base/command.interface.js';

/**
 * 線と図形の結びつきを外すコマンド。
 *
 * slides_connect_line の対になる操作を別ツールにしてある。接続の指定を空にすると解除、
 * という API の流儀をそのままツールに出すと、引数の書き忘れが解除に化けるため。
 * 線そのものは残り、外した時点の位置に留まる。
 */
export class DisconnectLineCommand implements Command {
  getToolDefinition(): ToolDefinition {
    return {
      name: 'slides_disconnect_line',
      description:
        'Detach a line from both of the shapes it is attached to, so it stops following them. The line itself stays where it is. Use slides_update_element_transform afterwards to move it, or slides_delete_element to remove it.',
      inputSchema: {
        type: 'object',
        properties: {
          presentationId: {
            type: 'string',
            description: 'The ID of the presentation.',
          },
          objectId: {
            type: 'string',
            description: 'The object ID of the line to detach.',
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

    // 空の lineProperties に fields を添えると、その項目だけが消える
    const fields = 'startConnection,endConnection';
    const slides = google.slides({ version: 'v1', auth });

    try {
      await slides.presentations.batchUpdate({
        presentationId,
        requestBody: { requests: [{ updateLineProperties: { objectId, lineProperties: {}, fields } }] },
      });

      return { content: [{ type: 'text', text: `線 ${objectId} の両端の接続を外しました。` }] };
    } catch (error) {
      return createErrorResult(
        `線の接続の解除に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
