import type { sheets_v4 } from 'googleapis';

/**
 * ツール引数の平たい条件指定を、Sheets API の BooleanCondition に組み立てる。
 *
 * 同じ BooleanCondition を条件付き書式とデータ入力規則の両方が使うが、**受け付ける
 * ConditionType はそれぞれ別の部分集合**で、列挙にあっても用途違いだと API に弾かれる。
 * どの集合を許すかは呼び出し側が渡し、ここは組み立てと判定だけを持つ。
 */

/**
 * 条件付き書式で使える ConditionType。
 *
 * 除外したもの: TEXT_NOT_EQ / TEXT_IS_EMAIL / TEXT_IS_URL / DATE_NOT_EQ / DATE_ON_OR_BEFORE /
 * DATE_ON_OR_AFTER / DATE_BETWEEN / DATE_NOT_BETWEEN / DATE_IS_VALID / ONE_OF_RANGE /
 * ONE_OF_LIST / BOOLEAN / FILTER_EXPRESSION。いずれも
 * `ConditionType 'X' is not supported in conditional formats.` で弾かれることを実機で確認している。
 */
export const CONDITIONAL_FORMAT_CONDITION_TYPES = [
  'NUMBER_GREATER',
  'NUMBER_GREATER_THAN_EQ',
  'NUMBER_LESS',
  'NUMBER_LESS_THAN_EQ',
  'NUMBER_EQ',
  'NUMBER_NOT_EQ',
  'NUMBER_BETWEEN',
  'NUMBER_NOT_BETWEEN',
  'TEXT_CONTAINS',
  'TEXT_NOT_CONTAINS',
  'TEXT_STARTS_WITH',
  'TEXT_ENDS_WITH',
  'TEXT_EQ',
  'DATE_EQ',
  'DATE_BEFORE',
  'DATE_AFTER',
  'BLANK',
  'NOT_BLANK',
  'CUSTOM_FORMULA',
] as const;

/**
 * データ入力規則で使える ConditionType。
 *
 * 条件付き書式とは集合が違い、こちらでは日付の範囲指定・リスト・チェックボックスが使える代わりに、
 * TEXT_STARTS_WITH / TEXT_ENDS_WITH / BLANK / NOT_BLANK が使えない。
 */
export const DATA_VALIDATION_CONDITION_TYPES = [
  'NUMBER_GREATER',
  'NUMBER_GREATER_THAN_EQ',
  'NUMBER_LESS',
  'NUMBER_LESS_THAN_EQ',
  'NUMBER_EQ',
  'NUMBER_NOT_EQ',
  'NUMBER_BETWEEN',
  'NUMBER_NOT_BETWEEN',
  'TEXT_CONTAINS',
  'TEXT_NOT_CONTAINS',
  'TEXT_EQ',
  'TEXT_IS_EMAIL',
  'TEXT_IS_URL',
  'DATE_EQ',
  'DATE_BEFORE',
  'DATE_AFTER',
  'DATE_ON_OR_BEFORE',
  'DATE_ON_OR_AFTER',
  'DATE_BETWEEN',
  'DATE_NOT_BETWEEN',
  'DATE_IS_VALID',
  'ONE_OF_RANGE',
  'ONE_OF_LIST',
  'CUSTOM_FORMULA',
  'BOOLEAN',
] as const;

/**
 * 平たい条件指定を BooleanCondition に変換する。
 *
 * @param value `{ type, values }` の形の条件指定
 * @param allowed この用途で受け付ける ConditionType
 * @param name エラー文面に出す引数名（`condition` など）
 * @throws 条件として解釈できない値や、許可集合にない type を渡した場合
 */
export const toBooleanCondition = (
  value: unknown,
  allowed: readonly string[],
  name: string,
): sheets_v4.Schema$BooleanCondition => {
  if (typeof value !== 'object' || value === null) {
    throw new Error(`${name} は { type, values } のオブジェクトで指定してください。`);
  }

  const { type, values } = value as Record<string, unknown>;

  if (typeof type !== 'string' || !allowed.includes(type)) {
    throw new Error(
      `${name}.type がこの用途で使える ConditionType ではありません（受け取った値: ${String(type)}）。\n` +
        `使える値: ${allowed.join(' / ')}`,
    );
  }

  const condition: sheets_v4.Schema$BooleanCondition = { type };

  if (Array.isArray(values) && values.length > 0) {
    condition.values = values.map((entry) => ({ userEnteredValue: String(entry) }));
  }

  return condition;
};

/**
 * フィルタの抽出条件で使える ConditionType。
 *
 * 条件付き書式で使える集合に、等しくないことを問う 2 つ（TEXT_NOT_EQ / DATE_NOT_EQ）を足したもの。
 * 入力規則だけで使える TEXT_IS_EMAIL / ONE_OF_LIST / BOOLEAN などは含まない。
 */
export const FILTER_CONDITION_TYPES = [...CONDITIONAL_FORMAT_CONDITION_TYPES, 'TEXT_NOT_EQ', 'DATE_NOT_EQ'] as const;
