#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * ミニ OAuth コールバックサーバー
 *
 * ブラウザからの OAuth コールバックを受け取り、指定されたアカウントのトークンを保存します。
 * stdio モードでも認証フローを完結させるための軽量サーバーです。
 *
 * 使い方:
 *   npm run setup -- --account work --description "会社の Google Workspace"
 *   npm run setup -- --account work --port 8123
 *   npm run setup -- --account private --service-account ~/Downloads/key.json
 */

import * as fs from 'fs/promises';
import * as http from 'http';
import path from 'path';
import * as readline from 'readline/promises';
import * as url from 'url';
import type { Credentials } from 'google-auth-library';
import { google } from 'googleapis';
import { AccountLabel } from '../auth/account-label.js';
import { upsertAccount } from '../auth/accounts-config.js';
import { readCredential } from '../auth/credentials.js';
import type { Credential, CredentialsConfig, OAuthClientCredential } from '../auth/credentials.js';
import { OAUTH_SCOPES, SERVICE_ACCOUNT_SCOPES } from '../auth/scopes.js';
import { TokenStore } from '../auth/token-store.js';
import { WorkspacePaths } from '../auth/workspace-paths.js';

/**
 * コールバック用サーバーの既定ポート。
 *
 * Docker では -p 8000:8000 で公開する前提のため、既定値は固定しておく必要がある。
 * ローカル実行で他プロセスと衝突した場合だけ、空きポートへ自動的に切り替える。
 */
const DEFAULT_PORT = 8000;

/** コマンドライン引数 */
interface SetupOptions {
  label: AccountLabel;
  description?: string | undefined;
  /** --port で明示指定されたポート。未指定なら既定ポートを試す */
  port?: number | undefined;
  /** --service-account で渡されたサービスアカウント鍵のパス。指定時は認可フローを行わない */
  serviceAccountKeyPath?: string | undefined;
  force: boolean;
}

/** 使用する資格情報と、その出どころ */
interface ResolvedCredential {
  credential: Credential;
  sourcePath: string;
}

/**
 * コマンドライン引数を読む。
 * どのアカウントを認可するかは取り違えの元なので、--account は必須にする。
 */
const parseOptions = (argv: string[]): SetupOptions => {
  const readValue = (flag: string): string | undefined => {
    const index = argv.indexOf(flag);
    return index >= 0 ? argv[index + 1] : undefined;
  };

  const rawLabel = readValue('--account');
  const rawPort = readValue('--port');

  if (rawLabel === undefined || rawLabel === '') {
    throw new Error('--account でアカウントのラベルを指定してください（例: --account work）。');
  }

  if (rawPort !== undefined && !/^\d+$/.test(rawPort)) {
    throw new Error(`--port には 1〜65535 の数値を指定してください（受け取った値: ${rawPort}）。`);
  }

  const port = rawPort === undefined ? undefined : Number(rawPort);

  if (port !== undefined && (port < 1 || port > 65535)) {
    throw new Error(`--port には 1〜65535 の数値を指定してください（受け取った値: ${rawPort ?? ''}）。`);
  }

  return {
    label: AccountLabel.parse(rawLabel),
    description: readValue('--description'),
    port,
    serviceAccountKeyPath: readValue('--service-account'),
    force: argv.includes('--force'),
  };
};

/**
 * このアカウントで使う OAuth クライアントを探す。
 * アカウント専用 → 全アカウント共通、の順に規約上の位置だけを見る。
 */
const resolveCredential = async (paths: WorkspacePaths, label: AccountLabel): Promise<ResolvedCredential> => {
  const candidates = [
    paths.accountServiceAccountPath(label),
    paths.accountCredentialsPath(label),
    paths.sharedCredentialsPath,
  ];

  for (const candidatePath of candidates) {
    const credential = await readCredential(candidatePath);

    if (credential !== null) {
      return { credential, sourcePath: candidatePath };
    }
  }

  throw new Error(
    `資格情報が見つかりません。次のいずれかに配置してください:\n` +
      candidates.map((candidatePath) => `  - ${candidatePath}`).join('\n') +
      `\n作成手順: docs/how-to-create-credentials.md`,
  );
};

/**
 * すでに保存済みのトークンがある場合に、上書きしてよいか確認する。
 * 非対話環境では誤って上書きしないよう、--force を必須にする。
 */
