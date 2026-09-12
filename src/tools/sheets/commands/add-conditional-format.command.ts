import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import type { sheets_v4 } from 'googleapis';
import type { ToolArgs, ToolDefinition } from '../../../types/mcp.js';
import type { Command } from '../../base/command.interface.js';
import { createErrorResult } from '../../base/command.interface.js';
import { hexToRgb } from '../../shared/color.js';
import { toCellFormat } from '../cell-format.js';
import { toGridIndexes } from '../grid-range.js';
import { fetchSheetIds } from '../sheet-id-resolver.js';

/**
 * 値の判定の仕方。
 *
 * Sheets API の ConditionType はデータ入力規則と共用で、条件付き書式が受け取るのは
 * その部分集合でしかない。列挙にあっても `ConditionType 'X' is not supported in
 * conditional formats.` で弾かれる値があるため、実際に通るものだけを載せている。
 * 除外したもの: TEXT_NOT_EQ / TEXT_IS_EMAIL / TEXT_IS_URL / DATE_NOT_EQ /
 * DATE_ON_OR_BEFORE / DATE_ON_OR_AFTER / DATE_BETWEEN / DATE_NOT_BETWEEN /
 * DATE_IS_VALID / ONE_OF_RANGE / ONE_OF_LIST / BOOLEAN / FILTER_EXPRESSION。
 */
const CONDITION_TYPES = [
  'NUMBER_GREATER',
  'NUMBER_GREATER_THAN_EQ',
  'NUMBER_LESS',
  'NUMBER_LESS_THAN_EQ',
  'NUMBER_EQ',
  'NUMBER_NOT_EQ',
  'NUMBER_BETWEEN',
  'NUMBER_NOT_BETWEEN',
  'TEXT_CONTAINS',
  'TEXT_NOT_CONTAINS',
  'TEXT_STARTS_WITH',
  'TEXT_ENDS_WITH',
  'TEXT_EQ',
  'DATE_EQ',
  'DATE_BEFORE',
  'DATE_AFTER',
  'BLANK',
  'NOT_BLANK',
  'CUSTOM_FORMULA',
] as const;

/** 色スケールの基準点の決め方 */
const INTERPOLATION_POINT_TYPES = ['MIN', 'MAX', 'NUMBER', 'PERCENT', 'PERCENTILE'] as const;

/** 色スケールの基準点 1 つぶんのスキーマ */
const interpolationPointSchema = (position: string): Record<string, unknown> => ({
  type: 'object',
  description: `The ${position} of the color scale.`,
  properties: {
    color: { type: 'string', description: 'RGB hex color for this point (e.g., "#FFFFFF").' },
    type: {
      type: 'string',
      enum: [...INTERPOLATION_POINT_TYPES],
      description: 'How the point is placed. MIN and MAX ignore value.',
    },
    value: { type: 'string', description: 'The number, percent, or percentile. Unused for MIN and MAX.' },
  },
  required: ['color', 'type'],
});

/**
 * 条件付き書式のルールを追加するコマンド。
 *
 * 値の判定で色を切り替える（booleanRule）か、値の大小を色の濃淡で表す（gradientRule）かの
 * どちらか一方を受ける。1 つのルールに渡す範囲は同じシートに属している必要がある。
 */
export class AddConditionalFormatCommand implements Command {
  getToolDefinition(): ToolDefinition {
    return {
      name: 'sheets_add_conditional_format',
      description:
        'Add a conditional formatting rule to a sheet. Either pass condition + format to color cells that match a condition, or pass gradient to apply a color scale. All ranges of one rule must be on the same sheet.',
      inputSchema: {
        type: 'object',
        properties: {
          spreadsheetId: {
            type: 'string',
            description: 'The ID of the spreadsheet to modify.',
          },
          ranges: {
            type: 'array',
            description:
              'Ranges the rule applies to, in A1 notation (e.g., ["Sheet1!B2:B100"]). All ranges must be on the same sheet.',
            items: { type: 'string' },
          },
          condition: {
            type: 'object',
            description:
              'The condition that turns the formatting on. Example: {"type": "NUMBER_GREATER", "values": ["100"]}. Required unless gradient is given.',
            properties: {
              type: { type: 'string', enum: [...CONDITION_TYPES] },
              values: {
                type: 'array',
                description:
                  'Values the condition compares against. BLANK and NOT_BLANK take none, BETWEEN takes two, CUSTOM_FORMULA takes one formula starting with "=".',
                items: { type: 'string' },
              },
            },
            required: ['type'],
          },
          format: {
            type: 'object',
            description: 'The formatting applied when the condition matches. Required when condition is given.',
            properties: {
              backgroundColor: { type: 'string', description: 'Background as an RGB hex color (e.g., "#FCE8E6").' },
              fontColor: { type: 'string', description: 'Text color as an RGB hex color (e.g., "#C5221F").' },
              bold: { type: 'boolean' },
              italic: { type: 'boolean' },
              underline: { type: 'boolean' },
              strikethrough: { type: 'boolean' },
            },
          },
          gradient: {
            type: 'object',
            description: 'A color scale applied across the range. Use instead of condition + format.',
            properties: {
              minpoint: interpolationPointSchema('low end'),
              midpoint: interpolationPointSchema('middle'),
              maxpoint: interpolationPointSchema('high end'),
            },
            required: ['minpoint', 'maxpoint'],
          },
          index: {
            type: 'number',
            description:
              'Where the rule is inserted among the existing rules of the sheet. Defaults to 0 (evaluated first).',
            default: 0,
          },
        },
        required: ['spreadsheetId', 'ranges'],
      },
    };
  }

