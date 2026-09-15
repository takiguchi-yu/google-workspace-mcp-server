import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import type { sheets_v4 } from 'googleapis';
import type { ToolArgs, ToolDefinition } from '../../../types/mcp.js';
import type { Command } from '../../base/command.interface.js';
import { createErrorResult } from '../../base/command.interface.js';
import { FILTER_CONDITION_TYPES, toBooleanCondition } from '../condition.js';
import { toColumnIndex, toGridIndexes } from '../grid-range.js';
import { fetchSheetIds } from '../sheet-id-resolver.js';
import { describeSortSpecs, sortSpecSchema, toSortSpecs } from '../sort-spec.js';

/**
 * シートにフィルタを設置するコマンド。
 *
 * `sheets_sort_range` と違い、**セルの中身は動かない**。見出し行にフィルタのボタンが付き、
 * 抽出条件を付ければ条件に合わない行が隠れる。1 シートに 1 つだけ存在でき、
 * 呼び直すと前のフィルタを置き換える。
 */
export class SetBasicFilterCommand implements Command {
  getToolDefinition(): ToolDefinition {
    return {
      name: 'sheets_set_basic_filter',
      description:
        'Put a filter on a range so the header row gets filter buttons, optionally hiding rows that do not match a criterion. Unlike sheets_sort_range this does not move any cell contents. A sheet holds only one basic filter; calling this again replaces it.',
      inputSchema: {
        type: 'object',
        properties: {
          spreadsheetId: {
            type: 'string',
            description: 'The ID of the spreadsheet to modify.',
          },
          range: {
            type: 'string',
            description:
              'The range the filter covers in A1 notation, including the header row (e.g., "Sheet1!A1:D100"). Without a sheet name the first sheet is used.',
          },
          sortSpecs: {
            type: 'array',
            description:
              'Columns the filter sorts by, in priority order. Optional. Example: [{"column": "C", "order": "DESCENDING"}].',
            items: sortSpecSchema as unknown as Record<string, unknown>,
          },
          criteria: {
            type: 'array',
            description:
              'Per-column rules for which rows stay visible. Optional. Give either condition or hiddenValues for each column.',
            items: {
              type: 'object',
              properties: {
                column: {
                  type: 'string',
                  description: 'The column the rule applies to, as an A1 column letter (e.g., "B").',
                },
                condition: {
                  type: 'object',
                  description:
                    'Rows matching this condition stay visible. Example: {"type": "NUMBER_GREATER", "values": ["100"]}.',
                  properties: {
                    type: { type: 'string', enum: [...FILTER_CONDITION_TYPES] },
                    values: {
                      type: 'array',
                      description: 'Values the condition compares against.',
                      items: { type: 'string' },
                    },
                  },
                  required: ['type'],
                },
                hiddenValues: {
                  type: 'array',
                  description: 'Exact cell values to hide (e.g., ["Done", "Cancelled"]). Use instead of condition.',
                  items: { type: 'string' },
                },
              },
              required: ['column'],
            },
          },
        },
        required: ['spreadsheetId', 'range'],
      },
    };
  }

  async execute(args: ToolArgs, auth: OAuth2Client): Promise<CallToolResult> {
    const spreadsheetId = typeof args.spreadsheetId === 'string' ? args.spreadsheetId : '';
    const range = typeof args.range === 'string' ? args.range : '';

    if (spreadsheetId === '') {
      return createErrorResult('spreadsheetId が指定されていません。');
    }
    if (range === '') {
      return createErrorResult('range が指定されていません。');
    }

    const sheets = google.sheets({ version: 'v4', auth });

    try {
      const sortSpecs = args.sortSpecs === undefined ? undefined : toSortSpecs(args.sortSpecs, 'sortSpecs');
      const filterSpecs = toFilterSpecs(args.criteria);
      const sheetIds = await fetchSheetIds(sheets, spreadsheetId);

      const filter: sheets_v4.Schema$BasicFilter = {
        range: { sheetId: sheetIds.of(range), ...toGridIndexes(range) },
      };
      if (sortSpecs !== undefined) {
        filter.sortSpecs = sortSpecs;
      }
      if (filterSpecs.length > 0) {
        filter.filterSpecs = filterSpecs;
      }

      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests: [{ setBasicFilter: { filter } }] },
      });

      const lines = [`フィルタを設置しました。`, `対象: ${range}`];
      if (sortSpecs !== undefined) {
        lines.push(`並べ替え: ${describeSortSpecs(sortSpecs)}`);
      }
      if (filterSpecs.length > 0) {
        lines.push(`抽出条件: ${String(filterSpecs.length)} 列に設定`);
      }
      lines.push(`スプレッドシートURL: https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`);

      return { content: [{ type: 'text', text: lines.join('\n') }] };
    } catch (error) {
      return createErrorResult(
        `フィルタの設置に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

/** 列ごとの抽出条件を FilterSpec の配列に変換する。指定が無ければ空配列 */
const toFilterSpecs = (value: unknown): sheets_v4.Schema$FilterSpec[] => {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new Error('criteria は { column, condition } または { column, hiddenValues } を持つ配列で指定してください。');
  }

  return value.map((entry, index) => {
    if (typeof entry !== 'object' || entry === null) {
      throw new Error(`criteria[${String(index)}] はオブジェクトで指定してください。`);
    }

    const { column, condition, hiddenValues } = entry as Record<string, unknown>;
    const name = `criteria[${String(index)}]`;

    if (condition === undefined && hiddenValues === undefined) {
      throw new Error(`${name} には condition か hiddenValues のどちらかを指定してください。`);
    }
    if (condition !== undefined && hiddenValues !== undefined) {
      throw new Error(`${name} の condition と hiddenValues は同時に指定できません。どちらか一方にしてください。`);
    }

    const criteria: sheets_v4.Schema$FilterCriteria =
      condition === undefined
        ? { hiddenValues: toHiddenValues(hiddenValues, name) }
        : { condition: toBooleanCondition(condition, FILTER_CONDITION_TYPES, `${name}.condition`) };

    return { columnIndex: toColumnIndex(column, `${name}.column`), filterCriteria: criteria };
  });
};

/** 隠す値の一覧を文字列の配列に整える */
const toHiddenValues = (value: unknown, name: string): string[] => {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${name}.hiddenValues は 1 つ以上の値を持つ配列で指定してください。`);
  }

  return value.map((entry) => String(entry));
};