const confirmOverwrite = async (store: TokenStore, options: SetupOptions): Promise<void> => {
  if (options.force || !(await store.exists())) {
    return;
  }

  if (!process.stdin.isTTY) {
    throw new Error(
      `アカウント '${options.label.value}' のトークンはすでに存在します: ${store.path}\n` +
        '上書きする場合は --force を付けて再実行してください。',
    );
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  try {
    const answer = await rl.question(
      `⚠️  アカウント '${options.label.value}' のトークンはすでに存在します（${store.path}）。上書きしますか? [y/N] `,
    );

    if (answer.trim().toLowerCase() !== 'y') {
      throw new Error('中止しました。既存のトークンは変更していません。');
    }
  } finally {
    rl.close();
  }
};

/**
 * 認証コードをトークンに交換
 */
const exchangeCodeForToken = async (
  config: CredentialsConfig,
  redirectUri: string,
  code: string,
): Promise<Credentials> => {
  const oauth2Client = new google.auth.OAuth2(config.client_id, config.client_secret, redirectUri);
  const { tokens } = await oauth2Client.getToken(code);

  return tokens;
};

/**
 * トークンの有効性をテストする。
 *
 * 利用者の Drive に余計なファイルを残さないよう、参照系の API だけを叩く。
 * drive.file スコープでは自身が作成したファイルしか返らないため、結果が空でも成功とみなす。
 */
const testToken = async (config: CredentialsConfig, redirectUri: string, credentials: Credentials): Promise<void> => {
  console.log('🧪 トークンの有効性をテストしています...');

  try {
    const auth = new google.auth.OAuth2(config.client_id, config.client_secret, redirectUri);
    auth.setCredentials(credentials);

    const drive = google.drive({ version: 'v3', auth });
    await drive.files.list({ pageSize: 1, fields: 'files(id)' });

    console.log('✅ トークンが有効です！Google Drive API との疎通に成功しました。');
  } catch (error) {
    console.error('⚠️  トークンのテスト中にエラーが発生しました:');
    if (error && typeof error === 'object' && 'message' in error) {
      console.error(`   ${String(error.message)}`);
    }
    console.error('   トークンは保存されましたが、API へのアクセスに問題がある可能性があります。');
  }
};

/**
 * 成功ページの HTML
 */
const getSuccessHtml = (label: string): string => {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>認証成功</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      margin: 0;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }
    .container {
      background: white;
      padding: 40px;
      border-radius: 12px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.2);
      text-align: center;
      max-width: 500px;
    }
    .icon {
      font-size: 64px;
      margin-bottom: 20px;
    }
    h1 {
      color: #333;
      margin: 0 0 16px 0;
    }
    p {
      color: #666;
      line-height: 1.6;
      margin: 0 0 24px 0;
    }
    .success {
      background: #10b981;
      color: white;
      padding: 12px 24px;
      border-radius: 6px;
      display: inline-block;
      font-weight: 600;
    }
    code {
      background: #f3f4f6;
      padding: 2px 6px;
      border-radius: 4px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">✅</div>
    <h1>認証に成功しました！</h1>
    <p>アカウント <code>${label}</code> の認証が完了しました。<br>このウィンドウを閉じて、ターミナルに戻ってください。</p>
    <div class="success">セットアップ完了</div>
  </div>
</body>
</html>
`;
};

/**
 * エラーページの HTML
 */
const getErrorHtml = (errorMessage: string): string => {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>認証エラー</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      margin: 0;
      background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
    }
    .container {
      background: white;
      padding: 40px;
      border-radius: 12px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.2);
      text-align: center;
      max-width: 500px;
    }
    .icon {
      font-size: 64px;
      margin-bottom: 20px;
    }
    h1 {
      color: #333;
      margin: 0 0 16px 0;
    }
    p {
      color: #666;
      line-height: 1.6;
      margin: 0 0 12px 0;
    }
    .error-message {
      background: #fef2f2;
      color: #dc2626;
      padding: 16px;
      border-radius: 6px;
      margin-top: 16px;
      font-family: monospace;
      font-size: 14px;
      text-align: left;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">❌</div>
    <h1>認証に失敗しました</h1>
    <p>Google アカウントの認証中にエラーが発生しました。</p>
    <p>ターミナルに戻ってエラーメッセージを確認してください。</p>
    <div class="error-message">${errorMessage}</div>
  </div>
</body>
</html>
`;
};

