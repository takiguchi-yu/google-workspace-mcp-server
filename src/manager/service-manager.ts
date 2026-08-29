import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { OAuth2Client } from 'google-auth-library';
import { takeAccountArgument, withAccountArgument } from './account-argument.js';
import type { AccountRegistry } from '../auth/account-registry.js';
import { AccountResolutionError } from '../auth/errors.js';
import { createErrorResult } from '../tools/base/command.interface.js';
import type { MetaCommand } from '../tools/base/command.interface.js';
import type { WorkspaceService } from '../tools/base/service.interface.js';
import type { ToolArgs, ToolDefinition } from '../types/mcp.js';

/**
 * すべての Google Workspace サービスを統合管理するマネージャー。
 *
 * ツール定義への account 引数の付与と、その引数からアカウントを解決する処理を
 * ここに集約する。各サービス・コマンドはアカウントの存在を意識しない。
 */
export class ServiceManager {
  private readonly accounts: AccountRegistry;
  private readonly services = new Map<string, WorkspaceService>();
  /** アカウントの解決を必要としないツール */
  private readonly metaCommands = new Map<string, MetaCommand>();

  constructor(accounts: AccountRegistry) {
    this.accounts = accounts;
  }

  /**
   * 新しいサービス（Slides, Sheets等）をマネージャーに登録する
   */
  registerService(serviceName: string, service: WorkspaceService): void {
    this.services.set(serviceName, service);
    console.error(`[ServiceManager] Registered service: ${serviceName}`);
  }

  /**
   * アカウントの解決を必要としないツールを登録する
   */
  registerMetaCommand(command: MetaCommand): void {
    const toolDef = command.getToolDefinition();
    this.metaCommands.set(toolDef.name, command);
    console.error(`[ServiceManager] Registered meta tool: ${toolDef.name}`);
  }

  /**
   * 登録されている全サービスからツール定義を集約する
   * MCP の ListToolsRequest で使用
   */
  getTools(): ToolDefinition[] {
    const allTools: ToolDefinition[] = [];

    for (const command of this.metaCommands.values()) {
      allTools.push(command.getToolDefinition());
    }

    for (const service of this.services.values()) {
      allTools.push(...service.getTools().map(withAccountArgument));
    }

    return allTools;
  }

  /**
   * ツール名に基づいて適切なサービスに処理を振り分ける
   * MCP の CallToolRequest で使用
   */
  async handleToolCall(name: string, args: ToolArgs): Promise<CallToolResult> {
    const metaCommand = this.metaCommands.get(name);

    if (metaCommand) {
      return await metaCommand.execute(args);
    }

    const service = this.findService(name);

    if (!service) {
      return createErrorResult(`No service found to handle tool '${name}'`);
    }

    const { label, rest } = takeAccountArgument(args);
    let auth: OAuth2Client;

    try {
      auth = await this.accounts.resolve(label);
    } catch (error) {
      // アカウントの解決失敗は利用者が直せる問題なので、原因と復旧手順をそのまま返す
      if (error instanceof AccountResolutionError) {
        return createErrorResult(error.message);
      }

      throw error;
    }

    return await service.execute(name, rest, auth);
  }

  /** ツール名を提供しているサービスを探す */
  private findService(toolName: string): WorkspaceService | undefined {
    for (const service of this.services.values()) {
      if (service.getTools().some((tool) => tool.name === toolName)) {
        return service;
      }
    }

    return undefined;
  }
}
