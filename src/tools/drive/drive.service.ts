import { BaseCommandService } from '../base/service.interface.js';
import { ListDriveItemsCommand } from './commands/list-drive-items.command.js';
import { SearchDriveFilesCommand } from './commands/search-drive-files.command.js';

/**
 * Google Drive サービス
 * コマンドパターンを使用して各操作を独立したコマンドクラスに委譲
 */
export class DriveService extends BaseCommandService {
  /**
   * Drive サービスが提供するすべてのコマンドを登録
   */
  protected registerCommands(): void {
    this.registerCommand(new SearchDriveFilesCommand());
    this.registerCommand(new ListDriveItemsCommand());
  }
}
