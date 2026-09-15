/**
 * レイアウトが持つプレースホルダ（タイトル・本文の枠）を選ぶヘルパー。
 *
 * createSlide でスライドを足すとき、タイトルと本文まで 1 回の batchUpdate で埋めるには
 * placeholderIdMappings で枠の objectId をこちらが決める必要がある。ところが枠の種類は
 * レイアウトによって違い（TITLE レイアウトのタイトルは TITLE ではなく CENTERED_TITLE、
 * CAPTION_ONLY にはタイトルが無い）、実在しない枠を指定すると batchUpdate ごと失敗する。
 * そこで、どの枠があるかは presentation-lookup.ts が API から読み、ここは選ぶ役だけを持つ。
 */

/** レイアウトの種類。Slides API の PredefinedLayout から、未指定を表す値を除いたもの */
export const PREDEFINED_LAYOUTS = [
  'BLANK',
  'CAPTION_ONLY',
  'TITLE',
  'TITLE_AND_BODY',
  'TITLE_AND_TWO_COLUMNS',
  'TITLE_ONLY',
  'SECTION_HEADER',
  'SECTION_TITLE_AND_DESCRIPTION',
  'ONE_COLUMN_TEXT',
  'MAIN_POINT',
  'BIG_NUMBER',
] as const;

/** レイアウト上の枠 1 つ。同じ種類が複数あるときは index で区別する */
export interface PlaceholderRef {
  readonly type: string;
  readonly index: number;
}

/** 埋めたい役割。ツール引数の title / body に対応する */
export type PlaceholderRole = 'title' | 'body';

/**
 * 役割ごとに、どの種類の枠を優先して使うか。
 *
 * 実機のレイアウト一覧で確かめた対応（0.8.0 時点）:
 * TITLE は CENTERED_TITLE + SUBTITLE、SECTION_TITLE_AND_DESCRIPTION は TITLE + SUBTITLE + BODY、
 * CAPTION_ONLY は BODY のみ、BLANK はどちらも持たない。
 */
const PREFERRED_TYPES: Readonly<Record<PlaceholderRole, readonly string[]>> = {
  title: ['TITLE', 'CENTERED_TITLE'],
  body: ['BODY', 'SUBTITLE'],
};

/** 役割をエラー文面に出すときの呼び名。役割が増えたら PREFERRED_TYPES と揃えてここにも足す */
const ROLE_LABELS: Readonly<Record<PlaceholderRole, string>> = {
  title: 'タイトル',
  body: '本文',
};

/** 役割の呼び名を返す */
export const labelOf = (role: PlaceholderRole): string => ROLE_LABELS[role];

/**
 * レイアウトの枠の一覧から、役割にあたる枠を 1 つ選ぶ。
 *
 * 同じ種類が複数あるレイアウト（TITLE_AND_TWO_COLUMNS の BODY は 2 つ）では、
 * index の小さいほうを選ぶ。
 *
 * @param placeholders レイアウトが持つ枠の一覧
 * @param role 埋めたい役割
 * @returns あてはまる枠。無ければ undefined
 */
export const pickPlaceholder = (
  placeholders: readonly PlaceholderRef[],
  role: PlaceholderRole,
): PlaceholderRef | undefined => {
  for (const type of PREFERRED_TYPES[role]) {
    const matched = placeholders.filter((placeholder) => placeholder.type === type).sort((a, b) => a.index - b.index);

    if (matched[0] !== undefined) {
      return matched[0];
    }
  }

  return undefined;
};

/** エラー文面に出すための、レイアウトが持つ枠の一覧 */
export const describePlaceholders = (placeholders: readonly PlaceholderRef[]): string =>
  placeholders.length === 0
    ? '（プレースホルダなし）'
    : placeholders.map((placeholder) => `${placeholder.type}#${String(placeholder.index)}`).join(', ');
