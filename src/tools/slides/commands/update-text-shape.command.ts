import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import type { ToolArgs, ToolDefinition } from '../../../types/mcp.js';
import type { Command } from '../../base/command.interface.js';
import { createErrorResult } from '../../base/command.interface.js';

/**
 * テキスト要素（シェイプ）の内容を更新するコマンド
 */
export class UpdateTextShapeCommand implements Command {
  getToolDefinition(): ToolDefinition {
    return {
      name: 'slides_update_text_shape',
      description: 'Update text content in an existing shape/text element on a slide.',
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
          elementObjectId: {
            type: 'string',
            description: 'The object ID of the shape/text element to update.',
          },
          text: {
            type: 'string',
            description: 'The new text content.',
          },
          appendText: {
            type: 'boolean',
            description: 'If true, append to existing text; if false (default), replace all text.',
            default: false,
          },
        },
        required: ['presentationId', 'pageObjectId', 'elementObjectId', 'text'],
      },
    };
  }

  async execute(args: ToolArgs, auth: OAuth2Client): Promise<CallToolResult> {
    const presentationId = typeof args.presentationId === 'string' ? args.presentationId : '';
    const pageObjectId = typeof args.pageObjectId === 'string' ? args.pageObjectId : '';
    const elementObjectId = typeof args.elementObjectId === 'string' ? args.elementObjectId : '';
    const text = typeof args.text === 'string' ? args.text : '';
    const appendText = args.appendText === true;

    if (presentationId === '') {
      return createErrorResult('presentationId が指定されていません。');
    }
    if (pageObjectId === '') {
      return createErrorResult('pageObjectId が指定されていません。');
    }
    if (elementObjectId === '') {
      return createErrorResult('elementObjectId が指定されていません。');
    }
    if (text === '') {
      return createErrorResult('text が指定されていません。');
    }

    const slides = google.slides({ version: 'v1', auth });

    try {
      // 追記の挿入位置は、いま入っているテキストの長さでなければならない。
      // 十分大きい数を渡すと API に "insertion index should not be greater than
      // the existing text length" と拒否されるため、長さを数えてから渡す。
      const currentLength = appendText ? await textLengthOf(slides, presentationId, elementObjectId) : 0;

      const requests = appendText
        ? [
            {
              insertText: {
                objectId: elementObjectId,
                insertionIndex: currentLength,
                text: currentLength === 0 ? text : `\n${text}`,
              },
            },
          ]
        : [
            {
              deleteText: {
                objectId: elementObjectId,
                textRange: {
                  type: 'ALL',
                },
              },
            },
            {
              insertText: {
                objectId: elementObjectId,
                insertionIndex: 0,
                text,
              },
            },
          ];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (slides.presentations as any).batchUpdate({
        presentationId,
        requestBody: { requests },
      });

      return {
        content: [
          {
            type: 'text',
            text: `テキスト要素を${appendText ? '更新' : '置換'}しました。\nプレゼンテーションID: ${presentationId}`,
          },
        ],
      };
    } catch (error) {
      return createErrorResult(
        `テキスト要素の更新に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

/**
 * 要素にいま入っているテキストの長さを返す。要素が見つからない、テキストを持たない場合は 0。
 *
 * Slides のテキストには末尾に消せない改行が含まれるが、挿入位置の上限はそれを含まない
 * 長さなので、textRun の中身だけを数える。
 */
const textLengthOf = async (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  slides: any,
  presentationId: string,
  elementObjectId: string,
): Promise<number> => {
  const response = await slides.presentations.get({
    presentationId,
    fields: 'slides.pageElements(objectId,shape(text(textElements(textRun(content)))))',
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const slide of (response.data.slides ?? []) as any[]) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const element = (slide.pageElements ?? []).find((page: any) => page.objectId === elementObjectId);

    if (element !== undefined) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const content = ((element.shape?.text?.textElements ?? []) as any[])
        .map((textElement) => (textElement.textRun?.content ?? '') as string)
        .join('');

      // 末尾の改行は消せない暗黙のものなので、挿入位置の上限には含まれない
      return content.endsWith('\n') ? content.length - 1 : content.length;
    }
  }

  return 0;
};
