# MCP Registry 公開手順（このリポジトリ向け）

このドキュメントは、MCP Registry の Quickstart をベースに、
このリポジトリ（Google Workspace MCP Server）をレジストリ公開するまでの流れをまとめたものです。

- 参照元: https://github.com/modelcontextprotocol/registry/blob/main/docs/modelcontextprotocol-io/quickstart.mdx
- 注意: MCP Registry はプレビュー運用のため、仕様変更や破壊的変更が入る可能性があります。

## 全体フロー

1. npm 公開用メタデータを確認（`package.json`）
2. npm にパッケージを公開
3. `mcp-publisher` をインストール
4. `server.json` を生成・調整
5. MCP Registry にログイン（GitHub 認証）
6. MCP Registry に公開
7. API で公開結果を確認

## 前提条件

- Node.js がインストール済み
- npm アカウントを作成済み
- GitHub アカウントを作成済み
- このリポジトリを clone 済み

## このリポジトリで使う公開情報

`package.json` の現状値は以下です。

- npm パッケージ名: `@takiguchi-yu/google-workspace-mcp-server`
- パッケージバージョン: `1.0.1`
- mcpName: `io.github.takiguchi-yu/google-workspace-mcp-server`
- リポジトリ URL: `https://github.com/takiguchi-yu/google-workspace-mcp-server.git`

GitHub 認証で公開する場合、`mcpName` は `io.github.<GitHubユーザー名>/` プレフィックスが必須です。

## 手順

### 1. package.json の公開メタデータ確認

`package.json` で以下を確認します。

- `name`（npm のパッケージ名）
- `version`（今回公開するバージョン）
- `mcpName`（Registry 上のサーバー名）
- `repository.url`

公開前にバージョンを上げる場合は、`version` を更新してください。

### 2. ビルドして npm に公開

MCP Registry は成果物本体をホストしないため、先に npm 公開が必要です。

```sh
# 依存関係インストール
npm install

# 品質チェック
npm run type-check
npm run lint
npm run format:check

# ビルド
npm run build

# npm ログイン（未ログイン時のみ）
npm adduser

# npm 公開
npm publish --access public
```

公開後、npm 上でパッケージが見えることを確認します。

- https://www.npmjs.com/package/@takiguchi-yu/google-workspace-mcp-server

### 3. mcp-publisher をインストール

macOS では Homebrew が簡単です。

```sh
brew install mcp-publisher
mcp-publisher --help
```

Homebrew を使わない場合は、Quickstart のバイナリ配布手順を利用してください。

### 4. server.json を生成して内容を調整

プロジェクトルートでテンプレートを生成します。

```sh
mcp-publisher init
```

生成された `server.json` を開き、最低限以下が一致していることを確認します。

- `name`: `package.json` の `mcpName` と同一
- `version`: 今回公開するバージョン
- `repository.url`: GitHub リポジトリ URL
- `packages[0].registryType`: `npm`
- `packages[0].identifier`: npm パッケージ名
- `packages[0].version`: npm 公開バージョン
- `packages[0].transport.type`: 通常は `stdio`

例（概念）:

```json
{
  "$schema": "https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json",
  "name": "io.github.takiguchi-yu/google-workspace-mcp-server",
  "description": "An MCP server for Google Workspaces.",
  "repository": {
    "url": "https://github.com/takiguchi-yu/google-workspace-mcp-server.git",
    "source": "github"
  },
  "version": "1.0.1",
  "packages": [
    {
      "registryType": "npm",
      "identifier": "@takiguchi-yu/google-workspace-mcp-server",
      "version": "1.0.1",
      "transport": {
        "type": "stdio"
      }
    }
  ]
}
```

### 5. MCP Registry にログイン（GitHub）

```sh
mcp-publisher login github
```

表示された URL（GitHub device login）にアクセスし、コードを入力して認証します。

### 6. MCP Registry に公開

```sh
mcp-publisher publish
```

成功時は、公開完了メッセージとサーバー名・バージョンが表示されます。

### 7. 公開確認

検索 API でサーバー名を確認します。

```sh
curl "https://registry.modelcontextprotocol.io/v0.1/servers?search=io.github.takiguchi-yu/google-workspace-mcp-server"
```

レスポンス JSON に対象サーバーが含まれていれば公開完了です。

## 更新リリース時の運用

2 回目以降の公開は、以下の差分更新を行います。

1. `package.json` の `version` を更新
2. `npm publish --access public` を実行
3. `server.json` の `version` と `packages[].version` を同じ値に更新
4. `mcp-publisher publish` を再実行

## トラブルシューティング

- `Registry validation failed for package`
  - `package.json` の `mcpName` 未設定、または `server.json` と不一致の可能性があります。
- `Invalid or expired Registry JWT token`
  - `mcp-publisher login github` で再ログインしてください。
- `You do not have permission to publish this server`
  - 認証方式と `name` の名前空間が一致していない可能性があります。
  - GitHub 認証なら `io.github.<username>/...` 形式が必要です。

## 補足

- CI での自動公開は、公式ドキュメントの GitHub Actions 手順を参照してください。
- DNS 認証など他の認証方式を使う場合は、認証ドキュメントを参照してください。