  async execute(args: ToolArgs, auth: OAuth2Client): Promise<CallToolResult> {
    const spreadsheetId = typeof args.spreadsheetId === 'string' ? args.spreadsheetId : '';
    const ranges = args.ranges;
    const index = typeof args.index === 'number' ? args.index : 0;

    if (spreadsheetId === '') {
      return createErrorResult('spreadsheetId が指定されていません。');
    }
    if (!Array.isArray(ranges) || ranges.length === 0 || ranges.some((range) => typeof range !== 'string')) {
      return createErrorResult('ranges は 1 つ以上の A1 記法の文字列を持つ配列で指定してください。');
    }
    if (args.condition === undefined && args.gradient === undefined) {
      return createErrorResult('condition（＋format）か gradient のどちらかを指定してください。');
    }
    if (args.condition !== undefined && args.gradient !== undefined) {
      return createErrorResult('condition と gradient は同時に指定できません。どちらか一方にしてください。');
    }

    const sheets = google.sheets({ version: 'v4', auth });

    try {
      const sheetIds = await fetchSheetIds(sheets, spreadsheetId);
      const gridRanges = (ranges as string[]).map((range) => ({
        sheetId: sheetIds.of(range),
        ...toGridIndexes(range),
      }));

      const sheetId = gridRanges[0]!.sheetId;
      if (gridRanges.some((range) => range.sheetId !== sheetId)) {
        return createErrorResult('1 つのルールに渡す ranges は、すべて同じシートの範囲である必要があります。');
      }

      const rule: sheets_v4.Schema$ConditionalFormatRule =
        args.gradient === undefined
          ? { ranges: gridRanges, booleanRule: toBooleanRule(args.condition, args.format) }
          : { ranges: gridRanges, gradientRule: toGradientRule(args.gradient) };

      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests: [{ addConditionalFormatRule: { rule, index } }] },
      });

      return {
        content: [
          {
            type: 'text',
            text: `条件付き書式を追加しました。\n対象: ${(ranges as string[]).join(', ')}\nindex: ${String(index)}\n（削除するときは sheets_list_conditional_formats で現在の index を確認してください）`,
          },
        ],
      };
    } catch (error) {
      return createErrorResult(
        `条件付き書式の追加に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

/** 条件と書式から booleanRule を組み立てる */
const toBooleanRule = (condition: unknown, format: unknown): sheets_v4.Schema$BooleanRule => {
  if (typeof condition !== 'object' || condition === null) {
    throw new Error('condition は { type, values } のオブジェクトで指定してください。');
  }

  const { type, values } = condition as Record<string, unknown>;

  if (typeof type !== 'string' || !(CONDITION_TYPES as readonly string[]).includes(type)) {
    throw new Error(
      `condition.type は条件付き書式で使える ConditionType で指定してください（受け取った値: ${String(type)}）。\n` +
        `使える値: ${CONDITION_TYPES.join(' / ')}`,
    );
  }
  if (typeof format !== 'object' || format === null) {
    throw new Error('condition を指定するときは format も指定してください。');
  }

  const { format: cellFormat, fields } = toCellFormat(format as Record<string, unknown>);

  if (fields.length === 0) {
    throw new Error('format に適用する書式が 1 つも指定されていません。');
  }

  const booleanCondition: sheets_v4.Schema$BooleanCondition = { type };

  if (Array.isArray(values) && values.length > 0) {
    booleanCondition.values = values.map((value) => ({ userEnteredValue: String(value) }));
  }

  return { condition: booleanCondition, format: cellFormat };
};

/** 色スケールの指定から gradientRule を組み立てる */
const toGradientRule = (gradient: unknown): sheets_v4.Schema$GradientRule => {
  if (typeof gradient !== 'object' || gradient === null) {
    throw new Error('gradient は { minpoint, midpoint, maxpoint } のオブジェクトで指定してください。');
  }

  const { minpoint, midpoint, maxpoint } = gradient as Record<string, unknown>;
  const rule: sheets_v4.Schema$GradientRule = {
    minpoint: toInterpolationPoint(minpoint, 'minpoint'),
    maxpoint: toInterpolationPoint(maxpoint, 'maxpoint'),
  };

  if (midpoint !== undefined) {
    rule.midpoint = toInterpolationPoint(midpoint, 'midpoint');
  }

  return rule;
};

/** 色スケールの基準点 1 つを組み立てる */
const toInterpolationPoint = (value: unknown, name: string): sheets_v4.Schema$InterpolationPoint => {
  if (typeof value !== 'object' || value === null) {
    throw new Error(`${name} は { color, type, value } のオブジェクトで指定してください。`);
  }

  const { color, type, value: pointValue } = value as Record<string, unknown>;

  if (typeof color !== 'string') {
    throw new Error(`${name}.color を 16 進数の色で指定してください。`);
  }
  if (typeof type !== 'string' || !(INTERPOLATION_POINT_TYPES as readonly string[]).includes(type)) {
    throw new Error(`${name}.type は ${INTERPOLATION_POINT_TYPES.join(' / ')} のいずれかで指定してください。`);
  }

  const point: sheets_v4.Schema$InterpolationPoint = { color: hexToRgb(color), type };

  if (type !== 'MIN' && type !== 'MAX') {
    if (pointValue === undefined) {
      throw new Error(`${name}.type が ${type} のときは ${name}.value が必要です。`);
    }
    point.value = String(pointValue);
  }

  return point;
};
