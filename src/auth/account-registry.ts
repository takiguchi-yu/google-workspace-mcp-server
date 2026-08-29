import type { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import { AccountLabel } from './account-label.js';
import { AccountsConfig } from './accounts-config.js';
import type { AccountDefinition } from './accounts-config.js';
import { readCredential } from './credentials.js';
import type { Credential } from './credentials.js';
import {
  AccountNotAuthorizedError,
  CredentialsNotFoundError,
  NoDefaultAccountError,
  UnknownAccountError,
} from './errors.js';
import { SERVICE_ACCOUNT_SCOPES } from './scopes.js';
import { TokenStore } from './token-store.js';
import { WorkspacePaths } from './workspace-paths.js';

/** credentials.json に redirect_uris が無い場合のフォールバック */
const FALLBACK_REDIRECT_URI = 'http://localhost';

/** accounts_list が返すアカウントの要約 */
export interface AccountSummary {
  label: string;
  isDefault: boolean;
  description?: string | undefined;
}

/**
 * ラベルから認証済みクライアントを引くレジストリ。
 *
 * 「どのアカウントか」を解釈する責務をここに集約し、各コマンドは解決済みの
 * OAuth2Client を受け取るだけにする。クライアントは初回に要求されたときだけ生成し、
 * 1 つのアカウントの認可切れが他のアカウントに波及しないようにする。
 */
export class AccountRegistry {
  private readonly paths: WorkspacePaths;
  private readonly config: AccountsConfig;
  /** ラベルごとの生成済みクライアント（生成中の Promise も含む） */
  private readonly clients = new Map<string, Promise<OAuth2Client>>();

  private constructor(paths: WorkspacePaths, config: AccountsConfig) {
    this.paths = paths;
    this.config = config;
  }

  /** 設定を読み込んでレジストリを作る。この時点では認可の有無を検証しない */
  static async load(paths: WorkspacePaths = new WorkspacePaths()): Promise<AccountRegistry> {
    return new AccountRegistry(paths, await AccountsConfig.load(paths));
  }

  /** 登録されているアカウントの一覧 */
  list(): AccountSummary[] {
    return this.config.list().map((definition) => ({
      label: definition.label.value,
      isDefault: this.config.isDefault(definition.label),
      description: definition.description,
    }));
  }

  /**
   * ラベルに対応する認証済みクライアントを返す。
   * ラベルを省略した場合は既定アカウントを使う。
   */
  async resolve(label?: string): Promise<OAuth2Client> {
    const target = label === undefined ? this.requireDefaultLabel() : AccountLabel.parse(label);
    const definition = this.config.get(target);

    if (definition === undefined) {
      throw new UnknownAccountError(target.value, this.config.labels());
    }

    const cached = this.clients.get(target.value);

    if (cached !== undefined) {
      return await cached;
    }

    // 失敗した解決はキャッシュに残さない。セットアップ後に再起動なしで復旧できるようにする
    const pending = this.createClient(definition).catch((error: unknown) => {
      this.clients.delete(target.value);
      throw error;
    });

    this.clients.set(target.value, pending);

    return await pending;
  }

  private requireDefaultLabel(): AccountLabel {
    const label = this.config.defaultLabel();

    if (label === null) {
      throw new NoDefaultAccountError(this.config.labels());
    }

    return label;
  }

  private async createClient(definition: AccountDefinition): Promise<OAuth2Client> {
    const credential = await this.loadCredential(definition);

    // サービスアカウントは独立した Google アカウントとして振る舞うため、認可フローもトークンも要らない。
    // アクセスできる範囲は、この鍵のアドレスに共有されたファイルだけで決まる。
    if (credential.kind === 'service-account') {
      return new google.auth.JWT({
        email: credential.clientEmail,
        key: credential.privateKey,
        scopes: SERVICE_ACCOUNT_SCOPES,
      });
    }

    const store = new TokenStore(definition.tokenPath ?? this.paths.accountTokenPath(definition.label));
    const tokens = await store.read();

    if (tokens === null) {
      throw new AccountNotAuthorizedError(definition.label.value, store.path);
    }

    const auth = new google.auth.OAuth2(
      credential.config.client_id,
      credential.config.client_secret,
      credential.config.redirect_uris?.[0] ?? FALLBACK_REDIRECT_URI,
    );
    auth.setCredentials(tokens);

    // アクセストークンが自動更新されたら、ディスク上の最新値にマージして書き戻す
    auth.on('tokens', (refreshed) => {
      void store.merge(refreshed).catch((error: unknown) => {
        console.error(`⚠️  Failed to persist the refreshed token for '${definition.label.value}':`, error);
      });
    });

    return auth;
  }

  /**
   * アカウントの資格情報を読む。
   *
   * 明示指定があればそれだけを見る。無ければ、アカウント専用のサービスアカウント鍵 →
   * アカウント専用の OAuth クライアント → 共通の OAuth クライアント、の順に探す。
   * サービスアカウント鍵を先に見るのは、置いてある以上そちらを使う意図とみなせるため。
   */
  private async loadCredential(definition: AccountDefinition): Promise<Credential> {
    const candidates =
      definition.credentialsPath === undefined
        ? [
            this.paths.accountServiceAccountPath(definition.label),
            this.paths.accountCredentialsPath(definition.label),
            this.paths.sharedCredentialsPath,
          ]
        : [this.paths.resolve(definition.credentialsPath)];

    for (const candidate of candidates) {
      const credential = await readCredential(candidate);

      if (credential !== null) {
        return credential;
      }
    }

    throw new CredentialsNotFoundError(definition.label.value, candidates);
  }
}
