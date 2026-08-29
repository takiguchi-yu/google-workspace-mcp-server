# Google Workspace MCP Server - セットアップガイド

Google Workspace MCP Server 利用者が Docker コンテナとしてサーバーを起動し、GitHub Copilot から Google Workspace サービスを操作できるようにするためのセットアップ手順を説明します。

## 目次

1. [前提条件](#前提条件)
2. [セットアップ手順](#セットアップ手順)
3. [GitHub Copilot の設定](#github-copilot-の設定)
4. [複数アカウントの使い分け](#複数アカウントの使い分け)

---

## 前提条件

- Docker がインストールされていること
- MacOS 環境
- Google Workspace アカウント
- DockerHub から公開イメージを pull できること

---

## セットアップ手順

### 1. OAuth 認証情報（CLIENT_ID、SECRET）を取得

Google Cloud Console で OAuth 認証情報を作成し、`credentials.json` ファイルを取得します。

👉 **詳細手順**: [認証情報の取得手順](./how-to-create-credentials.md)

### 2. トークンを取得

`credentials.json` を使用して、Google Workspace にアクセスするためのトークンを取得します。
会社用・個人用など複数のアカウントを登録する場合も、この手順をラベルを変えて繰り返すだけです。

👉 **詳細手順**: [トークンの取得手順](./how-to-get-token.md)

---

## GitHub Copilot の設定

### 1. VS Code の設定

VS Code の設定ファイル `.vscode/mcp.json` を作成/編集します：

```json
{
  "servers": {
    "google-workspace": {
      "command": "docker",
      "args": [
        "run",
        "--rm",
        "-i",
        "-v",
        "${userHome}/.google-workspace-mcp:/app/.google-workspace-mcp",
        "takigu1/google-workspace-mcp-server:0.4.0"
      ]
    }
  }
}
```

> **補足**:
>
> - マウントするのは設定とトークンをまとめた**ディレクトリ 1 つだけ**です。アカウントを増やしてもこの設定は変わりません
> - 利用可能な Docker イメージタグは以下で確認できます
>   - https://hub.docker.com/r/takigu1/google-workspace-mcp-server/tags

<details>
<summary>以前のバージョンから移行していない場合</summary>

`credentials.json` と `token.json` を直接マウントする従来の設定も、そのまま動作します。
これらは `default` というラベルのアカウント 1 件として読み込まれます。

```json
{
  "servers": {
    "google-workspace": {
      "command": "docker",
      "args": [
        "run",
        "--rm",
        "-i",
        "-v",
        "~/google-workspace-mcp-server/credentials.json:/app/credentials.json",
        "-v",
        "~/google-workspace-mcp-server/token.json:/app/token.json",
        "takigu1/google-workspace-mcp-server:0.4.0"
      ]
    }
  }
}
```

新レイアウトへの移し方は [トークンの取得手順](./how-to-get-token.md#以前のバージョンから移行する) を参照してください。

</details>

### 2. 接続確認

VS Code を再起動すると、GitHub Copilot から Google Workspace MCP Server に接続されます。

### 3. 使用例

#### ユースケース例

**📊 Google Sheets のデータ取得（URL指定）**

```
GitHub Copilot: このスプレッドシートの最新の売上データを取得してください
スプレッドシート ID: 1ABC123...XYZ
```

**📄 Google Slides の特定ページを読む（URL指定）**

```
GitHub Copilot: このプレゼンテーションの1ページ目の内容を教えてください
プレゼンテーション ID: 1ABC123...XYZ
```

**📁 Google Drive フォルダの内容確認（URL指定）**

```
GitHub Copilot: このフォルダ内のファイル一覧を取得してください
フォルダ ID: 1ABC123...XYZ
```

**🔍 ファイル検索（URLが不明な場合）**

```
GitHub Copilot: Google Drive で「議事録」というキーワードを含むファイルを検索してください
```

> **推奨**:
>
> URL が判明している場合は直接 ID もしくは URL を指定することで、Google Drive 内の大量ドキュメントから検索する処理が不要になり、より迅速で正確な結果が得られます。

---

## 複数アカウントの使い分け

会社用と個人用のように、複数の Google アカウントを 1 つのサーバーで扱えます。

### 登録済みアカウントを確認する

```
GitHub Copilot: 使える Google アカウントを教えて
```

`accounts_list` ツールが呼ばれ、登録されているラベル・既定アカウント・説明文が返ります。

### アカウントを指定して操作する

すべてのツールに `account` 引数があります。会話の中で自然に指定すれば、Copilot が対応するラベルを選びます。

```
GitHub Copilot: 個人のドライブから「家計簿」を検索して
GitHub Copilot: 会社のアカウントで議事録スプレッドシートを作成して
```

説明文（`--description`）を登録しておくと、「会社の」「個人の」といった曖昧な言い方からでも正しいラベルが選ばれやすくなります。

### `account` を省略したときの動作

| 登録アカウント数 | 既定アカウント                      | `account` 省略時           |
| ---------------- | ----------------------------------- | -------------------------- |
| 1 件             | 自動的にそのアカウント              | そのアカウントで実行       |
| 複数             | `accounts.json` の `defaultAccount` | 既定アカウントで実行       |
| 複数             | 未設定                              | エラー（候補ラベルを提示） |

取り違えを確実に防ぎたい場合は、`accounts.json` から `defaultAccount` を消して常に明示指定させてください。

### よくあるエラー

| メッセージ                               | 意味                              | 対処                                                            |
| ---------------------------------------- | --------------------------------- | --------------------------------------------------------------- |
| `Unknown account '...'`                  | 存在しないラベルを指定した        | `accounts_list` で正しいラベルを確認する                        |
| `... is not authorized yet`              | 登録済みだが未認可                | `npm run setup -- --account <label>` を実行する                 |
| `The 'account' argument is required ...` | 既定が決まっていない              | `account` を指定するか `defaultAccount` を設定する              |
| `No OAuth client credentials found ...`  | `credentials.json` が見つからない | [認証情報の取得手順](./how-to-create-credentials.md) を参照する |

---

以上でセットアップは完了です。GitHub Copilot から Google Workspace の操作が可能になります。
