/**
 * イメージタグの読み書き。
 *
 * 「公開済みのタグ一覧から最新版を選ぶ」「設定に固定されたタグを差し替える」という
 * 判断だけを持ち、Docker やファイルシステムには触れない。
 */

/** `0.4.1` のような、リリースバージョンだけを表すタグ */
const RELEASE_TAG_PATTERN = /^(\d+)\.(\d+)\.(\d+)$/;

/**
 * タグ一覧から最新のリリースバージョンを選ぶ。
 *
 * `latest` やプレリリースは「どのバージョンか」が一意に決まらないため候補にしない。
 * 比較は辞書順ではなく数値で行う（`0.10.0` は `0.9.0` より新しい）。
 *
 * @param tagNames Docker リポジトリのタグ名
 * @returns 最新のリリースバージョン。候補が無ければ null
 */
export const latestVersionOf = (tagNames: readonly string[]): string | null => {
  const versions = tagNames.flatMap((tag) => {
    const matched = RELEASE_TAG_PATTERN.exec(tag);
    return matched === null ? [] : [{ tag, order: [Number(matched[1]), Number(matched[2]), Number(matched[3])] }];
  });

  const newest = versions.reduce<(typeof versions)[number] | null>(
    (best, candidate) => (best === null || isNewer(candidate.order, best.order) ? candidate : best),
    null,
  );

  return newest?.tag ?? null;
};

/**
 * 設定に固定されているイメージのバージョンを返す。固定されていなければ null。
 *
 * @param configText 設定ファイルの中身
 * @param image 対象のイメージ
 */
export const pinnedVersionOf = (configText: string, image: string): string | null =>
  imageReference(image).exec(configText)?.[1] ?? null;

/**
 * 設定に固定されているイメージタグを差し替えた中身を返す。
 *
 * 設定ファイル全体を書き直すと利用者の他の設定まで整形し直してしまうため、
 * イメージ参照の文字列だけを置き換える。
 *
 * @param configText 設定ファイルの中身
 * @param image 差し替え対象のイメージ
 * @param version 差し替え後のバージョン
 */
export const withImageTag = (configText: string, image: string, version: string): string =>
  configText.replaceAll(imageReference(image), `"${image}:${version}"`);

/** 設定に現れるイメージ参照。JSON の配列要素なので、引用符ごと照合して別イメージへの誤爆を防ぐ */
const imageReference = (image: string): RegExp => new RegExp(`"${escapeForRegExp(image)}:(\\d+\\.\\d+\\.\\d+)"`, 'g');

/** 左のバージョンが右より新しいか */
const isNewer = (left: readonly number[], right: readonly number[]): boolean => {
  for (let i = 0; i < left.length; i++) {
    const a = left[i] ?? 0;
    const b = right[i] ?? 0;
    if (a !== b) {
      return a > b;
    }
  }

  return false;
};

/** 正規表現のメタ文字を打ち消す */
const escapeForRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
