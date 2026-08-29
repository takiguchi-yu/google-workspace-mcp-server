# Google Workspace MCP Server

Google Workspace MCP Server は、GitHub Copilot などの AI アシスタントから Google Workspace サービス（Slides、Sheets、Docs、Drive）を操作できるようにする MCP サーバーです。

会社用・個人用など、**複数の Google アカウントを 1 つのサーバーで使い分けられます**。

## 主な機能

### 👤 アカウント

- **accounts_list** - 登録されている Google アカウントの一覧を取得

すべてのツールに `account` 引数があり、`work` `private` のようなラベルで対象アカウントを指定します。省略した場合は既定アカウントが使われます。

アカウントごとに **OAuth**（利用者として認証）と **サービスアカウント**（ブラウザ認可が不要）を選べます。

|                        | OAuth      | サービスアカウント |
| ---------------------- | ---------- | ------------------ |
| ブラウザでの認可       | 必要       | 不要               |
| 既存ファイルの読み書き | Drive 全体 | 共有したものだけ   |
| 新規ファイルの作成     | 可         | 不可               |

### 📊 Google Sheets

- **sheets_list_spreadsheets** - スプレッドシート一覧を取得
- **sheets_get_spreadsheet_info** - スプレッドシートの詳細情報（シート一覧、プロパティ）を取得
- **sheets_read_sheet_values** - セル範囲のデータを読み取り
- **sheets_update_sheet_values** - セル範囲のデータを更新
- **sheets_create_spreadsheet** - 新規スプレッドシートを作成
- **sheets_add_sheet** - 既存のスプレッドシートにシートを追加
- **sheets_append_values** - 既存データの末尾に行を追記
- **sheets_clear_sheet_values** - 指定範囲のセルの値をクリア
- **sheets_import_csv** - CSV/TSV ファイルをスプレッドシートにインポート（カスタムデリミタ・Base64対応）
- **sheets_insert_dimension** - 指定位置に行・列を挿入
- **sheets_delete_dimension** - 指定範囲の行・列を削除

### 📄 Google Docs

- **docs_get_document** - Google Doc の本文を Markdown 形式で取得（見出し・段落・篇条書き・テーブルに対応）

### 🖼️ Google Slides

- **slides_create_presentation** - プレゼンテーションを作成
- **slides_get_presentation** - プレゼンテーションの内容を取得
- **slides_list_presentations** - プレゼンテーション一覧を取得
- **slides_get_page** - 特定スライドの詳細情報を取得
- **slides_update_text_shape** - テキスト要素の内容を更新または追記
- **slides_add_text_box** - スライドに新しいテキストボックスを追加
- **slides_delete_element** - スライドの要素（図形、テキストボックス、画像など）を削除
- **slides_duplicate_slide** - スライドを複製
- **slides_add_shape** - スライドに図形（矩形、円、矢印など）を追加
- **slides_update_slide_properties** - スライドのプロパティ（背景色など）を更新
- **slides_batch_update_presentation** - 複数の更新リクエストをバッチで実行（高度な操作）

### 📁 Google Drive

- **drive_search_files** - ファイルを検索（クエリ構文対応）
- **drive_list_items** - フォルダ内のファイル一覧を取得

## クイックスタート

### 簡単な流れ

1. Google Cloud で OAuth 認証情報（CLIENT_ID, SECRET）を作成（初回のみ）
2. OAuth 認証情報をもとに、アカウントごとのトークンを取得（アカウントを追加するたび）
3. GitHub Copilot で使用開始

```sh
# 会社アカウントを登録
npm run setup -- --account work --description "会社の Google Workspace"

# 個人アカウントを登録
npm run setup -- --account private --description "個人の Google アカウント"
```

詳細なセットアップ手順は **[docs/setup.md](docs/setup.md)** を参照してください。

## プロジェクト構成

```
src/
├── index.ts                # MCP サーバー起動
├── auth/                   # アカウント設定・トークン・OAuth クライアントの解決
├── manager/                # サービス統合管理と account 引数の取り回し
└── tools/                  # Google Workspace ツール実装
    ├── accounts/
    ├── sheets/
    ├── slides/
    ├── docs/
    └── drive/
```

設定とトークンは 1 つのディレクトリにまとまります。

```
~/.google-workspace-mcp/
├── accounts.json           # アカウント一覧と既定アカウント
├── credentials.json        # 全アカウントで共有する OAuth クライアント
└── accounts/
    ├── work/token.json                 # OAuth のトークン
    └── private/service-account.json    # サービスアカウントの鍵
```

用語の定義は [CONTEXT.md](CONTEXT.md) を参照してください。

## 新しいバージョンへの差し替え

新しいバージョンが公開されたら、次のコマンドで差し替えます。

```sh
npm run update-image             # 公開済みの最新版へ差し替える
npm run update-image -- 0.4.1    # バージョンを指定して差し替える
npm run update-image -- --dry-run  # 何が起きるかだけ表示する
```

やっていること:

1. Docker Hub のタグ一覧から最新のリリースバージョンを選び、`docker pull` する
2. MCP クライアントの設定（既定は `~/.claude.json`）に固定されているタグを差し替える（控えを `.bak` に残す）
3. 不要になった旧イメージを削除する（そのイメージで動いているコンテナがあれば削除せず知らせる）

差し替え後は、Claude Code を再起動するか `/mcp` で再接続すると新しいイメージで起動します。

| オプション        | 意味                                                                          |
| ----------------- | ----------------------------------------------------------------------------- |
| `--config <path>` | 設定ファイルの場所を変える（既定: `~/.claude.json`）                          |
| `--image <name>`  | 対象の Docker イメージを変える（既定: `takigu1/google-workspace-mcp-server`） |
| `--keep-old`      | 旧イメージを削除しない                                                        |
| `--dry-run`       | 変更せず、差し替え内容だけ表示する                                            |

> タグは `latest` ではなくバージョンで固定したままにします。`latest` は指す先が黙って変わるため、
> 今どのバージョンが動いているのか分からなくなります。

## 開発者向け： クラス設計

[docs/class-diagram.md](docs/class-diagram.md)

## 開発者向け： テスト

```sh
npm test    # ビルドしたうえで認証・アカウント解決層のテストを実行
```

## 開発者向け： Docker コンテナのデプロイメント方法

以下のファイルを参照してください：

- [docs/docker-deployment.md](docs/docker-deployment.md)

## 開発者向け： MCP Registry への公開手順

以下のファイルを参照してください：

- [docs/mcp-registry-publish.md](docs/mcp-registry-publish.md)

## 参考にしたプロジェクト

- [google_workspace_mcp](https://github.com/taylorwilsdon/google_workspace_mcp)

## 備忘

https://registry.modelcontextprotocol.io/?q=google-workspace で MCP を検索すると `-server` なしのプロジェクトが見つかるが、初期に登録してしまったものなので、 `unpublish` 的な操作ができるようになったら、そちらは削除する予定。（2026年3月時点では削除ができない。）
