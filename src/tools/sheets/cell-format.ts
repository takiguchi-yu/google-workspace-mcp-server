import type { sheets_v4 } from 'googleapis';
import { hexToRgb } from '../shared/color.js';

/**
 * ツール引数の平たい書式指定を、Sheets API の CellFormat に組み立てる。
 *
 * Sheets API は「指定した項目だけを変える」ためにフィールドマスクを要求する。
 * マスクに載せ忘れた項目は変更されず、逆に載せた項目は値が無ければ消える。
 * 組み立てとマスクの生成が離れているとこの取り違えが起きるので、両方をここで作る。
 */

/** 組み立てた書式と、それに対応するフィールドマスク（`userEnteredFormat` からの相対パス） */
export interface CellFormatResult {
  format: sheets_v4.Schema$CellFormat;
  fields: readonly string[];
}

/** 横位置の指定として受け付ける値 */
export const HORIZONTAL_ALIGNMENTS = ['LEFT', 'CENTER', 'RIGHT'] as const;

/** 縦位置の指定として受け付ける値 */
export const VERTICAL_ALIGNMENTS = ['TOP', 'MIDDLE', 'BOTTOM'] as const;

/** 折り返しの指定として受け付ける値 */
export const WRAP_STRATEGIES = ['OVERFLOW_CELL', 'LEGACY_WRAP', 'CLIP', 'WRAP'] as const;

/** 数値書式の種類として受け付ける値 */
export const NUMBER_FORMAT_TYPES = [
  'TEXT',
  'NUMBER',
  'PERCENT',
  'CURRENCY',
  'DATE',
  'TIME',
  'DATE_TIME',
  'SCIENTIFIC',
] as const;

/**
 * 平たい書式指定を CellFormat に変換する。指定されなかった項目はマスクにも載らない。
 *
 * @param args 1 範囲ぶんの書式指定。範囲そのもの（`range`）は無視する
 * @throws 色として解釈できない値や、列挙にない配置指定を渡した場合
 */
export const toCellFormat = (args: Record<string, unknown>): CellFormatResult => {
  const format: sheets_v4.Schema$CellFormat = {};
  const textFormat: sheets_v4.Schema$TextFormat = {};
  const fields: string[] = [];

  if (typeof args.backgroundColor === 'string') {
    format.backgroundColor = hexToRgb(args.backgroundColor);
    fields.push('backgroundColor');
  }

  for (const key of ['bold', 'italic', 'underline', 'strikethrough'] as const) {
    const value = args[key];
    if (typeof value === 'boolean') {
      textFormat[key] = value;
      fields.push(`textFormat.${key}`);
    }
  }

  if (typeof args.fontColor === 'string') {
    textFormat.foregroundColor = hexToRgb(args.fontColor);
    fields.push('textFormat.foregroundColor');
  }
  if (typeof args.fontSize === 'number') {
    textFormat.fontSize = args.fontSize;
    fields.push('textFormat.fontSize');
  }
  if (typeof args.fontFamily === 'string') {
    textFormat.fontFamily = args.fontFamily;
    fields.push('textFormat.fontFamily');
  }

  if (Object.keys(textFormat).length > 0) {
    format.textFormat = textFormat;
  }

  const horizontalAlignment = pickEnum(args.horizontalAlignment, HORIZONTAL_ALIGNMENTS, 'horizontalAlignment');
  if (horizontalAlignment !== undefined) {
    format.horizontalAlignment = horizontalAlignment;
    fields.push('horizontalAlignment');
  }

  const verticalAlignment = pickEnum(args.verticalAlignment, VERTICAL_ALIGNMENTS, 'verticalAlignment');
  if (verticalAlignment !== undefined) {
    format.verticalAlignment = verticalAlignment;
    fields.push('verticalAlignment');
  }

  const wrapStrategy = pickEnum(args.wrapStrategy, WRAP_STRATEGIES, 'wrapStrategy');
  if (wrapStrategy !== undefined) {
    format.wrapStrategy = wrapStrategy;
    fields.push('wrapStrategy');
  }

  const numberFormat = toNumberFormat(args.numberFormat);
  if (numberFormat !== null) {
    format.numberFormat = numberFormat;
    fields.push('numberFormat');
  }

  return { format, fields };
};

/** 列挙にある値だけを通す。未指定は undefined、列挙外はエラー */
const pickEnum = <T extends string>(value: unknown, allowed: readonly T[], name: string): T | undefined => {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value === 'string' && (allowed as readonly string[]).includes(value)) {
    return value as T;
  }

  throw new Error(`${name} は ${allowed.join(' / ')} のいずれかで指定してください（受け取った値: ${String(value)}）。`);
};

/** 数値書式の指定を NumberFormat に変換する。指定が無ければ null */
const toNumberFormat = (value: unknown): sheets_v4.Schema$NumberFormat | null => {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== 'object') {
    throw new Error('numberFormat は { type, pattern } のオブジェクトで指定してください。');
  }

  const { type, pattern } = value as Record<string, unknown>;
  const numberFormat: sheets_v4.Schema$NumberFormat = {
    type: pickEnum(type, NUMBER_FORMAT_TYPES, 'numberFormat.type') ?? 'NUMBER',
  };

  if (typeof pattern === 'string') {
    numberFormat.pattern = pattern;
  }

  return numberFormat;
};
