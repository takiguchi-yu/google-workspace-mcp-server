import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import type { ToolArgs, ToolDefinition } from '../../../types/mcp.js';
import type { Command } from '../../base/command.interface.js';
import { createErrorResult } from '../../base/command.interface.js';

/**
 * プレゼンテーション内の文字列を一括置換するコマンド。
 *
 * 差し込み用のひな形に `{{name}}` のような目印を置いておき、実際の値に置き換える使い方を想定する。
 */
export class ReplaceAllTextCommand implements Command {
  getToolDefinition(): ToolDefinition {
    return {
      name: 'slides_replace_all_text',
      description:
        'Replace every occurrence of a string across a presentation, or only on the slides you name. Useful for filling in placeholders such as {{title}} in a template.',
      inputSchema: {
        type: 'object',
        properties: {
          presentationId: {
            type: 'string',
            description: 'The ID of the presentation.',
          },
          text: {
            type: 'string',
            description: 'The text to search for (e.g., "{{title}}").',
          },
          replaceText: {
            type: 'string',
            description: 'The text to put in its place. Pass an empty string to delete the text.',
          },
          matchCase: {
            type: 'boolean',
            description: 'Whether the search is case sensitive. Defaults to true.',
            default: true,
          },
          pageObjectIds: {
            type: 'array',
            description: 'Limit the replacement to these slides. Defaults to every slide.',
            items: { type: 'string' },
          },
        },
        required: ['presentationId', 'text', 'replaceText'],
      },
    };
  }

  async execute(args: ToolArgs, auth: OAuth2Client): Promise<CallToolResult> {
    const presentationId = typeof args.presentationId === 'string' ? args.presentationId : '';
    const text = typeof args.text === 'string' ? args.text : '';
    const replaceText = typeof args.replaceText === 'string' ? args.replaceText : '';
    const matchCase = args.matchCase === undefined ? true : args.matchCase === true;
    const pageObjectIds = args.pageObjectIds;

    if (presentationId === '') {
      return createErrorResult('presentationId が指定されていません。');
    }
    if (text === '') {
      return createErrorResult('text が指定されていません。置換したい文字列を指定してください。');
    }
    if (
      pageObjectIds !== undefined &&
      (!Array.isArray(pageObjectIds) || pageObjectIds.some((id) => typeof id !== 'string'))
    ) {
      return createErrorResult('pageObjectIds は文字列の配列で指定してください。');
    }

    const slides = google.slides({ version: 'v1', auth });

    try {
      const response = await slides.presentations.batchUpdate({
        presentationId,
        requestBody: {
          requests: [
            {
              replaceAllText: {
                containsText: { text, matchCase },
                replaceText,
                ...(pageObjectIds === undefined ? {} : { pageObjectIds: pageObjectIds as string[] }),
              },
            },
          ],
        },
      });

      const occurrences = response.data.replies?.[0]?.replaceAllText?.occurrencesChanged ?? 0;

      return {
        content: [
          {
            type: 'text',
            text: `"${text}" を "${replaceText}" に置換しました。\n置換した箇所: ${String(occurrences)} 件`,
          },
        ],
      };
    } catch (error) {
      return createErrorResult(`文字列の置換に失敗しました: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