/**
 * サーバーを待ち受け状態にし、実際に確保できたポートを返す。
 *
 * 既定ポートが埋まっていた場合、デスクトップアプリ型のクライアントに限り空きポートへ切り替える。
 * デスクトップアプリはループバックへのリダイレクトが任意のポートで許可されるため安全に変更できる。
 * ウェブアプリ型は登録済みのリダイレクト URI と完全一致する必要があるので、切り替えず明示的に失敗させる。
 */
const listenOnAvailablePort = async (
  server: http.Server,
  options: SetupOptions,
  clientType: OAuthClientCredential['type'],
): Promise<number> => {
  const preferredPort = options.port ?? DEFAULT_PORT;
  // 明示指定されたポートは利用者の意図なので、勝手に変えない
  const allowFallback = options.port === undefined && clientType === 'installed';

  const tryListen = (port: number): Promise<number> =>
    new Promise((resolve, reject) => {
      const onError = (error: Error): void => {
        server.removeListener('listening', onListening);
        reject(error);
      };
      const onListening = (): void => {
        server.removeListener('error', onError);
        const address = server.address();
        resolve(typeof address === 'object' && address !== null ? address.port : port);
      };

      server.once('error', onError);
      server.once('listening', onListening);
      server.listen(port);
    });

  try {
    return await tryListen(preferredPort);
  } catch (error) {
    const isPortTaken = error !== null && typeof error === 'object' && 'code' in error && error.code === 'EADDRINUSE';

    if (!isPortTaken) {
      throw error;
    }

    if (!allowFallback) {
      throw new Error(
        `ポート ${String(preferredPort)} は既に使用されています。\n` +
          (clientType === 'web'
            ? '  ウェブアプリ型の OAuth クライアントはリダイレクト URI が完全一致する必要があるため、\n' +
              '  ポートを自動では変更できません。使用中のプロセスを停止するか、Google Cloud Console に\n' +
              '  別ポートのリダイレクト URI を登録したうえで --port を指定してください。'
            : `  使用中のプロセスを停止するか、--port で別のポートを指定してください（例: --port 8123）。\n` +
              `  使用中のプロセスは次で確認できます: lsof -i:${String(preferredPort)}`),
        { cause: error },
      );
    }

    // 0 を渡すと OS が空きポートを割り当てる
    const fallbackPort = await tryListen(0);
    console.log(
      `⚠️  ポート ${String(preferredPort)} は使用中のため、空きポート ${String(fallbackPort)} を使用します。\n` +
        '   Docker で実行している場合は -p の指定と食い違うため、使用中のプロセスを停止してから再実行してください。\n',
    );

    return fallbackPort;
  }
};

/**
 * 認証完了後の保存処理。
 * トークンとアカウント設定の両方を書くことで、利用者が accounts.json を手書きせずに済む。
 */
const persistAccount = async (paths: WorkspacePaths, options: SetupOptions, tokens: Credentials): Promise<void> => {
  const store = new TokenStore(paths.accountTokenPath(options.label));

  console.log('💾 トークンを保存しています...');
  await store.save(tokens);
  console.log(`✅ トークンを保存しました: ${store.path}`);

  await upsertAccount(paths, {
    label: options.label,
    description: options.description,
  });
  console.log(`✅ アカウント設定を更新しました: ${paths.configPath}`);
};

/**
 * サービスアカウントをアカウントとして登録する。
 *
 * サービスアカウントはブラウザでの認可を必要としないため、鍵を規約上の位置に置いて
 * accounts.json を更新するだけで使えるようになる。認可フローも同意画面も通らない。
 */
