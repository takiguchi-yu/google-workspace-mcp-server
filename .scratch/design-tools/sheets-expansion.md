# スプレッドシートの機能拡張（シートのライフサイクル・入力支援・読み取り）

Sheets API v4 の batchUpdate は 69 種のリクエストを持つが、0.6.2 時点のツールが使っているのは
11 種だけだった。穴のうち「使用頻度が高く実装が軽いもの」を 3 つの塊にまとめて埋める。

**Status:** 実装・点検まで完了（未リリース）
**Blocked by:** なし

## 完了条件

- [x] A: シートのライフサイクル — `sheets_delete_sheet` / `sheets_duplicate_sheet` / `sheets_update_sheet_properties` の 3 本
- [x] B: 入力支援 — `sheets_set_data_validation` / `sheets_clear_data_validation` / `sheets_sort_range` / `sheets_set_basic_filter` / `sheets_clear_basic_filter` の 5 本
- [x] C: 読み取りの拡張 — `sheets_read_sheet_values` に `valueRenderOption` を足し、既定範囲が Z 列止まりなのを直す
- [x] 範囲・シートの指定は A1 記法／シート名に統一し、`sheetId` はサーバー側で解決する
- [x] 条件（BooleanCondition）の組み立てを共通ヘルパーに集約し、条件付き書式と重複させない
- [x] 純粋関数にテストを書く（`condition.test.ts` / `sort-spec.test.ts` / `grid-range.test.ts` に 24 件追加）
- [x] README / class-diagram / CONTEXT.md を更新する
- [x] `npm run type-check` / `lint` / `format:check` / `test` が通る
- [x] 実機で全ツールを通し、読み戻しで反映を確認する

## 設計パス

- **概念**: 「シート」（タブそのものの生死と属性）、「条件」（BooleanCondition＝入力規則と条件付き書式が
  共有する判定）、「並べ替え仕様」（SortSpec）、「値の見せ方」（ValueRenderOption）。
- **責務**: `condition.ts`（新規・純粋関数）は引数から BooleanCondition を組み立てることと、
  渡された ConditionType が許可集合にあるかの判定だけを持つ。**どの集合が許されるかは呼び出し側が渡す** —
  条件付き書式と入力規則で使える部分集合が違うため。各コマンドは API 呼び出しと結果の文面だけを持つ。
- **依存の向き**: commands → `condition.ts` / `grid-range.ts` / `sheet-id-resolver.ts` の一方向。
  `condition.ts` は API クライアントも `sheetId` も知らない。

### 見送った判断

- **`sheets_update_sheet_properties` に固定行列（frozen）を含めない。** 既存 `sheets_freeze_panes` の
  責務なので、同じ設定に入口を 2 つ作らない。
- **入力規則の設定と解除を 1 ツールにまとめない。** Sheets API は `rule` を省略すると解除になるが、
  引数の省略が破壊的操作に化けるのは事故のもと。`clear` を別ツールにして明示させる。
- **`sheets_batch_update`（生の batchUpdate を通す汎用ツール）は作らない。** 使用頻度が高い操作は
  個別ツールのほうが AI から正しく呼ばれる。ツール本数が問題になってから集約を検討する（2026-09-15 のユーザー判断）。

## 確認した一次情報

- batchUpdate の全リクエスト種別（69 種）: `node_modules/googleapis/build/src/apis/sheets/v4.d.ts:3527`
- 既存ツールが使っている API は 11 種（`addSheet` / `insertDimension` / `deleteDimension` / `repeatCell` /
  `updateBorders` / `mergeCells` / `unmergeCells` / `updateDimensionProperties` / `updateSheetProperties` /
  `addConditionalFormatRule` / `deleteConditionalFormatRule`）
- OAuth スコープの追加は不要。`spreadsheets` のフルスコープを既に要求している（`src/auth/scopes.ts:7-12`）
- ConditionType が入力規則・条件付き書式・フィルタのどれで使えるかは
  https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets/other の表で確認した。
  **ただしこの表は実機で裏を取る。** 0.6.2 で条件付き書式の列挙を削ったときと同じく、
  ドキュメントと API の実際の受け入れがずれている可能性がある。

## 今回やらないと決めたもの

優先度を下げただけで、いずれも API 側には存在する。

- **表の見た目の続き**: `addBanding`（交互の背景色）、`updateCells` の `note` / `hyperlink`、
  `addDimensionGroup`（行列のグループ化）、`addChart`（グラフ）。
  `addChart` は `ChartSpec` が大きく、他の 3 つを足したくらいの実装コストになる。
