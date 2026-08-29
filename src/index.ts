import * as fs from 'fs/promises';
import path from 'path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { AccountRegistry } from './auth/account-registry.js';
import { ServiceManager } from './manager/service-manager.js';
import { ListAccountsCommand } from './tools/accounts/commands/list-accounts.command.js';
import { DocsService } from './tools/docs/docs.service.js';
import { DriveService } from './tools/drive/drive.service.js';
import { SheetsService } from './tools/sheets/sheets.service.js';
import { SlidesService } from './tools/slides/slides.service.js';
import type { ToolArgs } from './types/mcp.js';

interface PackageJson {
  version?: string;
}

/**
 * JSON Schema を Zod スキーマに変換するヘルパー関数
 *
 * required に含まれないプロパティは省略可能として扱う。account 引数のように
 * 「渡さなければ既定の動作をする」引数を表現するために必要。
 */
const convertToZodSchema = (inputSchema: Record<string, unknown>): Record<string, z.ZodType> => {
  const properties = (inputSchema.properties ?? {}) as Record<
    string,
    { type: string; description?: string; default?: string | number | boolean }
  >;
  const required = new Set((inputSchema.required as string[] | undefined) ?? []);
  const zodSchema: Record<string, z.ZodType> = {};

  for (const [key, prop] of Object.entries(properties)) {
    let schema: z.ZodType | null = null;

    if (prop.type === 'string') {
      schema = z.string().describe(prop.description ?? '');
      if (typeof prop.default === 'string') {
        schema = schema.default(prop.default);
      }
    } else if (prop.type === 'number') {
      schema = z.number().describe(prop.description ?? '');
      if (typeof prop.default === 'number') {
        schema = schema.default(prop.default);
      }
    } else if (prop.type === 'boolean') {
      schema = z.boolean().describe(prop.description ?? '');
      if (typeof prop.default === 'boolean') {
        schema = schema.default(prop.default);
      }
    } else if (prop.type === 'array') {
      // 要素の型は検証しない。数値・真偽値などを受けても各コマンド側で正規化するため、
      // ここで厳密に縛るとクライアントからの正当な入力を取りこぼす
      schema = z.array(z.unknown()).describe(prop.description ?? '');
    } else if (prop.type === 'object') {
      schema = z.record(z.string(), z.unknown()).describe(prop.description ?? '');
    }
    // 今後、他の型にも対応可能

    if (schema === null) {
      continue;
    }

    // 既定値を持つスキーマはそれ自体が省略可能なので、二重に optional にしない
    zodSchema[key] = required.has(key) || prop.default !== undefined ? schema : schema.optional();
  }

  return zodSchema;
};

/**
 * package.json からサーバーバージョンを取得する
 */
const loadServerVersion = async (): Promise<string> => {
  const packageJsonPath = path.join(process.cwd(), 'package.json');

  try {
    const content = await fs.readFile(packageJsonPath, 'utf8');
    const parsed = JSON.parse(content) as PackageJson;

    if (typeof parsed.version === 'string' && parsed.version.length > 0) {
      return parsed.version;
    }
  } catch {
    // package.json の読み込みに失敗した場合はフォールバック値を返す
  }

  return '0.0.0';
};

async function main() {
  const version = await loadServerVersion();

  const server = new McpServer({
    name: 'google-workspace-mcp-server',
    version,
  });

  try {
    // 読み込むのは設定だけ。認証クライアントは対象アカウントが初めて使われたときに作る
    const accounts = await AccountRegistry.load();

    const serviceManager = new ServiceManager(accounts);
    serviceManager.registerMetaCommand(new ListAccountsCommand(accounts));
    serviceManager.registerService('slides', new SlidesService());
    serviceManager.registerService('sheets', new SheetsService());
    serviceManager.registerService('drive', new DriveService());
    serviceManager.registerService('docs', new DocsService());

    // 全サービスからツール定義を取得
    const allTools = serviceManager.getTools();

    // 各ツールを MCP サーバーに登録
    for (const tool of allTools) {
      server.registerTool(
        tool.name,
        {
          description: tool.description ?? 'Google Workspace tool',
          inputSchema: convertToZodSchema(tool.inputSchema as Record<string, unknown>),
        },
        async (args: ToolArgs) => {
          return await serviceManager.handleToolCall(tool.name, args);
        },
      );
    }

    const transport = new StdioServerTransport();
    await server.connect(transport);

    const registered = accounts.list();
    console.error(
      registered.length === 0
        ? '⚠️  No Google accounts are registered yet. Run: npm run setup -- --account <label>'
        : `🔑 Registered accounts: ${registered.map((account) => account.label).join(', ')}`,
    );
    console.error('🚀 Google Workspace MCP Server is running');
  } catch (error) {
    console.error('❌ Failed to start MCP Server:', error);
    process.exit(1);
  }
}

main().catch(console.error);
