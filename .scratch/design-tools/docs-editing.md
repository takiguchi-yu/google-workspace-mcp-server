# Google Docs の書き込み・書式対応

Docs サービスは `docs_get_document`（読み取り）だけで、書き込みツールが 1 つも無い。
スプレッドシート／スライドのデザイン対応（0.6.0）を検討したときに、Docs だけは
「書式を足す」ではなく「編集機能そのものを新設する」スコープになると分かったので切り出した。

**Status:** 保留（2026-09-12 に優先度が低いと判断。着手時期は未定）
**Blocked by:** なし（技術的な障害は無い。優先度の問題）

## 完了条件

- [ ] テキストを挿入・置換できる（`documents.batchUpdate` の `insertText` / `replaceAllText`）
- [ ] 段落スタイル（見出しレベル・配置）を変更できる
- [ ] 文字スタイル（太字・色・サイズ・フォント）を変更できる
- [ ] 表を挿入できる
- [ ] 位置の指定方法が決まっていて、README に書かれている
- [ ] README のツール一覧に追加した
- [ ] `npm run type-check` / `lint` / `format:check` / `test` が通る

## 見つけたときの状況

- 0.6.0 の設計時に確認。`src/tools/docs/docs.service.ts` の `registerCommands()` は
  `GetDocumentCommand` のみを登録している。
- OAuth スコープは `https://www.googleapis.com/auth/documents`（`src/auth/scopes.ts:12`）で、
  書き込みも含むフルスコープ。**スコープの追加や再認可は不要。**
- 0.6.0 に含めなかったのは、Sheets / Slides が「既存の読み書きに見た目を足す」話なのに対し、
  Docs は書き込み経路そのものが無く、変更の性質が違うため。1 本の変更に混ぜると差分が読めなくなる。

## 着手前に決めること

- **位置の指定方法。** Docs API は文字位置を 0 始まりの index で指す。Sheets の A1 記法に当たる
  「人が読める指定」が Docs には無い。index をそのまま露出するか、見出しや段落番号で指させるかを決める。
  Sheets では A1 記法に統一する判断をした（[ADR 0001](../../docs/adr/0001-a1-notation-for-formatting-range.md)）ので、
  同じ観点で検討する。
- **ツールの粒度。** 0.6.0 では意図単位のツール群を選んだ。Docs もそろえるかを決める。
