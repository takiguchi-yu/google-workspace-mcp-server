import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { JWT } from 'google-auth-library';
import { AccountLabel } from './account-label.js';
import { AccountRegistry } from './account-registry.js';
import {
  AccountNotAuthorizedError,
  CredentialsNotFoundError,
  InvalidAccountLabelError,
  NoDefaultAccountError,
  UnknownAccountError,
} from './errors.js';
import { WorkspacePaths } from './workspace-paths.js';

let workDir: string;
let paths: WorkspacePaths;
const savedEnv = { ...process.env };

const CREDENTIALS = JSON.stringify({
  installed: { client_id: 'test-client-id', client_secret: 'test-client-secret' },
});

const SERVICE_ACCOUNT_KEY = JSON.stringify({
  type: 'service_account',
  client_email: 'mcp@test-project.iam.gserviceaccount.com',
  private_key: '-----BEGIN PRIVATE KEY-----\ndummy\n-----END PRIVATE KEY-----\n',
});

beforeEach(async () => {
  workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'account-registry-'));
  paths = new WorkspacePaths(path.join(workDir, 'home'));

  // 旧レイアウトの取り込みがテスト結果に混ざらないよう、存在しない場所を指しておく
  process.env.GOOGLE_CREDENTIALS_PATH = path.join(workDir, 'absent', 'credentials.json');
  process.env.GOOGLE_TOKEN_PATH = path.join(workDir, 'absent', 'token.json');
});

afterEach(async () => {
  process.env = { ...savedEnv };
  await fs.rm(workDir, { recursive: true, force: true });
});

const writeFileAt = async (filePath: string, content: string): Promise<void> => {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content);
};

const writeConfig = async (content: unknown): Promise<void> => {
  await writeFileAt(paths.configPath, JSON.stringify(content));
};

const writeToken = async (label: string): Promise<void> => {
  await writeFileAt(path.join(paths.home, 'accounts', label, 'token.json'), JSON.stringify({ refresh_token: 'r1' }));
};

describe('AccountRegistry.list', () => {
  it('ラベル・既定フラグ・説明文を返す', async () => {
    await writeConfig({ defaultAccount: 'work', accounts: { work: { description: '会社' }, private: {} } });

    assert.deepEqual((await AccountRegistry.load(paths)).list(), [
      { label: 'work', isDefault: true, description: '会社' },
      { label: 'private', isDefault: false, description: undefined },
    ]);
  });

  it('アカウントが無ければ空配列', async () => {
    assert.deepEqual((await AccountRegistry.load(paths)).list(), []);
  });
});

