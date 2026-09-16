/**
 * 枠の中で中身を縦のどこに置くかを表す値。
 *
 * 図形（ShapeProperties）と表のセル（TableCellProperties）が同じ列挙を共有するため、
 * どちらのモジュールにも属さない場所に置く。横の揃えは段落の書式なので
 * paragraph-style.ts の ALIGNMENTS が受け持つ。
 */

/** Slides API の ContentAlignment のうち、実機で通る 3 値 */
export const CONTENT_ALIGNMENTS = ['TOP', 'MIDDLE', 'BOTTOM'] as const;
