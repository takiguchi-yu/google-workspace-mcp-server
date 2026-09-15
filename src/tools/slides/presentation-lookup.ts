import type { slides_v1 } from 'googleapis';
import type { ElementGeometry } from './element-transform.js';
import type { PlaceholderRef } from './layout-placeholders.js';

/**
 * プレゼンテーションの現状を API から引くモジュール。
 *
 * Slides のツールで API を読むのはここだけに閉じる。変換ヘルパー（dimensions / element-transform /
 * line-geometry / layout-placeholders）は API クライアントを知らず、読んだ値だけを受け取る。
 * Sheets の sheet-id-resolver.ts と同じ役回り。
 */

/**
 * 要素の現在の size と transform を引く。グループの中の要素も探す。
 *
 * @param slides 認証済みの Slides API クライアント
 * @param presentationId 対象のプレゼンテーション
 * @param objectId 探す要素の objectId
 * @throws 要素が見つからない場合
 */
export const fetchElementGeometry = async (
  slides: slides_v1.Slides,
  presentationId: string,
  objectId: string,
): Promise<ElementGeometry> => {
  const response = await slides.presentations.get({
    presentationId,
    fields: 'slides/pageElements(objectId,size,transform,elementGroup)',
  });

  for (const slide of response.data.slides ?? []) {
    const found = findElement(slide.pageElements ?? [], objectId);

    if (found !== undefined) {
      return {
        widthEmu: found.size?.width?.magnitude ?? 0,
        heightEmu: found.size?.height?.magnitude ?? 0,
        transform: found.transform ?? {},
      };
    }
  }

  throw new Error(`要素 ${objectId} が見つかりません。slides_get_page で objectId を確かめてください。`);
};

/** 要素を深さ優先で探す。グループは children を持つ */
const findElement = (
  elements: readonly slides_v1.Schema$PageElement[],
  objectId: string,
): slides_v1.Schema$PageElement | undefined => {
  for (const element of elements) {
    if (element.objectId === objectId) {
      return element;
    }

    const found = findElement(element.elementGroup?.children ?? [], objectId);

    if (found !== undefined) {
      return found;
    }
  }

  return undefined;
};

/**
 * レイアウトが持つプレースホルダの一覧を引く。
 *
 * レイアウトはプレゼンテーションのマスターに属するため、テーマを差し替えると枠の構成も変わる。
 * 決め打ちの対応表ではなく毎回引くことで、テンプレートから起こしたプレゼンテーションでも
 * 「このレイアウトに本文の枠は無い」を呼ぶ前に言えるようにする。
 *
 * @param slides 認証済みの Slides API クライアント
 * @param presentationId 対象のプレゼンテーション
 * @param layoutName 探すレイアウトの名前（PredefinedLayout と同じ綴り）
 * @throws レイアウトが見つからない場合
 */
export const fetchLayoutPlaceholders = async (
  slides: slides_v1.Slides,
  presentationId: string,
  layoutName: string,
): Promise<PlaceholderRef[]> => {
  const response = await slides.presentations.get({
    presentationId,
    fields: 'layouts(layoutProperties/name,pageElements(shape/placeholder))',
  });

  const layouts = response.data.layouts ?? [];
  const layout = layouts.find((candidate) => candidate.layoutProperties?.name === layoutName);

  if (layout === undefined) {
    const names = layouts.flatMap((candidate) => {
      const name = candidate.layoutProperties?.name;
      return typeof name === 'string' ? [name] : [];
    });

    throw new Error(
      `このプレゼンテーションにレイアウト ${layoutName} がありません。\n使えるレイアウト: ${names.join(', ')}`,
    );
  }

  return (layout.pageElements ?? []).flatMap((element) => {
    const placeholder = element.shape?.placeholder;
    return typeof placeholder?.type === 'string' ? [{ type: placeholder.type, index: placeholder.index ?? 0 }] : [];
  });
};
