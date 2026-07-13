import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import type { ToolArgs, ToolDefinition } from '../../../types/mcp.js';
import type { Command } from '../../base/command.interface.js';
import { createErrorResult } from '../../base/command.interface.js';

/**
 * スプレッドシートの複数の範囲を一度に更新するコマンド
 */
export class BatchUpdateSheetValuesCommand implements Command {
  constructor(private readonly auth: OAuth2Client) {}

  getToolDefinition(): ToolDefinition {
    return {
      name: 'sheets_batch_update_sheet_values',
      description: 'Batch updates values in multiple ranges of a Google Sheet.',
      inputSchema: {
        type: 'object',
        properties: {
          spreadsheetId: {
            type: 'string',
            description: 'The ID of the spreadsheet to update.',
          },
          data: {
            type: 'array',
            description: 'An array of range-value pairs to update.',
            items: {
              type: 'object',
              properties: {
                range: {
                  type: 'string',
                  description: 'The range to update in A1 notation (e.g., "Sheet1!A1:B2", "A1:B2").',
                },
                values: {
                  type: 'array',
                  description: 'A 2D array of values to write. Each inner array represents a row.',
                  items: {
                    type: 'array',
                    items: {
                      type: 'string',
                    },
                  },
                },
              },
              required: ['range', 'values'],
            },
          },
          valueInputOption: {
            type: 'string',
            description:
              'How the input data should be interpreted. "USER_ENTERED" (default) parses formulas and dates; "RAW" treats all values as strings.',
            enum: ['USER_ENTERED', 'RAW'],
            default: 'USER_ENTERED',
          },
        },
        required: ['spreadsheetId', 'data'],
      },
    };
  }

  async execute(args: ToolArgs): Promise<CallToolResult> {
    const spreadsheetId = typeof args.spreadsheetId === 'string' ? args.spreadsheetId : '';
    const valueInputOption =
      args.valueInputOption === 'RAW' || args.valueInputOption === 'USER_ENTERED'
        ? args.valueInputOption
        : 'USER_ENTERED';

    if (spreadsheetId === '') {
      return createErrorResult('spreadsheetId が指定されていません。');
    }

    if (!Array.isArray(args.data)) {
      return createErrorResult(
        'data が指定されていません。range と values を含むオブジェクトの配列を指定してください。例: [{"range": "A1:B2", "values": [["A1", "B1"], ["A2", "B2"]]}]',
      );
    }

    if ((args.data as unknown[]).length === 0) {
      return createErrorResult('data が空です。最低1つの更新データが必要です。');
    }

    // data をパース・バリデーション
    let parsedData: Array<{ range: string; values: unknown[][] }>;
    try {
      parsedData = (args.data as unknown[]).map((item, index) => {
        if (typeof item !== 'object' || item === null) {
          throw new Error(`data[${index}] がオブジェクトではありません。`);
        }
        const obj = item as Record<string, unknown>;
        const range = typeof obj.range === 'string' ? obj.range : '';
        if (range === '') {
          throw new Error(`data[${index}].range が指定されていません。`);
        }
        if (!Array.isArray(obj.values)) {
          throw new Error(`data[${index}].values が配列ではありません。`);
        }
        return { range, values: obj.values };
      });
    } catch (validationError) {
      return createErrorResult(
        `data の形式が無効です: ${validationError instanceof Error ? validationError.message : String(validationError)}`,
      );
    }

    // values を string[][] に変換
    let convertedData: Array<{ range: string; values: string[][] }> = [];
    try {
      convertedData = parsedData.map(({ range, values }) => {
        const convertedValues = (values as unknown[]).map((row, rowIndex) => {
          if (!Array.isArray(row)) {
            throw new Error(`${range} の行 ${rowIndex} が配列ではありません。`);
          }
          return (row as unknown[]).map((cell) => this.convertToString(cell));
        });
        return { range, values: convertedValues };
      });
    } catch (conversionError) {
      return createErrorResult(
        `values の型変換に失敗しました: ${conversionError instanceof Error ? conversionError.message : String(conversionError)}`,
      );
    }

    const sheets = google.sheets({ version: 'v4', auth: this.auth });

    try {
      const response = await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId,
        requestBody: {
          data: convertedData,
          valueInputOption,
        },
      });

      const updatedResponses = response.data.responses ?? [];
      const totalUpdatedCells = updatedResponses.reduce((sum, resp) => {
        return sum + (resp.updatedCells ?? 0);
      }, 0);

      const updateSummary = updatedResponses
        .map((resp, idx) => `${resp.updatedRange ?? convertedData[idx]?.range}: ${resp.updatedCells ?? 0} セル`)
        .join('\n');

      return {
        content: [
          {
            type: 'text',
            text: `複数範囲のスプレッドシートを更新しました。\n合計セル数: ${String(totalUpdatedCells)} セル\n\n${updateSummary}`,
          },
        ],
      };
    } catch (error) {
      return createErrorResult(
        `シートデータのバッチ更新に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * セルの値を文字列に変換
   * 複数の型に対応（string、number、boolean、Date など）
   */
  private convertToString(cell: unknown): string {
    if (cell === null || cell === undefined) {
      return '';
    }
    if (typeof cell === 'string') {
      return cell;
    }
    if (typeof cell === 'number' || typeof cell === 'boolean') {
      return String(cell);
    }
    if (cell instanceof Date) {
      return cell.toISOString();
    }
    if (typeof cell === 'object') {
      return JSON.stringify(cell);
    }
    return String(cell);
  }
}
