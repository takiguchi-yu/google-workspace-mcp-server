import { BaseCommandService } from '../base/service.interface.js';
import { AddShapeCommand } from './commands/add-shape.command.js';
import { AddTextBoxCommand } from './commands/add-text-box.command.js';
import { BatchUpdatePresentationCommand } from './commands/batch-update-presentation.command.js';
import { CreatePresentationCommand } from './commands/create-presentation.command.js';
import { DeleteElementCommand } from './commands/delete-element.command.js';
import { DuplicateSlideCommand } from './commands/duplicate-slide.command.js';
import { GetPageCommand } from './commands/get-page.command.js';
import { GetPresentationCommand } from './commands/get-presentation.command.js';
import { InsertImageCommand } from './commands/insert-image.command.js';
import { ListPresentationsCommand } from './commands/list-presentations.command.js';
import { ReplaceAllTextCommand } from './commands/replace-all-text.command.js';
import { UpdateShapeStyleCommand } from './commands/update-shape-style.command.js';
import { UpdateSlidePropertiesCommand } from './commands/update-slide-properties.command.js';
import { UpdateTextShapeCommand } from './commands/update-text-shape.command.js';
import { UpdateTextStyleCommand } from './commands/update-text-style.command.js';

/**
 * Google Slides サービス
 * コマンドパターンを使用して各操作を独立したコマンドクラスに委譲
 */
export class SlidesService extends BaseCommandService {
  /**
   * Slides サービスが提供するすべてのコマンドを登録
   */
  protected registerCommands(): void {
    this.registerCommand(new CreatePresentationCommand());
    this.registerCommand(new GetPresentationCommand());
    this.registerCommand(new ListPresentationsCommand());
    this.registerCommand(new GetPageCommand());
    this.registerCommand(new UpdateTextShapeCommand());
    this.registerCommand(new AddTextBoxCommand());
    this.registerCommand(new DeleteElementCommand());
    this.registerCommand(new DuplicateSlideCommand());
    this.registerCommand(new AddShapeCommand());
    this.registerCommand(new UpdateSlidePropertiesCommand());
    this.registerCommand(new BatchUpdatePresentationCommand());
    this.registerCommand(new UpdateTextStyleCommand());
    this.registerCommand(new UpdateShapeStyleCommand());
    this.registerCommand(new InsertImageCommand());
    this.registerCommand(new ReplaceAllTextCommand());
  }
}
