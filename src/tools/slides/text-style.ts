import type { slides_v1 } from 'googleapis';
import type { ToolArgs } from '../../types/mcp.js';
import { hexToRgb } from '../shared/color.js';

/**
 * 文字の見た目の指定を Slides API の TextStyle に組み立てるヘルパー。
 *
 * 作ると同時に飾りたい slides_add_text_box と、あとから変える slides_update_text_style が
 * 同じ引数の形を共有する。作成系ツールが見た目まで受けるのは、生成した objectId を
 * 受け取って次の呼び出しに渡す往復を減らすため。
 */

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

  return { style, fields };
};
