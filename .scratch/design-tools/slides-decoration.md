# スライドの装飾機能の拡充（0.8.0 予定）

Slides API v1 の 43 種のリクエストのうち、0.7.0 時点のツールが使っているのは 11 種。
文字単位のスタイルはあるのに段落単位が丸ごと無く、スライドは複製でしか増やせない。
装飾の穴を 10 本のツールで埋める。

**Status:** 完了（0.8.0 としてリリース済み）
**Blocked by:** なし

## 完了条件

- [x] スライドの追加 — `slides_add_slide`（レイアウト指定、タイトル・本文まで 1 回で埋める）
- [x] 段落 3 本 — `slides_update_paragraph_style` / `slides_create_paragraph_bullets` / `slides_delete_paragraph_bullets`
- [x] 図形の周辺 5 本 — `slides_update_element_transform` / `slides_update_elements_z_order` / `slides_add_line` / `slides_group_elements` / `slides_ungroup_elements`
- [x] 表 1 本 — `slides_add_table`（2 次元配列で中身ごと）
- [x] `slides_add_text_box` に文字スタイルと段落の配置を足す
- [x] `slides_update_slide_properties` の description から未実装の記述を削る
- [x] `slides_add_shape` の `strokeWidth` の説明を「12700 EMU = 1pt」と分かる表記にする（値は変えない）
- [x] 新ツールの寸法を PT に統一し、判断を ADR に記録する — **ADR 0002 ではなく 0004**。
      起票時点では 0002 が空いていたが、Docs の作業で 0002 / 0003 が埋まったため次の空き番号を使った
- [x] 純粋関数にテストを書く — 11 モジュール、222 件が通る
- [x] README / class-diagram / CONTEXT.md を更新する
- [x] `npm run type-check` / `lint` / `format:check` / `test` が通る
- [x] 実機で全ツールを通す。正常系・異常系に加えて **enum は全値を通す**
- [x] 0.8.0 としてリリースする — タグ `v0.8.0`（コミット b2696fb）。
      GitHub Actions の Publish が success（run 34983029931、7m50s）で、npm は 0.8.0 を配信中

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

## 実測で確かめたこと

実機点検は `SlidesService` を直接呼ぶ使い捨てスクリプトで回した（ツール定義ではなく
コマンドの実装をそのまま通すため）。検証用プレゼンテーション 2 枚を作成。

| 確かめたこと                                   | 結果                                                                                                                                                            |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `predefinedLayout` の全値                      | 11 値すべて通った                                                                                                                                               |
| `bulletPreset` の全値                          | 15 値すべて通った                                                                                                                                               |
| z-order の `operation` の全値                  | 4 値すべて通った                                                                                                                                                |
| `dashStyle` / `startArrow` / `endArrow` の全値 | 6 値 / 10 値すべて通った                                                                                                                                        |
| 線の `category`                                | STRAIGHT / BENT / CURVED すべて通った。非推奨の `category` も受ける                                                                                             |
| **負の `scale` を API が受けるか**             | **受ける。** `scaleX: -1` が `-0.4233` として保存され、読み返しでも残る。始点・終点で線を見せる設計は成立する                                                   |
| `createTable` がサイズ省略時にどこへ置くか     | スライド中央。幅 570pt 固定、1 行 30pt。位置・サイズを渡すと `size`/`transform` ではなく列幅・行高に反映される                                                  |
| レイアウトごとのプレースホルダ                 | 決め打ちできない。`TITLE` のタイトルは `CENTERED_TITLE`、`CAPTION_ONLY` にタイトルは無く、`BLANK` は両方無い。実在しない枠を指定すると batchUpdate ごと失敗する |
| objectId の長さ                                | **5 文字以上**でないと弾かれる（`The object ID (b_0) length should not be less than 5.`）                                                                       |
| `updatePageElementTransform` の逆算            | `newScale = 目標寸法(EMU) / size`。`size` は作成時に何を渡しても 3000000 EMU に正規化される。回転は行列に織り込め、読み返しても 4 桁の丸めの範囲で戻る          |

通過件数: 純粋関数のテスト 197 件、実機点検 138 件（正常系・異常系・enum 全値）。

## 決めたことの追加分

- **レイアウトのプレースホルダは決め打ちの対応表にせず、実行のたびに API から引く。**
  テーマを差し替えたプレゼンテーションでも「このレイアウトに本文の枠は無い」を、
  batchUpdate を投げる前に言えるようにするため。ADR 0001 が `sheetId` を毎回引くのと同じ判断。
- **`toTextRange` は片方だけの範囲指定を弾く。** 0.7.0 の `slides_update_text_style` は
  `startIndex` だけ渡されると黙って全体にかけていた。戻す手立てが無いまま全文の見た目が
  変わるため、共有ヘルパーに寄せる際にエラーへ変えた。**既存ツールのふるまいが変わる唯一の箇所。**
- **`update_paragraph_style` に `direction` は出さない。** 「決めたこと」表の要点は
  配置・行間・インデント・段落前後の空きの 4 つ。実機では通ることを確かめたが、
  頼まれていないものを増やさない判断で落とした。

## レビューで見つけて直したこと

`/code-review` を Standards / Spec の 2 軸で回し、次を直した。

