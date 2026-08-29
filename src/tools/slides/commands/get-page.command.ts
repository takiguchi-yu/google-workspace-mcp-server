import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import type { ToolArgs, ToolDefinition } from '../../../types/mcp.js';
import type { Command } from '../../base/command.interface.js';
import { createErrorResult } from '../../base/command.interface.js';

/**
 * プレゼンテーション内の特定スライドの詳細情報を取得するコマンド
 */
export class GetPageCommand implements Command {
  getToolDefinition(): ToolDefinition {
    return {
      name: 'slides_get_page',
      description: 'Get details about a specific page (slide) in a presentation including elements and layout.',
      inputSchema: {
        type: 'object',
        properties: {
          presentationId: {
            type: 'string',
            description: 'The ID of the presentation.',
          },
          pageObjectId: {
            type: 'string',
            description: 'The object ID of the page/slide to retrieve.',
          },
        },
        required: ['presentationId', 'pageObjectId'],
      },
    };
  }

  async execute(args: ToolArgs, auth: OAuth2Client): Promise<CallToolResult> {
    const presentationId = typeof args.presentationId === 'string' ? args.presentationId : '';
    const pageObjectId = typeof args.pageObjectId === 'string' ? args.pageObjectId : '';

    if (presentationId === '') {
      return createErrorResult('presentationId が指定されていません。');
    }
    if (pageObjectId === '') {
      return createErrorResult('pageObjectId が指定されていません。');
    }

    const slides = google.slides({ version: 'v1', auth });

    try {
      const response = await slides.presentations.pages.get({
        presentationId,
        pageObjectId,
      });

      const page = response.data;
      const pageType = page.pageType ?? '不明';
      const objectId = page.objectId ?? pageObjectId;

      let result = `スライド情報:\n\n`;
      result += `ページID: ${objectId}\n`;
      result += `ページタイプ: ${pageType}\n`;
      result += `プレゼンテーションURL: https://docs.google.com/presentation/d/${presentationId}/edit#slide=id.${objectId}\n\n`;

      // ページ要素の情報を取得
      const pageElements = page.pageElements ?? [];
      result += `ページ要素数: ${String(pageElements.length)}\n\n`;

      if (pageElements.length > 0) {
        result += `要素の詳細:\n`;
        for (const element of pageElements) {
          const elementId = element.objectId ?? '不明';

          if (element.shape) {
            const shapeType = element.shape.shapeType ?? '不明';
            result += `  - Shape (ID: ${elementId}, タイプ: ${shapeType})\n`;

            // テキストコンテンツがあれば表示
            if (element.shape.text?.textElements) {
              const textContent = element.shape.text.textElements
                .map((te) => te.textRun?.content ?? '')
                .join('')
                .trim();
              if (textContent) {
                result += `    テキスト: ${textContent.substring(0, 100)}${textContent.length > 100 ? '...' : ''}\n`;
              }
            }
          } else if (element.table) {
            const rows = element.table.rows ?? 0;
            const columns = element.table.columns ?? 0;
            result += `  - Table (ID: ${elementId}, サイズ: ${String(rows)}行 x ${String(columns)}列)\n`;
          } else if (element.line) {
            const lineType = element.line.lineType ?? '不明';
            result += `  - Line (ID: ${elementId}, タイプ: ${lineType})\n`;
          } else if (element.image) {
            result += `  - Image (ID: ${elementId})\n`;
          } else if (element.video) {
            result += `  - Video (ID: ${elementId})\n`;
          } else {
            result += `  - その他の要素 (ID: ${elementId})\n`;
          }
        }
      }

      return {
        content: [{ type: 'text', text: result }],
      };
    } catch (error) {
      return createErrorResult(
        `スライド情報の取得に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