describe('AccountRegistry.resolve', () => {
  it('共通の credentials とアカウント別 token でクライアントを作る', async () => {
    await writeConfig({ accounts: { work: {} } });
    await writeFileAt(paths.sharedCredentialsPath, CREDENTIALS);
    await writeToken('work');

    const client = await (await AccountRegistry.load(paths)).resolve('work');

    assert.equal(client.credentials.refresh_token, 'r1');
    assert.equal(client._clientId, 'test-client-id');
  });

  it('同じラベルには同じクライアントを返す', async () => {
    await writeConfig({ accounts: { work: {} } });
    await writeFileAt(paths.sharedCredentialsPath, CREDENTIALS);
    await writeToken('work');

    const registry = await AccountRegistry.load(paths);

    assert.equal(await registry.resolve('work'), await registry.resolve('work'));
  });

  it('アカウントごとに別のクライアントを返す', async () => {
    await writeConfig({ accounts: { work: {}, private: {} } });
    await writeFileAt(paths.sharedCredentialsPath, CREDENTIALS);
    await writeToken('work');
    await writeFileAt(
      path.join(paths.home, 'accounts', 'private', 'token.json'),
      JSON.stringify({ refresh_token: 'r2' }),
    );

    const registry = await AccountRegistry.load(paths);

    assert.equal((await registry.resolve('work')).credentials.refresh_token, 'r1');
    assert.equal((await registry.resolve('private')).credentials.refresh_token, 'r2');
  });

  it('アカウント専用の credentials を共通より優先する', async () => {
    await writeConfig({ accounts: { work: {} } });
    await writeFileAt(paths.sharedCredentialsPath, CREDENTIALS);
    await writeFileAt(
      paths.accountCredentialsPath(AccountLabel.parse('work')),
      JSON.stringify({ installed: { client_id: 'account-client-id', client_secret: 's' } }),
    );
    await writeToken('work');

    const client = await (await AccountRegistry.load(paths)).resolve('work');

    assert.equal(client._clientId, 'account-client-id');
  });

  it('accounts.json で指定された credentials のパスを使う', async () => {
    const explicitPath = path.join(workDir, 'company', 'credentials.json');
    await writeConfig({ accounts: { work: { credentialsPath: explicitPath } } });
    await writeFileAt(explicitPath, JSON.stringify({ installed: { client_id: 'explicit-id', client_secret: 's' } }));
    await writeToken('work');

    assert.equal((await (await AccountRegistry.load(paths)).resolve('work'))._clientId, 'explicit-id');
  });

  it('ラベル省略時は既定アカウントを使う', async () => {
    await writeConfig({ defaultAccount: 'private', accounts: { work: {}, private: {} } });
    await writeFileAt(paths.sharedCredentialsPath, CREDENTIALS);
    await writeFileAt(
      path.join(paths.home, 'accounts', 'private', 'token.json'),
      JSON.stringify({ refresh_token: 'default-token' }),
    );

    const client = await (await AccountRegistry.load(paths)).resolve();

    assert.equal(client.credentials.refresh_token, 'default-token');
  });

  it('既定が決まらない状態でラベルを省略するとエラーになり、候補を示す', async () => {
    await writeConfig({ accounts: { work: {}, private: {} } });

    await assert.rejects(
      (await AccountRegistry.load(paths)).resolve(),
      (error: Error) => error instanceof NoDefaultAccountError && error.message.includes('work, private'),
    );
  });

  it('未知のラベルはエラーになり、利用可能なラベルを示す', async () => {
    await writeConfig({ accounts: { work: {}, private: {} } });

    await assert.rejects(
      (await AccountRegistry.load(paths)).resolve('wrok'),
      (error: Error) =>
        error instanceof UnknownAccountError &&
        error.message.includes("Unknown account 'wrok'") &&
        error.message.includes('work, private'),
    );
  });

  it('書式が不正なラベルはエラーになる', async () => {
    await writeConfig({ accounts: { work: {} } });

    await assert.rejects((await AccountRegistry.load(paths)).resolve('../etc'), InvalidAccountLabelError);
  });

  it('トークンが無いアカウントはエラーになり、セットアップコマンドを示す', async () => {
    await writeConfig({ accounts: { work: {} } });
    await writeFileAt(paths.sharedCredentialsPath, CREDENTIALS);

    await assert.rejects(
      (await AccountRegistry.load(paths)).resolve('work'),
      (error: Error) =>
        error instanceof AccountNotAuthorizedError && error.message.includes('npm run setup -- --account work'),
    );
  });

  it('credentials が無いアカウントはエラーになり、探した場所を示す', async () => {
    await writeConfig({ accounts: { work: {} } });
    await writeToken('work');

    await assert.rejects(
      (await AccountRegistry.load(paths)).resolve('work'),
      (error: Error) => error instanceof CredentialsNotFoundError && error.message.includes('credentials.json'),
    );
  });

  it('サービスアカウントの鍵があれば、トークンなしでクライアントを作る', async () => {
    await writeConfig({ accounts: { private: {} } });
    await writeFileAt(path.join(paths.home, 'accounts', 'private', 'service-account.json'), SERVICE_ACCOUNT_KEY);

    const client = await (await AccountRegistry.load(paths)).resolve('private');

    assert.ok(client instanceof JWT);
    assert.equal(client.email, 'mcp@test-project.iam.gserviceaccount.com');
  });

  it('サービスアカウントの鍵は OAuth クライアントより優先される', async () => {
    await writeConfig({ accounts: { private: {} } });
    await writeFileAt(paths.sharedCredentialsPath, CREDENTIALS);
    await writeFileAt(paths.accountCredentialsPath(AccountLabel.parse('private')), CREDENTIALS);
    await writeFileAt(path.join(paths.home, 'accounts', 'private', 'service-account.json'), SERVICE_ACCOUNT_KEY);

    assert.ok((await (await AccountRegistry.load(paths)).resolve('private')) instanceof JWT);
  });

  it('accounts.json でサービスアカウントの鍵を明示指定できる', async () => {
    const explicitPath = path.join(workDir, 'keys', 'private-sa.json');
    await writeConfig({ accounts: { private: { credentialsPath: explicitPath } } });
    await writeFileAt(explicitPath, SERVICE_ACCOUNT_KEY);

    assert.ok((await (await AccountRegistry.load(paths)).resolve('private')) instanceof JWT);
  });

  it('サービスアカウントはトークンが無くても認可エラーにならない', async () => {
    await writeConfig({ accounts: { work: {}, private: {} } });
    await writeFileAt(paths.sharedCredentialsPath, CREDENTIALS);
    await writeFileAt(path.join(paths.home, 'accounts', 'private', 'service-account.json'), SERVICE_ACCOUNT_KEY);

    const registry = await AccountRegistry.load(paths);

    // OAuth 側は従来どおりトークンが必要
    await assert.rejects(registry.resolve('work'), AccountNotAuthorizedError);
    assert.ok((await registry.resolve('private')) instanceof JWT);
  });

  it('資格情報として解釈できないファイルはエラーになる', async () => {
    await writeConfig({ accounts: { work: {} } });
    await writeFileAt(paths.sharedCredentialsPath, JSON.stringify({ nonsense: true }));

    await assert.rejects((await AccountRegistry.load(paths)).resolve('work'), /expected an OAuth client/);
  });

  it('解決に失敗したアカウントは、後からトークンを置けば再起動なしで復旧する', async () => {
    await writeConfig({ accounts: { work: {} } });
    await writeFileAt(paths.sharedCredentialsPath, CREDENTIALS);

    const registry = await AccountRegistry.load(paths);
    await assert.rejects(registry.resolve('work'), AccountNotAuthorizedError);

    await writeToken('work');

    assert.equal((await registry.resolve('work')).credentials.refresh_token, 'r1');
  });
});
