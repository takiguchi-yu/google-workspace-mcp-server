import type { slides_v1 } from 'googleapis';
import { emuToPoints, pointsToEmu, roundPoints } from './dimensions.js';

/**
 * 既存の要素を動かす・大きさを変える・回すための行列を組み立てるヘルパー。
 *
 * **既存要素は size を変えられない。** updatePageElementTransform が受け取るのは transform だけで、
 * 実寸は `size × scale` で決まる。さらに Google 側が size を 3000000 EMU に正規化するため、
 * 「幅を 200pt にする」には現在の size を読んで倍率を逆算する必要がある。
 * 作成時（createShape / createTable）は size に実寸を渡せばよく、更新時とは流儀が違う。
 *
 * このモジュールは API クライアントも objectId も知らない。現在の値と目標値だけを受け取って
 * 新しい行列を返す。現在の値を引くのは presentation-lookup.ts の役割。
 */

/** API から読んだ要素の現在の姿。size は EMU */
export interface ElementGeometry {
  readonly widthEmu: number;
  readonly heightEmu: number;
  readonly transform: slides_v1.Schema$AffineTransform;
}

/** 変えたい項目だけを持つ目標。位置と大きさはポイント、回転は度 */
export interface TransformTarget {
  readonly left?: number | undefined;
  readonly top?: number | undefined;
  readonly width?: number | undefined;
  readonly height?: number | undefined;
  readonly rotation?: number | undefined;
}

/** 行列から読み取った、いまの位置・大きさ・向き。位置と大きさはポイント、回転は度 */
export interface Placement {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
  readonly rotation: number;
}

/**
 * 行列の成分を読む。API のレスポンスは 0 の成分を省くため、欠けていたら 0 とみなす。
 */
const componentOf = (transform: slides_v1.Schema$AffineTransform, key: 'scaleX' | 'scaleY' | 'shearX' | 'shearY') =>
  transform[key] ?? 0;

/**
 * 行列を「倍率 × 回転」に分解する。
 *
 * 回転 θ と倍率 (sx, sy) の合成は
 * `scaleX = sx·cosθ` / `shearY = sx·sinθ` / `shearX = -sy·sinθ` / `scaleY = sy·cosθ` なので、
 * x 列の長さを取れば sx、偏角を取れば θ が戻る。
 *
 * **sy は符号つきで返す。** slides_add_line は線の向きを scale の符号で表すため、
 * 鏡映（片方の軸だけが負）の要素が普通に存在する。長さだけを見て正の値に丸めると、
 * 位置を変えただけの呼び出しで線が裏返る。符号は行列式から戻す（`det = sx · sy`）。
 */
const decompose = (transform: slides_v1.Schema$AffineTransform) => {
  const a = componentOf(transform, 'scaleX');
  const b = componentOf(transform, 'shearX');
  const c = componentOf(transform, 'shearY');
  const d = componentOf(transform, 'scaleY');

  const scaleX = Math.hypot(a, c);

  return {
    scaleX,
    // x 列がつぶれている（幅 0 の縦線）ときは行列式が 0 になり符号を引けないので、y 列をそのまま使う
    scaleY: scaleX === 0 ? d : (a * d - b * c) / scaleX,
    radians: Math.atan2(c, a),
  };
};

/**
 * いまの行列から、人が読める位置・大きさ・向きを取り出す。
 *
 * 位置は要素の基準点（回転させる前の左上）であって、見た目の外接矩形の左上ではない。
 * 大きさは符号を外した実寸で返す。鏡映しているかどうかは向きの話なので、大きさには出さない。
 *
 * @param geometry API から読んだ要素の現在の姿
 */
export const toPlacement = (geometry: ElementGeometry): Placement => {
  const { scaleX, scaleY, radians } = decompose(geometry.transform);

  return {
    left: roundPoints(emuToPoints(geometry.transform.translateX ?? 0)),
    top: roundPoints(emuToPoints(geometry.transform.translateY ?? 0)),
    width: roundPoints(emuToPoints(Math.abs(scaleX) * geometry.widthEmu)),
    height: roundPoints(emuToPoints(Math.abs(scaleY) * geometry.heightEmu)),
    rotation: roundPoints((radians * 180) / Math.PI),
  };
};

/**
 * 目標の位置・大きさ・向きから、applyMode ABSOLUTE で送る行列を作る。
 *
 * 指定しなかった項目は、いまの行列の値をそのまま引き継ぐ。大きさを変えるときも、
 * 鏡映しているかどうか（線の向き）は元のまま残す。
 *
 * @param geometry API から読んだ要素の現在の姿
 * @param target 変えたい項目だけを持つ目標
 * @throws size が 0 の要素に大きさを指定した場合（倍率を逆算できない）
 */
export const toAbsoluteTransform = (
  geometry: ElementGeometry,
  target: TransformTarget,
): slides_v1.Schema$AffineTransform => {
  const current = decompose(geometry.transform);

  const scaleX = target.width === undefined ? current.scaleX : scaleFor(target.width, geometry.widthEmu, 'width');
  const scaleY =
    target.height === undefined
      ? current.scaleY
      : signOf(current.scaleY) * scaleFor(target.height, geometry.heightEmu, 'height');
  const radians = target.rotation === undefined ? current.radians : (target.rotation * Math.PI) / 180;

  const cos = Math.cos(radians);
  const sin = Math.sin(radians);

  return {
    scaleX: scaleX * cos,
    shearX: -scaleY * sin,
    shearY: scaleX * sin,
    scaleY: scaleY * cos,
    translateX: target.left === undefined ? (geometry.transform.translateX ?? 0) : pointsToEmu(target.left),
    translateY: target.top === undefined ? (geometry.transform.translateY ?? 0) : pointsToEmu(target.top),
    unit: 'EMU',
  };
};

/** 鏡映しているかどうかを引き継ぐための符号。0 は鏡映していないものとして扱う */
const signOf = (value: number): number => (value < 0 ? -1 : 1);

/** 目標の実寸を倍率に直す。API が返した size が分母になる */
const scaleFor = (points: number, sizeEmu: number, name: string): number => {
  if (sizeEmu === 0) {
    throw new Error(`この要素は大きさを持たないため ${name} を変えられません。`);
  }

  return pointsToEmu(points) / sizeEmu;
};
