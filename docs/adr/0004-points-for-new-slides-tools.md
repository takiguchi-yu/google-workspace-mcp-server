# Slides の新しいツールは寸法をポイントで受け、既存の EMU ツールはそのまま残す

0.8.0 で足した装飾ツール（`slides_add_line` / `slides_add_table` /
`slides_update_element_transform` / `slides_update_paragraph_style`）は、位置・大きさ・
インデントをポイント（PT）で受けることにした。スライドの標準サイズは 720 × 405 pt で、
「左から 60pt、上から 40pt」は呼ぶ側がそのまま組み立てられる。同じ位置を EMU で書くと
762000 と 508000 になり、AI が桁を 1 つ間違えてもスライドの外に飛ぶだけで気づけない。

いっぽう既存の `slides_add_shape` / `slides_add_text_box` / `slides_insert_image` は
0.4.0 から EMU で公開している。単位を変えると、これまで `width: 1828800` と書いていた
呼び出しが黙って 72 分の 1 の大きさになる。エラーにならず、見た目だけが壊れる。

Sheets で範囲を A1 記法に統一し、既存 2 本との食い違いを許した
[ADR 0001](./0001-a1-notation-for-formatting-range.md) と同じ進め方になる。
新しいものから正しくし、既存は壊さない。

## 考えた選択肢

- **全ツールをポイントに統一する。** 食い違いは消えるが、既存の呼び出しが黙って
  72 倍小さくなる破壊的変更になるため採らなかった。個別ツールが一巡してから、
  メジャーバージョンの区切りで改めて検討する。
- **`unit` 引数でどちらかを選べるようにする。** 全ツールに引数が 1 つ増えるうえ、
  指定を忘れたときの既定がそのまま事故になる。単位は呼ぶたびに決めるものではない。
- **EMU のままで、説明文に換算式を書く。** 0.7.0 までがこれで、`strokeWidth` の
  「Defaults to 12700 (0.014 inches)」のように、読んでも太さが思い浮かばない文面になっていた。
  0.8.0 では既存ツールの説明文だけを「12700 EMU = 1 pt」と直し、値は変えていない。

## 結果として受け入れたこと

- **同じサービスの中に 2 つの単位が並ぶ。** どちらであるかは各ツールの説明文に明記し、
  EMU 系のツールには「新しい slides_add_line / slides_add_table はポイントで受ける」と添えた。
- **既存要素のリサイズは、作成時とは別の道を通る。** `updatePageElementTransform` は
  `transform` しか受け付けず、実寸は `size × 倍率` で決まる。さらに Google 側が `size` を
  3000000 EMU に正規化するため、「幅を 200pt にする」には現在の `size` を読んでから
  倍率を逆算しなければならない。ポイントで受ける以上この逆算はサーバーの仕事になり、
  `slides_update_element_transform` だけは API 呼び出しが 2 回（`presentations.get` と
  `batchUpdate`）になる。

変換は `src/tools/slides/dimensions.ts` と `src/tools/slides/element-transform.ts`（純粋関数）、
現在の値を引くのは `src/tools/slides/presentation-lookup.ts`（API 呼び出し）に分けてある。
