import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { OAuth2Client } from 'google-auth-library';
import { google, type slides_v1 } from 'googleapis';
import type { ToolArgs, ToolDefinition } from '../../../types/mcp.js';
import type { Command } from '../../base/command.interface.js';
import { createErrorResult } from '../../base/command.interface.js';

/**
 * Google Slides プレゼンテーションの内容を取得するコマンド
 */
export class GetPresentationCommand implements Command {
  getToolDefinition(): ToolDefinition {
    return {
      name: 'slides_get_presentation',
      description: 'Read content from a presentation including text and tables to understand specifications.',
      inputSchema: {
        type: 'object',
        properties: {
          presentationId: {
            type: 'string',
            description: 'ID of the presentation',
          },
        },
        required: ['presentationId'],
      },
    };
  }

  async execute(args: ToolArgs, auth: OAuth2Client): Promise<CallToolResult> {
    // 引数のバリデーション
    const presentationId = typeof args.presentationId === 'string' ? args.presentationId : '';
    if (presentationId === '') {
      return createErrorResult('presentationId が指定されていません。');
    }

    const slides = google.slides({ version: 'v1', auth });

    try {
      // API 呼び出し
      const response = await slides.presentations.get({
        presentationId,
      });

      const data = response.data;
      const presentationTitle = typeof data.title === 'string' ? data.title : 'Untitled';
      const slidePages = data.slides ?? [];

      let fullContent = `Title: ${presentationTitle}\n\n`;

      slidePages.forEach((slide, index) => {
        fullContent += `--- Slide ${String(index + 1)} ---\n`;

        slide.pageElements?.forEach((element) => {
          if (element.shape) {
            const shapeText = this.extractTextFromShape(element.shape);
            if (shapeText) {
              fullContent += `${shapeText}\n`;
            }
          }

          if (element.table) {
            const tableText = this.extractTextFromTable(element.table);
            if (tableText) {
              fullContent += `${tableText}\n`;
            }
          }
        });
        fullContent += '\n';
      });

      return {
        content: [{ type: 'text', text: fullContent }],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return createErrorResult(`Failed to get presentation: ${errorMessage}`);
    }
  }

  /**
   * Shape や TableCell の text からテキストのみを抽出する共通ヘルパー
   */
  private readonly extractTextFromTextContent = (textContent?: slides_v1.Schema$TextContent): string => {
    const textElements = textContent?.textElements;
    if (!textElements) {
      return '';
    }

    const joined = textElements
      .map((element) => element.textRun?.content ?? '')
      .join('')
      .trim();

    return joined;
  };

  /**
   * テキストボックス（Shape）からテキストを抽出
   */
  private readonly extractTextFromShape = (shape: slides_v1.Schema$Shape): string => {
    return this.extractTextFromTextContent(shape.text);
  };

  /**
   * 表のセルからテキストを抽出し、行単位で連結
   */
  private readonly extractTextFromTable = (table: slides_v1.Schema$Table): string => {
    const rows = table.tableRows ?? [];

    const rowStrings = rows
      .map((row) => {
        const cells = row.tableCells ?? [];
        const cellTexts = cells
          .map((cell) => this.extractTextFromTextContent(cell.text))
          .filter((cellText) => cellText.length > 0);

        if (cellTexts.length === 0) {
          return '';
        }

        return cellTexts.join(' | ');
      })
      .filter((rowText) => rowText.length > 0);

    return rowStrings.join('\n');
  };
}
