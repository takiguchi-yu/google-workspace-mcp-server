import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import type { ToolArgs, ToolDefinition } from '../../../types/mcp.js';
import type { Command } from '../../base/command.interface.js';
import { createErrorResult } from '../../base/command.interface.js';

/**
 * Google Drive からスプレッドシート一覧を取得するコマンド
 */
export class ListSpreadsheetsCommand implements Command {
  getToolDefinition(): ToolDefinition {
    return {
      name: 'sheets_list_spreadsheets',
      description: 'Lists spreadsheets from Google Drive that the user has access to.',
      inputSchema: {
        type: 'object',
        properties: {
          maxResults: {
            type: 'number',
            description: 'Maximum number of spreadsheets to return. Defaults to 25.',
            default: 25,
          },
        },
        required: [],
      },
    };
  }

  async execute(args: ToolArgs, auth: OAuth2Client): Promise<CallToolResult> {
    const maxResults = typeof args.maxResults === 'number' ? args.maxResults : 25;

    const drive = google.drive({ version: 'v3', auth });

    try {
      const response = await drive.files.list({
        q: "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false",
        pageSize: maxResults,
        fields: 'files(id, name, modifiedTime, webViewLink)',
        orderBy: 'modifiedTime desc',
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });

      const files = response.data.files ?? [];

      if (files.length === 0) {
        return {
          content: [{ type: 'text', text: 'スプレッドシートが見つかりませんでした。' }],
        };
      }

      const spreadsheetsList = files
        .map(
          (file) =>
            `- "${file.name ?? '名前なし'}" (ID: ${file.id ?? '不明'}) | 更新日時: ${file.modifiedTime ?? '不明'} | リンク: ${file.webViewLink ?? 'なし'}`,
        )
        .join('\n');

      const result = `${String(files.length)} 件のスプレッドシートが見つかりました:\n\n${spreadsheetsList}`;

      return {
        content: [{ type: 'text', text: result }],
      };
    } catch (error) {
      return createErrorResult(
        `スプレッドシート一覧の取得に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
