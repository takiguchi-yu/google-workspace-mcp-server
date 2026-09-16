import type { slides_v1 } from 'googleapis';
import { CONTENT_ALIGNMENTS } from './content-alignment.js';
import { pickOptionalEnum } from './enum-argument.js';
import { DASH_STYLES } from './line-style.js';
import { toOptionalNumber } from './number-argument.js';
import { hexToRgb } from '../shared/color.js';

/**
 * 表の見た目（セルの塗り・セルの縦揃え・罫線）を組み立てるヘルパー。
 *
 * どの範囲にかけるかは table-range.ts、API の呼び出しはコマンドが受け持つ。
 * ここは値の検証と組み立てだけを持つ。
 */

/** 罫線を引く位置。Slides API の BorderPosition の全 9 値（実機で全値の通過を確認） */
export const BORDER_POSITIONS = [
  'ALL',
  'OUTER',
  'INNER',
  'INNER_HORIZONTAL',
  'INNER_VERTICAL',
  'TOP',
  'BOTTOM',
  'LEFT',
  'RIGHT',
] as const;

/** 塗りを消すときに渡す値。色の代わりに受ける */
const NO_FILL = 'NONE';

/**
 * 引数からセルの見た目と、変更する項目の一覧を組み立てる。
 *
 * @param args ツール引数（1 範囲ぶん）
 * @throws 色として読めない文字列、列挙に無い縦揃えを渡した場合
 */
export const toTableCellProperties = (
  args: Record<string, unknown>,
): { properties: slides_v1.Schema$TableCellProperties; fields: string[] } => {
  const properties: slides_v1.Schema$TableCellProperties = {};
  const fields: string[] = [];

  if (typeof args.fillColor === 'string') {
    properties.tableCellBackgroundFill =
      args.fillColor.toUpperCase() === NO_FILL
        ? { propertyState: 'NOT_RENDERED' }
        : { propertyState: 'RENDERED', solidFill: { color: { rgbColor: hexToRgb(args.fillColor) } } };
    fields.push('tableCellBackgroundFill');
  }

  const contentAlignment = pickOptionalEnum(args.contentAlignment, CONTENT_ALIGNMENTS, 'contentAlignment');

  if (contentAlignment !== undefined) {
    properties.contentAlignment = contentAlignment;
    fields.push('contentAlignment');
  }

  return { properties, fields };
};

/**
 * 引数から罫線の見た目と、変更する項目の一覧を組み立てる。
 *
 * **罫線は消せない。** 太さ 0 は API に拒否されるため、消したいときは
 * 背景と同じ色を指定することになる。
 *
 * @param args ツール引数（1 範囲ぶん）
 * @throws 色として読めない文字列、列挙に無い破線、0 以下の太さを渡した場合
 */
export const toTableBorderProperties = (
  args: Record<string, unknown>,
): { properties: slides_v1.Schema$TableBorderProperties; fields: string[] } => {
  const properties: slides_v1.Schema$TableBorderProperties = {};
  const fields: string[] = [];

  if (typeof args.color === 'string') {
    properties.tableBorderFill = { solidFill: { color: { rgbColor: hexToRgb(args.color) } } };
    fields.push('tableBorderFill');
  }

  const weight = toOptionalNumber(args.weight, 'weight');

  if (weight !== undefined) {
    if (weight <= 0) {
      throw new Error(
        `weight は 0 より大きい値で指定してください（受け取った値: ${String(weight)}）。罫線は消せないため、` +
          '見えなくしたいときは背景と同じ色を color に渡してください。',
      );
    }
    properties.weight = { magnitude: weight, unit: 'PT' };
    fields.push('weight');
  }

  const dashStyle = pickOptionalEnum(args.dashStyle, DASH_STYLES, 'dashStyle');

  if (dashStyle !== undefined) {
    properties.dashStyle = dashStyle;
    fields.push('dashStyle');
  }

  return { properties, fields };
};
