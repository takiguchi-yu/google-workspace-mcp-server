# スライドの装飾機能の拡充（0.8.0 予定）

Slides API v1 の 43 種のリクエストのうち、0.7.0 時点のツールが使っているのは 11 種。
文字単位のスタイルはあるのに段落単位が丸ごと無く、スライドは複製でしか増やせない。
装飾の穴を 10 本のツールで埋める。

**Status:** 未着手（設計は合意済み）
**Blocked by:** なし

## 完了条件

- [ ] スライドの追加 — `slides_add_slide`（レイアウト指定、タイトル・本文まで 1 回で埋める）
- [ ] 段落 3 本 — `slides_update_paragraph_style` / `slides_create_paragraph_bullets` / `slides_delete_paragraph_bullets`
- [ ] 図形の周辺 5 本 — `slides_update_element_transform` / `slides_update_elements_z_order` / `slides_add_line` / `slides_group_elements` / `slides_ungroup_elements`
- [ ] 表 1 本 — `slides_add_table`（2 次元配列で中身ごと）
- [ ] `slides_add_text_box` に文字スタイルと段落の配置を足す
- [ ] `slides_update_slide_properties` の description から未実装の記述を削る
- [ ] `slides_add_shape` の `strokeWidth` の説明を「12700 EMU = 1pt」と分かる表記にする（値は変えない）
- [ ] 新ツールの寸法を PT に統一し、判断を ADR 0002 に記録する
- [ ] 純粋関数にテストを書く
- [ ] README / class-diagram / CONTEXT.md を更新する
- [ ] `npm run type-check` / `lint` / `format:check` / `test` が通る
- [ ] 実機で全ツールを通す。正常系・異常系に加えて **enum は全値を通す**
- [ ] 0.8.0 としてリリースする

## 設計パス

- **概念**: 「スライド」（レイアウトを持つページ）、「段落」（文字とは別の書式の単位）、
  「配置」（要素の位置・大きさ・向き・重なり）、「線」（2 点を結ぶ要素）、「表」（行列を持つ要素）。
- **責務**: 寸法の変換（PT ↔ EMU）と、現在の transform からの倍率の逆算を純粋関数に切り出す。
  コマンドは API 呼び出しと文面だけを持つ。段落の範囲指定は既存の文字 index の流儀に合わせる。
- **依存の向き**: commands → 変換ヘルパー の一方向。ヘルパーは API クライアントも objectId も知らない。

## 決めたこと

### 何を作るか

| ツール                            | 使う API                              | 要点                                                                                                                                                    |
| --------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `slides_add_slide`                | `createSlide` + `insertText`          | `predefinedLayout` の列挙で指定。`placeholderIdMappings` でプレースホルダの objectId をこちらが決め、タイトル・本文まで **1 回の batchUpdate** で埋める |
| `slides_update_paragraph_style`   | `updateParagraphStyle`                | 配置・行間・インデント・段落前後の空き                                                                                                                  |
| `slides_create_paragraph_bullets` | `createParagraphBullets`              | 箇条書き・番号付きリスト                                                                                                                                |
| `slides_delete_paragraph_bullets` | `deleteParagraphBullets`              | 解除は別ツール                                                                                                                                          |
| `slides_update_element_transform` | `updatePageElementTransform`          | `left/top/width/height/rotation` で受ける                                                                                                               |
| `slides_update_elements_z_order`  | `updatePageElementsZOrder`            | 複数要素を一度に                                                                                                                                        |
| `slides_add_line`                 | `createLine` + `updateLineProperties` | 始点・終点の座標で受け、色・太さ・破線・矢印の頭も同じツールで                                                                                          |
| `slides_group_elements`           | `groupObjects`                        |                                                                                                                                                         |
| `slides_ungroup_elements`         | `ungroupObjects`                      | 解除は別ツール                                                                                                                                          |
| `slides_add_table`                | `createTable` + `insertText`          | 2 次元配列から行数列数を決める。位置・サイズは省略可                                                                                                    |

### 横断の方針

- **新ツールの寸法は PT。既存の EMU ツールはそのまま。** スライドの標準サイズは 720 × 405 pt なので、
  PT なら AI がそのまま扱える。ADR 0001（範囲を A1 記法に統一し、既存 2 本との食い違いを許した）と
  同じ進め方で、**ADR 0002 に記録する**。
- **作る系ツールは見た目も同じツールで設定する。** `add_text_box` にスタイルを足し、`add_line` は
  最初から色・太さ・矢印を受ける。生成した objectId を AI が受け取って次の呼び出しに渡す往復を減らす。
