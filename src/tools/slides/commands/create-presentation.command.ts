import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import type { ToolArgs, ToolDefinition } from '../../../types/mcp.js';
import type { Command } from '../../base/command.interface.js';
import { createErrorResult } from '../../base/command.interface.js';

/**
 * Google Slides プレゼンテーションを新規作成するコマンド
 */
export class CreatePresentationCommand implements Command {
  getToolDefinition(): ToolDefinition {
    return {
      name: 'slides_create_presentation',
      description: 'Create a new Google Slides presentation with a specified title.',
      inputSchema: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: 'Title of presentation',
          },
        },
        required: ['title'],
      },
    };
  }

  async execute(args: ToolArgs, auth: OAuth2Client): Promise<CallToolResult> {
    // 引数のバリデーション
    const title = typeof args.title === 'string' ? args.title : 'Untitled Presentation';

    const slides = google.slides({ version: 'v1', auth });

    try {
      // API 呼び出し
      const response = await slides.presentations.create({
        requestBody: { title },
      });

      const data = response.data;
      const presentationId = data.presentationId ?? 'unknown';
      const presentationTitle = data.title ?? 'Untitled';

      return {
        content: [
          {
            type: 'text',
            text: `Successfully created presentation: "${presentationTitle}"\nID: ${presentationId}\nURL: https://docs.google.com/presentation/d/${presentationId}/edit`,
          },
        ],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return createErrorResult(`Failed to create presentation: ${errorMessage}`);
    }
  }
}
