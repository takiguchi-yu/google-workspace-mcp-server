import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import type { ToolArgs, ToolDefinition } from '../../../types/mcp.js';
import type { Command } from '../../base/command.interface.js';
import { createErrorResult } from '../../base/command.interface.js';

/**
 * スライドのプロパティを更新するコマンド
 */
export class UpdateSlidePropertiesCommand implements Command {
  constructor(private readonly auth: OAuth2Client) {}

  getToolDefinition(): ToolDefinition {
    return {
      name: 'slides_update_slide_properties',
      description: 'Update slide-level properties like background color or apply a layout template.',
      inputSchema: {
        type: 'object',
        properties: {
          presentationId: {
            type: 'string',
            description: 'The ID of the presentation.',
          },
          pageObjectId: {
            type: 'string',
            description: 'The object ID of the slide.',
          },
          backgroundColor: {
            type: 'string',
            description: 'RGB hex color for slide background (e.g., "#FFFFFF"). Omit to keep current.',
          },
        },
        required: ['presentationId', 'pageObjectId'],
      },
    };
  }

  private hexToRgb(hex: string): { red: number; green: number; blue: number } {
    const cleanHex = hex.replace(/^#/, '');
    const red = parseInt(cleanHex.substring(0, 2), 16) / 255;
    const green = parseInt(cleanHex.substring(2, 4), 16) / 255;
    const blue = parseInt(cleanHex.substring(4, 6), 16) / 255;
    return { red, green, blue };
  }

  async execute(args: ToolArgs): Promise<CallToolResult> {
    const presentationId = typeof args.presentationId === 'string' ? args.presentationId : '';
    const pageObjectId = typeof args.pageObjectId === 'string' ? args.pageObjectId : '';
    const backgroundColor = typeof args.backgroundColor === 'string' ? args.backgroundColor : '';

    if (presentationId === '') {
      return createErrorResult('presentationId が指定されていません。');
    }
    if (pageObjectId === '') {
      return createErrorResult('pageObjectId が指定されていません。');
    }

    if (backgroundColor === '') {
      return createErrorResult('最低限、backgroundColor を指定してください。');
    }

    const slides = google.slides({ version: 'v1', auth: this.auth });

    try {
      const requests = [];

      // Background color の更新
      if (backgroundColor) {
        const rgb = this.hexToRgb(backgroundColor);
        requests.push({
          updatePageProperties: {
            objectId: pageObjectId,
            pageProperties: {
              pageBackgroundFill: {
                solidFill: {
                  color: {
                    rgbColor: rgb,
                  },
                },
              },
            },
            fields: 'pageBackgroundFill',
          },
        });
      }

      if (requests.length === 0) {
        return createErrorResult('更新するプロパティが指定されていません。');
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (slides.presentations as any).batchUpdate({
        presentationId,
        requestBody: { requests },
      });

      return {
        content: [
          {
            type: 'text',
            text: `スライドのプロパティを更新しました。\nプレゼンテーションID: ${presentationId}`,
          },
        ],
      };
    } catch (error) {
      return createErrorResult(
        `スライドプロパティの更新に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
