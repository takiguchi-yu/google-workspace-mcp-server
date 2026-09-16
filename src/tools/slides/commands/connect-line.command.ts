import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import type { slides_v1 } from 'googleapis';
import type { ToolArgs, ToolDefinition } from '../../../types/mcp.js';
import type { Command } from '../../base/command.interface.js';
import { createErrorResult } from '../../base/command.interface.js';
import { pickOptionalEnum } from '../enum-argument.js';
import { LINE_CATEGORIES } from '../line-style.js';
import { toOptionalNumber } from '../number-argument.js';

/**
 * 線の端を図形に結びつけるコマンド。
 *
 * 結びつけた線は、図形を動かすと一緒に追随する。接続点の番号は省略でき、
 * 省略すると Google が図形の形に応じて選ぶ。**表には接続点が無い**ため繋げられない。
 *
 * 両端が繋がった線は経路を引き直せる（rerouteLine）ので、同じ呼び出しでそこまでやる。
 * 解除は slides_disconnect_line が引き受ける。
 */
export class ConnectLineCommand implements Command {
  getToolDefinition(): ToolDefinition {
    return {
      name: 'slides_connect_line',
      description:
        'Attach the ends of a line to shapes so the line follows them when they move. Give the line and the shape for either end, or both. Connection site indexes are optional — leave them out and Google picks a sensible point on each shape. Tables have no connection sites and cannot be attached. When both ends end up attached, the line is also rerouted along the shortest path.',
      inputSchema: {
        type: 'object',
        properties: {
          presentationId: {
            type: 'string',
            description: 'The ID of the presentation.',
          },
          objectId: {
            type: 'string',
            description: 'The object ID of the line, as returned by slides_add_line.',
          },
          startShapeId: {
            type: 'string',
            description: 'Object ID of the shape to attach the start of the line to. Omit to leave that end alone.',
          },
          endShapeId: {
            type: 'string',
            description: 'Object ID of the shape to attach the end of the line to. Omit to leave that end alone.',
          },
          startSite: {
            type: 'number',
            description: 'Which connection site on the start shape to use. Omit to let Google choose.',
          },
          endSite: {
            type: 'number',
            description: 'Which connection site on the end shape to use. Omit to let Google choose.',
          },
          lineCategory: {
            type: 'string',
            description: 'Change the routing style of the line at the same time. BENT suits connectors between boxes.',
            enum: [...LINE_CATEGORIES],
          },
        },
        required: ['presentationId', 'objectId'],
      },
    };
  }

  async execute(args: ToolArgs, auth: OAuth2Client): Promise<CallToolResult> {
    const presentationId = typeof args.presentationId === 'string' ? args.presentationId : '';
    const objectId = typeof args.objectId === 'string' ? args.objectId : '';
    const startShapeId = typeof args.startShapeId === 'string' ? args.startShapeId : undefined;
    const endShapeId = typeof args.endShapeId === 'string' ? args.endShapeId : undefined;

    if (presentationId === '') {
      return createErrorResult('presentationId が指定されていません。');
    }
    if (objectId === '') {
      return createErrorResult('objectId が指定されていません。');
    }
    if (startShapeId === undefined && endShapeId === undefined) {
      return createErrorResult('startShapeId と endShapeId のどちらか、または両方を指定してください。');
    }
    if (startShapeId === undefined && args.startSite !== undefined) {
      return createErrorResult('startSite を指定するときは startShapeId も渡してください。');
    }
    if (endShapeId === undefined && args.endSite !== undefined) {
      return createErrorResult('endSite を指定するときは endShapeId も渡してください。');
    }

    const lineProperties: slides_v1.Schema$LineProperties = {};
    const fields: string[] = [];
    const requests: slides_v1.Schema$Request[] = [];

    try {
      if (startShapeId !== undefined) {
        lineProperties.startConnection = toConnection(startShapeId, toOptionalNumber(args.startSite, 'startSite'));
        fields.push('startConnection');
      }
      if (endShapeId !== undefined) {
        lineProperties.endConnection = toConnection(endShapeId, toOptionalNumber(args.endSite, 'endSite'));
        fields.push('endConnection');
      }

      requests.push({ updateLineProperties: { objectId, lineProperties, fields: fields.join(',') } });

      const lineCategory = pickOptionalEnum(args.lineCategory, LINE_CATEGORIES, 'lineCategory');

      if (lineCategory !== undefined) {
        requests.push({ updateLineCategory: { objectId, lineCategory } });
      }

      // 経路の引き直しは両端が繋がっている線にしか効かない（片端だけだと API に断られる）
      if (startShapeId !== undefined && endShapeId !== undefined) {
        requests.push({ rerouteLine: { objectId } });
      }
    } catch (error) {
      return createErrorResult(error instanceof Error ? error.message : String(error));
    }

    const slides = google.slides({ version: 'v1', auth });

    try {
      await slides.presentations.batchUpdate({ presentationId, requestBody: { requests } });

      const attached = [
        ...(startShapeId === undefined ? [] : [`始点 → ${startShapeId}`]),
        ...(endShapeId === undefined ? [] : [`終点 → ${endShapeId}`]),
      ];

      return {
        content: [{ type: 'text', text: `線 ${objectId} を図形に繋ぎました。\n${attached.join('\n')}` }],
      };
    } catch (error) {
      return createErrorResult(`線の接続に失敗しました: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

/** 接続の指定を組み立てる。接続点の番号は省略でき、省略すると Google が選ぶ */
const toConnection = (connectedObjectId: string, connectionSiteIndex?: number): slides_v1.Schema$LineConnection =>
  connectionSiteIndex === undefined ? { connectedObjectId } : { connectedObjectId, connectionSiteIndex };
