import type { slides_v1 } from 'googleapis';
import { pickOptionalEnum } from './enum-argument.js';
import { toOptionalNumber } from './number-argument.js';
import type { ToolArgs } from '../../types/mcp.js';
import { hexToRgb } from '../shared/color.js';

/**
 * 文字の見た目の指定を Slides API の TextStyle に組み立てるヘルパー。
 *
 * 作ると同時に飾りたい slides_add_text_box と、あとから変える slides_update_text_style が
 * 同じ引数の形を共有する。作成系ツールが見た目まで受けるのは、生成した objectId を
 * 受け取って次の呼び出しに渡す往復を減らすため。
 */

/** 文字の縦のずらし方。Slides API の BaselineOffset から、未指定を表す値を除いたもの */
export const BASELINE_OFFSETS = ['NONE', 'SUPERSCRIPT', 'SUBSCRIPT'] as const;

/** 指定できるフォントの太さ。実機で確かめたところ 100 刻みのみで、450 は拒否される */
const FONT_WEIGHTS = [100, 200, 300, 400, 500, 600, 700, 800, 900];

/** 文字の見た目の引数スキーマ。ツール定義から展開して使う */
export const textStyleSchema = {
  fontFamily: { type: 'string', description: 'Font family name (e.g., "Roboto", "Noto Sans JP").' },
  fontSize: { type: 'number', description: 'Font size in points (e.g., 24).' },
  foregroundColor: { type: 'string', description: 'Text color as an RGB hex color (e.g., "#202124").' },
  backgroundColor: { type: 'string', description: 'Highlight color behind the text as an RGB hex color.' },
  bold: { type: 'boolean', description: 'Whether the text is bold.' },
  italic: { type: 'boolean', description: 'Whether the text is italic.' },
  underline: { type: 'boolean', description: 'Whether the text is underlined.' },
  strikethrough: { type: 'boolean', description: 'Whether the text has a strikethrough.' },
  smallCaps: { type: 'boolean', description: 'Whether lowercase letters are rendered as smaller capitals.' },
  baselineOffset: {
    type: 'string',
    description: 'Raises or lowers the text. Superscript and subscript are also rendered smaller.',
    enum: [...BASELINE_OFFSETS],
  },
  fontWeight: {
    type: 'number',
    description:
      'Rendered weight of the font, in hundreds from 100 to 900 (400 is normal, 700 is bold). Requires fontFamily to be given in the same call.',
  },
  link: {
    type: 'string',
    description: 'Make the text a hyperlink to this URL. Use "NONE" to remove an existing link.',
  },
} as const;

/**
 * 引数から TextStyle と、変更する項目の一覧を組み立てる。
 *
 * 指定されなかった項目には触れない。fields が空なら、見た目の指定が 1 つも無かったということ。
 *
 * @param args ツール引数
 * @throws 色として解釈できない文字列を渡した場合
 */
export const toTextStyle = (args: ToolArgs): { style: slides_v1.Schema$TextStyle; fields: string[] } => {
  const style: slides_v1.Schema$TextStyle = {};
  const fields: string[] = [];

  for (const key of ['bold', 'italic', 'underline', 'strikethrough'] as const) {
    if (typeof args[key] === 'boolean') {
      style[key] = args[key];
      fields.push(key);
    }
  }

  if (typeof args.fontFamily === 'string') {
    style.fontFamily = args.fontFamily;
    fields.push('fontFamily');
  }
  if (typeof args.fontSize === 'number') {
    style.fontSize = { magnitude: args.fontSize, unit: 'PT' };
    fields.push('fontSize');
  }
  if (typeof args.foregroundColor === 'string') {
    style.foregroundColor = { opaqueColor: { rgbColor: hexToRgb(args.foregroundColor) } };
    fields.push('foregroundColor');
  }
  if (typeof args.backgroundColor === 'string') {
    style.backgroundColor = { opaqueColor: { rgbColor: hexToRgb(args.backgroundColor) } };
    fields.push('backgroundColor');
  }

  if (typeof args.smallCaps === 'boolean') {
    style.smallCaps = args.smallCaps;
    fields.push('smallCaps');
  }

  const baselineOffset = pickOptionalEnum(args.baselineOffset, BASELINE_OFFSETS, 'baselineOffset');
  if (baselineOffset !== undefined) {
    style.baselineOffset = baselineOffset;
    fields.push('baselineOffset');
  }

  const fontWeight = toOptionalNumber(args.fontWeight, 'fontWeight');
  if (fontWeight !== undefined) {
    if (!FONT_WEIGHTS.includes(fontWeight)) {
      throw new Error(
        `fontWeight は ${FONT_WEIGHTS.join(' / ')} のいずれかで指定してください（受け取った値: ${String(fontWeight)}）。`,
      );
    }
    if (typeof args.fontFamily !== 'string') {
      throw new Error('fontWeight を指定するときは fontFamily も渡してください（API が組で受け取るため）。');
    }
    style.weightedFontFamily = { fontFamily: args.fontFamily, weight: fontWeight };
    fields.push('weightedFontFamily');
  }

  if (typeof args.link === 'string') {
    // 項目名だけを fields に載せて値を省くと、その項目が消える（API の field mask の流儀）
    if (args.link.toUpperCase() !== 'NONE') {
      style.link = { url: args.link };
    }
    fields.push('link');
  }

  return { style, fields };
};
