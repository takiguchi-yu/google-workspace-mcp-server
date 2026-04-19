import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import type { ToolArgs, ToolDefinition } from '../../../types/mcp.js';
import type { Command } from '../../base/command.interface.js';
import { createErrorResult } from '../../base/command.interface.js';

/**
 * CSV ファイルをスプレッドシートにインポートするコマンド
 */
export class ImportSheetCsvCommand implements Command {
  constructor(private readonly auth: OAuth2Client) {}

  getToolDefinition(): ToolDefinition {
    return {
      name: 'sheets_import_csv',
      description:
        'Imports CSV (or TSV) data into a Google Sheet. Supports custom delimiters and handles quoted fields.',
      inputSchema: {
        type: 'object',
        properties: {
          spreadsheetId: {
            type: 'string',
            description: 'The ID of the spreadsheet to import data into.',
          },
          range: {
            type: 'string',
            description: 'The range where to import the data (e.g., "Sheet1!A1", "A1"). Defaults to "A1".',
            default: 'A1',
          },
          csvContent: {
            type: 'string',
            description: 'The CSV content as a string. Can be raw CSV or base64-encoded.',
          },
          isBase64: {
            type: 'boolean',
            description: 'Whether the csvContent is base64-encoded. Defaults to false.',
            default: false,
          },
          delimiter: {
            type: 'string',
            description: 'The delimiter character. Defaults to "," (comma). Use "\\t" for TSV.',
            default: ',',
          },
          valueInputOption: {
            type: 'string',
            description:
              'How the input data should be interpreted. "USER_ENTERED" (default) parses formulas and dates; "RAW" treats all values as strings.',
            enum: ['USER_ENTERED', 'RAW'],
            default: 'USER_ENTERED',
          },
        },
        required: ['spreadsheetId', 'csvContent'],
      },
    };
  }

  /**
   * CSV 形式のテキストをパースして2次元配列に変換
   * クォートされたフィールドや改行を含むフィールドに対応
   */
  private parseCsv(csvContent: string, delimiter: string): string[][] {
    const rows: string[][] = [];
    let currentRow: string[] = [];
    let currentField = '';
    let insideQuotes = false;

    for (let i = 0; i < csvContent.length; i++) {
      const char = csvContent[i];
      const nextChar = csvContent[i + 1];

      if (char === '"') {
        if (insideQuotes && nextChar === '"') {
          // ダブルクォーテーションのエスケープ
          currentField += '"';
          i++;
        } else {
          // クォートの切り替え
          insideQuotes = !insideQuotes;
        }
      } else if (char === delimiter && !insideQuotes) {
        // フィールドの終了
        currentRow.push(currentField);
        currentField = '';
      } else if ((char === '\n' || char === '\r') && !insideQuotes) {
        // 行の終了
        if (currentField || currentRow.length > 0) {
          currentRow.push(currentField);
          rows.push(currentRow);
          currentRow = [];
          currentField = '';
        }
        // CR LF の場合の \n をスキップ
        if (char === '\r' && nextChar === '\n') {
          i++;
        }
      } else {
        currentField += char;
      }
    }

    // 最後のフィールドと行を追加
    if (currentField || currentRow.length > 0) {
      currentRow.push(currentField);
      rows.push(currentRow);
    }

    return rows;
  }

  async execute(args: ToolArgs): Promise<CallToolResult> {
    const spreadsheetId = typeof args.spreadsheetId === 'string' ? args.spreadsheetId : '';
    let csvContent = typeof args.csvContent === 'string' ? args.csvContent : '';
    const isBase64 = args.isBase64 === true;
    let delimiter = typeof args.delimiter === 'string' ? args.delimiter : ',';
    const range = typeof args.range === 'string' ? args.range : 'A1';
    const valueInputOption =
      args.valueInputOption === 'RAW' || args.valueInputOption === 'USER_ENTERED'
        ? args.valueInputOption
        : 'USER_ENTERED';

    if (spreadsheetId === '') {
      return createErrorResult('spreadsheetId が指定されていません。');
    }
    if (csvContent === '') {
      return createErrorResult('csvContent が指定されていません。');
    }

    // Base64 デコード
    if (isBase64) {
      try {
        csvContent = Buffer.from(csvContent, 'base64').toString('utf-8');
      } catch (error) {
        return createErrorResult(
          `Base64 デコードに失敗しました: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    // デリミタの処理（\t をタブに変換）
    if (delimiter === '\\t') {
      delimiter = '\t';
    }

    // CSV をパース
    let values: string[][];
    try {
      values = this.parseCsv(csvContent, delimiter);
    } catch (error) {
      return createErrorResult(`CSV のパースに失敗しました: ${error instanceof Error ? error.message : String(error)}`);
    }

    if (values.length === 0) {
      return createErrorResult('CSV に有効なデータが含まれていません。');
    }

    const sheets = google.sheets({ version: 'v4', auth: this.auth });

    try {
      const response = await sheets.spreadsheets.values.update({
        spreadsheetId,
        range,
        valueInputOption,
        requestBody: {
          values,
        },
      });

      const updatedRows = response.data.updatedRows ?? 0;
      const updatedColumns = response.data.updatedColumns ?? 0;

      return {
        content: [
          {
            type: 'text',
            text: `CSV データをインポートしました。\n更新行数: ${updatedRows}\n更新列数: ${updatedColumns}\nスプレッドシートID: ${spreadsheetId}`,
          },
        ],
      };
    } catch (error) {
      return createErrorResult(
        `CSV のインポートに失敗しました: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
