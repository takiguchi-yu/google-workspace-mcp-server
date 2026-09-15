/**
 * 列挙で受ける引数を検証するヘルパー。
 *
 * 0.6.2 で shapeType と ConditionType の列挙に API が受け付けない値が混ざっていた前例があり、
 * 宣言した値は実機で通してから確定させている。それでも呼ぶ側が列挙外の値を渡すことはあるので、
 * API に投げる前に「受け付ける値」を文面で示して弾く。
 */

/**
 * 列挙の値を検証して返す。
 *
 * @param value ツール引数として受け取った値
 * @param allowed 受け付ける値
 * @param name エラー文面に出す引数名
 * @throws 文字列でない、または列挙に無い値を渡した場合
 */
export const pickEnum = <T extends string>(value: unknown, allowed: readonly T[], name: string): T => {
  if (typeof value !== 'string' || !(allowed as readonly string[]).includes(value)) {
    throw new Error(
      `${name} は ${allowed.join(' / ')} のいずれかで指定してください（受け取った値: ${String(value)}）。`,
    );
  }

  return value as T;
};

/**
 * 省略できる列挙の値を検証して返す。省略されたら undefined を返す。
 *
 * @param value ツール引数として受け取った値
 * @param allowed 受け付ける値
 * @param name エラー文面に出す引数名
 * @throws 指定されたが列挙に無い値だった場合
 */
export const pickOptionalEnum = <T extends string>(
  value: unknown,
  allowed: readonly T[],
  name: string,
): T | undefined => (value === undefined ? undefined : pickEnum(value, allowed, name));
