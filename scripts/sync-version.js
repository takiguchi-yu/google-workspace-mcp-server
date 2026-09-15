import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';

/**
 * package.json の version を、それに追随すべき各所へ書き戻す。
 *
 * バージョンの真実は package.json ただ 1 つ。server.json とドキュメントの Docker タグは
 * そこに追随するだけで、人が覚えて書き換えるものではない（実際、タグを固定する案内に変えた
 * eed8f14 以降、4 回のリリースで 0.5.0 のまま取り残された）。
 *
 * `--stage` を付けると、書き換えたファイルを git にステージする。`npm version` の
 * version フックから呼ばれたときだけ付けるので、手で実行したぶんが勝手にステージされることはない。
 */

/** Docker タグを書いているドキュメント。増えたらここに足す */
const DOCUMENT_FILES = ['docs/how-to-get-token.md', 'docs/setup.md', 'README.md'];

/**
 * ドキュメント中の Docker イメージタグ。
 * ユーザー名は Docker Hub 側の設定で決まるので、イメージ名から後ろだけを見る。
 */
const IMAGE_TAG_PATTERN = /(google-workspace-mcp-server:)\d+\.\d+\.\d+/g;

const pkg = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
const version = pkg.version;
const changed = [];

// server.json のバージョンを package.json に合わせる
const serverJson = JSON.parse(fs.readFileSync('./server.json', 'utf8'));
serverJson.version = version;
if (serverJson.packages && serverJson.packages.length > 0) {
  serverJson.packages[0].version = version;
}
fs.writeFileSync('./server.json', JSON.stringify(serverJson, null, 2) + '\n', 'utf8');
changed.push('server.json');
console.log(`✅ Synced server.json version to ${version}`);

// ドキュメントの Docker イメージタグを合わせる
for (const file of DOCUMENT_FILES) {
  const filePath = path.resolve(file);
  if (!fs.existsSync(filePath)) {
    continue;
  }

  const before = fs.readFileSync(filePath, 'utf8');
  const after = before.replace(IMAGE_TAG_PATTERN, `$1${version}`);

  if (after === before) {
    continue;
  }

  fs.writeFileSync(filePath, after, 'utf8');
  changed.push(file);

  const count = (before.match(IMAGE_TAG_PATTERN) ?? []).length;
  console.log(`✅ Synced ${file} image tag to ${version} (${count} occurrences)`);
}

// version フックから呼ばれたときは、書き換えたぶんをリリースコミットに載せる
if (process.argv.includes('--stage')) {
  execFileSync('git', ['add', ...changed], { stdio: 'inherit' });
  console.log(`✅ Staged: ${changed.join(', ')}`);
}
