import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import type { sheets_v4 } from 'googleapis';
import type { ToolArgs, ToolDefinition } from '../../../types/mcp.js';
import type { Command } from '../../base/command.interface.js';
import { createErrorResult } from '../../base/command.interface.js';
import { hexToRgb } from '../../shared/color.js';
import { toGridIndexes } from '../grid-range.js';
import { fetchSheetIds } from '../sheet-id-resolver.js';

/** 罫線の種類として受け付ける値。NONE は罫線を消す */
const BORDER_STYLES = ['SOLID', 'SOLID_MEDIUM', 'SOLID_THICK', 'DASHED', 'DOTTED', 'DOUBLE', 'NONE'] as const;

/** 罫線を引ける辺。`all` はこの 6 辺すべての省略記法 */
const BORDER_SIDES = ['top', 'bottom', 'left', 'right', 'innerHorizontal', 'innerVertical'] as const;

/** 1 辺ぶんの罫線指定のスキーマ。辺ごとに同じ形を使う */
const borderSchema = (side: string): Record<string, unknown> => ({
  type: 'object',
  description: `Border on the ${side}.`,
  properties: {
    style: { type: 'string', enum: [...BORDER_STYLES], description: 'Line style. Defaults to SOLID.' },
    color: { type: 'string', description: 'RGB hex color (e.g., "#000000"). Defaults to black.' },
    width: { type: 'number', description: 'Line width in pixels. Usually left unset.' },
  },
});

/**
 * セル範囲に罫線を引くコマンド。
 *
 * 外周の 4 辺と内側の縦横を個別に指定できる。すべて同じ罫線でよければ `all` にまとめて渡す。
 */
export class SetBordersCommand implements Command {
  getToolDefinition(): ToolDefinition {
    return {
      name: 'sheets_set_borders',
      description:
        'Draw or clear borders around and inside one or more cell ranges. Use "all" to apply the same border to every edge, or set individual edges. Use style NONE to remove a border.',
      inputSchema: {
        type: 'object',
        properties: {
          spreadsheetId: {
            type: 'string',
            description: 'The ID of the spreadsheet to modify.',
          },
          borders: {
            type: 'array',
            description:
              'Borders to apply, one entry per range. Example: [{"range": "Sheet1!A1:D10", "all": {"style": "SOLID", "color": "#B0B0B0"}}].',
            items: {
              type: 'object',
              properties: {
                range: {
                  type: 'string',
                  description:
                    'The range to draw borders on in A1 notation (e.g., "Sheet1!A1:D10"). Without a sheet name the first sheet is used.',
                },
                all: borderSchema('every edge, outer and inner'),
                top: borderSchema('top edge'),
                bottom: borderSchema('bottom edge'),
                left: borderSchema('left edge'),
                right: borderSchema('right edge'),
                innerHorizontal: borderSchema('horizontal lines between rows'),
                innerVertical: borderSchema('vertical lines between columns'),
              },
              required: ['range'],
            },
          },
        },
        required: ['spreadsheetId', 'borders'],
      },
    };
  }

  async execute(args: ToolArgs, auth: OAuth2Client): Promise<CallToolResult> {
    const spreadsheetId = typeof args.spreadsheetId === 'string' ? args.spreadsheetId : '';
    const borders = args.borders;

    if (spreadsheetId === '') {
      return createErrorResult('spreadsheetId が指定されていません。');
    }
    if (!Array.isArray(borders) || borders.length === 0) {
      return createErrorResult('borders は 1 つ以上の要素を持つ配列で指定してください。');
    }

    const sheets = google.sheets({ version: 'v4', auth });

    try {
      const sheetIds = await fetchSheetIds(sheets, spreadsheetId);
      const requests: sheets_v4.Schema$Request[] = [];

      for (const entry of borders as unknown[]) {
        if (typeof entry !== 'object' || entry === null) {
          return createErrorResult('borders の要素はオブジェクトで指定してください。');
        }

        const spec = entry as Record<string, unknown>;
        const range = typeof spec.range === 'string' ? spec.range : '';

        if (range === '') {
          return createErrorResult('borders の各要素には range（A1 記法）が必要です。');
        }

        const sides = toSides(spec);

        if (Object.keys(sides).length === 0) {
          return createErrorResult(`range "${range}" に引く罫線が 1 つも指定されていません。`);
        }

        requests.push({
          updateBorders: { range: { sheetId: sheetIds.of(range), ...toGridIndexes(range) }, ...sides },
        });
      }

      await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } });

      const ranges = (borders as Record<string, unknown>[]).map((spec) => String(spec.range)).join(', ');

      return {
        content: [{ type: 'text', text: `${String(requests.length)} 件の範囲に罫線を適用しました。\n対象: ${ranges}` }],
      };
    } catch (error) {
      return createErrorResult(`罫線の適用に失敗しました: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

/** 1 範囲ぶんの指定から、辺ごとの罫線を組み立てる。`all` は個別指定で上書きできる */
const toSides = (
  spec: Record<string, unknown>,
): Partial<Record<(typeof BORDER_SIDES)[number], sheets_v4.Schema$Border>> => {
  const sides: Partial<Record<(typeof BORDER_SIDES)[number], sheets_v4.Schema$Border>> = {};
  const all = spec.all === undefined ? null : toBorder(spec.all, 'all');

  for (const side of BORDER_SIDES) {
    const border = spec[side] === undefined ? all : toBorder(spec[side], side);

    if (border !== null) {
      sides[side] = border;
    }
  }

  return sides;
};

/** 罫線 1 本ぶんの指定を Border に変換する */
const toBorder = (value: unknown, name: string): sheets_v4.Schema$Border => {
  if (typeof value !== 'object' || value === null) {
    throw new Error(`${name} は { style, color, width } のオブジェクトで指定してください。`);
  }

  const { style, color, width } = value as Record<string, unknown>;

  if (style !== undefined && !(typeof style === 'string' && (BORDER_STYLES as readonly string[]).includes(style))) {
    throw new Error(`${name}.style は ${BORDER_STYLES.join(' / ')} のいずれかで指定してください。`);
  }

  const border: sheets_v4.Schema$Border = { style: typeof style === 'string' ? style : 'SOLID' };

  if (typeof color === 'string') {
    border.color = hexToRgb(color);
  }
  if (typeof width === 'number') {
    border.width = width;
  }

  return border;
};
