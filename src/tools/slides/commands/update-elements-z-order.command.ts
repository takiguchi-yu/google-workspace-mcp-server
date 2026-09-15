import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import type { ToolArgs, ToolDefinition } from '../../../types/mcp.js';
import type { Command } from '../../base/command.interface.js';
import { createErrorResult } from '../../base/command.interface.js';
import { pickEnum } from '../enum-argument.js';
import { toObjectIds } from '../object-ids.js';

/** 重なり順の動かし方。Slides API の ZOrderOperation から、未指定を表す値を除いたもの */
const Z_ORDER_OPERATIONS = ['BRING_TO_FRONT', 'BRING_FORWARD', 'SEND_BACKWARD', 'SEND_TO_BACK'] as const;

/**
 * 要素の重なり順を変えるコマンド。
 *
 * 複数の要素を一度に動かせる。渡した要素どうしの相対的な順序は保たれる。
 */
export class UpdateElementsZOrderCommand implements Command {
  getToolDefinition(): ToolDefinition {
    return {
      name: 'slides_update_elements_z_order',
      description:
        'Change which elements are drawn on top of which. All elements must be on the same slide, and their order relative to each other is preserved. BRING_FORWARD and SEND_BACKWARD move by one step; BRING_TO_FRONT and SEND_TO_BACK move all the way.',
      inputSchema: {
        type: 'object',
        properties: {
          presentationId: {
            type: 'string',
            description: 'The ID of the presentation.',
          },
          objectIds: {
            type: 'array',
            description: 'Object IDs of the elements to move. They must all be on the same slide.',
            items: { type: 'string' },
          },
          operation: {
            type: 'string',
            description: 'How far to move the elements in the stack.',
            enum: [...Z_ORDER_OPERATIONS],
          },
        },
        required: ['presentationId', 'objectIds', 'operation'],
      },
    };
  }

  async execute(args: ToolArgs, auth: OAuth2Client): Promise<CallToolResult> {
    const presentationId = typeof args.presentationId === 'string' ? args.presentationId : '';

    if (presentationId === '') {
      return createErrorResult('presentationId が指定されていません。');
    }

    let pageElementObjectIds: string[];
    let operation: string;

    try {
      pageElementObjectIds = toObjectIds(args.objectIds, 'objectIds', 1);
      operation = pickEnum(args.operation, Z_ORDER_OPERATIONS, 'operation');
    } catch (error) {
      return createErrorResult(error instanceof Error ? error.message : String(error));
    }

    const slides = google.slides({ version: 'v1', auth });

    try {
      await slides.presentations.batchUpdate({
        presentationId,
        requestBody: { requests: [{ updatePageElementsZOrder: { pageElementObjectIds, operation } }] },
      });

      return {
        content: [
          {
            type: 'text',
            text: `${String(pageElementObjectIds.length)} 個の要素の重なり順を変更しました。\n操作: ${operation}`,
          },
        ],
      };
    } catch (error) {
      return createErrorResult(
        `重なり順の変更に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
