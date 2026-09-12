# スプレッドシート・スライドのデザイン対応（0.6.0）

Sheets に書式系ツール 8 本、Slides に 4 本を追加した。Docs は
[別チケット](./docs-editing.md)に切り出した。

**Status:** 完了
**Blocked by:** なし

## 完了条件

- [x] Sheets: セル書式・罫線・結合・列幅行高・固定・条件付き書式（追加/削除/一覧）の 8 ツール
- [x] Slides: テキストスタイル・図形スタイル・画像挿入・一括置換の 4 ツール
- [x] 範囲の指定は A1 記法に統一し、`sheetId` はサーバー側で解決する
- [x] `hexToRgb` の重複（2 箇所）を共通ヘルパーに集約する
- [x] 純粋関数（A1↔GridRange 変換、色変換、書式の組み立て）にテストを書く
- [x] README / class-diagram / CONTEXT.md / ADR を更新する
- [x] `npm run type-check` / `lint` / `format:check` / `test` が通る

## 実測で確かめたこと

- `npm test` → tests 108 / pass 108 / fail 0
- `npm run type-check`、`npm run lint`、`npm run format:check` はいずれもエラー無し
- 登録ツール数: sheets 20 / slides 15 / docs 1 / drive 2 = 38、＋メタツール `accounts_list` で 39
  （ビルド済みの各 Service を読み込んで `getTools()` を数えた）
- OAuth スコープの追加は不要。`spreadsheets` / `presentations` のフルスコープを既に要求している
  （`src/auth/scopes.ts:9-13, 24-28`）

## 決めたこと

- **範囲は A1 記法に統一。** 理由と、既存 `sheets_insert_dimension` との食い違いを許した経緯は
  [ADR 0001](../../docs/adr/0001-a1-notation-for-formatting-range.md) に記録した。
- **サーバーはテーマを持たない。** 「濃い青の見出し」といった配色は呼ぶ側が具体値で指示する。
  プリセットをサーバーに同梱する案は、MCP サーバーがデザイン資産の保守責任を負うことになるため見送った。
- **1 ツール呼び出しで複数範囲を受ける。** Sheets の `batchUpdate` は原則 all-or-nothing なので、
  途中失敗で中途半端な見た目が残らない。
- **`slides_insert_image` は公開 URL 限定。** Slides API が公開アクセス可能な URL を要求し、
  Drive スコープは `drive.file`（アプリが作成したファイルのみ）のため。スコープは広げなかった。

## 申し送り

- **`sheets_batch_update_sheet_values` が README の一覧に載っていなかった**ので、この変更で 1 行追加した。
  実装漏れではなくドキュメントの漏れ。
- **`slides_add_text_box` は今もスタイル引数を持たない。** テキストを入れてから
  `slides_update_text_style` で飾る 2 手順になる。1 手順にまとめるかは、使われ方を見てから判断する。
- **条件付き書式の `index` は削除のたびに繰り上がる。** 複数消すときは番号の大きい方からになる。
  ツールの description と実行結果の文面に明記したが、まとめて消す専用ツールは作っていない。
