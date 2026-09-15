import type { slides_v1 } from 'googleapis';

/**
 * 文字の範囲指定を Slides API の Range に直すヘルパー。
 *
 * 範囲は省略したら要素のテキスト全体、指定するなら 0 始まりの文字 index で受ける。
 * 既存の slides_update_text_style と同じ流儀で、段落系のツールもここを共有する。
 */

/**
 * 開始・終了の index を Range に直す。どちらも省略されたときは全体を指す。
 *
 * 片方だけを指定するのは受け付けない。「startIndex だけ渡したのに全体にかかった」という
 * 取り違えは、書式を戻す手立てが無いまま全文の見た目を壊すため。
 *
 * @param startIndex 0 始まりの開始位置
 * @param endIndex 終了位置（この位置は含まない）
 * @throws 片方だけ指定した、負の値、開始が終了以上の場合
 */
export const toTextRange = (startIndex: unknown, endIndex: unknown): slides_v1.Schema$Range => {
  const hasStart = startIndex !== undefined;
  const hasEnd = endIndex !== undefined;

  if (!hasStart && !hasEnd) {
    return { type: 'ALL' };
  }
  if (hasStart !== hasEnd) {
    throw new Error('範囲を指定するときは startIndex と endIndex の両方を渡してください。');
  }
  if (typeof startIndex !== 'number' || typeof endIndex !== 'number') {
    throw new Error('startIndex と endIndex は数値で指定してください。');
  }
  if (!Number.isInteger(startIndex) || !Number.isInteger(endIndex)) {
    throw new Error('startIndex と endIndex は整数で指定してください。');
  }
  if (startIndex < 0) {
    throw new Error(`startIndex は 0 以上で指定してください（受け取った値: ${String(startIndex)}）。`);
  }
  if (endIndex <= startIndex) {
    throw new Error(
      `endIndex は startIndex より大きい値で指定してください（受け取った値: ${String(startIndex)} / ${String(endIndex)}）。`,
    );
  }

  return { type: 'FIXED_RANGE', startIndex, endIndex };
};

/** 文字範囲の引数スキーマ。範囲を受けるツールの定義から展開して使う */
export const textRangeSchema = {
  startIndex: {
    type: 'number',
    description: 'Zero-based start of the character range. Omit both indexes to apply to all text.',
  },
  endIndex: {
    type: 'number',
    description: 'Zero-based end of the character range, exclusive. Required when startIndex is given.',
  },
} as const;
