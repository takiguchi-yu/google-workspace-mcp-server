# 表の書式とコネクタ（0.9.0 予定）

0.8.0 で `slides_add_table` を出したが、中身を入れることしかできず、見出し行に色も罫線も
付けられない。表の書式 5 本とコネクタ 2 本を足し、既存 3 ツールに引数を足す。

**Status:** 完了（0.9.0 としてリリース済み）
**Blocked by:** なし

## 完了条件

- [x] 表の書式 5 本 — `slides_update_table_cells` / `slides_update_table_borders` /
      `slides_resize_table` / `slides_insert_table_dimension` / `slides_delete_table_dimension`
- [x] コネクタ 2 本 — `slides_connect_line` / `slides_disconnect_line`
- [x] `slides_update_text_style`（と `slides_add_text_box`）に link / baselineOffset /
      smallCaps / fontWeight を足す
- [x] `slides_update_shape_style` に contentAlignment / link を足す
- [x] `slides_update_slide_properties` に背景画像と発表時スキップを足す
- [x] 列の記号の変換を `src/tools/shared/column-letters.ts` に切り出す（Sheets の公開 API は変えない）
- [x] 純粋関数にテストを書く — 266 件が通る
- [x] README / class-diagram / CONTEXT.md を更新する
- [x] `npm run type-check` / `lint` / `format:check` / `test` が通る
- [x] 実機で全ツールを通す — 110 件（正常系・異常系・enum 全値）。正常系・異常系に加えて **enum は全値を通す**
- [x] 0.9.0 としてリリースする — タグ `v0.9.0`（コミット 6768230）。
      Publish ワークフローが success（run 35038557666、5m14s）、npm・Docker Hub・MCP Registry に配信済み。
      0.8.0 以降の説明文修正 2 件（コミット 2a9c474）も一緒に出た

## 設計パス

- **概念**: 「表の範囲」（表の中の長方形。A1 記法で受ける）、「罫線の位置」（全体・外周・内側・各辺）、
  「向き」（行 or 列。Sheets の dimension と同じ語）、「接続」（線の端と図形の結びつき）、
  「列の記号」（A → 0）。
- **責務**: A1 記法から span への変換と、塗り・罫線の組み立てを純粋関数に切り出す。
  表の行数・列数を引くのは `presentation-lookup.ts`（Slides で API を読むのはここだけ、を守る）。
  列の記号の変換は Sheets と Slides で共用するので `shared/` へ。
- **依存の向き**: slides commands → slides helpers → shared。**sheets への依存は作らない。**

## 決めたこと

### ツールの切り方

表は**用途ごとに 5 本**。API のリクエストと 1 対 1（9 本）にすると Slides のツールが 34 本になり、
AI が選ぶときの見通しが悪くなる。まとめて 2 本にすると引数が増えて省略時の振る舞いが読めなくなる。

| ツール                          | 使う API                                                   | 要点                                             |
| ------------------------------- | ---------------------------------------------------------- | ------------------------------------------------ |
| `slides_update_table_cells`     | `updateTableCellProperties`                                | 範囲を A1 で受け、塗りと縦揃え。複数範囲まとめて |
| `slides_update_table_borders`   | `updateTableBorderProperties`                              | 位置（ALL/OUTER/INNER/各辺）と色・太さ・破線     |
| `slides_resize_table`           | `updateTableRowProperties` / `updateTableColumnProperties` | 行高・列幅                                       |
| `slides_insert_table_dimension` | `insertTableRows` / `insertTableColumns`                   | 行・列の挿入                                     |
| `slides_delete_table_dimension` | `deleteTableRow` / `deleteTableColumn`                     | 削除は別ツール                                   |
| `slides_connect_line`           | `updateLineProperties` + `rerouteLine`                     | 線の端を図形に結ぶ。経路の引き直しまで 1 回で    |
| `slides_disconnect_line`        | `updateLineProperties`                                     | 解除は別ツール                                   |

### 横断の方針

- **範囲は A1 記法。** ADR 0001 と同じ。`sheets_set_borders` / `sheets_merge_cells` /
  `sheets_resize_dimension` の新しい流儀（`range` + 配列でまとめて）に合わせる。
  古い `sheets_insert_dimension` の 0 始まり index 方式には合わせない。
- **解除系は別ツール。** グループ・箇条書き・入力規則と同じ判断。
- **セルの結合・解除は今回やらない。** 別チケットに切る。結合があると範囲が長方形でなくなり、
  A1 記法との対応が崩れるため、書式が一巡してから設計する。
- **寸法は PT。** ADR 0004 のまま。

## 実機で確かめた事実（実装の前提）

