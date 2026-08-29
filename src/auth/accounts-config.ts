import * as fs from 'fs/promises';
import path from 'path';
import { AccountLabel } from './account-label.js';
import { TokenStore } from './token-store.js';
import type { WorkspacePaths } from './workspace-paths.js';

/** 旧レイアウト（単一アカウント時代）で使われていた環境変数 */
const LEGACY_CREDENTIALS_ENV = 'GOOGLE_CREDENTIALS_PATH';
const LEGACY_TOKEN_ENV = 'GOOGLE_TOKEN_PATH';

/** 旧レイアウトを取り込むときに割り当てるラベル */
export const LEGACY_ACCOUNT_LABEL = 'default';

/** accounts.json の 1 アカウント分のエントリ */
interface AccountEntryFile {
  description?: string | undefined;
  credentialsPath?: string | undefined;
  tokenPath?: string | undefined;
}

/** accounts.json のスキーマ */
interface AccountsConfigFile {
  defaultAccount?: string | undefined;
  accounts?: Record<string, AccountEntryFile>;
}

/** 解決済みのアカウント定義 */
export interface AccountDefinition {
  label: AccountLabel;
  /** 利用者が書く自由記述。accounts_list を通じて、AI アシスタントがラベルを選ぶ手がかりになる */
  description?: string | undefined;
  /** 明示指定された OAuth クライアントのパス。未指定なら規約上の位置から探す */
  credentialsPath?: string | undefined;
  /** 明示指定されたトークンのパス。未指定なら規約上の位置を使う */
  tokenPath?: string | undefined;
}

/** accounts.json を読む。ファイルが無ければ null */
const readConfigFile = async (configPath: string): Promise<AccountsConfigFile | null> => {
  let content: string;

  try {
    content = await fs.readFile(configPath, 'utf8');
  } catch {
    return null;
  }

  const parsed: unknown = JSON.parse(content);

  if (parsed === null || typeof parsed !== 'object') {
    throw new Error(`Invalid ${configPath}: the top level must be a JSON object.`);
  }

  return parsed as AccountsConfigFile;
};

/**
 * 旧レイアウトのアカウントを探す。
 *
 * 環境変数（未設定なら実行ディレクトリ）が指すトークンファイルに中身がある場合だけ、
 * 既存利用者が設定を書き換えずにバージョンアップできるよう default アカウントとして取り込む。
 * ドキュメントが `touch token.json` を案内していた経緯があるため、空ファイルは対象外とする。
 */
const detectLegacyAccount = async (): Promise<AccountDefinition | null> => {
  const credentialsPath = process.env[LEGACY_CREDENTIALS_ENV] ?? path.join(process.cwd(), 'credentials.json');
  const tokenPath = process.env[LEGACY_TOKEN_ENV] ?? path.join(process.cwd(), 'token.json');

  if (!(await new TokenStore(tokenPath).exists())) {
    return null;
  }

  return {
    label: AccountLabel.parse(LEGACY_ACCOUNT_LABEL),
    description: 'Imported from the single-account layout',
    credentialsPath,
    tokenPath,
  };
};

/**
 * 登録されているアカウントの一覧と、どれが既定かを保持するクラス。
 *
 * accounts.json があればそれが唯一の真実。無い場合にかぎり旧レイアウトを取り込む。
 * OAuth クライアントやトークンの中身には触れず、「どのアカウントが在るか」だけを扱う。
 */
export class AccountsConfig {
  private readonly definitions: Map<string, AccountDefinition>;
  private readonly explicitDefault: AccountLabel | null;

  private constructor(definitions: Map<string, AccountDefinition>, explicitDefault: AccountLabel | null) {
    this.definitions = definitions;
    this.explicitDefault = explicitDefault;
  }

  static async load(paths: WorkspacePaths): Promise<AccountsConfig> {
    const file = await readConfigFile(paths.configPath);

    if (file === null) {
      const legacy = await detectLegacyAccount();
      const definitions = new Map<string, AccountDefinition>();

      if (legacy !== null) {
        definitions.set(legacy.label.value, legacy);
      }

      return new AccountsConfig(definitions, null);
    }

    const definitions = new Map<string, AccountDefinition>();

    for (const [rawLabel, entry] of Object.entries(file.accounts ?? {})) {
      const label = AccountLabel.tryParse(rawLabel);

      if (label === null) {
        console.error(`⚠️  Skipping account '${rawLabel}' in accounts.json: the label format is invalid.`);
        continue;
      }

      definitions.set(label.value, {
        label,
        description: entry.description,
        credentialsPath: entry.credentialsPath,
        tokenPath: entry.tokenPath,
      });
    }

    const explicitDefault = file.defaultAccount === undefined ? null : AccountLabel.tryParse(file.defaultAccount);

    if (explicitDefault !== null && !definitions.has(explicitDefault.value)) {
      console.error(
        `⚠️  defaultAccount '${explicitDefault.value}' in accounts.json is not a registered account. Ignoring it.`,
      );
      return new AccountsConfig(definitions, null);
    }

    return new AccountsConfig(definitions, explicitDefault);
  }

  /** 登録順のアカウント定義 */
  list(): AccountDefinition[] {
    return Array.from(this.definitions.values());
  }

  /** 登録されているラベルの一覧（エラーメッセージ用） */
  labels(): string[] {
    return Array.from(this.definitions.keys());
  }

  get(label: AccountLabel): AccountDefinition | undefined {
    return this.definitions.get(label.value);
  }

  /**
   * 既定アカウント。明示指定があればそれ、無くても 1 件だけならそれ。
   * 複数あって明示指定が無い場合は、取り違えを防ぐため null を返す。
   */
  defaultLabel(): AccountLabel | null {
    if (this.explicitDefault !== null) {
      return this.explicitDefault;
    }

    const only = this.definitions.size === 1 ? this.list()[0] : undefined;
    return only?.label ?? null;
  }

  isDefault(label: AccountLabel): boolean {
    return this.defaultLabel()?.value === label.value;
  }
}

/** upsertAccount に渡す登録内容 */
export interface AccountRegistration {
  label: AccountLabel;
  description?: string | undefined;
  credentialsPath?: string | undefined;
  makeDefault?: boolean | undefined;
}

/**
 * accounts.json にアカウントを追加・更新する（セットアップから呼ばれる）。
 *
 * 利用者が JSON を手書きしなくて済むようにするのが目的なので、既存の内容は保ったまま
 * 対象ラベルのエントリだけを差し替える。既定アカウントが未設定なら、この登録を既定にする。
 */
export const upsertAccount = async (paths: WorkspacePaths, registration: AccountRegistration): Promise<void> => {
  const current = (await readConfigFile(paths.configPath)) ?? {};
  const accounts = { ...current.accounts };
  const existing = accounts[registration.label.value] ?? {};

  accounts[registration.label.value] = {
    ...existing,
    ...(registration.description === undefined ? {} : { description: registration.description }),
    ...(registration.credentialsPath === undefined ? {} : { credentialsPath: registration.credentialsPath }),
  };

  const shouldBecomeDefault = registration.makeDefault === true || current.defaultAccount === undefined;

  const next: AccountsConfigFile = {
    defaultAccount: shouldBecomeDefault ? registration.label.value : current.defaultAccount,
    accounts,
  };

  await fs.mkdir(path.dirname(paths.configPath), { recursive: true });
  await fs.writeFile(paths.configPath, `${JSON.stringify(next, null, 2)}\n`);
};