1. **（重大）負の scale を持つ線を `slides_update_element_transform` で動かすと裏返っていた。**
   行列を `hypot` と `atan2` だけで分解していたため、鏡映（片方の軸だけが負）を
   「180 度の回転」と読み違え、再構成でもう一方の軸まで反転させていた。
   倍率の符号を**行列式から戻す**ように直した（`det = sx · sy`）。
   6 方向の線について、位置を変えても大きさを変えても向きが残ることを実機で確認。
2. **`slides_add_table` で `width` だけ渡すと表が左上へ飛んでいた。** 説明文の
   「省略したら中央」と食い違っていたので、省略された辺を中央寄せとして計算するようにした。
   幅だけ 300pt を渡したとき left=210 / top=172.5 になることを実機で確認。
3. **`presentation_lookup` の field マスクが広すぎた。**
   `slides(objectId,pageElements)` を `slides/pageElements(objectId,size,transform,elementGroup)` に絞った。
   グループの中の要素も引けることを実機で確認。
4. **列挙とヘルパーの重複を寄せた。** `ALIGNMENTS` を `paragraph-style.ts`、
   `DASH_STYLES` / `ARROW_STYLES` / `LINE_CATEGORIES` を `line-style.ts` に集約。
   数値引数の検証は `dimensions.ts` から `number-argument.ts` に切り出した
   （寸法以外の rotation・lineSpacing・insertionIndex にも使うため）。
5. **`dimensions.ts` の未使用 export を配線した。** `toElementProperties` / `pointBoxSchema` /
   `SLIDE_WIDTH_PT` / `SLIDE_HEIGHT_PT` は `slides_add_table` の中央寄せで使うようになった。
   使い道の無かった `toNumber` の第 3 引数（fallback）は削除。
6. **CONTEXT.md の「配置」の _Avoid_ に `transform` の扱いを書き足した。**
   ツール名 `slides_update_element_transform` が API の綴りを使う以上、
   禁止語のままでは自分の規定を自分で破ることになるため。

## 申し送り

- **表の罫線・セルの塗り**、**画像の装飾**、**コネクタ（`rerouteLine`）** は今回の対象外のまま。
  起票は 0.8.0 のリリース後に、実際に困った場面が出てから行う。
- **objectId は `${prefix}_${Date.now()}` のまま。** 同じミリ秒に 2 回呼ぶと衝突するが、
  衝突しても API が「その objectId は既にある」と断るだけでデータは壊れない。
  既存の `add_shape` / `add_text_box` と同じ流儀に合わせた。

## 0.8.0 の動作確認（公開イメージ経由）

`takigu1/google-workspace-mcp-server:0.8.0` を pull し、stdio で MCP を話して確かめた。
ローカルのソースではなく **CI がビルドして公開した成果物**が対象。

| 確かめたこと                  | 結果                                                                                                                               |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| 3 つのレジストリへの公開      | Docker Hub（amd64 / arm64）・npm・MCP Registry すべてに 0.8.0                                                                      |
| `initialize` が返すバージョン | `0.8.0`                                                                                                                            |
| `tools/list`                  | 57 本。新ツール 10 本すべてが正しい引数で出る。`account` の差し込みも全ツールで効いている                                          |
| 説明文の手直し                | `update_slide_properties` と `add_shape` の `strokeWidth` が新しい文面になっている                                                 |
| `direction` を落とした判断    | `update_paragraph_style` の引数は 11 + account で、`direction` は出ていない                                                        |
| end-to-end                    | 新ツール 10 本を 1 つのスライドに通し、サムネイル（PNG）で描画まで確認                                                             |
| 異常系 12 件                  | すべてエラーになり、理由の分かる文面が返る                                                                                         |
| 鏡映した線の修正              | 右上へ向かう線（始点 80,360 → 終点 300,250）を (400,300) へ移動して、終点が (620,190) になることを確認。向きも大きさも保たれている |
| 表の中央寄せの修正            | 幅 300pt だけを渡した表が left=210pt に置かれる（(720-300)/2）                                                                     |

### 動作確認で見つけた説明文の誤り 2 件（修正済み・未リリース）

どちらも説明文だけの誤りで、振る舞いは正しかった。**0.8.0 の成果物には誤った説明が入っている。**

1. **`slides_group_elements` が「表はグループ化できない」を書いていなかった。**
   スライドを分けて 1 組ずつ試した結果: 図形＋図形 ✓ / 図形＋線 ✓ / 図形＋画像 ✓ /
   図形＋表 ✗ / 図形＋プレースホルダ ✗。すでに別のグループに入っている要素も対象にできない。
2. **`slides_delete_paragraph_bullets` が「インデントは箇条書きのぶんが残る」と書いていた。**
   実測は逆で、入れ子 3 段の箇条書きで `indentStart` が 36 / 72 / 108pt → なし / 36 / 72pt。
   入れ子の深さは残るが箇条書きが足したぶんは消えるので、先頭の段落は余白まで戻る。

### 申し送り

- 上の 2 件は main にコミット済みだが**リリースしていない**。次の機能追加とまとめて出す。
  それまで 0.8.0 を使う AI は、表をグループ化しようとして `The page element (...) cannot be
grouped.` という API そのままの文面に当たる。
- 検証用のプレゼンテーション 3 枚を work アカウントの Drive に残してある
  （「0.8.0 装飾ツール 実機点検」「0.8.0 実機点検 / スライドと段落」「0.8.0 動作確認（公開イメージ経由）」）。
