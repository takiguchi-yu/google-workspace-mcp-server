import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import type { sheets_v4 } from 'googleapis';
import type { ToolArgs, ToolDefinition } from '../../../types/mcp.js';
import type { Command } from '../../base/command.interface.js';
import { createErrorResult } from '../../base/command.interface.js';
import type { GridIndexes } from '../grid-range.js';
import { toA1Range } from '../grid-range.js';

/**
 * 条件付き書式のルールを一覧するコマンド。
 *
 * 削除に必要な index は API が付ける通し番号で、外からは見えない。
 * 範囲は A1 記法に戻して返し、行列番号を利用者に見せない。
 */
export class ListConditionalFormatsCommand implements Command {
  getToolDefinition(): ToolDefinition {
    return {
      name: 'sheets_list_conditional_formats',
      description:
        'List the conditional formatting rules of a spreadsheet with the index needed to delete them, the ranges they cover in A1 notation, and a summary of each rule.',
      inputSchema: {
        type: 'object',
        properties: {
          spreadsheetId: {
            type: 'string',
            description: 'The ID of the spreadsheet to inspect.',
          },
          sheetName: {
            type: 'string',
            description: 'Limit the listing to one sheet. Defaults to every sheet.',
          },
        },
        required: ['spreadsheetId'],
      },
    };
  }

  async execute(args: ToolArgs, auth: OAuth2Client): Promise<CallToolResult> {
    const spreadsheetId = typeof args.spreadsheetId === 'string' ? args.spreadsheetId : '';
    const sheetName = typeof args.sheetName === 'string' ? args.sheetName : null;

    if (spreadsheetId === '') {
      return createErrorResult('spreadsheetId が指定されていません。');
    }

    const sheets = google.sheets({ version: 'v4', auth });

    try {
      const response = await sheets.spreadsheets.get({
        spreadsheetId,
        fields: 'sheets(properties(title),conditionalFormats)',
      });

      const targets = (response.data.sheets ?? []).filter(
        (sheet) => sheetName === null || sheet.properties?.title === sheetName,
      );

      if (targets.length === 0) {
        return createErrorResult(`シート名 "${String(sheetName)}" が見つかりません。`);
      }

      const sections = targets.map((sheet) => {
        const title = sheet.properties?.title ?? '(名前不明)';
        const rules = sheet.conditionalFormats ?? [];

        if (rules.length === 0) {
          return `## ${title}\n条件付き書式はありません。`;
        }

        return `## ${title}\n${rules.map((rule, index) => describeRule(rule, index, title)).join('\n')}`;
      });

      return { content: [{ type: 'text', text: sections.join('\n\n') }] };
    } catch (error) {
      return createErrorResult(
        `条件付き書式の取得に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

/** ルール 1 件を 1 行で説明する。先頭は削除に使う index */
const describeRule = (rule: sheets_v4.Schema$ConditionalFormatRule, index: number, sheetTitle: string): string => {
  const ranges = (rule.ranges ?? []).map((range) => toA1Range(toIndexes(range), sheetTitle)).join(', ');
  const condition = rule.booleanRule?.condition;

  if (condition !== undefined) {
    const values = (condition.values ?? []).map((value) => value.userEnteredValue ?? '').join(', ');
    const suffix = values === '' ? '' : ` [${values}]`;
    return `- index=${String(index)} ${ranges} — ${condition.type ?? '(種類不明)'}${suffix}`;
  }

  if (rule.gradientRule !== undefined) {
    const points = [rule.gradientRule.minpoint, rule.gradientRule.midpoint, rule.gradientRule.maxpoint]
      .filter((point) => point !== undefined)
      .map((point) => point.type ?? '?')
      .join(' → ');
    return `- index=${String(index)} ${ranges} — カラースケール (${points})`;
  }

  return `- index=${String(index)} ${ranges} — (内容を判別できないルール)`;
};

/** API が返す GridRange を、null を落として行列番号だけにする */
const toIndexes = (range: sheets_v4.Schema$GridRange): GridIndexes => ({
  ...(typeof range.startRowIndex === 'number' && { startRowIndex: range.startRowIndex }),
  ...(typeof range.endRowIndex === 'number' && { endRowIndex: range.endRowIndex }),
  ...(typeof range.startColumnIndex === 'number' && { startColumnIndex: range.startColumnIndex }),
  ...(typeof range.endColumnIndex === 'number' && { endColumnIndex: range.endColumnIndex }),
});
