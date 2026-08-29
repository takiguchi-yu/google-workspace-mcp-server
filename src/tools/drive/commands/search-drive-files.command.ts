import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import type { ToolArgs, ToolDefinition } from '../../../types/mcp.js';
import type { Command } from '../../base/command.interface.js';
import { createErrorResult } from '../../base/command.interface.js';

/**
 * Google Drive でファイルを検索するコマンド
 */
export class SearchDriveFilesCommand implements Command {
  getToolDefinition(): ToolDefinition {
    return {
      name: 'drive_search_files',
      description:
        'Search for files in Google Drive using query syntax or free text. Supports filtering by name, type, and other criteria.',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description:
              'Search query. Can be free text (e.g., "report") or Drive query syntax (e.g., "name contains \'report\' and mimeType=\'application/pdf\'").',
          },
          maxResults: {
            type: 'number',
            description: 'Maximum number of files to return. Defaults to 20.',
            default: 20,
          },
        },
        required: ['query'],
      },
    };
  }

  async execute(args: ToolArgs, auth: OAuth2Client): Promise<CallToolResult> {
    const query = typeof args.query === 'string' ? args.query : '';
    const maxResults = typeof args.maxResults === 'number' ? args.maxResults : 20;

    if (query === '') {
      return createErrorResult('query が指定されていません。');
    }

    const drive = google.drive({ version: 'v3', auth });

    try {
      // クエリがDrive API構文かどうかを判定
      // 簡易判定: "mimeType" や "'" を含む場合はAPI構文とみなす
      const isDriveQuerySyntax = query.includes('mimeType') || query.includes("'");

      const searchQuery = isDriveQuerySyntax
        ? `(${query}) and trashed=false`
        : `name contains '${query.replace(/'/g, "\\'")}' and trashed=false`;

      const response = await drive.files.list({
        q: searchQuery,
        pageSize: maxResults,
        fields: 'files(id, name, mimeType, modifiedTime, webViewLink, size)',
        orderBy: 'modifiedTime desc',
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });

      const files = response.data.files ?? [];

      if (files.length === 0) {
        return {
          content: [{ type: 'text', text: `検索クエリ "${query}" に一致するファイルが見つかりませんでした。` }],
        };
      }

      let result = `検索クエリ "${query}" で ${String(files.length)} 件のファイルが見つかりました:\n\n`;

      for (const file of files) {
        const fileName = file.name ?? '名前なし';
        const fileId = file.id ?? '不明';
        const mimeType = file.mimeType ?? '不明';
        const modifiedTime = file.modifiedTime ?? '不明';
        const size = file.size ? `${String(Math.round(parseInt(file.size, 10) / 1024))} KB` : 'N/A';
        const link = file.webViewLink ?? 'リンクなし';

        result += `- ${fileName}\n`;
        result += `  ID: ${fileId}\n`;
        result += `  種類: ${mimeType}\n`;
        result += `  更新日時: ${modifiedTime}\n`;
        result += `  サイズ: ${size}\n`;
        result += `  リンク: ${link}\n\n`;
      }

      return {
        content: [{ type: 'text', text: result }],
      };
    } catch (error) {
      return createErrorResult(`ファイル検索に失敗しました: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
