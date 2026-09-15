# Docker の利用手順に書いてあるイメージタグが古い

`docs/how-to-get-token.md` が案内しているイメージタグが 0.5.0 のまま止まっている。
現在の最新は 0.7.0。

**Status:** 完了
**Blocked by:** なし

## 完了条件

- [x] イメージタグを現行バージョン（0.7.0）に合わせる
- [x] 他のドキュメントにも同じ表記が無いか洗う（`grep -rn "google-workspace-mcp-server:" docs README.md`）
- [x] **リリースのたびに古くなる構造そのものを直す** → `scripts/sync-version.js` の対象に
      ドキュメントを加えた。`latest` に戻す案は採らない（`eed8f14` の判断を覆すことになるため）

## 見つけたときの状況

0.7.0 のリリース作業中（2026-09-15）に気づいた。**該当は 6 箇所**で、起票時に「3 箇所」と
書いたのは grep の出力を途中で切っていたための数え間違い。

```
docs/how-to-get-token.md:69,90,113,210
docs/setup.md:57,92
```

### 0.5.0 で止まった理由

`eed8f14`（2026-08-29）で `latest` からバージョン固定に変えたとき、その時点の最新だった
0.5.0 を書いた。**同じ日にリリースされた 0.5.0 の直後**（`f12243a`）である。

以降 0.6.0 / 0.6.1 / 0.6.2 / 0.7.0 と 4 回リリースしたが、`scripts/sync-version.js` が
同期するのは `package.json` → `server.json` だけで、ドキュメントは対象外。
**書き換える仕組みが無いので、人が気づかない限り古いまま残る。**

**なぜ 0.7.0 のリリースでは直さなかったか**: ツール追加の変更とは無関係で、差分に混ぜると
レビューの焦点がぼやけるため。リリース後に指摘を受けて 0.7.0 に書き換えた（2026-09-15）。

なお `eed8f14 docs: :memo: Docker イメージのタグをバージョン固定するよう案内を変更` で
**意図的にバージョンを固定する方針にした**経緯がある。固定をやめる案はこの判断を覆すことになるので、
そのつもりで決める必要がある。

## 決めたこと

**バージョンの真実は `package.json` の `version` ただ 1 つ**とし、`server.json` と
ドキュメントの Docker タグはそこに追随するだけにした。人が覚えて書き換えるものではなくなる。

### 設計パス

- **概念**: 「バージョンの同期対象」。真実は `package.json`、追随先が `server.json` とドキュメント
- **責務**: `scripts/sync-version.js` が「真実を追随先に書き戻す」1 つを持つ
- **依存の向き**: スクリプト → ファイル の一方向。ファイル側はスクリプトを知らない

### ステージを誰がやるか

**書き換えたファイルを知っているのはスクリプトだけ**なので、`git add` もスクリプトに持たせた。
追随先が増えても `package.json` の version フックを直さずに済む。

手で `npm run sync-version` を叩いたぶんが勝手にステージされると困るので、`--stage` を
付けたときだけステージする。version フックからだけ付ける。

```json
"sync-version": "node ./scripts/sync-version.js",
"version": "node ./scripts/sync-version.js --stage",
```

**既存の慣習からは少し離れている。** 従来は version フックが `git add server.json` を
持っていた（`npm run sync-version && git add server.json`）。追随先が増えるたびにフックの
引数を足す必要があり、足し忘れると今回と同じことが起きるため、スクリプト側に寄せた。

### イメージ名をハードコードしない

Docker Hub のユーザー名は `vars.DOCKERHUB_USERNAME`（`publish.yml:39`）で決まるので、
スクリプトは `google-workspace-mcp-server:X.Y.Z` のイメージ名から後ろだけを見る。
ユーザー名が変わっても追随する。

## 実測で確かめたこと

ドキュメントのタグを 0.5.0 に戻してから実行し、書き換えとステージの両方を確認した。

```
$ npm run sync-version
✅ Synced server.json version to 0.7.0
✅ Synced docs/how-to-get-token.md image tag to 0.7.0 (4 occurrences)
✅ Synced docs/setup.md image tag to 0.7.0 (2 occurrences)

$ node ./scripts/sync-version.js --stage
✅ Staged: server.json, docs/how-to-get-token.md, docs/setup.md
```

- 書き換え後の `git diff docs/` は空（＝ 6 箇所すべて元の 0.7.0 に戻った）
- 変更が無いファイルはステージされない（docs が最新のときは `Staged: server.json` だけ）
- `npm run lint` / `format:check` はエラー無し

## 申し送り

- **`npm version` を通した全体の流れはまだ踏んでいない。** 次のリリース（0.8.0）が実地の検証になる。
  `git add` が失敗してもリリースが止まらない作りではないので、そこで初めて分かる不具合はありうる。
- **Docker タグを書くドキュメントを増やしたら `DOCUMENT_FILES` に足す**（`scripts/sync-version.js:18`）。
  現在は `docs/how-to-get-token.md` / `docs/setup.md` / `README.md` の 3 つを見ている
  （README には今のところ記述が無いが、増えたときのために入れてある）。