| 確かめたこと                   | 結果                                                                                                                                                     |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tableRange` の span           | **省略も 0 も不可。必ず正の数。** 表より大きい span も拒否される。よって `A:C` のような開放端の範囲を受けるなら、表の行数・列数を API から読む必要がある |
| `borderPosition` の全値        | ALL / BOTTOM / INNER / INNER_HORIZONTAL / INNER_VERTICAL / LEFT / OUTER / RIGHT / TOP の 9 値すべて通る                                                  |
| `contentAlignment` の全値      | TOP / MIDDLE / BOTTOM の 3 値                                                                                                                            |
| `baselineOffset` の全値        | NONE / SUPERSCRIPT / SUBSCRIPT の 3 値                                                                                                                   |
| フォントの太さ                 | 100〜900 の **100 刻みのみ**。450 は `Font weight 450 is not supported.`                                                                                 |
| `updateLineCategory` の全値    | STRAIGHT / BENT / CURVED                                                                                                                                 |
| コネクタ                       | 両端を図形に接続 → `rerouteLine` → 接続解除 がすべて通る                                                                                                 |
| `connectionSiteIndex`          | **省略できる**（Google が接続点を選ぶ）。範囲外の index は拒否。**表には接続点が無い**                                                                   |
| セルの塗りを消す               | `propertyState: NOT_RENDERED` で消せる                                                                                                                   |
| 罫線を消す                     | **できない。** 太さ 0 は `The border weight 0.0 should not be less than or equal to zero.` 白で塗るしかない                                              |
| `rowIndices` / `columnIndices` | 省略すると全行・全列に効く。複数指定も可                                                                                                                 |

## レビューで直したこと

`/code-review` を Standards / Spec の 2 軸で回し、次を直した。

1. **`slides_update_table_borders` を配列で受ける形にした。** 横断の方針に
   「`sheets_set_borders` の新しい流儀（`range` + 配列でまとめて）に合わせる」と書きながら、
   このツールだけ単数だった。外周と内側を 1 回で描き分けられるようになった。
2. **引数の誤りを「API の失敗」と書かなくした。** 表の 5 本は検証を API の try に入れていたため、
   範囲の書き間違いが「セルの更新に失敗しました: …」になっていた。0.8.0 の流儀に合わせ、
   「表を読む → 引数を検証 → 送る」を try ごとに分けた。
3. **`slides_disconnect_line` の `end` 引数を落とした。** 片端だけの解除は仕様に無く、
   ここだけ列挙を手書きしていた。両端の解除に一本化した。
4. **`CONTENT_ALIGNMENTS` を `content-alignment.ts` に移した。** 図形のコマンドが
   「表の見た目」のモジュールを参照していて、責務がはみ出していた。
5. **`shared/column-letters.ts` にテストを置いた。** 再輸出越しに Sheets 側のテストで
   検証していて、設計パスの依存の向きと逆になっていた。
6. **`slides_resize_table` で位置を省略したとき、`rowIndices` ごと省くようにした。**
   実機で「省略すると全行・全列に効く」ことを確かめてあるのに、全 index を明示送信していた。
7. **`at` の数値許容を外した。** 引数スキーマは文字列なので、数値は MCP 層で弾かれる。
   実装だけが受け付けても届かない経路だった。
8. **細かい直し**: `startSite` だけ渡して `startShapeId` を省いた指定を弾く /
   `fetchTableSize` で 0 行・0 列の表を弾く / `== null` の緩い比較をやめる /
   `grid-range.ts` のヘッダを抽出後の実態に合わせる /
   `text-style.ts` に足した 4 項目にテストを書く。

### 指摘のうち、採らなかったもの

- **`slides_connect_line` の `lineCategory` はスコープ外**（Spec 指摘）→ **残した。**
  ユーザーが選んだ選択肢の説明が「これが入って初めて `updateLineCategory` / `rerouteLine` が
  意味を持つ」と明記しており、合意の範囲内。代わりに上の表の API 列を直した。
- **`backgroundColor: "NONE"` はスコープ外**（Spec 指摘）→ **残した。** 背景画像を足した以上、
  それを消す手立てが無いと機能として閉じない。`slides_update_shape_style` の
  `fillColor: "NONE"` と同じ流儀。
- **`table-range.ts` のセル解析が `grid-range.ts` と重複**（Standards 指摘）→ **見送り。**
  共通化すると Sheets 側のエラー文面が変わる。A1 のシート名の扱い（クォート・`!` の
  エスケープ）は Sheets 固有で、Slides の表には要らない。共有したのは列の記号の変換だけ。
- **class-diagram に 7 コマンドすべてを載せる**（Spec 指摘）→ **見送り。** 図には
  「代表的なクラスのみを表示しています」と断りがあり、0.8.0 でも 3 本だけ載せた。
  今回は `UpdateTableCellsCommand` と `ConnectLineCommand` を代表として足した。

## 今回やらないと決めたもの

- **セルの結合・解除**（`mergeTableCells` / `unmergeTableCells`）— 別チケット。下に起票する
- **画像の装飾** — 枠線・トリミング・リンク・差し替えは通るが、今回の選択から外れた
- **影（shadow）** — API は成功を返すが `propertyState` は `NOT_RENDERED` のまま。**書き込めない**
- **画像の透明度・明るさ・コントラスト・recolor** — `cannot be updated` で拒否される
- **文字の自動縮小（autofit）** — `NONE` しか受け付けない
- **代替テキスト・Sheets のグラフ・動画・図形の一括画像置換**

## 着手できる条件

いつでも着手できる。実機点検には Google アカウントと、検証用のプレゼンテーションが要る。
