/**
 * アカウントの解決に失敗したことを表すエラーの基底クラス。
 *
 * メッセージには「何が起きたか」と「どうすれば直るか」を必ず含める。
 * このメッセージは MCP のツール結果としてそのまま AI アシスタントに返るため、
 * 不明なラベルはアシスタント自身が訂正でき、未認可は利用者へ正しく促せる必要がある。
 */
export abstract class AccountResolutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** 指定されたラベルのアカウントが登録されていない */
export class UnknownAccountError extends AccountResolutionError {
  constructor(label: string, available: string[]) {
    super(
      available.length > 0
        ? `Unknown account '${label}'. Available accounts: ${available.join(', ')}. ` +
            'Call accounts_list for details, then retry with a valid label.'
        : `Unknown account '${label}'. No accounts are registered yet. ` +
            `Ask the user to run: npm run setup -- --account ${label}`,
    );
  }
}

/** account が省略されたが、既定アカウントを一意に決められない */
export class NoDefaultAccountError extends AccountResolutionError {
  constructor(available: string[]) {
    super(
      available.length === 0
        ? 'No Google accounts are registered. Ask the user to run: npm run setup -- --account <label>'
        : `The 'account' argument is required because no default account is configured. ` +
            `Available accounts: ${available.join(', ')}. ` +
            'Retry with one of them, or ask the user to set "defaultAccount" in accounts.json.',
    );
  }
}

/** アカウントは登録されているが、まだ認可されていない（トークンが無い） */
export class AccountNotAuthorizedError extends AccountResolutionError {
  constructor(label: string, tokenPath: string) {
    super(
      `Account '${label}' is registered but not authorized yet (no token at ${tokenPath}). ` +
        `Ask the user to run: npm run setup -- --account ${label}`,
    );
  }
}

/** OAuth クライアント（credentials.json）が見つからない */
export class CredentialsNotFoundError extends AccountResolutionError {
  constructor(label: string, searchedPaths: string[]) {
    super(
      `No OAuth client credentials found for account '${label}'. Looked in: ${searchedPaths.join(', ')}. ` +
        'See docs/how-to-create-credentials.md for how to create them.',
    );
  }
}

/** ラベルの書式が不正 */
export class InvalidAccountLabelError extends AccountResolutionError {
  constructor(input: string) {
    super(`Invalid account label '${input}'. Use 1-64 characters of A-Z, a-z, 0-9, '-' or '_'.`);
  }
}
