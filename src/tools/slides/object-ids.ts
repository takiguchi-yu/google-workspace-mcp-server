/**
 * 複数の objectId を配列で受ける引数を検証するヘルパー。
 *
 * 重なり順・グループ化・グループ解除が同じ形の引数を取る。空配列や文字列以外が
 * 混ざったまま API に投げると、どの要素が悪いのか分からない文面が返るため手前で弾く。
 */

/**
 * objectId の配列を検証して返す。
 *
 * @param value ツール引数として受け取った値
 * @param name エラー文面に出す引数名
 * @param minimum 必要な最小の個数
 * @throws 配列でない、個数が足りない、空文字や文字列以外が混ざっている場合
 */
export const toObjectIds = (value: unknown, name: string, minimum: number): string[] => {
  if (!Array.isArray(value)) {
    throw new Error(`${name} は objectId の配列で指定してください。`);
  }
  if (value.length < minimum) {
    throw new Error(`${name} には objectId を ${String(minimum)} 個以上指定してください。`);
  }

  return value.map((entry, index) => {
    if (typeof entry !== 'string' || entry === '') {
      throw new Error(`${name}[${String(index)}] は空でない objectId の文字列で指定してください。`);
    }

    return entry;
  });
};
