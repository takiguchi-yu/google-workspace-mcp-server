import * as fs from 'fs/promises';
import path from 'path';
import type { Credentials } from 'google-auth-library';

/**
 * 1 アカウント分のトークンファイルを読み書きするクラス。
 *
 * 書き込みは一時ファイル + rename による原子的置換で行う。途中でプロセスが落ちても
 * トークンファイルが半端な状態で残らず、再認可をやり直す必要がなくなる。
 * 同一プロセス内の同時更新はキューで直列化する。
 */
export class TokenStore {
  private readonly tokenPath: string;
  /** 書き込みを直列化するためのキュー */
  private queue: Promise<void> = Promise.resolve();

  constructor(tokenPath: string) {
    this.tokenPath = tokenPath;
  }

  /** このストアが読み書きするファイルのパス（エラーメッセージ用） */
  get path(): string {
    return this.tokenPath;
  }

  /** トークンを読む。ファイルが無い・壊れている場合は null */
  async read(): Promise<Credentials | null> {
    try {
      const content = await fs.readFile(this.tokenPath, 'utf8');
      const parsed: unknown = JSON.parse(content);

      // 空オブジェクトは「touch しただけの空ファイル」と区別がつかないため未保存扱いにする
      if (parsed === null || typeof parsed !== 'object' || Object.keys(parsed).length === 0) {
        return null;
      }

      return parsed as Credentials;
    } catch {
      return null;
    }
  }

  /** トークンが保存されているか */
  async exists(): Promise<boolean> {
    return (await this.read()) !== null;
  }

  /** トークンを丸ごと置き換える */
  async save(credentials: Credentials): Promise<void> {
    await this.enqueue(() => this.writeAtomically(credentials));
  }

  /**
   * ディスク上の最新値に patch を重ねて保存する。
   *
   * リフレッシュ時に Google から渡される値には refresh_token が含まれないことがあるため、
   * 毎回読み直してからマージする。こうすることで、別プロセスが更新した refresh_token を
   * こちらが抱えている古い値で上書きしてしまう事故を防ぐ。
   */
  async merge(patch: Credentials): Promise<void> {
    await this.enqueue(async () => {
      const current = (await this.read()) ?? {};
      await this.writeAtomically({ ...current, ...patch });
    });
  }

  /** 直前の書き込みの完了を待ってから task を実行する */
  private enqueue(task: () => Promise<void>): Promise<void> {
    const next = this.queue.then(task, task);
    this.queue = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }

  private async writeAtomically(credentials: Credentials): Promise<void> {
    await fs.mkdir(path.dirname(this.tokenPath), { recursive: true });

    // rename を原子的にするため、一時ファイルは同じディレクトリに作る
    const tempPath = `${this.tokenPath}.${String(process.pid)}.tmp`;

    // トークンは認証情報そのものなので、所有者だけが読める権限で書く
    await fs.writeFile(tempPath, `${JSON.stringify(credentials, null, 2)}\n`, { mode: 0o600 });
    await fs.rename(tempPath, this.tokenPath);
  }
}
