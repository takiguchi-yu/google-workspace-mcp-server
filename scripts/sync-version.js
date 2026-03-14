import fs from 'fs';

// package.json と server.json を読み込む
const pkg = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
const serverJson = JSON.parse(fs.readFileSync('./server.json', 'utf8'));

// server.json のバージョンを package.json に合わせる
serverJson.version = pkg.version;
if (serverJson.packages && serverJson.packages.length > 0) {
  serverJson.packages[0].version = pkg.version;
}

// ファイルに書き戻す
fs.writeFileSync('./server.json', JSON.stringify(serverJson, null, 2) + '\n', 'utf8');
console.log(`✅ Synced server.json version to ${pkg.version}`);
