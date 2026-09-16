/**
 * A1 記法の列の記号と 0 始まりの列番号を相互に変換するヘルパー。
 *
 * Sheets の書式ツールは範囲を A1 記法で受け、Slides の表も同じ流儀に揃えた（ADR 0001）。
 * 記号と番号の対応は 26 進数の数え方そのもので、どちらのサービスにも属さないため
 * shared に置く。色の変換（color.ts）を 1 箇所に集約したのと同じ理由。
 */

/** アルファベットの桁数。列番号は 26 進数（A=1）で数える */
const LETTER_RADIX = 26;

/** `A` の符号位置。桁の計算の基準になる */
const LETTER_A = 'A'.codePointAt(0)!;

/**
 * 列の記号を 0 始まりの列番号に変換する。`A` は 0、`Z` は 25、`AA` は 26。
 *
 * @param letters 列の記号。大文字小文字は問わない
 */
export const columnIndexOf = (letters: string): number => {
  let index = 0;

  for (const letter of letters.toUpperCase()) {
    index = index * LETTER_RADIX + (letter.codePointAt(0)! - LETTER_A + 1);
  }

  return index - 1;
};

/**
 * 0 始まりの列番号を列の記号に戻す。0 は `A`、25 は `Z`、26 は `AA`。
 *
 * @param index 0 始まりの列番号
 */
export const columnLettersOf = (index: number): string => {
  let letters = '';

  for (let remaining = index; remaining >= 0; remaining = Math.floor(remaining / LETTER_RADIX) - 1) {
    letters = String.fromCodePoint((remaining % LETTER_RADIX) + LETTER_A) + letters;
  }

  return letters;
};
