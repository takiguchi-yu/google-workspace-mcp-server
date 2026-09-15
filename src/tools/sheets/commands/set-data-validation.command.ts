import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import type { sheets_v4 } from 'googleapis';
import type { ToolArgs, ToolDefinition } from '../../../types/mcp.js';
import type { Command } from '../../base/command.interface.js';
import { createErrorResult } from '../../base/command.interface.js';
import { DATA_VALIDATION_CONDITION_TYPES, toBooleanCondition } from '../condition.js';
import { toGridIndexes } from '../grid-range.js';
import { fetchSheetIds } from '../sheet-id-resolver.js';

/**
 * セルに入力規則を設定するコマンド。
 *
 * プルダウン（ONE_OF_LIST / ONE_OF_RANGE）とチェックボックス（BOOLEAN）が主な用途。
 * どちらも `showCustomUi` を true にして初めてセル上の UI になるので、既定で true にしている。
 */
export class SetDataValidationCommand implements Command {
  getToolDefinition(): ToolDefinition {
    return {
      name: 'sheets_set_data_validation',
      description:
        'Set a data validation rule on one or more cell ranges. Use ONE_OF_LIST for a dropdown of fixed choices, ONE_OF_RANGE for a dropdown backed by a range, and BOOLEAN for a checkbox. To remove a rule, use sheets_clear_data_validation.',
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
              'Ranges the rule applies to, in A1 notation (e.g., ["Sheet1!C2:C100"]). Without a sheet name the first sheet is used.',
            items: { type: 'string' },
          },
          condition: {
            type: 'object',
            description:
              'What counts as valid input. Examples: {"type": "ONE_OF_LIST", "values": ["Todo", "Doing", "Done"]} for a dropdown, {"type": "BOOLEAN"} for a checkbox, {"type": "ONE_OF_RANGE", "values": ["=Master!$A$2:$A$20"]} for a dropdown backed by a range.',
            properties: {
              type: { type: 'string', enum: [...DATA_VALIDATION_CONDITION_TYPES] },
              values: {
                type: 'array',
                description:
                  'Values the condition compares against. ONE_OF_LIST takes the choices, ONE_OF_RANGE takes one range formula starting with "=", BETWEEN takes two, BOOLEAN takes none (or the two values that mean checked/unchecked).',
                items: { type: 'string' },
              },
            },
            required: ['type'],
          },
          strict: {
            type: 'boolean',
            description:
              'Whether input that fails the rule is rejected outright. Defaults to false, which accepts the input but flags the cell.',
            default: false,
          },
          showCustomUi: {
            type: 'boolean',
            description:
              'Whether the cell shows a dropdown or checkbox UI. Defaults to true; set false to validate without changing how the cell looks.',
            default: true,
          },
          inputMessage: {
            type: 'string',
            description: 'A hint shown to the person when they edit the cell.',
          },
        },
        required: ['spreadsheetId', 'ranges', 'condition'],
      },
    };
  }

  async execute(args: ToolArgs, auth: OAuth2Client): Promise<CallToolResult> {
    const spreadsheetId = typeof args.spreadsheetId === 'string' ? args.spreadsheetId : '';
    const ranges = args.ranges;
    const strict = args.strict === true;
    const showCustomUi = args.showCustomUi !== false;
    const inputMessage = typeof args.inputMessage === 'string' ? args.inputMessage : undefined;

    if (spreadsheetId === '') {
      return createErrorResult('spreadsheetId が指定されていません。');
    }
    if (!Array.isArray(ranges) || ranges.length === 0 || ranges.some((range) => typeof range !== 'string')) {
      return createErrorResult('ranges は 1 つ以上の A1 記法の文字列を持つ配列で指定してください。');
    }
    if (args.condition === undefined) {
      return createErrorResult('condition が指定されていません。');
    }

    const sheets = google.sheets({ version: 'v4', auth });

    try {
      const condition = toBooleanCondition(args.condition, DATA_VALIDATION_CONDITION_TYPES, 'condition');
      const rule: sheets_v4.Schema$DataValidationRule = { condition, strict, showCustomUi };

      if (inputMessage !== undefined) {
        rule.inputMessage = inputMessage;
      }

      const sheetIds = await fetchSheetIds(sheets, spreadsheetId);
      const requests = (ranges as string[]).map((range) => ({
        setDataValidation: {
          range: { sheetId: sheetIds.of(range), ...toGridIndexes(range) },
          rule,
        },
      }));

      await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } });

      return {
        content: [
          {
            type: 'text',
            text:
              `入力規則を設定しました。\n` +
              `対象: ${(ranges as string[]).join(', ')}\n` +
              `条件: ${condition.type ?? ''}${condition.values === undefined ? '' : ` (${condition.values.map((value) => String(value.userEnteredValue)).join(', ')})`}\n` +
              `入力を拒否する: ${strict ? 'はい' : 'いいえ（違反はセルに印が付くだけ）'}\n` +
              `スプレッドシートURL: https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
          },
        ],
      };
    } catch (error) {
      return createErrorResult(
        `入力規則の設定に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
