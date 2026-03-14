# クラス設計（クラス図）

このプロジェクトは複数のデザインパターンを組み合わせて、拡張性と保守性の高いアーキテクチャを実現しています。

## 採用しているデザインパターン

- **ストラテジーパターン**: 各 Google Workspace サービス（Sheets, Slides, Drive）を独立した戦略として実装
- **コマンドパターン**: 各ツールの操作を独立したコマンドクラスとしてカプセル化
- **ファクトリーパターン**: `ServiceManager` がサービスを統合管理し、適切なサービスに処理を振り分け
- **テンプレートメソッドパターン**: `BaseCommandService` が共通処理を提供し、サブクラスで具体的なコマンド登録を実装

```mermaid
classDiagram
    %% 認証管理
    class GoogleAuthManager {
        -auth: OAuth2Client
        -credentialsPath: string
        -tokenPath: string
        +getAuth() Promise~OAuth2Client~
    }

    %% コアインターフェース
    class Command {
        <<interface>>
        +getToolDefinition() ToolDefinition
        +execute(args) Promise~CallToolResult~
    }

    class WorkspaceService {
        <<interface>>
        +getTools() ToolDefinition[]
        +execute(toolName, args) Promise~CallToolResult~
    }

    %% 基底クラスとマネージャー
    class BaseCommandService {
        <<abstract>>
        #auth: OAuth2Client
        #commands: Map~string, Command~
        #registerCommands()* void
        +getTools() ToolDefinition[]
        +execute(toolName, args) Promise~CallToolResult~
    }

    class ServiceManager {
        -services: Map~string, WorkspaceService~
        +registerService(service) void
        +getTools() ToolDefinition[]
        +handleToolCall(name, args) Promise~CallToolResult~
    }

    %% 具体例（代表）
    class SheetsService {
        +registerCommands() void
    }

    class ListSpreadsheetsCommand {
        -auth: OAuth2Client
        +getToolDefinition() ToolDefinition
        +execute(args) Promise~CallToolResult~
    }

    %% 関係性
    GoogleAuthManager ..> BaseCommandService : provides OAuth2Client
    WorkspaceService <|.. BaseCommandService : implements
    BaseCommandService <|-- SheetsService : extends
    ServiceManager o-- WorkspaceService : manages
    Command <|.. ListSpreadsheetsCommand : implements
    BaseCommandService o-- Command : uses
    SheetsService ..> ListSpreadsheetsCommand : creates

    note for GoogleAuthManager "シングルトン的な\n認証管理"
    note for ServiceManager "ファクトリーパターン"
    note for BaseCommandService "テンプレートメソッド"
    note for SheetsService "ストラテジー"
    note for ListSpreadsheetsCommand "コマンド"
```

> **Note**: 図は代表的なクラスのみを表示しています。実際には Slides/Drive サービスや各種コマンドクラスも同様のパターンで実装されています。
