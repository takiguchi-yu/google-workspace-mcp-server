# Google Workspace MCP Server

Google Workspace MCP Server は、GitHub Copilot などの AI アシスタントから Google Workspace サービス（Slides、Sheets、Drive）を操作できるようにする MCP サーバーです。

## 主な機能

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
2. OAuth 認証情報をもとに Google Workspace の機能を操作するためのトークンを取得（初回のみ）
3. GitHub Copilot で使用開始

詳細なセットアップ手順は **[docs/setup.md](docs/setup.md)** を参照してください。

## プロジェクト構成

```
src/
├── index.ts                # MCP サーバー起動
├── auth/                   # OAuth 認証管理
├── manager/                # サービス統合管理
└── tools/                  # Google Workspace ツール実装
    ├── sheets/
    ├── slides/
    └── drive/
```

## 開発者向け： クラス設計

[docs/class-diagram.md](docs/class-diagram.md)

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
