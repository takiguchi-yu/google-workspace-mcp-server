import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import type { ToolArgs, ToolDefinition } from '../../../types/mcp.js';
import type { Command } from '../../base/command.interface.js';
import { createErrorResult } from '../../base/command.interface.js';

/** 既定の大きさ。1 インチ = 914400 EMU */
const DEFAULT_SIZE_EMU = 1_828_800;

/**
 * スライドに画像を挿入するコマンド。
 *
 * Slides API は画像を挿入時に 1 度だけ取得してコピーを保存するため、URL は公開アクセス
 * 可能でなければならない。このサーバーの Drive スコープは自分が作成したファイルに限られるので、
 * 利用者の Drive にある非公開画像は指定できない。
 */
export class InsertImageCommand implements Command {
  getToolDefinition(): ToolDefinition {
    return {
      name: 'slides_insert_image',
      description:
        'Insert an image into a slide from a publicly accessible URL. The image is fetched once at insertion time, so the URL must be reachable without login. Formats: PNG, JPEG, GIF. Max 50 MB and 25 megapixels.',
      inputSchema: {
        type: 'object',
        properties: {
          presentationId: {
            type: 'string',
            description: 'The ID of the presentation.',
          },
          pageObjectId: {
            type: 'string',
            description: 'The object ID of the slide to insert the image into.',
          },
          url: {
            type: 'string',
            description:
              'Publicly accessible URL of a PNG, JPEG, or GIF image, up to 2 KB in length. Private Drive links do not work.',
          },
          left: {
            type: 'number',
            description: 'Left position in EMUs (1 inch = 914400 EMUs). Defaults to 0.',
            default: 0,
          },
          top: {
            type: 'number',
            description: 'Top position in EMUs. Defaults to 0.',
            default: 0,
          },
          width: {
            type: 'number',
            description: 'Image width in EMUs. Defaults to 1828800 (2 inches).',
            default: DEFAULT_SIZE_EMU,
          },
          height: {
            type: 'number',
            description: 'Image height in EMUs. Defaults to 1828800 (2 inches).',
            default: DEFAULT_SIZE_EMU,
          },
        },
        required: ['presentationId', 'pageObjectId', 'url'],
      },
    };
  }

  async execute(args: ToolArgs, auth: OAuth2Client): Promise<CallToolResult> {
    const presentationId = typeof args.presentationId === 'string' ? args.presentationId : '';
    const pageObjectId = typeof args.pageObjectId === 'string' ? args.pageObjectId : '';
    const url = typeof args.url === 'string' ? args.url : '';
    const left = typeof args.left === 'number' ? args.left : 0;
    const top = typeof args.top === 'number' ? args.top : 0;
    const width = typeof args.width === 'number' ? args.width : DEFAULT_SIZE_EMU;
    const height = typeof args.height === 'number' ? args.height : DEFAULT_SIZE_EMU;

    if (presentationId === '') {
      return createErrorResult('presentationId が指定されていません。');
    }
    if (pageObjectId === '') {
      return createErrorResult('pageObjectId が指定されていません。');
    }
    if (url === '') {
      return createErrorResult('url が指定されていません。');
    }
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return createErrorResult('url は http:// または https:// で始まる公開 URL を指定してください。');
    }

    const slides = google.slides({ version: 'v1', auth });

    try {
      const response = await slides.presentations.batchUpdate({
        presentationId,
        requestBody: {
          requests: [
            {
              createImage: {
                url,
                elementProperties: {
                  pageObjectId,
                  size: {
                    width: { magnitude: width, unit: 'EMU' },
                    height: { magnitude: height, unit: 'EMU' },
                  },
                  transform: {
                    scaleX: 1,
                    scaleY: 1,
                    translateX: left,
                    translateY: top,
                    unit: 'EMU',
                  },
                },
              },
            },
          ],
        },
      });

      const objectId = response.data.replies?.[0]?.createImage?.objectId ?? '(不明)';

      return {
        content: [
          { type: 'text', text: `スライド ${pageObjectId} に画像を挿入しました。\n画像の objectId: ${objectId}` },
        ],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return createErrorResult(
        `画像の挿入に失敗しました: ${message}\n（画像 URL はログイン無しで開ける必要があります。PNG / JPEG / GIF、50MB 未満、25 メガピクセル以下）`,
      );
    }
  }
}
