import os from 'os';
import path from 'path';
import type { AccountLabel } from './account-label.js';

/** ホームディレクトリ名の既定値（利用者のホーム配下に作られる） */
const DEFAULT_HOME_DIR_NAME = '.google-workspace-mcp';

/**
 * 設定とトークンの置き場所を一箇所で決めるクラス。
 *
 * パスの組み立てをここに閉じ込めることで、レイアウトを変えたときの影響範囲を限定する。
 * Docker では GOOGLE_WORKSPACE_MCP_HOME でコンテナ内のパスに差し替える。
 */
export class WorkspacePaths {
  readonly home: string;

  constructor(home?: string) {
    this.home = home ?? process.env.GOOGLE_WORKSPACE_MCP_HOME ?? path.join(os.homedir(), DEFAULT_HOME_DIR_NAME);
  }

  /** アカウント設定ファイルのパス */
  get configPath(): string {
    return path.join(this.home, 'accounts.json');
  }

  /** 全アカウントで共有する OAuth クライアントのパス */
  get sharedCredentialsPath(): string {
    return path.join(this.home, 'credentials.json');
  }

  /** 指定アカウントのディレクトリ */
  accountDir(label: AccountLabel): string {
    return path.join(this.home, 'accounts', label.value);
  }

  /** 指定アカウント専用の OAuth クライアントのパス（規約上の位置） */
  accountCredentialsPath(label: AccountLabel): string {
    return path.join(this.accountDir(label), 'credentials.json');
  }

  /** 指定アカウント専用のサービスアカウント鍵のパス（規約上の位置） */
  accountServiceAccountPath(label: AccountLabel): string {
    return path.join(this.accountDir(label), 'service-account.json');
  }

  /** 指定アカウントのトークンのパス（規約上の位置） */
  accountTokenPath(label: AccountLabel): string {
    return path.join(this.accountDir(label), 'token.json');
  }

  /** 設定ファイルに書かれた相対パスを、ホーム基準の絶対パスにする */
  resolve(maybeRelative: string): string {
    return path.isAbsolute(maybeRelative) ? maybeRelative : path.join(this.home, maybeRelative);
  }
}
