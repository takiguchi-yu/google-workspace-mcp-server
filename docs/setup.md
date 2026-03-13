# Google Workspace MCP Server - セットアップガイド

Google Workspace MCP Server 利用者が Docker コンテナとしてサーバーを起動し、GitHub Copilot から Google Workspace サービスを操作できるようにするためのセットアップ手順を説明します。

## 目次

1. [前提条件](#前提条件)
2. [セットアップ手順](#セットアップ手順)
3. [GitHub Copilot との連携/設定](#github-copilot-との連携設定)

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

👉 **詳細手順**: [OAuth 認証情報の取得手順](./how-to-create-credentials.md)

### 2. トークンを取得

`credentials.json` を使用して、Google Workspace にアクセスするためのトークンを取得します。

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
        "/Users/YOUR_USERNAME/google-workspace-mcp/credentials.json:/app/credentials.json",
        "-v",
        "/Users/YOUR_USERNAME/google-workspace-mcp/token.json:/app/token.json",
        "YOUR_DOCKERHUB_USERNAME/google-workspace-mcp-server:latest"
      ]
    }
  }
}
```

> **重要**:
>
> - `/Users/YOUR_USERNAME/` の部分を実際のホームディレクトリパスに置き換えてください
> - `YOUR_DOCKERHUB_USERNAME` を実際の DockerHub ユーザー名に置き換えてください
> - バージョン固定で利用したい場合は `:latest` ではなく `:1.0.1` のようなタグを指定してください

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

以上でセットアップは完了です。GitHub Copilot から Google Workspace の操作が可能になります。