- **運用系**: `addProtectedRange`、`addNamedRange`、`findReplace`、`copyPaste` / `cutPaste` / `moveDimension`、
  `deleteDuplicates` / `trimWhitespace`、`updateSpreadsheetProperties`、`spreadsheets.sheets.copyTo`。
- **エクスポート（PDF / CSV）**: Drive スコープが `drive.file` なので、このサーバーが作成したファイルしか
  出力できない。スコープを広げるかの判断が先に要る。

## 実測で確かめたこと

- `npm test` → tests 132 / pass 132 / fail 0（0.6.2 時点は 108）
- `npm run type-check`、`npm run lint`、`npm run format:check` はいずれもエラー無し
- Sheets の登録ツールは 20 本 → 28 本（`src/tools/sheets/sheets.service.ts:42-70`）

## 実機での点検（2026-09-15、work アカウント）

ビルド済みのコマンドを直接呼び、適用後は API から読み戻した。検証用スプレッドシート
`1oRQUCk7D6CnkO5Tz8ZWm0LhU_7R0ThZ5ogFJEhu55l8`（"ツール点検 2026-09-15..."）を 1 枚使った。

**合格 54 / 不合格 2。不合格は 2 件とも検証スクリプト側の誤りで、ツールは正しかった**（下記）。

通した内容。

| 対象                   | 内容                                                                                                                                          |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 読み取りの拡張         | FORMATTED_VALUE（既定）／FORMULA（`=C2*2` がそのまま返る）／UNFORMATTED_VALUE                                                                 |
| シートのライフサイクル | 複製（名前・位置指定、名前衝突の拒否）、リネーム・タブ色・位置・非表示、削除（最後の 1 枚の拒否、存在しないシート名の拒否、変更点なしの拒否） |
| 入力規則               | ONE_OF_LIST／BOOLEAN／NUMBER_BETWEEN + strict + inputMessage／ONE_OF_RANGE、用途違いの type の拒否、解除                                      |
| 並べ替え               | 単一キー降順、複数キー、列の記号でない指定の拒否                                                                                              |
| フィルタ               | 並び順のみ、condition での抽出、hiddenValues での抽出、両方指定の拒否、用途違いの type の拒否、解除、存在しないシート名の拒否                 |

### ここで確かめた仕様

- **`SortSpec.dimensionIndex` はシート上の絶対の列番号。** 範囲内の相対位置ではない。
  公式ドキュメントは "The dimension the sort should be applied to." としか書いていないため実機で確かめた。
  範囲 `B2:D5` に対して `column: "C"` を指定し、C 列（点数）が降順に並ぶことを読み戻しで確認した。
- **`values.get` はグリッドより広い範囲を渡してもエラーにならず、グリッドにクリップして返す。**
  `A1:ZZZ1000` を渡すと、レスポンスの `range` は `Sheet1!A1:Z1000`（26 列のシートの場合）になる。
  既定範囲を広げても安全なのはこのため。
- **一方 `values.update` はグリッド外を書けない。**
  `Range (Sheet1!AB1) exceeds grid limits. Max rows: 1000, max columns: 26` で 400 になる。

### 不合格 2 件（いずれも検証スクリプト側の誤り）

新規スプレッドシートのグリッドは 26 列しかないのに、列を広げずに `AB1` へ書こうとしていた。
そのため「AB 列に値を置く」が 400 で失敗し、続く「既定範囲が AB 列を含む」も連鎖して落ちた。

列を 30 列に広げてから同じ手順を踏むと、**既定範囲（`A1:ZZZ1000`）の読み取りに AB 列の値が
含まれることを確認した**。旧既定の `A1:Z1000` なら読み落としていた箇所で、今回の変更の狙いどおり。
検証スクリプトは `appendDimension` で列を足してから書くように直した。

## 申し送り

- **検証で作ったスプレッドシート 1 枚は本人が片付ける**（2026-09-15 時点）。
  `1oRQUCk7D6CnkO5Tz8ZWm0LhU_7R0ThZ5ogFJEhu55l8`（work アカウントの Drive）。
- **`ONE_OF_RANGE` の範囲指定は `=Sheet1!$A$2:$A$20` の形で渡す。** `=` を落とすと API に弾かれる。
  ツールの description には例として載せたが、バリデーションはしていない。
- **`sheets_delete_dimension` / `sheets_insert_dimension` は今も `sheetId` を引数に取る。**
  今回追加した 8 本はすべてシート名・A1 記法に統一したが、既存 2 本との食い違いは
  [ADR 0001](../../docs/adr/0001-a1-notation-for-formatting-range.md) の判断のまま残している。
- **リリースはまだ。** 0.7.0 として出すなら、`publish.yml` に入れた MCP Registry のリトライ
  （0.6.1 で追加、0.6.2 で初めて自動で通った）がそのまま効くはず。
