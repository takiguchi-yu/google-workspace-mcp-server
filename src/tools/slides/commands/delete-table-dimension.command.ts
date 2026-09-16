import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import type { slides_v1 } from 'googleapis';
import type { ToolArgs, ToolDefinition } from '../../../types/mcp.js';
import type { Command } from '../../base/command.interface.js';
import { createErrorResult } from '../../base/command.interface.js';
import { fetchTableSize } from '../presentation-lookup.js';
import { dimensionSchema, toDimension, toDimensionIndex } from '../table-dimension.js';

/**
 * 表から行・列を消すコマンド。
 *
 * 追加とは別ツールにしてある。引数の取り違えで中身ごと消える操作なので、
 * 「足す」と「消す」を同じツールの真偽値で切り替えさせない。
 */
export class DeleteTableDimensionCommand implements Command {
  getToolDefinition(): ToolDefinition {
    return {
      name: 'slides_delete_table_dimension',
      description:
        'Delete a row or column from a table, together with the text in it. Say which one, counted the way A1 notation does ("2" is the second row, "B" is the second column). A table must keep at least one row and one column.',
      inputSchema: {
        type: 'object',
        properties: {
          presentationId: {
            type: 'string',
            description: 'The ID of the presentation.',
          },
          objectId: {
            type: 'string',
            description: 'The object ID of the table.',
          },
          ...dimensionSchema,
        },
        required: ['presentationId', 'objectId', 'dimension', 'at'],
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

    const slides = google.slides({ version: 'v1', auth });
    let dimension: 'ROWS' | 'COLUMNS';
    let label: string;
    let request: slides_v1.Schema$Request;

    try {
      dimension = toDimension(args.dimension);
      label = dimension === 'ROWS' ? '行' : '列';

      const size = await fetchTableSize(slides, presentationId, objectId);
      const remaining = dimension === 'ROWS' ? size.rows : size.columns;

      if (remaining <= 1) {
        return createErrorResult(
          `この表は${label}が 1 つしかないため削除できません。表ごと消すなら slides_delete_element を使ってください。`,
        );
      }

      const index = toDimensionIndex(args.at, dimension, size, 'at');
      const cellLocation =
        dimension === 'ROWS' ? { rowIndex: index, columnIndex: 0 } : { rowIndex: 0, columnIndex: index };
      request =
        dimension === 'ROWS'
          ? { deleteTableRow: { tableObjectId: objectId, cellLocation } }
          : { deleteTableColumn: { tableObjectId: objectId, cellLocation } };
    } catch (error) {
      return createErrorResult(error instanceof Error ? error.message : String(error));
    }

    try {
      await slides.presentations.batchUpdate({ presentationId, requestBody: { requests: [request] } });

      return {
        content: [{ type: 'text', text: `表 ${objectId} から ${String(args.at)} の${label}を消しました。` }],
      };
    } catch (error) {
      return createErrorResult(`行・列の削除に失敗しました: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
