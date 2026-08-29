import { InvalidAccountLabelError } from './errors.js';

/**
 * ラベルとして許可する書式。
 * ディレクトリ名としてそのまま使うため、パス区切り・ドット・空白は許可しない。
 */
const LABEL_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * アカウントを一意に指す論理名。
 *
 * ツール引数・ディレクトリ名・エラー文面のすべてで使う唯一の識別子であり、
 * 生成時に書式を検証することでパストラバーサルを構造的に防ぐ。
 * 個人情報（メールアドレスなど）は保持しない。
 */
export class AccountLabel {
  readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  /** 文字列を検証してラベルにする。書式が不正なら InvalidAccountLabelError を投げる */
  static parse(input: string): AccountLabel {
    const label = AccountLabel.tryParse(input);

    if (label === null) {
      throw new InvalidAccountLabelError(input);
    }

    return label;
  }

  /** 書式が正しければラベルを、不正なら null を返す（設定ファイルの読み飛ばし用） */
  static tryParse(input: string): AccountLabel | null {
    const trimmed = input.trim();
    return LABEL_PATTERN.test(trimmed) ? new AccountLabel(trimmed) : null;
  }

  toString(): string {
    return this.value;
  }
}
