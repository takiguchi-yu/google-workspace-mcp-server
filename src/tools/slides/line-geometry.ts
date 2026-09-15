import type { slides_v1 } from 'googleapis';

/**
 * 線を始点・終点で受け取り、Slides API の矩形に直すヘルパー。
 *
 * createLine は始点・終点ではなく elementProperties（位置と大きさ）で線を受ける。
 * 線は矩形の対角線として描かれ、左上から右下でない向きは scale の符号で表す。
 * 負の scale を API が受けることは実機で確認済み（scaleX: -1 がそのまま保存される）。
 * 色・太さ・端の飾りは幾何とは別の話なので line-style.ts が受け持つ。
 */

/** 線の両端。スライドの左上を原点としたポイント */
export interface LineEnds {
  readonly startX: number;
  readonly startY: number;
  readonly endX: number;
  readonly endY: number;
}

/**
 * 始点・終点から createLine の elementProperties を組み立てる。
 *
 * 大きさは両端の差の絶対値、向きは scale の符号で表す。始点はそのまま transform の
 * translate になるので、`終点 = 始点 + size × scale` が成り立つ。
 *
 * @param pageObjectId 線を引くスライドの objectId
 * @param ends 線の両端（ポイント）
 * @throws 始点と終点が同じ場合（長さ 0 の線は引けない）
 */
export const toLineElementProperties = (
  pageObjectId: string,
  ends: LineEnds,
): slides_v1.Schema$PageElementProperties => {
  const deltaX = ends.endX - ends.startX;
  const deltaY = ends.endY - ends.startY;

  if (deltaX === 0 && deltaY === 0) {
    throw new Error('始点と終点が同じ位置です。長さのある線になるように指定してください。');
  }

  return {
    pageObjectId,
    size: {
      width: { magnitude: Math.abs(deltaX), unit: 'PT' },
      height: { magnitude: Math.abs(deltaY), unit: 'PT' },
    },
    transform: {
      scaleX: deltaX < 0 ? -1 : 1,
      scaleY: deltaY < 0 ? -1 : 1,
      translateX: ends.startX,
      translateY: ends.startY,
      unit: 'PT',
    },
  };
};
