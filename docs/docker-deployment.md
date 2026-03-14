# DockerHub デプロイメントガイド（公開向け）

このガイドでは、Google Workspace MCP サーバーの Docker イメージを DockerHub の Public リポジトリへ公開する手順を説明します。

MCP サーバーを不特定多数が利用できる状態にするには、Private な ECR ではなく Public なレジストリ公開が必要です。

## 前提条件

- Docker がインストール済みであること
- DockerHub アカウントを作成済みであること
- DockerHub 上に Public リポジトリを作成済みであること
  - 例: `takigu1/google-workspace-mcp-server`

## 手順

### 1. DockerHub リポジトリ情報を環境変数に設定

以下の値を自分の DockerHub 情報に置き換えて設定します。

```sh
export DOCKERHUB_USERNAME="takigu1"
export IMAGE_NAME="google-workspace-mcp-server"
export IMAGE_TAG="0.0.6"
```

`IMAGE_TAG` には `latest` ではなく、リリースバージョン（例: `0.0.6`）を使うことを推奨します。

### 2. DockerHub にログイン

```sh
docker login
```

プロンプトに従って DockerHub のユーザー名とパスワード（またはアクセストークン）を入力します。

### 3. Docker イメージをビルド

```sh
docker build --no-cache -t $IMAGE_NAME:$IMAGE_TAG .
```

### 4. DockerHub 向けにタグ付け

```sh
docker tag $IMAGE_NAME:$IMAGE_TAG $DOCKERHUB_USERNAME/$IMAGE_NAME:$IMAGE_TAG
docker tag $IMAGE_NAME:$IMAGE_TAG $DOCKERHUB_USERNAME/$IMAGE_NAME:latest
```

### 5. DockerHub にプッシュ

```sh
docker push $DOCKERHUB_USERNAME/$IMAGE_NAME:$IMAGE_TAG
docker push $DOCKERHUB_USERNAME/$IMAGE_NAME:latest
```

## 公開確認

### 1. DockerHub 上で確認

以下の URL でイメージが公開されていることを確認します。

```text
https://hub.docker.com/r/takigu1/google-workspace-mcp-server
```

### 2. pull テストで確認

別環境またはローカルで以下を実行し、pull できることを確認します。

```sh
docker pull $DOCKERHUB_USERNAME/$IMAGE_NAME:$IMAGE_TAG
```

## 更新リリース時の運用

1. `IMAGE_TAG` を新しいバージョンに更新
2. 再ビルド
3. バージョンタグと `latest` を再タグ付け
4. 両方を push

## トラブルシューティング

- `denied: requested access to the resource is denied`
  - DockerHub にログインできていないか、リポジトリ名が誤っている可能性があります。
- `repository does not exist`
  - DockerHub 側で対象リポジトリが未作成、またはリポジトリ名が一致していない可能性があります。
- 公開したのに pull できない
  - リポジトリが Private になっていないか確認してください。Public に変更が必要です。
