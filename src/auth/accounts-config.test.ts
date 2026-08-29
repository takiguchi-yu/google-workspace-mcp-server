import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { AccountLabel } from './account-label.js';
import { AccountsConfig, upsertAccount } from './accounts-config.js';
import { WorkspacePaths } from './workspace-paths.js';

let workDir: string;
let paths: WorkspacePaths;
const savedEnv = { ...process.env };

beforeEach(async () => {
  workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'accounts-config-'));
  paths = new WorkspacePaths(path.join(workDir, 'home'));

  // 旧レイアウトの探索先を、実行ディレクトリではなくテスト用の場所に固定する
  process.env.GOOGLE_CREDENTIALS_PATH = path.join(workDir, 'legacy', 'credentials.json');
  process.env.GOOGLE_TOKEN_PATH = path.join(workDir, 'legacy', 'token.json');
});

afterEach(async () => {
  process.env = { ...savedEnv };
  await fs.rm(workDir, { recursive: true, force: true });
});

const writeConfig = async (content: unknown): Promise<void> => {
  await fs.mkdir(paths.home, { recursive: true });
  await fs.writeFile(paths.configPath, JSON.stringify(content, null, 2));
};

const writeLegacyToken = async (): Promise<void> => {
  await fs.mkdir(path.join(workDir, 'legacy'), { recursive: true });
  await fs.writeFile(path.join(workDir, 'legacy', 'token.json'), JSON.stringify({ refresh_token: 'r1' }));
};

describe('AccountsConfig.load', () => {
  it('設定も旧レイアウトも無ければ空になる', async () => {
    const config = await AccountsConfig.load(paths);

    assert.deepEqual(config.labels(), []);
    assert.equal(config.defaultLabel(), null);
  });

  it('accounts.json のアカウントを読み込む', async () => {
    await writeConfig({
      defaultAccount: 'work',
      accounts: {
        work: { description: '会社の Workspace' },
        private: { credentialsPath: 'personal/credentials.json' },
      },
    });

    const config = await AccountsConfig.load(paths);

    assert.deepEqual(config.labels(), ['work', 'private']);
    assert.equal(config.get(AccountLabel.parse('work'))?.description, '会社の Workspace');
    assert.equal(config.get(AccountLabel.parse('private'))?.credentialsPath, 'personal/credentials.json');
  });

  it('明示された defaultAccount を既定にする', async () => {
    await writeConfig({ defaultAccount: 'private', accounts: { work: {}, private: {} } });

    const config = await AccountsConfig.load(paths);

    assert.equal(config.defaultLabel()?.value, 'private');
    assert.equal(config.isDefault(AccountLabel.parse('private')), true);
    assert.equal(config.isDefault(AccountLabel.parse('work')), false);
  });

  it('アカウントが 1 件だけなら既定が未設定でもそれを使う', async () => {
    await writeConfig({ accounts: { work: {} } });

    assert.equal((await AccountsConfig.load(paths)).defaultLabel()?.value, 'work');
  });

  it('アカウントが複数で既定が未設定なら、取り違えを防ぐため既定を決めない', async () => {
    await writeConfig({ accounts: { work: {}, private: {} } });

    assert.equal((await AccountsConfig.load(paths)).defaultLabel(), null);
  });

  it('存在しないアカウントを指す defaultAccount は無視する', async () => {
    await writeConfig({ defaultAccount: 'missing', accounts: { work: {}, private: {} } });

    assert.equal((await AccountsConfig.load(paths)).defaultLabel(), null);
  });

  it('書式が不正なラベルのエントリは読み飛ばす', async () => {
    await writeConfig({ accounts: { work: {}, '../evil': {} } });

    assert.deepEqual((await AccountsConfig.load(paths)).labels(), ['work']);
  });

  it('accounts.json が無く旧レイアウトのトークンがあれば default として取り込む', async () => {
    await writeLegacyToken();

    const config = await AccountsConfig.load(paths);
    const definition = config.get(AccountLabel.parse('default'));

    assert.deepEqual(config.labels(), ['default']);
    assert.equal(config.defaultLabel()?.value, 'default');
    assert.equal(definition?.tokenPath, process.env.GOOGLE_TOKEN_PATH);
    assert.equal(definition?.credentialsPath, process.env.GOOGLE_CREDENTIALS_PATH);
  });

  it('旧レイアウトのトークンが空ファイルなら取り込まない', async () => {
    await fs.mkdir(path.join(workDir, 'legacy'), { recursive: true });
    await fs.writeFile(path.join(workDir, 'legacy', 'token.json'), '');

    assert.deepEqual((await AccountsConfig.load(paths)).labels(), []);
  });

  it('accounts.json があれば旧レイアウトは見ない', async () => {
    await writeLegacyToken();
    await writeConfig({ accounts: { work: {} } });

    assert.deepEqual((await AccountsConfig.load(paths)).labels(), ['work']);
  });
});

describe('upsertAccount', () => {
  it('accounts.json が無ければ作り、最初の登録を既定にする', async () => {
    await upsertAccount(paths, { label: AccountLabel.parse('work'), description: '会社' });

    const config = await AccountsConfig.load(paths);

    assert.deepEqual(config.labels(), ['work']);
    assert.equal(config.defaultLabel()?.value, 'work');
    assert.equal(config.get(AccountLabel.parse('work'))?.description, '会社');
  });

  it('2 件目の登録は既定を奪わない', async () => {
    await upsertAccount(paths, { label: AccountLabel.parse('work') });
    await upsertAccount(paths, { label: AccountLabel.parse('private') });

    const config = await AccountsConfig.load(paths);

    assert.deepEqual(config.labels(), ['work', 'private']);
    assert.equal(config.defaultLabel()?.value, 'work');
  });

  it('makeDefault を指定すれば既定を差し替える', async () => {
    await upsertAccount(paths, { label: AccountLabel.parse('work') });
    await upsertAccount(paths, { label: AccountLabel.parse('private'), makeDefault: true });

    assert.equal((await AccountsConfig.load(paths)).defaultLabel()?.value, 'private');
  });

  it('再登録しても既存の説明文を消さない', async () => {
    await upsertAccount(paths, { label: AccountLabel.parse('work'), description: '会社' });
    await upsertAccount(paths, { label: AccountLabel.parse('work') });

    assert.equal((await AccountsConfig.load(paths)).get(AccountLabel.parse('work'))?.description, '会社');
  });
});
