import { BaseCommandService } from '../base/service.interface.js';
import { AddLineCommand } from './commands/add-line.command.js';
import { AddShapeCommand } from './commands/add-shape.command.js';
import { AddSlideCommand } from './commands/add-slide.command.js';
import { AddTableCommand } from './commands/add-table.command.js';
import { AddTextBoxCommand } from './commands/add-text-box.command.js';
import { BatchUpdatePresentationCommand } from './commands/batch-update-presentation.command.js';
import { ConnectLineCommand } from './commands/connect-line.command.js';
import { CreateParagraphBulletsCommand } from './commands/create-paragraph-bullets.command.js';
import { CreatePresentationCommand } from './commands/create-presentation.command.js';
import { DeleteElementCommand } from './commands/delete-element.command.js';
import { DeleteParagraphBulletsCommand } from './commands/delete-paragraph-bullets.command.js';
import { DeleteTableDimensionCommand } from './commands/delete-table-dimension.command.js';
import { DisconnectLineCommand } from './commands/disconnect-line.command.js';
import { DuplicateSlideCommand } from './commands/duplicate-slide.command.js';
import { GetPageCommand } from './commands/get-page.command.js';
import { GetPresentationCommand } from './commands/get-presentation.command.js';
import { GroupElementsCommand } from './commands/group-elements.command.js';
import { InsertImageCommand } from './commands/insert-image.command.js';
import { InsertTableDimensionCommand } from './commands/insert-table-dimension.command.js';
import { ListPresentationsCommand } from './commands/list-presentations.command.js';
import { ReplaceAllTextCommand } from './commands/replace-all-text.command.js';
import { ResizeTableCommand } from './commands/resize-table.command.js';
import { UngroupElementsCommand } from './commands/ungroup-elements.command.js';
import { UpdateElementTransformCommand } from './commands/update-element-transform.command.js';
import { UpdateElementsZOrderCommand } from './commands/update-elements-z-order.command.js';
import { UpdateParagraphStyleCommand } from './commands/update-paragraph-style.command.js';
import { UpdateShapeStyleCommand } from './commands/update-shape-style.command.js';
import { UpdateSlidePropertiesCommand } from './commands/update-slide-properties.command.js';
import { UpdateTableBordersCommand } from './commands/update-table-borders.command.js';
import { UpdateTableCellsCommand } from './commands/update-table-cells.command.js';
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
    this.registerCommand(new AddSlideCommand());
    this.registerCommand(new UpdateParagraphStyleCommand());
    this.registerCommand(new CreateParagraphBulletsCommand());
    this.registerCommand(new DeleteParagraphBulletsCommand());
    this.registerCommand(new UpdateElementTransformCommand());
    this.registerCommand(new UpdateElementsZOrderCommand());
    this.registerCommand(new AddLineCommand());
    this.registerCommand(new GroupElementsCommand());
    this.registerCommand(new UngroupElementsCommand());
    this.registerCommand(new AddTableCommand());
    this.registerCommand(new UpdateTableCellsCommand());
    this.registerCommand(new UpdateTableBordersCommand());
    this.registerCommand(new ResizeTableCommand());
    this.registerCommand(new InsertTableDimensionCommand());
    this.registerCommand(new DeleteTableDimensionCommand());
    this.registerCommand(new ConnectLineCommand());
    this.registerCommand(new DisconnectLineCommand());
  }
}
