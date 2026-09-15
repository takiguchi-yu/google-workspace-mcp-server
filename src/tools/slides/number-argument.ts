/**
 * 数値で受ける引数を検証するヘルパー。
 *
 * 寸法・角度・行間・挿入位置と、数値で受ける引数は 1 つのツールに何本もある。
 * 検証せずに API へ渡すと「Invalid value at ...」としか返らず、どの引数が悪いのか分からない。
 * 列挙の enum-argument.ts、objectId の配列の object-ids.ts と同じ役回り。
 */

/**
 * 省略できない数値の引数を読む。
 *
 * @param value ツール引数として受け取った値
 * @param name エラー文面に出す引数名
 * @throws 省略された、数値でない、または有限でない値を渡した場合
 */
export const toNumber = (value: unknown, name: string): number => {
  if (value === undefined) {
    throw new Error(`${name} が指定されていません。`);
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${name} は数値で指定してください（受け取った値: ${String(value)}）。`);
  }

  return value;
};

/**
 * 省略できる数値の引数を読む。指定が無ければ undefined を返す。
 *
 * @param value ツール引数として受け取った値
 * @param name エラー文面に出す引数名
 * @throws 指定されたが、数値でない、または有限でない値だった場合
 */
export const toOptionalNumber = (value: unknown, name: string): number | undefined =>
  value === undefined ? undefined : toNumber(value, name);
