import type { slides_v1 } from 'googleapis';
import { pickOptionalEnum } from './enum-argument.js';
import { toNumber } from './number-argument.js';
import { hexToRgb } from '../shared/color.js';

/**
 * 線の見た目（色・太さ・破線・端の飾り）を組み立てるヘルパー。
 *
 * 線そのものと図形の枠線は API 上も同じ DashStyle を共有するので、列挙はここに 1 つだけ置く。
 * 線の位置と向きは幾何の話なので line-geometry.ts が受け持つ。
 */

/** 線の種類。Slides API の LineCategory から、未指定を表す値を除いたもの */
export const LINE_CATEGORIES = ['STRAIGHT', 'BENT', 'CURVED'] as const;

/** 破線の刻み。Slides API の DashStyle から、未指定を表す値を除いたもの */
export const DASH_STYLES = ['SOLID', 'DOT', 'DASH', 'DASH_DOT', 'LONG_DASH', 'LONG_DASH_DOT'] as const;

/** 線の端の飾り。Slides API の ArrowStyle から、未指定を表す値を除いたもの */
export const ARROW_STYLES = [
  'NONE',
  'STEALTH_ARROW',
  'FILL_ARROW',
  'FILL_CIRCLE',
  'FILL_SQUARE',
  'FILL_DIAMOND',
  'OPEN_ARROW',
  'OPEN_CIRCLE',
  'OPEN_SQUARE',
  'OPEN_DIAMOND',
] as const;

/** 線の見た目の引数スキーマ。ツール定義から展開して使う */
export const lineStyleSchema = {
  color: {
    type: 'string',
    description: 'Line color as an RGB hex color (e.g., "#1A73E8"). Defaults to the theme color.',
  },
  weight: { type: 'number', description: 'Line thickness in points (e.g., 2).' },
  dashStyle: { type: 'string', description: 'Dash pattern of the line.', enum: [...DASH_STYLES] },
  startArrow: {
    type: 'string',
    description: 'Decoration at the start point. NONE for a plain end.',
    enum: [...ARROW_STYLES],
  },
  endArrow: {
    type: 'string',
    description: 'Decoration at the end point. Use FILL_ARROW for a normal arrow.',
    enum: [...ARROW_STYLES],
  },
} as const;

/**
 * 引数から LineProperties と、変更する項目の一覧を組み立てる。
 *
 * 指定されなかった項目には触れない。fields が空なら、見た目の指定が 1 つも無かったということ。
 *
 * @param args ツール引数
 * @throws 色として読めない文字列、数値でない太さ、列挙に無い破線・飾りを渡した場合
 */
export const toLineProperties = (
  args: Record<string, unknown>,
): { lineProperties: slides_v1.Schema$LineProperties; fields: string[] } => {
  const lineProperties: slides_v1.Schema$LineProperties = {};
  const fields: string[] = [];

  if (typeof args.color === 'string') {
    lineProperties.lineFill = { solidFill: { color: { rgbColor: hexToRgb(args.color) } } };
    fields.push('lineFill');
  }
  if (args.weight !== undefined) {
    lineProperties.weight = { magnitude: toNumber(args.weight, 'weight'), unit: 'PT' };
    fields.push('weight');
  }

  for (const key of ['dashStyle', 'startArrow', 'endArrow'] as const) {
    const value = pickOptionalEnum(args[key], key === 'dashStyle' ? DASH_STYLES : ARROW_STYLES, key);

    if (value !== undefined) {
      lineProperties[key] = value;
      fields.push(key);
    }
  }

  return { lineProperties, fields };
};
