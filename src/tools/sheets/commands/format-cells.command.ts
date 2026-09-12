import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import type { sheets_v4 } from 'googleapis';
import type { ToolArgs, ToolDefinition } from '../../../types/mcp.js';
import type { Command } from '../../base/command.interface.js';
import { createErrorResult } from '../../base/command.interface.js';
import {
  HORIZONTAL_ALIGNMENTS,
  NUMBER_FORMAT_TYPES,
  VERTICAL_ALIGNMENTS,
  WRAP_STRATEGIES,
  toCellFormat,
} from '../cell-format.js';
import { toGridIndexes } from '../grid-range.js';
import { fetchSheetIds } from '../sheet-id-resolver.js';

/**
 * セルの見た目（塗り・文字・配置・数値書式）を変更するコマンド。
 *
 * 「見出し行は濃い青に白の太字、データ行は白背景」のように範囲ごとの指定をまとめて受け、
 * 1 回の batchUpdate で適用する。途中で失敗しても中途半端な見た目が残らない。
 */
export class FormatCellsCommand implements Command {
  getToolDefinition(): ToolDefinition {
    return {
      name: 'sheets_format_cells',
      description:
        'Apply visual formatting (background color, font color, bold, size, alignment, number format) to one or more cell ranges. Only the properties you specify are changed; everything else is left as is.',
      inputSchema: {
        type: 'object',
        properties: {
          spreadsheetId: {
            type: 'string',
            description: 'The ID of the spreadsheet to format.',
          },
          formats: {
            type: 'array',
            description:
              'Formatting to apply, one entry per range. Example: [{"range": "Sheet1!A1:D1", "backgroundColor": "#4285F4", "fontColor": "#FFFFFF", "bold": true}].',
            items: {
              type: 'object',
              properties: {
                range: {
                  type: 'string',
                  description:
                    'The range to format in A1 notation (e.g., "Sheet1!A1:D1", "A1:D1", "Sheet1!B:B"). Without a sheet name the first sheet is used.',
                },
                backgroundColor: {
                  type: 'string',
                  description: 'Cell background as an RGB hex color (e.g., "#4285F4").',
                },
                fontColor: {
                  type: 'string',
                  description: 'Text color as an RGB hex color (e.g., "#FFFFFF").',
                },
                bold: { type: 'boolean', description: 'Whether the text is bold.' },
                italic: { type: 'boolean', description: 'Whether the text is italic.' },
                underline: { type: 'boolean', description: 'Whether the text is underlined.' },
                strikethrough: { type: 'boolean', description: 'Whether the text has a strikethrough.' },
                fontSize: { type: 'number', description: 'Font size in points (e.g., 12).' },
                fontFamily: { type: 'string', description: 'Font family name (e.g., "Roboto").' },
                horizontalAlignment: {
                  type: 'string',
                  description: 'Horizontal alignment of the text.',
                  enum: [...HORIZONTAL_ALIGNMENTS],
                },
                verticalAlignment: {
                  type: 'string',
                  description: 'Vertical alignment of the text.',
                  enum: [...VERTICAL_ALIGNMENTS],
                },
                wrapStrategy: {
                  type: 'string',
                  description: 'How text that is longer than the cell is handled.',
                  enum: [...WRAP_STRATEGIES],
                },
                numberFormat: {
                  type: 'object',
                  description:
                    'Number format for the cells. Example: {"type": "CURRENCY", "pattern": "\\"¥\\"#,##0"}. The pattern is optional.',
                  properties: {
                    type: { type: 'string', enum: [...NUMBER_FORMAT_TYPES] },
                    pattern: { type: 'string' },
                  },
                  required: ['type'],
                },
              },
              required: ['range'],
            },
          },
        },
        required: ['spreadsheetId', 'formats'],
      },
    };
  }

  async execute(args: ToolArgs, auth: OAuth2Client): Promise<CallToolResult> {
    const spreadsheetId = typeof args.spreadsheetId === 'string' ? args.spreadsheetId : '';
    const formats = args.formats;

    if (spreadsheetId === '') {
      return createErrorResult('spreadsheetId が指定されていません。');
    }
    if (!Array.isArray(formats) || formats.length === 0) {
      return createErrorResult('formats は 1 つ以上の要素を持つ配列で指定してください。');
    }

    const sheets = google.sheets({ version: 'v4', auth });

    try {
      const sheetIds = await fetchSheetIds(sheets, spreadsheetId);
      const requests: sheets_v4.Schema$Request[] = [];

      for (const entry of formats as unknown[]) {
        if (typeof entry !== 'object' || entry === null) {
          return createErrorResult('formats の要素はオブジェクトで指定してください。');
        }

        const spec = entry as Record<string, unknown>;
        const range = typeof spec.range === 'string' ? spec.range : '';

        if (range === '') {
          return createErrorResult('formats の各要素には range（A1 記法）が必要です。');
        }

        const { format, fields } = toCellFormat(spec);

        if (fields.length === 0) {
          return createErrorResult(`range "${range}" に適用する書式が 1 つも指定されていません。`);
        }

        requests.push({
          repeatCell: {
            range: { sheetId: sheetIds.of(range), ...toGridIndexes(range) },
            cell: { userEnteredFormat: format },
            fields: fields.map((field) => `userEnteredFormat.${field}`).join(','),
          },
        });
      }

      await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } });

      const ranges = (formats as Record<string, unknown>[]).map((spec) => String(spec.range)).join(', ');

      return {
        content: [{ type: 'text', text: `${String(requests.length)} 件の範囲に書式を適用しました。\n対象: ${ranges}` }],
      };
    } catch (error) {
      return createErrorResult(`書式の適用に失敗しました: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
