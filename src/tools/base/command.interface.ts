import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { OAuth2Client } from 'google-auth-library';
import type { ToolArgs, ToolDefinition } from '../../types/mcp.js';

/**
 * Google Workspace を操作するコマンドが実装すべきインターフェース。
 *
 * どのアカウントで実行するかはコマンドの関心事ではない。認証済みクライアントは
 * 実行時に引数として渡されるため、コマンドは自分でアカウントを解決してはならない。
 */
export interface Command {
  /**
   * このコマンドのツール定義を返す。
   * account 引数は ServiceManager が横断的に差し込むため、ここには書かない。
   */
  getToolDefinition(): ToolDefinition;

  /**
   * コマンドを実行する
   * @param args ツール引数（account は取り除かれた状態で渡される）
   * @param auth 解決済みの認証クライアント
   */
  execute(args: ToolArgs, auth: OAuth2Client): Promise<CallToolResult>;
}

/**
 * アカウントの解決を必要としないツール。
 * サーバー自身の情報（登録されているアカウントなど）を返すものが該当する。
 */
export interface MetaCommand {
  getToolDefinition(): ToolDefinition;
  execute(args: ToolArgs): Promise<CallToolResult>;
}

/**
 * エラーレスポンスを作成するヘルパー関数
 */
export const createErrorResult = (message: string): CallToolResult => ({
  content: [{ type: 'text', text: `Error: ${message}` }],
  isError: true,
});