const registerServiceAccount = async (paths: WorkspacePaths, options: SetupOptions, keyPath: string): Promise<void> => {
  console.log('🔑 サービスアカウントとして登録します（ブラウザでの認可は不要です）\n');

  const credential = await readCredential(keyPath);

  if (credential === null) {
    throw new Error(`サービスアカウントの鍵が見つかりません: ${keyPath}`);
  }

  if (credential.kind !== 'service-account') {
    throw new Error(
      `${keyPath} はサービスアカウントの鍵ではありません（OAuth クライアントの credentials.json のようです）。\n` +
        'Google Cloud Console の「IAM と管理 → サービスアカウント → 鍵」からダウンロードした JSON を指定してください。',
    );
  }

  const destination = paths.accountServiceAccountPath(options.label);
  const alreadyExists = (await readCredential(destination)) !== null;

  if (alreadyExists && !options.force) {
    if (!process.stdin.isTTY) {
      throw new Error(
        `アカウント '${options.label.value}' の鍵はすでに存在します: ${destination}\n` +
          '上書きする場合は --force を付けて再実行してください。',
      );
    }

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

    try {
      const answer = await rl.question(`⚠️  既存の鍵を上書きしますか?（${destination}） [y/N] `);

      if (answer.trim().toLowerCase() !== 'y') {
        throw new Error('中止しました。既存の鍵は変更していません。');
      }
    } finally {
      rl.close();
    }
  }

  // 鍵は認証情報そのものなので、所有者だけが読める権限で置く
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.copyFile(keyPath, destination);
  await fs.chmod(destination, 0o600);
  console.log(`✅ 鍵を配置しました: ${destination}`);

  await upsertAccount(paths, {
    label: options.label,
    description: options.description,
  });
  console.log(`✅ アカウント設定を更新しました: ${paths.configPath}\n`);

  await testServiceAccount(credential.clientEmail, credential.privateKey);

  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║              🎉 セットアップが完了しました！               ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');
  console.log('⚠️  最後に、使いたいファイルを共有してください:');
  console.log('');
  console.log(`     ${credential.clientEmail}`);
  console.log('');
  console.log('  1. Google Drive でフォルダを作る（例: MCP共有）');
  console.log('  2. そのフォルダを上のアドレスに「編集者」で共有する');
  console.log('  3. AI に触らせたいファイルをそのフォルダに入れる');
  console.log('');
  console.log('  共有していないファイルには一切アクセスできません。');
  console.log(`  ツール呼び出しでは account: "${options.label.value}" を指定します\n`);
};

/**
 * サービスアカウントの鍵が有効かを確認する。
 * 共有されたファイルがまだ無くても成功する参照系の API を使う。
 */
const testServiceAccount = async (clientEmail: string, privateKey: string): Promise<void> => {
  console.log('🧪 鍵の有効性をテストしています...');

  try {
    const auth = new google.auth.JWT({ email: clientEmail, key: privateKey, scopes: SERVICE_ACCOUNT_SCOPES });
    const drive = google.drive({ version: 'v3', auth });
    await drive.about.get({ fields: 'user(displayName)' });

    console.log('✅ 鍵が有効です！Google Drive API との疎通に成功しました。');
  } catch (error) {
    console.error('⚠️  鍵のテスト中にエラーが発生しました:');
    if (error && typeof error === 'object' && 'message' in error) {
      console.error(`   ${String(error.message)}`);
    }
    console.error('   確認するポイント:');
    console.error('     • 鍵が壊れていないか（DECODER routines のエラーは鍵の形式が不正なことを示します）');
    console.error('     • Google Cloud Console で Drive / Sheets / Docs / Slides API が有効になっているか');
    console.error('     • サービスアカウントが無効化・削除されていないか');
  }
};

/**
 * HTTP サーバーの起動
 */
