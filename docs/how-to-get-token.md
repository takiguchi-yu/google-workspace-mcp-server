# トークンの取得手順

OAuth 認証情報を使って、Google Workspace にアクセスするためのトークンを取得します。これにより、GitHub Copilot から Google Workspace を操作できるようになります。

## 前提条件

- `credentials.json` ファイルが準備できていること
  - まだの場合は [OAuth 認証情報の取得手順](./how-to-create-credentials.md) を参照してください
- Docker がインストールされていること
- AWS アカウントへのアクセス権限があること
- シェル環境: `bash` または `zsh`（macOS のデフォルトシェル）

---

## 手順

### 1. AWS 設定（環境変数の設定）

コマンドをコピペで実行できるように、AWS関連の情報を環境変数として設定します。

```sh
# AWS設定を環境変数に設定（実際の値に置き換えてください）
export AWS_REGION="ap-northeast-1"  # 例: ap-northeast-1
export AWS_PROFILE="your-profile"   # 例: default
export AWS_ACCOUNT_ID="123456789012"  # 例: 123456789012
```

> **注**: これらの値は、ターミナルセッションが終了すると消えます。永続化したい場合は `~/.zshrc` や `~/.bashrc` に追加してください。

### 2. 作業ディレクトリの準備

```sh
# 任意の作業ディレクトリを作成
mkdir -p ~/google-workspace-mcp-server
cd ~/google-workspace-mcp-server

# ダウンロードした credentials.json をこのディレクトリに配置
# 空の token.json ファイルを作成
touch token.json
```

### 3. Docker イメージの取得

```sh
# ECR にログイン (Login Succeeded が表示されれば成功)
aws ecr get-login-password --region $AWS_REGION --profile $AWS_PROFILE | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com

# Docker イメージを取得
docker pull $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/google-workspace-mcp-server:latest
```

### 4. トークンの取得

```sh
cd ~/google-workspace-mcp-server

docker run -it --rm \
  -p 8000:8000 \
  -v $(pwd)/credentials.json:/app/credentials.json \
  -v $(pwd)/token.json:/app/token.json \
  $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/google-workspace-mcp-server:latest \
  npm run setup
```

コンソールに表示された URL を開き、Google アカウントで認証してください。認証が成功すると、`token.json` ファイルにアクセストークンが保存されます。

> **成功の確認**: `token.json` ファイルにトークン情報が書き込まれていることを確認してください。

---

次のステップ: [GitHub Copilot の設定](./setup.md#github-copilot-の設定)
