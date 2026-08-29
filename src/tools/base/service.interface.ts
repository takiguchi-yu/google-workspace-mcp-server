import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { OAuth2Client } from 'google-auth-library';
import type { Command } from './command.interface.js';
import type { ToolArgs, ToolDefinition } from '../../types/mcp.js';

/**
 * すべての Google Workspace サービスが実装すべきインターフェース
 */
export interface WorkspaceService {
  /**
   * サービスが提供する全てのツール定義を返す
   */
  getTools(): ToolDefinition[];

  /**
   * ツール名を指定してコマンドを実行する
   * @param auth 解決済みの認証クライアント
   */
  execute(toolName: string, args: ToolArgs, auth: OAuth2Client): Promise<CallToolResult>;
}

/**
 * コマンドベースの Google Workspace サービスの基底クラス。
 *
 * 認証クライアントは実行時に渡されるため、サービスもコマンドも保持しない。
 * これにより、1 つのサービスインスタンスで複数のアカウントを扱える。
 */
export abstract class BaseCommandService implements WorkspaceService {
  protected readonly commands = new Map<string, Command>();

  constructor() {
    this.registerCommands();
  }

  /**
   * 各サービスでコマンドを登録する
   */
  protected abstract registerCommands(): void;

  /**
   * コマンドをマップに登録する
   */
  protected registerCommand(command: Command): void {
    const toolDef = command.getToolDefinition();
    this.commands.set(toolDef.name, command);
  }

  /**
   * 登録されているすべてのコマンドのツール定義を返す
   */
  getTools(): ToolDefinition[] {
    return Array.from(this.commands.values()).map((cmd) => cmd.getToolDefinition());
  }

  /**
   * ツール名に対応するコマンドを実行する
   */
  async execute(toolName: string, args: ToolArgs, auth: OAuth2Client): Promise<CallToolResult> {
    const command = this.commands.get(toolName);

    if (!command) {
      return {
        content: [{ type: 'text', text: `Error: Unknown tool '${toolName}'` }],
        isError: true,
      };
    }

    try {
      return await command.execute(args, auth);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text', text: `Error: ${errorMessage}` }],
        isError: true,
      };
    }
  }
}
