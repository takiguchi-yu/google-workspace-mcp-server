# 書式ツールの範囲は A1 記法で受け、sheetId は毎回引く

Sheets API の書式リクエストは範囲を GridRange（数値の `sheetId` と 0 始まりの行列番号）で指すが、
書式系ツール（`sheets_format_cells` ほか）の引数は A1 記法の文字列に統一し、`sheetId` は
実行のたびに `spreadsheets.get` で引くことにした。AI と利用者が読み書きするのは `'売上'!A1:D1`
であって行列番号ではなく、番号を外に出すと「先頭行は 0 か 1 か」「終端は含むか」の取り違えが
そのままデータの破壊につながるため。

## 考えた選択肢

- **`sheetId` と 0 始まりの index を引数に出す。** 既存の `sheets_insert_dimension` はこの形で、
  追加の API 呼び出しも要らない。採らなかったのは、呼ぶ側が事前に `sheets_get_spreadsheet_info`
  で `sheetId` を引く必要があり、書式のように何範囲もまとめて指定する操作では負担が大きいため。
- **両方受ける。** 引数スキーマに相互排他のバリデーションが全ツールぶん増え、A1 記法と番号の
  分裂がそのまま固定化するため採らなかった。

## 結果として受け入れたこと

- 書式ツール 1 回につき API 呼び出しが 2 回になる（シート一覧の取得＋`batchUpdate`）。
  複数範囲を 1 回の呼び出しにまとめられるようにして、この固定費が範囲の数に比例しないようにした。
- 既存の `sheets_insert_dimension` / `sheets_delete_dimension` とは引数の形が食い違ったままになる。
  既存ツールの引数を変えると後方互換が壊れるため、そろえにいかない。

範囲の変換は `src/tools/sheets/grid-range.ts`（純粋関数）、`sheetId` の解決は
`src/tools/sheets/sheet-id-resolver.ts`（API 呼び出し）に分けてある。
