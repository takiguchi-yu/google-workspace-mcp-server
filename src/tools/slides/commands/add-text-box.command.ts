import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import type { slides_v1 } from 'googleapis';
import type { ToolArgs, ToolDefinition } from '../../../types/mcp.js';
import type { Command } from '../../base/command.interface.js';
import { createErrorResult } from '../../base/command.interface.js';
import { pickOptionalEnum } from '../enum-argument.js';
import { ALIGNMENTS } from '../paragraph-style.js';
import { textStyleSchema, toTextStyle } from '../text-style.js';

/**
 * スライドに新しいテキストボックスを追加するコマンド。
 *
 * 文字の見た目と段落の揃えも同じ呼び出しで指定できる。作った objectId を受け取ってから
 * slides_update_text_style をもう 1 回呼ぶ往復を省くため。
 *
 * **位置と大きさは EMU で受ける。** 0.8.0 で追加したツールはポイントで受けるが、
 * このツールは 0.4.0 から EMU で公開しており、単位を変えると既存の呼び出しが黙って
 * 72 分の 1 の大きさになるため据え置いている（docs/adr/0004-points-for-new-slides-tools.md）。
 */
export class AddTextBoxCommand implements Command {
  getToolDefinition(): ToolDefinition {
    return {
      name: 'slides_add_text_box',
      description:
        'Add a new text box to a slide with custom position and content. Font, color, and paragraph alignment can be set here too. Position and size are in EMUs (1 inch = 914400 EMU, 1 pt = 12700 EMU); the newer slides_add_line and slides_add_table take points instead.',
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
          text: {
            type: 'string',
            description: 'The text content for the text box.',
          },
          left: {
            type: 'number',
            description: 'Left position in EMUs (English Metric Units). 1 inch = 914400 EMUs. Defaults to 0.',
            default: 0,
          },
          top: {
            type: 'number',
            description: 'Top position in EMUs. Defaults to 0.',
            default: 0,
          },
          width: {
            type: 'number',
            description: 'Box width in EMUs. Defaults to 1828800 (2 inches).',
            default: 1_828_800,
          },
          height: {
            type: 'number',
            description: 'Box height in EMUs. Defaults to 914400 (1 inch).',
            default: 914_400,
          },
          ...textStyleSchema,
          alignment: {
            type: 'string',
            description: 'Horizontal alignment of the text. START is left in a left-to-right language.',
            enum: [...ALIGNMENTS],
          },
        },
        required: ['presentationId', 'pageObjectId', 'text'],
      },
    };
  }

  async execute(args: ToolArgs, auth: OAuth2Client): Promise<CallToolResult> {
    const presentationId = typeof args.presentationId === 'string' ? args.presentationId : '';
    const pageObjectId = typeof args.pageObjectId === 'string' ? args.pageObjectId : '';
    const text = typeof args.text === 'string' ? args.text : '';
    const left = typeof args.left === 'number' ? args.left : 0;
    const top = typeof args.top === 'number' ? args.top : 0;
    const width = typeof args.width === 'number' ? args.width : 1_828_800;
    const height = typeof args.height === 'number' ? args.height : 914_400;

    if (presentationId === '') {
      return createErrorResult('presentationId が指定されていません。');
    }
    if (pageObjectId === '') {
      return createErrorResult('pageObjectId が指定されていません。');
    }
    if (text === '') {
      return createErrorResult('text が指定されていません。');
    }

    const objectId = `textbox_${String(Date.now())}`;
    const requests: slides_v1.Schema$Request[] = [
      {
        createShape: {
          objectId,
          shapeType: 'TEXT_BOX',
          elementProperties: {
            pageObjectId,
            // 大きさは size で渡す。transform の scale は倍率（スカラー）であって寸法ではない
            size: {
              width: { magnitude: width, unit: 'EMU' },
              height: { magnitude: height, unit: 'EMU' },
            },
            transform: { scaleX: 1, scaleY: 1, translateX: left, translateY: top, unit: 'EMU' },
          },
        },
      },
      { insertText: { objectId, text } },
    ];

    try {
      const { style, fields } = toTextStyle(args);

      if (fields.length > 0) {
        requests.push({ updateTextStyle: { objectId, style, textRange: { type: 'ALL' }, fields: fields.join(',') } });
      }

      const alignment = pickOptionalEnum(args.alignment, ALIGNMENTS, 'alignment');

      if (alignment !== undefined) {
        requests.push({
          updateParagraphStyle: { objectId, style: { alignment }, textRange: { type: 'ALL' }, fields: 'alignment' },
        });
      }
    } catch (error) {
      return createErrorResult(error instanceof Error ? error.message : String(error));
    }

    const slides = google.slides({ version: 'v1', auth });

    try {
      await slides.presentations.batchUpdate({ presentationId, requestBody: { requests } });

      return {
        content: [
          {
            type: 'text',
            text: `テキストボックスを追加しました。\nプレゼンテーションID: ${presentationId}\nobjectId: ${objectId}`,
          },
        ],
      };
    } catch (error) {
      return createErrorResult(
        `テキストボックスの追加に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