- **解除系は別ツールにする。** 箇条書きの解除もグループの解除も独立させる。Sheets の入力規則で
  「引数の省略が破壊的操作に化けるのを避ける」として決めた判断に揃える。
- **範囲指定は省略で全体、指定するなら文字 index。** 既存 `slides_update_text_style` の
  `startIndex` / `endIndex` と同じ流儀。API の `textRange` に直訳できる。
- **サーバーはテーマを持たない。** 0.6.0 の判断を維持する。配色は呼ぶ側が具体値で指示する。
- **生の `slides_batch_update_presentation` は逃げ道として残す。** 個別ツールは「AI が正しく呼べる」
  ためのもので、生ツールの廃止は破壊的変更になるため今回はやらない。
- **0.8.0 でまとめて出す。** 領域ごとに分けず、実機点検を 1 回で済ませる。

### 実装の勘所

**既存要素のリサイズは `size` を変えられない。** `updatePageElementTransform` は `transform` しか
受け付けず、実寸は `size × scale` で決まる。さらに Google 側が `size` を 3000000 EMU に正規化するため
（0.6.0 の点検で確認）、「幅を 200pt にする」には次の手順が要る。

1. `presentations.get` で対象要素の現在の `size` と `transform` を読む
2. `newScaleX = 目標幅 / size.width`
3. `applyMode: ABSOLUTE` で新しい行列を送る

作成時（`createShape` / `createTable`）は `size` に実寸を渡せばよく、**更新時とは流儀が違う**。
0.6.0 で `add_text_box` が丸ごと壊れていたのは、この 2 つを取り違えて寸法を倍率に入れていたため。

**線の向きは矩形で表す。** `createLine` は始点・終点ではなく `elementProperties`（位置とサイズ）で
受けるので、始点・終点から矩形に変換する。右上→左下のような向きは `scale` の符号で表すことになるが、
**負の scale を API が受けるかは未確認**（下記）。

### 見送った判断

- **全ツールを PT に統一する案**: EMU で値を渡していた既存の呼び出しが黙って 72 倍小さくなる。
  破壊的変更なので 0.8.0 では出せない。
- **`unit` 引数で選べるようにする案**: 引数が 1 つ増え、指定忘れの事故を呼ぶ。
- **生の batchUpdate を取り下げる案**: 破壊的変更。個別ツールが揃ってから改めて検討する。
- **画像の装飾（`updateImageProperties` / `replaceImage`）**: 今回の対象から外した。優先度の判断。
- **`rerouteLine`（2 つの図形を繋ぐコネクタ）**: 線を引けるようにしてから改めて考える。
- **表の罫線・セルの塗り（`updateTableCellProperties` / `updateTableBorderProperties`）**:
  実装量が 2 倍近くになるため、作成と中身に絞った。

## 実装時に一次情報で確かめること

**0.6.2 で `shapeType` と `ConditionType` の列挙に、API が受け付けない値が混ざっていた前例がある。**
宣言する enum は実機で全値を通してから確定させる。

- `predefinedLayout` の全値（`TITLE_AND_BODY` など）
- `bulletPreset` の全値
- z-order の `operation` の全値
- 矢印の頭（`startArrow` / `endArrow`）と破線（`dashStyle`）の全値
- 線の `category`（STRAIGHT / BENT / CURVED）
- **負の `scale` を API が受けるか** — 右上→左下の線を表現できるかがこれで決まる。
  受け付けないなら、線の指定を「始点・終点」で見せる設計そのものを見直す必要がある
- `createTable` がサイズ省略時に実際どこへ置くか

## 今回やらないと決めたもの

いずれも API 側には存在する。

- 画像の装飾: `updateImageProperties` / `replaceImage` / `replaceAllShapesWithImage`
- 表の書式: `updateTableCellProperties` / `updateTableBorderProperties` / `updateTableRowProperties` /
  `updateTableColumnProperties` / `insertTableRows` / `insertTableColumns` / `mergeTableCells`
- コネクタ: `rerouteLine` / `updateLineCategory`
- Sheets のグラフを貼る: `createSheetsChart` / `refreshSheetsChart` / `replaceAllShapesWithSheetsChart`
- 動画: `createVideo` / `updateVideoProperties`
- 代替テキスト: `updatePageElementAltText`（アクセシビリティ）

## 着手できる条件

いつでも着手できる。実機点検には Google アカウントと、検証用のプレゼンテーションを 1 枚作れることが要る。
