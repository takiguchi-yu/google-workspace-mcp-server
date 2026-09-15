import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import type { slides_v1 } from 'googleapis';
import type { ToolArgs, ToolDefinition } from '../../../types/mcp.js';
import type { Command } from '../../base/command.interface.js';
import { createErrorResult } from '../../base/command.interface.js';
import { centeredOn, pointBoxSchema, toElementProperties } from '../dimensions.js';
import { toOptionalNumber } from '../number-argument.js';
import type { TableGrid } from '../table-grid.js';
import { toCellTextRequests, toTableGrid } from '../table-grid.js';

/** サイズを省略したときに Google が使う表の幅（ポイント）。実機で確認した値 */
const DEFAULT_TABLE_WIDTH_PT = 570;

/** サイズを省略したときに Google が使う 1 行の高さ（ポイント）。実機で確認した値 */
const DEFAULT_ROW_HEIGHT_PT = 30;

/**
 * スライドに表を追加するコマンド。
 *
 * 行数・列数は 2 次元配列の中身から決めて、セルの文字まで 1 回の batchUpdate で埋める。
 * 位置・大きさを省略するとスライドの中央に置かれる。
 *
 * 罫線とセルの塗りは 0.8.0 の対象外。必要なら slides_batch_update_presentation から
 * updateTableCellProperties / updateTableBorderProperties を直接呼ぶ。
 */
export class AddTableCommand implements Command {
  getToolDefinition(): ToolDefinition {
    return {
      name: 'slides_add_table',
      description:
        'Add a table to a slide, filled with its contents. The number of rows and columns comes from the "rows" array, so no separate counts are needed. Short rows are padded with empty cells. Position and size are in points; anything you leave out is centred on the slide, so omitting all four puts a 570 pt wide table in the middle. Cell borders and shading are not set here.',
      inputSchema: {
        type: 'object',
        properties: {
          presentationId: {
            type: 'string',
            description: 'The ID of the presentation.',
          },
          pageObjectId: {
            type: 'string',
            description: 'The object ID of the slide to add the table to.',
          },
          rows: {
            type: 'array',
            description:
              'The table contents as an array of rows, each row an array of cell strings. Example: [["Name","Owner"],["Design","Ada"]]. The first row is not styled as a header.',
            items: { type: 'array', items: { type: 'string' } },
          },
          ...pointBoxSchema,
          width: {
            type: 'number',
            description: 'Total table width in points, split evenly between columns. Defaults to 570.',
          },
          height: {
            type: 'number',
            description: 'Total table height in points, split evenly between rows. Defaults to 30 per row.',
          },
        },
        required: ['presentationId', 'pageObjectId', 'rows'],
      },
    };
  }

  async execute(args: ToolArgs, auth: OAuth2Client): Promise<CallToolResult> {
    const presentationId = typeof args.presentationId === 'string' ? args.presentationId : '';
    const pageObjectId = typeof args.pageObjectId === 'string' ? args.pageObjectId : '';

    if (presentationId === '') {
      return createErrorResult('presentationId が指定されていません。');
    }
    if (pageObjectId === '') {
      return createErrorResult('pageObjectId が指定されていません。');
    }

    const objectId = `table_${String(Date.now())}`;
    let requests: slides_v1.Schema$Request[];
    let grid: TableGrid;

    try {
      grid = toTableGrid(args.rows, 'rows');
      requests = [
        {
          createTable: {
            objectId,
            elementProperties: toTableElementProperties(pageObjectId, args, grid),
            rows: grid.rows,
            columns: grid.columns,
          },
        },
        ...toCellTextRequests(objectId, grid),
      ];
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
            text: `表を追加しました。\n大きさ: ${String(grid.rows)} 行 × ${String(grid.columns)} 列\nobjectId: ${objectId}`,
          },
        ],
      };
    } catch (error) {
      return createErrorResult(`表の追加に失敗しました: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

/**
 * 表の位置・大きさを組み立てる。
 *
 * 4 つとも省略されたら size も transform も送らず、Google の既定（スライド中央）に任せる。
 * 一部だけ指定されたときは、**残りを中央寄せとして計算する**。片方を渡しただけで
 * 左上に飛ぶと、説明文の「省略すると中央に置く」という約束が破れるため。
 */
const toTableElementProperties = (
  pageObjectId: string,
  args: ToolArgs,
  grid: TableGrid,
): slides_v1.Schema$PageElementProperties => {
  const left = toOptionalNumber(args.left, 'left');
  const top = toOptionalNumber(args.top, 'top');
  const width = toOptionalNumber(args.width, 'width');
  const height = toOptionalNumber(args.height, 'height');

  if (left === undefined && top === undefined && width === undefined && height === undefined) {
    return { pageObjectId };
  }

  const box = {
    width: width ?? DEFAULT_TABLE_WIDTH_PT,
    height: height ?? DEFAULT_ROW_HEIGHT_PT * grid.rows,
  };
  const centered = centeredOn(box.width, box.height);

  return toElementProperties(pageObjectId, { ...box, left: left ?? centered.left, top: top ?? centered.top });
};
