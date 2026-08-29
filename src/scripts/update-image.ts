#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Docker イメージ差し替えスクリプト
 *
 * 公開済みの新しいバージョンを取得し、MCP クライアントの設定に固定されているタグを
 * 差し替え、不要になった旧イメージを片付けるまでを 1 コマンドで行う。
 *
 * タグは固定したままにする。`latest` は指す先が黙って変わるため、
 * 「今どのバージョンが動いているのか」が分からなくなるため使わない。
 *
 * 使い方:
 *   npm run update-image                 # 最新版へ差し替える
 *   npm run update-image -- 0.4.1        # バージョンを指定して差し替える
 *   npm run update-image -- --dry-run    # 何をするかだけ表示する
 */
import { execFile } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { latestVersionOf, pinnedVersionOf, withImageTag } from './image-tag.js';

const execFileAsync = promisify(execFile);

/** 公開先の Docker リポジトリ */
const DEFAULT_IMAGE = 'takigu1/google-workspace-mcp-server';

/** MCP クライアントの設定ファイル */
const DEFAULT_CONFIG_PATH = path.join(os.homedir(), '.claude.json');

/** コマンドラインの指定内容 */
interface Options {
  /** 差し替え先のバージョン。省略時は公開済みの最新版 */
  version: string | null;
  image: string;
  configPath: string;
  /** 実際には変更せず、何をするかだけ表示する */
  dryRun: boolean;
  /** 旧イメージを残す */
  keepOld: boolean;
}

const parseOptions = (argv: readonly string[]): Options => {
  const options: Options = {
    version: null,
    image: DEFAULT_IMAGE,
    configPath: DEFAULT_CONFIG_PATH,
    dryRun: false,
    keepOld: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] ?? '';
    if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--keep-old') {
      options.keepOld = true;
    } else if (arg === '--image') {
      options.image = argv[++i] ?? options.image;
    } else if (arg === '--config') {
      options.configPath = argv[++i] ?? options.configPath;
    } else if (!arg.startsWith('-')) {
      options.version = arg;
    }
  }

  return options;
};

/** Docker Hub からタグ一覧を引く */
const fetchTagNames = async (image: string): Promise<string[]> => {
  const endpoint = `https://hub.docker.com/v2/repositories/${image}/tags?page_size=100&ordering=last_updated`;
  const response = await fetch(endpoint);

  if (!response.ok) {
    throw new Error(`タグ一覧を取得できませんでした (HTTP ${String(response.status)}): ${endpoint}`);
  }

  const body = (await response.json()) as { results?: { name?: unknown }[] };

  return (body.results ?? []).flatMap((result) => (typeof result.name === 'string' ? [result.name] : []));
};

/** そのイメージがローカルにあるか */
const imageExists = async (imageWithTag: string): Promise<boolean> => {
  const { stdout } = await execFileAsync('docker', ['images', '-q', imageWithTag]);
  return stdout.trim() !== '';
};

/**
 * そのイメージを使っているコンテナの ID を返す。
 * 停止中のコンテナもイメージを掴んだままなので、`-a` を付けて両方を見る。
 */
const containersUsing = async (imageWithTag: string): Promise<string[]> => {
  const { stdout } = await execFileAsync('docker', [
    'ps',
    '-a',
    '--filter',
    `ancestor=${imageWithTag}`,
    '--format',
    '{{.ID}}',
  ]);
  return stdout.split('\n').filter((line) => line !== '');
};

const docker = async (...args: string[]): Promise<void> => {
  console.log(`$ docker ${args.join(' ')}`);
  const { stdout } = await execFileAsync('docker', args);
  if (stdout.trim() !== '') {
    console.log(stdout.trim());
  }
};

const main = async (): Promise<void> => {
  const options = parseOptions(process.argv.slice(2));
  const version = options.version ?? latestVersionOf(await fetchTagNames(options.image));

  if (version === null) {
    throw new Error(`公開済みのバージョンが見つかりませんでした: ${options.image}`);
  }

  const configText = await fs.readFile(options.configPath, 'utf8');
  const previousVersion = pinnedVersionOf(configText, options.image);

  if (previousVersion === null) {
    throw new Error(`設定に ${options.image} のイメージ指定が見つかりませんでした: ${options.configPath}`);
  }
  if (previousVersion === version) {
    console.log(`✅ すでに ${options.image}:${version} を指しています。差し替えは不要です。`);
    return;
  }

  console.log(`${options.image}: ${previousVersion} → ${version}`);

  if (options.dryRun) {
    console.log('--dry-run のため、pull・設定の書き換え・旧イメージの削除は行いません。');
    return;
  }

  await docker('pull', `${options.image}:${version}`);

  const backupPath = await saveConfig(options.configPath, withImageTag(configText, options.image, version));
  console.log(`✅ ${options.configPath} のタグを ${version} に更新しました（控え: ${backupPath}）`);

  await removeOldImage(options, previousVersion);

  console.log('\n次の一手: Claude Code を再起動するか /mcp で再接続すると、新しいイメージで起動します。');
};

/**
 * 設定を保存し、書き換え前の控えのパスを返す。
 *
 * 利用者の設定ファイルは他の設定も同居しているため、壊さないための備えを 2 つ置く。
 * 書き込みは一時ファイル + rename による原子的置換で行い、途中で落ちても半端な状態を残さない。
 * さらに、差し替え後の内容が JSON として妥当であることを保存前に確かめる。
 */
const saveConfig = async (configPath: string, text: string): Promise<string> => {
  JSON.parse(text) as unknown;

  const backupPath = `${configPath}.bak`;
  await fs.copyFile(configPath, backupPath);

  // rename を原子的にするため、一時ファイルは同じディレクトリに作る
  const tempPath = `${configPath}.${String(process.pid)}.tmp`;
  await fs.writeFile(tempPath, text, 'utf8');
  await fs.rename(tempPath, configPath);

  return backupPath;
};

/** 旧イメージを片付ける。まだ使っているコンテナがあれば消さずに知らせる */
const removeOldImage = async (options: Options, previousVersion: string): Promise<void> => {
  const oldImage = `${options.image}:${previousVersion}`;

  if (options.keepOld) {
    console.log(`--keep-old のため ${oldImage} は残します。`);
    return;
  }

  if (!(await imageExists(oldImage))) {
    return;
  }

  const containers = await containersUsing(oldImage);
  if (containers.length > 0) {
    console.log(
      `⚠️  ${oldImage} を使っているコンテナが残っています (${containers.join(', ')})。\n` +
        `   新しいイメージに入れ替わってから、docker rmi ${oldImage} で削除してください。`,
    );
    return;
  }

  // 差し替え自体は済んでいるため、後片付けの失敗で異常終了にはしない
  try {
    await docker('rmi', oldImage);
  } catch (error) {
    console.log(`⚠️  ${oldImage} を削除できませんでした: ${error instanceof Error ? error.message : String(error)}`);
  }
};

await main().catch((error: unknown) => {
  console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
