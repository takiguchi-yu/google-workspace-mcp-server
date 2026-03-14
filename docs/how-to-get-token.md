# トークンの取得手順

OAuth 認証情報を使って、Google Workspace にアクセスするためのトークンを取得します。これにより、GitHub Copilot から Google Workspace を操作できるようになります。

## 前提条件

- `credentials.json` ファイルが準備できていること
  - まだの場合は [OAuth 認証情報の取得手順](./how-to-create-credentials.md) を参照してください
- Docker がインストールされていること
- シェル環境: `bash` または `zsh`（macOS のデフォルトシェル）

---

## 手順

### 1. 作業ディレクトリの準備

```sh
# 任意の作業ディレクトリを作成
mkdir -p ~/google-workspace-mcp-server
cd ~/google-workspace-mcp-server

# ダウンロードした credentials.json をこのディレクトリに配置
# 空の token.json ファイルを作成
touch token.json
```

### 2. Docker イメージの取得

```sh
# DockerHub から Docker イメージを取得
docker pull takigu1/google-workspace-mcp-server:latest

# 利用可能タグ一覧
# https://hub.docker.com/r/takigu1/google-workspace-mcp-server/tags
```

### 3. トークンの取得

```sh
cd ~/google-workspace-mcp-server

docker run -it --rm \
  -p 8000:8000 \
  -v $(pwd)/credentials.json:/app/credentials.json \
  -v $(pwd)/token.json:/app/token.json \
  takigu1/google-workspace-mcp-server:latest \
  npm run setup
```

コンソールに表示された URL を開き、Google アカウントで認証してください。認証が成功すると、`token.json` ファイルにアクセストークンが保存されます。

> **成功の確認**: `token.json` ファイルにトークン情報が書き込まれていることを確認してください。

---

次のステップ: [GitHub Copilot の設定](./setup.md#github-copilot-の設定)
