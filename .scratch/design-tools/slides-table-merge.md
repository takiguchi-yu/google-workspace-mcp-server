# 表のセルの結合・解除

`slides_merge_table_cells` / `slides_unmerge_table_cells` を足す。
0.9.0 の表の書式 5 本からは外した。

**Status:** 未着手
**Blocked by:** 0.9.0 の表の書式（`.scratch/design-tools/slides-tables-and-connectors.md`）

## 完了条件

- [ ] `slides_merge_table_cells` — 範囲を A1 で受けてセルを結合する
- [ ] `slides_unmerge_table_cells` — 結合を解除する（解除は別ツール）
- [ ] 結合されたセルを含む表に対して、既存の `slides_update_table_cells` /
      `slides_update_table_borders` が壊れないことを実機で確かめる
- [ ] 純粋関数にテストを書く / README・class-diagram を更新する

## 見つけたときの状況

0.9.0 で表の書式を足すときに、`mergeTableCells` / `unmergeTableCells` が実機で通ることは
確かめた（両方とも成功）。外したのは実装量ではなく、**範囲の意味が変わるため**。

Slides API の `TableRange` の説明に「テーブル範囲が指すセルは必ずしも長方形にならない」とあり、
結合されたセルを含む範囲は A1 記法の長方形と 1 対 1 に対応しない。書式系 5 本が
「範囲 = 長方形」を前提に組み上がっているので、結合を先に入れると前提が崩れる。

## 着手できる条件

0.9.0 の `slides_update_table_cells` / `slides_update_table_borders` が出ていること。
結合済みの表で範囲指定がどう解釈されるかを実機で確かめてから設計する。
