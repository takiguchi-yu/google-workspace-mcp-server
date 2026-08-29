import * as fs from 'fs/promises';

/**
 * OAuth クライアントの種類。
 *
 * デスクトップアプリ（installed）はループバックへのリダイレクトが任意のポートで許可されるため、
 * コールバック用サーバーのポートを動的に選べる。ウェブアプリ（web）は登録済みのリダイレクト URI と
 * 完全一致する必要があるため、ポートを勝手に変えてはならない。
 */
export type OAuthClientType = 'installed' | 'web';

/** OAuth クライアント（Google Cloud のアプリ登録）の設定 */
export interface CredentialsConfig {
  client_id: string;
  client_secret: string;
  redirect_uris?: string[];
}

/** ブラウザでの認可を必要とする、利用者本人としてアクセスする資格情報 */
export interface OAuthClientCredential {
  kind: 'oauth-client';
  type: OAuthClientType;
  config: CredentialsConfig;
}

/**
 * サービスアカウントの鍵。
 *
 * 独立した Google アカウントとして振る舞うため、ブラウザでの認可を必要としない。
 * アクセスできるのは、この clientEmail に共有されたファイルだけ。
 */
export interface ServiceAccountCredential {
  kind: 'service-account';
  /** 利用者がファイルを共有する宛先となるアドレス */
  clientEmail: string;
  privateKey: string;
}

/** 資格情報ファイルから読み取れる 2 種類の資格情報 */
export type Credential = OAuthClientCredential | ServiceAccountCredential;

/** Google Cloud Console からダウンロードした credentials.json / サービスアカウント鍵の形 */
interface CredentialFileContent {
  type?: string;
  client_email?: string;
  private_key?: string;
  installed?: CredentialsConfig;
  web?: CredentialsConfig;
}

/**
 * 資格情報ファイルを読み、内容から種類を判別する。
 *
 * サービスアカウントの鍵は type: "service_account" を持ち、OAuth クライアントは installed / web を持つ。
 * 形が明確に異なるため、利用者に設定ファイルで種類を書かせる必要はない。
 * ファイルが無い場合は null を返し、形式が不正な場合は例外を投げる。
 */
export const readCredential = async (credentialPath: string): Promise<Credential | null> => {
  let content: string;

  try {
    content = await fs.readFile(credentialPath, 'utf8');
  } catch {
    return null;
  }

  const parsed = JSON.parse(content) as CredentialFileContent;

  if (parsed.type === 'service_account') {
    if (!parsed.client_email || !parsed.private_key) {
      throw new Error(`Invalid service account key ${credentialPath}: "client_email" and "private_key" are required.`);
    }

    return { kind: 'service-account', clientEmail: parsed.client_email, privateKey: parsed.private_key };
  }

  if (parsed.installed) {
    return { kind: 'oauth-client', type: 'installed', config: parsed.installed };
  }

  if (parsed.web) {
    return { kind: 'oauth-client', type: 'web', config: parsed.web };
  }

  throw new Error(
    `Invalid credential file ${credentialPath}: expected an OAuth client ("installed" or "web") ` +
      'or a service account key ("type": "service_account").',
  );
};
