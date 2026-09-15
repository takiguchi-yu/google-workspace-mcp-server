import type { slides_v1 } from 'googleapis';

/**
 * スライドの寸法をポイントで受け取り、Slides API の形に組み立てるヘルパー。
 *
 * 0.8.0 で追加したツールは寸法をポイント（PT）で受ける。スライドの標準サイズが
 * 720 × 405 pt なので、ポイントなら呼ぶ側が値をそのまま組み立てられるため。
 * 既存の EMU 系ツール（slides_add_shape / slides_add_text_box / slides_insert_image）は
 * 後方互換のため EMU のまま残してある（docs/adr/0004-points-for-new-slides-tools.md）。
 */

/** 1 ポイントあたりの EMU。API の Dimension は EMU と PT のどちらでも受ける */
export const EMU_PER_POINT = 12_700;

/** 16:9 スライドの標準の幅（ポイント） */
export const SLIDE_WIDTH_PT = 720;

/** 16:9 スライドの標準の高さ（ポイント） */
export const SLIDE_HEIGHT_PT = 405;

/** ポイントを EMU に直す。API が返す size は EMU なので、目標寸法を突き合わせるときに使う */
export const pointsToEmu = (points: number): number => points * EMU_PER_POINT;

/** EMU をポイントに直す。API から読んだ値を文面に出すときに使う */
export const emuToPoints = (emu: number): number => emu / EMU_PER_POINT;

/** 文面に出すための丸め。小数第 1 位まで残す */
export const roundPoints = (points: number): number => Math.round(points * 10) / 10;

/** 位置と大きさをポイントで受けるときの箱 */
export interface PointBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * 作成系リクエスト（createShape / createLine / createTable）の elementProperties を組み立てる。
 *
 * **作成時は size に実寸を渡す。** transform の scale は倍率（スカラー）であって寸法ではない。
 * 既存要素のリサイズはこの流儀では通らず、倍率の逆算が要る（element-transform.ts）。
 *
 * @param pageObjectId 要素を置くスライドの objectId
 * @param box 位置と大きさ（ポイント）
 */
export const toElementProperties = (pageObjectId: string, box: PointBox): slides_v1.Schema$PageElementProperties => ({
  pageObjectId,
  size: {
    width: { magnitude: box.width, unit: 'PT' },
    height: { magnitude: box.height, unit: 'PT' },
  },
  transform: { scaleX: 1, scaleY: 1, translateX: box.left, translateY: box.top, unit: 'PT' },
});

/** ポイントで受ける位置・大きさの引数スキーマ。作成系ツールの定義から展開して使う */
export const pointBoxSchema = {
  left: {
    type: 'number',
    description: 'Distance from the left edge of the slide, in points. A slide is 720 pt wide.',
  },
  top: {
    type: 'number',
    description: 'Distance from the top edge of the slide, in points. A slide is 405 pt tall.',
  },
  width: { type: 'number', description: 'Width in points.' },
  height: { type: 'number', description: 'Height in points.' },
} as const;

/**
 * スライドの中央に置いたときの位置を返す。
 *
 * 大きさだけを指定されたときに、残りの位置を決めるために使う。
 * 「省略したら中央」という約束を、一部だけ指定されたときにも保つため。
 *
 * @param width 要素の幅（ポイント）
 * @param height 要素の高さ（ポイント）
 */
export const centeredOn = (width: number, height: number): { left: number; top: number } => ({
  left: (SLIDE_WIDTH_PT - width) / 2,
  top: (SLIDE_HEIGHT_PT - height) / 2,
});
