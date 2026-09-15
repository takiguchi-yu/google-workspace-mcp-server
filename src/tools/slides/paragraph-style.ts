import type { slides_v1 } from 'googleapis';
import { pickEnum } from './enum-argument.js';
import { toOptionalNumber } from './number-argument.js';

/**
 * 段落の書式（揃え・行間・インデント・段落前後の空き）を組み立てるヘルパー。
 *
 * 段落は文字とは別の書式の単位で、slides_update_paragraph_style が全項目を、
 * slides_add_text_box が揃えだけを受ける。両方が同じ列挙と同じ組み立てを共有する。
 * 長さはすべてポイント（ADR 0004）。
 */

/** 段落の揃え方。Slides API の Alignment から、未指定を表す値を除いたもの */
export const ALIGNMENTS = ['START', 'CENTER', 'END', 'JUSTIFIED'] as const;

/** 長さで受ける段落の項目。すべてポイント */
const LENGTH_KEYS = ['spaceAbove', 'spaceBelow', 'indentStart', 'indentEnd', 'indentFirstLine'] as const;

/** 段落の書式の引数スキーマ。ツール定義から展開して使う */
export const paragraphStyleSchema = {
  alignment: {
    type: 'string',
    description: 'Horizontal alignment of the paragraph. START is left in a left-to-right language.',
    enum: [...ALIGNMENTS],
  },
  lineSpacing: {
    type: 'number',
    description: 'Line spacing as a percentage of normal: 100 is single spacing, 150 is one-and-a-half.',
  },
  spaceAbove: { type: 'number', description: 'Extra space above the paragraph, in points.' },
  spaceBelow: { type: 'number', description: 'Extra space below the paragraph, in points.' },
  indentStart: { type: 'number', description: 'Indent of the whole paragraph from the start side, in points.' },
  indentEnd: { type: 'number', description: 'Indent of the whole paragraph from the end side, in points.' },
  indentFirstLine: { type: 'number', description: 'Extra indent of the first line only, in points.' },
} as const;

/**
 * 引数から ParagraphStyle と、変更する項目の一覧を組み立てる。
 *
 * 指定されなかった項目には触れない。fields が空なら、書式の指定が 1 つも無かったということ。
 *
 * @param args ツール引数
 * @throws 列挙に無い揃え方、数値でない長さを渡した場合
 */
export const toParagraphStyle = (
  args: Record<string, unknown>,
): { style: slides_v1.Schema$ParagraphStyle; fields: string[] } => {
  const style: slides_v1.Schema$ParagraphStyle = {};
  const fields: string[] = [];

  if (args.alignment !== undefined) {
    style.alignment = pickEnum(args.alignment, ALIGNMENTS, 'alignment');
    fields.push('alignment');
  }

  const lineSpacing = toOptionalNumber(args.lineSpacing, 'lineSpacing');
  if (lineSpacing !== undefined) {
    style.lineSpacing = lineSpacing;
    fields.push('lineSpacing');
  }

  for (const key of LENGTH_KEYS) {
    const points = toOptionalNumber(args[key], key);

    if (points !== undefined) {
      style[key] = { magnitude: points, unit: 'PT' };
      fields.push(key);
    }
  }

  return { style, fields };
};