const startServer = async (): Promise<void> => {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║   Google Workspace MCP Server - トークンセットアップ       ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  const options = parseOptions(process.argv.slice(2));
  const paths = new WorkspacePaths();

  console.log(`📁 ホームディレクトリ: ${paths.home}`);
  console.log(`🏷️  アカウントラベル  : ${options.label.value}\n`);

  // サービスアカウント鍵が渡された場合は、認可フローを行わずに登録だけして終わる
  if (options.serviceAccountKeyPath !== undefined) {
    await registerServiceAccount(paths, options, options.serviceAccountKeyPath);
    return;
  }

  // 資格情報の検証
  console.log('🔍 資格情報を探しています...');
  const credentials = await resolveCredential(paths, options.label);
  console.log(`✅ 見つかりました: ${credentials.sourcePath}\n`);

  // すでにサービスアカウントが設定されているなら、ブラウザでの認可は不要
  if (credentials.credential.kind === 'service-account') {
    console.log('ℹ️  このアカウントはサービスアカウントで設定されています。ブラウザでの認可は不要です。\n');
    console.log(`   共有先アドレス: ${credentials.credential.clientEmail}`);
    console.log('   使いたいファイルやフォルダを、このアドレスに共有してください。\n');
    console.log(
      '   鍵を差し替える場合: npm run setup -- --account ' + options.label.value + ' --service-account <鍵のパス>',
    );
    return;
  }

  const oauthCredential = credentials.credential;

  // 既存トークンの上書き確認
  await confirmOverwrite(new TokenStore(paths.accountTokenPath(options.label)), options);

  // リダイレクト URI にポートが入るため、待ち受けを開始してから認証 URL を組み立てる。
  // ハンドラーが実行されるのは待ち受け開始後なので、この変数は必ず確定している。
  let redirectUri = '';

  const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url ?? '', true);

    if (parsedUrl.pathname !== '/oauth2callback') {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
      return;
    }

    const code = parsedUrl.query.code as string | undefined;
    const error = parsedUrl.query.error as string | undefined;

    if (error) {
      console.error(`\n❌ 認証エラー: ${error}`);
      res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(getErrorHtml(`認証が拒否されました: ${error}`));
      return;
    }

    if (!code) {
      console.error('\n❌ 認証コードが見つかりません');
      res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(getErrorHtml('認証コードが見つかりませんでした。'));
      return;
    }

    // 非同期処理を void でラップ
    void (async () => {
      try {
        console.log('\n🔄 認証コードをトークンに交換しています...');
        const tokens = await exchangeCodeForToken(oauthCredential.config, redirectUri, code);

        await persistAccount(paths, options, tokens);
        await testToken(oauthCredential.config, redirectUri, tokens);

        console.log('\n╔═══════════════════════════════════════════════════════════╗');
        console.log('║              🎉 セットアップが完了しました！               ║');
        console.log('╚═══════════════════════════════════════════════════════════╝\n');
        console.log('次のステップ:');
        console.log(`  • 別のアカウントを追加する: npm run setup -- --account <label>`);
        console.log(`  • ツール呼び出しでは account: "${options.label.value}" を指定します\n`);

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(getSuccessHtml(options.label.value));

        // サーバーを終了
        setTimeout(() => {
          server.close(() => {
            process.exit(0);
          });
        }, 1000);
      } catch (err) {
        console.error('\n❌ トークンの取得に失敗しました:');
        if (err && typeof err === 'object' && 'message' in err) {
          console.error(`   ${String(err.message)}`);
        }

        res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(getErrorHtml(err instanceof Error ? err.message : '不明なエラー'));
      }
    })();
  });

  const port = await listenOnAvailablePort(server, options, oauthCredential.type);
  redirectUri = `http://localhost:${String(port)}/oauth2callback`;

  const authUrl = new google.auth.OAuth2(
    oauthCredential.config.client_id,
    oauthCredential.config.client_secret,
    redirectUri,
  ).generateAuthUrl({
    access_type: 'offline',
    scope: OAUTH_SCOPES,
    prompt: 'consent',
  });

  console.log(`🚀 OAuth サーバーを起動しました: http://localhost:${String(port)}`);
  console.log('');
  console.log('📋 次の手順に従ってください:');
  console.log('');
  console.log('  1. 以下の URL をブラウザで開いてください:');
  console.log('');
  console.log(`     ${authUrl}`);
  console.log('');
  console.log(`  2. アカウント '${options.label.value}' として使う Google アカウントでログインしてください`);
  console.log('  3. 認証が完了すると、自動的にこのサーバーに戻ります');
  console.log('');
  console.log('⏳ 認証完了を待っています...\n');

  // 待ち受け開始後に起きたエラー（待ち受け失敗は listenOnAvailablePort が処理済み）
  server.on('error', (err) => {
    console.error('\n❌ サーバーエラー:', err);
    process.exit(1);
  });
};

// サーバー起動
startServer().catch((error: unknown) => {
  console.error('\n╔═══════════════════════════════════════════════════════════╗');
  console.error('║           ❌ セットアップに失敗しました                    ║');
  console.error('╚═══════════════════════════════════════════════════════════╝\n');

  if (error && typeof error === 'object' && 'message' in error) {
    console.error(`${String(error.message)}\n`);
  }

  console.error('トラブルシューティング:');
  console.error('  • credentials.json が正しく配置／マウントされているか確認');
  console.error('  • Google Cloud Console で OAuth 2.0 が有効化されているか確認');
  console.error('  • リダイレクト URI が http://localhost:8000/oauth2callback に設定されているか確認\n');

  process.exit(1);
});
