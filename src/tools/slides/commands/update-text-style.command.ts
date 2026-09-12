import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import type { slides_v1 } from 'googleapis';
import type { ToolArgs, ToolDefinition } from '../../../types/mcp.js';
import type { Command } from '../../base/command.interface.js';
import { createErrorResult } from '../../base/command.interface.js';
import { hexToRgb } from '../../shared/color.js';

/**
 * テキストの見た目（フォント・大きさ・色・装飾）を変えるコマンド。
 *
 * slides_add_text_box はテキストを入れるだけで装飾を持たないため、作ったあとの飾り付けは
 * このコマンドが引き受ける。範囲を指定しなければ要素のテキスト全体にかかる。
 */
export class UpdateTextStyleCommand implements Command {
  getToolDefinition(): ToolDefinition {
    return {
      name: 'slides_update_text_style',
      description:
        'Change how the text of a shape or text box looks: font family, size, color, bold, italic, underline, strikethrough. Only the properties you specify are changed. Applies to the whole text unless startIndex and endIndex are given.',
      inputSchema: {
        type: 'object',
        properties: {
          presentationId: {
            type: 'string',
            description: 'The ID of the presentation.',
          },
          objectId: {
            type: 'string',
            description: 'The object ID of the shape or text box holding the text.',
          },
          fontFamily: {
            type: 'string',
            description: 'Font family name (e.g., "Roboto", "Noto Sans JP").',
          },
          fontSize: {
            type: 'number',
            description: 'Font size in points (e.g., 24).',
          },
          foregroundColor: {
            type: 'string',
            description: 'Text color as an RGB hex color (e.g., "#202124").',
          },
          backgroundColor: {
            type: 'string',
            description: 'Highlight color behind the text as an RGB hex color.',
          },
          bold: { type: 'boolean', description: 'Whether the text is bold.' },
          italic: { type: 'boolean', description: 'Whether the text is italic.' },
          underline: { type: 'boolean', description: 'Whether the text is underlined.' },
          strikethrough: { type: 'boolean', description: 'Whether the text has a strikethrough.' },
          startIndex: {
            type: 'number',
            description: 'Zero-based start of the character range to style. Omit to style all text.',
          },
          endIndex: {
            type: 'number',
            description: 'Zero-based end of the character range, exclusive. Omit to style all text.',
          },
        },
        required: ['presentationId', 'objectId'],
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

    const style: slides_v1.Schema$TextStyle = {};
    const fields: string[] = [];

    for (const key of ['bold', 'italic', 'underline', 'strikethrough'] as const) {
      const value = args[key];
      if (typeof value === 'boolean') {
        style[key] = value;
        fields.push(key);
      }
    }

    if (typeof args.fontFamily === 'string') {
      style.fontFamily = args.fontFamily;
      fields.push('fontFamily');
    }
    if (typeof args.fontSize === 'number') {
      style.fontSize = { magnitude: args.fontSize, unit: 'PT' };
      fields.push('fontSize');
    }
    if (typeof args.foregroundColor === 'string') {
      style.foregroundColor = { opaqueColor: { rgbColor: hexToRgb(args.foregroundColor) } };
      fields.push('foregroundColor');
    }
    if (typeof args.backgroundColor === 'string') {
      style.backgroundColor = { opaqueColor: { rgbColor: hexToRgb(args.backgroundColor) } };
      fields.push('backgroundColor');
    }

    if (fields.length === 0) {
      return createErrorResult('変更する見た目を 1 つ以上指定してください（fontSize、bold、foregroundColor など）。');
    }

    const startIndex = typeof args.startIndex === 'number' ? args.startIndex : undefined;
    const endIndex = typeof args.endIndex === 'number' ? args.endIndex : undefined;
    const textRange: slides_v1.Schema$Range =
      startIndex === undefined || endIndex === undefined
        ? { type: 'ALL' }
        : { type: 'FIXED_RANGE', startIndex, endIndex };

    const slides = google.slides({ version: 'v1', auth });

    try {
      await slides.presentations.batchUpdate({
        presentationId,
        requestBody: {
          requests: [{ updateTextStyle: { objectId, style, textRange, fields: fields.join(',') } }],
        },
      });

      return {
        content: [
          {
            type: 'text',
            text: `要素 ${objectId} のテキストの見た目を更新しました。\n変更した項目: ${fields.join(', ')}`,
          },
        ],
      };
    } catch (error) {
      return createErrorResult(
        `テキストの見た目の更新に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
