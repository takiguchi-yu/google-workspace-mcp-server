# トークンの取得手順

OAuth 認証情報を使って、Google Workspace にアクセスするためのトークンを取得します。これにより、GitHub Copilot から Google Workspace を操作できるようになります。

会社用・個人用など、**複数の Google アカウントを登録できます**。アカウントは `work` `private` のような短い**ラベル**で区別します。

> **サービスアカウントを使う場合、このページの手順は不要です。**
> ブラウザでの認可が要らないため、鍵を 1 コマンドで登録するだけで済みます。
> → [サービスアカウントを登録する](#サービスアカウントを登録する)

## 前提条件

- `credentials.json` ファイルが準備できていること
  - まだの場合は [認証情報の取得手順](./how-to-create-credentials.md) を参照してください
- Docker がインストールされていること
- シェル環境: `bash` または `zsh`（macOS のデフォルトシェル）

---

## ファイルの配置

設定とトークンは、次の 1 つのディレクトリにまとまります。Docker へのマウントもこのディレクトリ 1 つだけで済みます。

```
~/.google-workspace-mcp/
├── accounts.json              # アカウント一覧と既定アカウント（setup が自動で書きます）
├── credentials.json           # 全アカウントで共有する OAuth クライアント
└── accounts/
    ├── work/
    │   └── token.json         # 会社アカウントのトークン（OAuth）
    └── private/
        └── service-account.json  # 個人アカウントの鍵（サービスアカウント）
```

アカウントごとに認証方式を選べます。資格情報は**次の順で探索**され、**内容から種類が自動判別**されます。

1. `accounts.json` の `credentialsPath`（明示指定した場合）
2. `accounts/<ラベル>/service-account.json` → サービスアカウント
3. `accounts/<ラベル>/credentials.json` → そのアカウント専用の OAuth クライアント
4. `credentials.json` → 全アカウント共有の OAuth クライアント

設定ファイルに方式を書く必要はありません。鍵を置いた位置と中身で決まります。

> **アカウントごとに別の OAuth クライアントを使いたい場合**
>
> 会社の Google Workspace が組織ポリシーで外部の OAuth アプリをブロックしている場合など、
> 会社の Google Cloud プロジェクトで作ったクライアントが必要になることがあります。
> その場合は `~/.google-workspace-mcp/accounts/work/credentials.json` に置いてください。
> アカウント専用のものがあればそちらが、無ければ共有のものが使われます。

---

## 手順

### 1. 作業ディレクトリの準備

```sh
# 設定とトークンの置き場所を作成
mkdir -p ~/.google-workspace-mcp

# ダウンロードした credentials.json をこのディレクトリに配置
mv ~/Downloads/client_secret_*.json ~/.google-workspace-mcp/credentials.json
```

### 2. Docker イメージの取得

```sh
# DockerHub から Docker イメージを取得（タグは必ずバージョンを指定する）
docker pull takigu1/google-workspace-mcp-server:0.5.0

# 利用可能タグ一覧
# https://hub.docker.com/r/takigu1/google-workspace-mcp-server/tags
```

> **`latest` は使わないでください。**
>
> `latest` は指す先が黙って変わるため、**今どのバージョンが動いているのか分からなくなります。**
> 実際、ローカルに `latest` がキャッシュされていると新しいバージョンを公開しても古いイメージのまま動き続け、
> 「設定は直したのに動かない」という切り分けの難しい状態になります。
>
> 以降のコマンドと MCP クライアントの設定では、すべて `:0.5.0` のようにバージョンを明示してください。
> バージョンを上げるときは、設定ファイルのタグを書き換えることが「適用した」という記録になります。

### 3. 1 つ目のアカウントを認可する

```sh
docker run -it --rm \
  -p 8000:8000 \
  -v ~/.google-workspace-mcp:/app/.google-workspace-mcp \
  takigu1/google-workspace-mcp-server:0.5.0 \
  npm run setup -- --account work --description "会社の Google Workspace"
```

コンソールに表示された URL を開き、**会社の Google アカウント**で認証してください。

- `--account` : アカウントのラベル。英数字・ハイフン・アンダースコアのみ
- `--description` : `accounts_list` に表示される説明文（省略可）。AI アシスタントがラベルを選ぶ手がかりになります
- `--port` : コールバック用サーバーのポート（省略時は 8000）
- `--service-account` : サービスアカウントの鍵のパス。指定するとブラウザでの認可を行いません
- `--force` : 既存トークン・既存鍵の上書き確認をスキップ

> **成功の確認**: `~/.google-workspace-mcp/accounts/work/token.json` が作成され、
> `~/.google-workspace-mcp/accounts.json` にエントリが追加されていることを確認してください。

### 4. 2 つ目以降のアカウントを認可する

同じコマンドをラベルを変えて実行します。

```sh
docker run -it --rm \
  -p 8000:8000 \
  -v ~/.google-workspace-mcp:/app/.google-workspace-mcp \
  takigu1/google-workspace-mcp-server:0.5.0 \
  npm run setup -- --account private --description "個人の Google アカウント"
```

> **注意**: ブラウザに前のアカウントのセッションが残っていると、同じアカウントで認証してしまいます。
> シークレットウィンドウで開くか、認証画面でアカウントを切り替えてください。

### 5. 既定アカウントを決める

**最初に登録したアカウントが既定になります。** 既定アカウントは、ツール呼び出しで `account` を省略したときに使われます。

変更したい場合は `~/.google-workspace-mcp/accounts.json` の `defaultAccount` を書き換えてください。

```json
{
  "defaultAccount": "work",
  "accounts": {
    "work": { "description": "会社の Google Workspace" },
    "private": { "description": "個人の Google アカウント" }
  }
}
```

`defaultAccount` を消すと、アカウントが複数ある場合は `account` の指定が必須になります。取り違えを確実に防ぎたい場合はこの設定にしてください。

---

## サービスアカウントを登録する

ブラウザでの認可が不要な方式です。鍵の作り方は [サービスアカウントを作成する](./how-to-create-credentials.md#サービスアカウントを作成する) を参照してください。

```sh
npm run setup -- --account private \
  --description "個人の Google アカウント" \
  --service-account ~/Downloads/<鍵>.json
```

ブラウザは開きません。鍵が `~/.google-workspace-mcp/accounts/private/service-account.json` に配置され、`accounts.json` も更新されます。

完了時に表示される**共有先アドレス**に、使いたいフォルダを「編集者」で共有してください。

```
⚠️  最後に、使いたいファイルを共有してください:

     mcp-bot@your-project.iam.gserviceaccount.com
```

> **共有していないファイルには一切アクセスできません。** これは制約であると同時に、
> AI に見せる範囲を明示的に限定できるという利点でもあります。
>
> **新規ファイルの作成はできません。** サービスアカウントはストレージ容量を持たないためです。
> 新規作成が必要なアカウントは OAuth で登録してください。

鍵を差し替える場合は `--force` を付けて再実行します。

```sh
npm run setup -- --account private --service-account ~/Downloads/<新しい鍵>.json --force
```

---

## ポートについて

コールバック用サーバーは既定でポート **8000** を使います。Docker の `-p 8000:8000` はこれに対応しています。

**ローカル実行でポートが埋まっていた場合は、空きポートへ自動的に切り替わります。**
デスクトップアプリ型の OAuth クライアントはループバックへのリダイレクトが任意のポートで許可されるため、追加の設定は不要です。

```
⚠️  ポート 8000 は使用中のため、空きポート 50878 を使用します。
🚀 OAuth サーバーを起動しました: http://localhost:50878
```

ポートを固定したい場合は `--port` を指定してください。

```sh
npm run setup -- --account private --port 8123
```

> **自動切り替えが起きないケース**
>
> - **`--port` を明示指定したとき** — 利用者の意図を尊重し、埋まっていればエラーにします
> - **ウェブアプリ型（`web`）の OAuth クライアントを使っているとき** — リダイレクト URI が完全一致である必要があるため、勝手にポートを変えられません。使用中のプロセスを停止するか、Google Cloud Console に別ポートのリダイレクト URI を登録して `--port` を指定してください
>
> **Docker で自動切り替えが起きた場合は注意してください。** コンテナ内のポートが `-p` の指定と食い違い、ブラウザからコールバックに到達できません。使用中のプロセスを停止してから再実行してください（通常、新しいコンテナ内で 8000 が埋まることはありません）。

---

## 認可をやり直す

同じラベルで再度 `npm run setup` を実行すると、上書き確認のうえでトークンを取り直せます。
確認を省略したい場合は `--force` を付けてください。

```sh
docker run -it --rm \
  -p 8000:8000 \
  -v ~/.google-workspace-mcp:/app/.google-workspace-mcp \
  takigu1/google-workspace-mcp-server:0.5.0 \
  npm run setup -- --account work --force
```

---

## 以前のバージョンから移行する

単一アカウント時代の `credentials.json` / `token.json` を個別にマウントしている場合、**0.5.0 以降ではそのままでは動きません。**
アカウントは `accounts.json` に登録されているものだけが読み込まれます。

次のようにファイルを移動してください。ラベル（ここでは `work`）は自分が分かる名前で構いません。

```sh
mkdir -p ~/.google-workspace-mcp/accounts/work
cp <既存の credentials.json> ~/.google-workspace-mcp/credentials.json
cp <既存の token.json>       ~/.google-workspace-mcp/accounts/work/token.json

cat > ~/.google-workspace-mcp/accounts.json <<'JSON'
{
  "defaultAccount": "work",
  "accounts": { "work": {} }
}
JSON
```

移行したら、MCP クライアントの設定を、旧ファイルの個別マウントからホームディレクトリ 1 つのマウントに置き換えてください。

```diff
- "-v", "<既存のディレクトリ>/credentials.json:/app/credentials.json",
- "-v", "<既存のディレクトリ>/token.json:/app/token.json",
+ "-v", "$HOME/.google-workspace-mcp:/app/.google-workspace-mcp",
```

---

次のステップ: [GitHub Copilot の設定](./setup.md#github-copilot-の設定)
