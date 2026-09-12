/**
 * 16 進数の色指定を Google Workspace API の色に変換するヘルパー。
 *
 * Sheets も Slides も色を 0〜1 の RGB で受け取るが、ツールの引数は利用者と AI が
 * 読み書きする場所なので `#4285F4` の形で受ける。変換はこのモジュール 1 箇所に閉じる。
 */

/** 0〜1 の RGB。Sheets の Color、Slides の RgbColor のどちらとしても使える */
export interface RgbColor {
  red: number;
  green: number;
  blue: number;
}

/** `#4285F4` / `4285f4` / `#4a8` を受ける。それ以外は色として扱わない */
const HEX_COLOR_PATTERN = /^#?(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/**
 * 16 進数の色指定を 0〜1 の RGB に変換する。
 *
 * `#` の有無と大文字小文字は問わない。3 桁の短縮形（`#4a8`）は各桁を 2 回繰り返した
 * 6 桁として解釈する。
 *
 * @param hex 16 進数の色指定
 * @throws 色として解釈できない文字列を渡した場合。呼び出し元のコマンドは捕捉せず、
 *   BaseCommandService がエラー結果に変換する
 */
export const hexToRgb = (hex: string): RgbColor => {
  if (!HEX_COLOR_PATTERN.test(hex)) {
    throw new Error(`色は "#4285F4" のような 16 進数で指定してください（受け取った値: ${hex}）。`);
  }

  const digits = expand(hex.replace(/^#/, ''));

  return {
    red: channelOf(digits, 0),
    green: channelOf(digits, 2),
    blue: channelOf(digits, 4),
  };
};

/** 3 桁の短縮形を 6 桁に伸ばす。6 桁ならそのまま返す */
const expand = (digits: string): string =>
  digits.length === 3 ? [...digits].map((digit) => digit + digit).join('') : digits;

/** 6 桁のうち 2 桁を 0〜1 の値として読む */
const channelOf = (digits: string, offset: number): number =>
  Number.parseInt(digits.slice(offset, offset + 2), 16) / 255;
