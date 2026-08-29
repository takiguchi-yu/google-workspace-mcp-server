import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { TokenStore } from './token-store.js';

let workDir: string;

beforeEach(async () => {
  workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'token-store-'));
});

afterEach(async () => {
  await fs.rm(workDir, { recursive: true, force: true });
});

describe('TokenStore', () => {
  it('保存したトークンを読み戻せる', async () => {
    const store = new TokenStore(path.join(workDir, 'accounts', 'work', 'token.json'));

    await store.save({ refresh_token: 'r1', access_token: 'a1' });

    assert.deepEqual(await store.read(), { refresh_token: 'r1', access_token: 'a1' });
    assert.equal(await store.exists(), true);
  });

  it('保存時に中間ディレクトリを作り、所有者だけが読める権限にする', async () => {
    const tokenPath = path.join(workDir, 'accounts', 'private', 'token.json');
    const store = new TokenStore(tokenPath);

    await store.save({ refresh_token: 'r1' });

    const stat = await fs.stat(tokenPath);
    assert.equal(stat.mode & 0o777, 0o600);
  });

  it('一時ファイルを残さない', async () => {
    const dir = path.join(workDir, 'accounts', 'work');
    await new TokenStore(path.join(dir, 'token.json')).save({ refresh_token: 'r1' });

    assert.deepEqual(await fs.readdir(dir), ['token.json']);
  });

  it('ファイルが無い場合は null を返す', async () => {
    const store = new TokenStore(path.join(workDir, 'missing.json'));

    assert.equal(await store.read(), null);
    assert.equal(await store.exists(), false);
  });

  it('空ファイル・空オブジェクト・壊れた JSON は未保存として扱う', async () => {
    for (const content of ['', '{}', 'not json']) {
      const tokenPath = path.join(workDir, 'token.json');
      await fs.writeFile(tokenPath, content);

      assert.equal(await new TokenStore(tokenPath).read(), null, `should be null for: ${JSON.stringify(content)}`);
    }
  });

  it('merge はディスク上の refresh_token を残したまま新しい access_token を重ねる', async () => {
    const store = new TokenStore(path.join(workDir, 'token.json'));
    await store.save({ refresh_token: 'r1', access_token: 'a1', expiry_date: 1 });

    await store.merge({ access_token: 'a2', expiry_date: 2 });

    assert.deepEqual(await store.read(), { refresh_token: 'r1', access_token: 'a2', expiry_date: 2 });
  });

  it('merge は自分が読み込んだ時点の値ではなく、常に最新のファイルを基準にする', async () => {
    const tokenPath = path.join(workDir, 'token.json');
    const store = new TokenStore(tokenPath);
    await store.save({ refresh_token: 'r1', access_token: 'a1' });

    // 別プロセスが refresh_token を更新した状況を再現する
    await fs.writeFile(tokenPath, JSON.stringify({ refresh_token: 'rotated', access_token: 'a1' }));

    await store.merge({ access_token: 'a2' });

    assert.deepEqual(await store.read(), { refresh_token: 'rotated', access_token: 'a2' });
  });

  it('同時に走った merge を取りこぼさない', async () => {
    const store = new TokenStore(path.join(workDir, 'token.json'));
    await store.save({ refresh_token: 'r1' });

    await Promise.all([store.merge({ access_token: 'a1' }), store.merge({ expiry_date: 99 })]);

    const stored = await store.read();
    assert.equal(stored?.refresh_token, 'r1');
    assert.equal(stored?.access_token, 'a1');
    assert.equal(stored?.expiry_date, 99);
  });
});
