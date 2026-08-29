import type { ToolArgs, ToolDefinition } from '../types/mcp.js';

/** すべての Workspace ツールに共通で生える、対象アカウントを指す引数名 */
export const ACCOUNT_ARGUMENT = 'account';

const ACCOUNT_DESCRIPTION =
  "Label of the Google account to operate on (for example 'work' or 'private'). " +
  'Omit it to use the default account. Call accounts_list to see the available labels.';

/**
 * ツール定義に account 引数を差し込む。
 *
 * 各コマンドが個別に書くのではなく一箇所で付与することで、コマンドを追加したときの
 * 書き忘れが起きないようにする。省略可能なので required には追加しない。
 */
export const withAccountArgument = (tool: ToolDefinition): ToolDefinition => ({
  ...tool,
  inputSchema: {
    ...tool.inputSchema,
    properties: {
      ...tool.inputSchema.properties,
      [ACCOUNT_ARGUMENT]: { type: 'string', description: ACCOUNT_DESCRIPTION },
    },
  },
});

/** 引数から account を抜き出し、コマンドへ渡す残りの引数と分けて返す */
export const takeAccountArgument = (args: ToolArgs): { label?: string | undefined; rest: ToolArgs } => {
  const { [ACCOUNT_ARGUMENT]: rawLabel, ...rest } = args;
  const label = typeof rawLabel === 'string' && rawLabel.trim() !== '' ? rawLabel : undefined;

  return { label, rest };
};
