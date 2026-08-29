import { BaseCommandService } from '../base/service.interface.js';
import { GetDocumentCommand } from './commands/get-document.command.js';

/**
 * Google Docs サービス
 * コマンドパターンを使用して各操作を独立したコマンドクラスに委譲
 */
export class DocsService extends BaseCommandService {
  /**
   * Docs サービスが提供するすべてのコマンドを登録
   */
  protected registerCommands(): void {
    this.registerCommand(new GetDocumentCommand());
  }
}
