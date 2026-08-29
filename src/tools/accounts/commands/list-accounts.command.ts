import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { AccountRegistry } from '../../../auth/account-registry.js';
import type { ToolDefinition } from '../../../types/mcp.js';
import type { MetaCommand } from '../../base/command.interface.js';

/**
 * 登録されている Google アカウントの一覧を返すコマンド。
 *
 * 他のツールの account 引数に何を渡せばよいかを AI アシスタントが知るための入口であり、
 * 認可が 1 件も済んでいない状態でも呼べる必要があるため、アカウントの解決を行わない。
 */
export class ListAccountsCommand implements MetaCommand {
  private readonly accounts: AccountRegistry;

  constructor(accounts: AccountRegistry) {
    this.accounts = accounts;
  }

  getToolDefinition(): ToolDefinition {
    return {
      name: 'accounts_list',
      description:
        'Lists the Google accounts registered on this server, with their labels and which one is the default. ' +
        'Pass a returned label as the "account" argument of the other tools.',
      inputSchema: {
        type: 'object',
        properties: {},
        required: [],
      },
    };
  }

  async execute(): Promise<CallToolResult> {
    const accounts = this.accounts.list();

    if (accounts.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text:
              'No Google accounts are registered on this server. ' +
              'Ask the user to run: npm run setup -- --account <label>',
          },
        ],
      };
    }

    const lines = accounts.map((account) => {
      const flag = account.isDefault ? ' (default)' : '';
      const description = account.description === undefined ? '' : ` - ${account.description}`;
      return `- ${account.label}${flag}${description}`;
    });

    const hint =
      accounts.length > 1 && !accounts.some((account) => account.isDefault)
        ? '\n\nNo default account is configured, so the "account" argument is required.'
        : '';

    return {
      content: [{ type: 'text', text: `Registered accounts:\n${lines.join('\n')}${hint}` }],
    };
  }
}
