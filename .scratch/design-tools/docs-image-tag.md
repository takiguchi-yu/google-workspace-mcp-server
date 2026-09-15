# Docker の利用手順に書いてあるイメージタグが古い

`docs/how-to-get-token.md` が案内しているイメージタグが 0.5.0 のまま止まっている。
現在の最新は 0.7.0。

**Status:** 未着手
**Blocked by:** なし

## 完了条件

- [ ] `docs/how-to-get-token.md` のイメージタグを現行バージョンに合わせる（3 箇所）
- [ ] 他のドキュメントにも同じ表記が無いか洗う（`grep -rn "google-workspace-mcp-server:" docs README.md`）
- [ ] **リリースのたびに古くなる構造そのものを直すか**を決める。案は 2 つ
  - `scripts/sync-version.js` の対象にドキュメントを加えて、`npm version` で一緒に書き換える
  - ドキュメントからバージョン固定の記述を外し、「最新は npm / Docker Hub で確認」と書く

## 見つけたときの状況

0.7.0 のリリース作業中（2026-09-15）に気づいた。

```
docs/how-to-get-token.md:69:takigu1/google-workspace-mcp-server:0.5.0
docs/how-to-get-token.md:90:takigu1/google-workspace-mcp-server:0.5.0
docs/how-to-get-token.md:113:takigu1/google-workspace-mcp-server:0.5.0
```

**なぜ 0.7.0 のリリースでは直さなかったか**: ツール追加の変更とは無関係で、差分に混ぜると
レビューの焦点がぼやけるため。また「タグを書き換える」だけで済ませると同じことが次のリリースでも
起きるので、構造を直すかの判断を先にしたい。

なお `eed8f14 docs: :memo: Docker イメージのタグをバージョン固定するよう案内を変更` で
**意図的にバージョンを固定する方針にした**経緯がある。固定をやめる案はこの判断を覆すことになるので、
そのつもりで決める必要がある。

## 着手できる条件

いつでも着手できる。
