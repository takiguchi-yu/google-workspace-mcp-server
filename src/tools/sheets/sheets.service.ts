import { BaseCommandService } from '../base/service.interface.js';
import { AddSheetCommand } from './commands/add-sheet.command.js';
import { AppendSheetValuesCommand } from './commands/append-sheet-values.command.js';
import { BatchUpdateSheetValuesCommand } from './commands/batch-update-sheet-values.command.js';
import { ClearSheetValuesCommand } from './commands/clear-sheet-values.command.js';
import { CreateSpreadsheetCommand } from './commands/create-spreadsheet.command.js';
import { DeleteDimensionCommand } from './commands/delete-dimension.command.js';
import { GetSpreadsheetInfoCommand } from './commands/get-spreadsheet-info.command.js';
import { ImportSheetCsvCommand } from './commands/import-sheet-csv.command.js';
import { InsertDimensionCommand } from './commands/insert-dimension.command.js';
import { ListSpreadsheetsCommand } from './commands/list-spreadsheets.command.js';
import { ReadSheetValuesCommand } from './commands/read-sheet-values.command.js';
import { UpdateSheetValuesCommand } from './commands/update-sheet-values.command.js';

/**
 * Google Sheets サービス
 * コマンドパターンを使用して各操作を独立したコマンドクラスに委譲
 */
export class SheetsService extends BaseCommandService {
  /**
   * Sheets サービスが提供するすべてのコマンドを登録
   */
  protected registerCommands(): void {
    this.registerCommand(new ListSpreadsheetsCommand());
    this.registerCommand(new GetSpreadsheetInfoCommand());
    this.registerCommand(new ReadSheetValuesCommand());
    this.registerCommand(new UpdateSheetValuesCommand());
    this.registerCommand(new BatchUpdateSheetValuesCommand());
    this.registerCommand(new CreateSpreadsheetCommand());
    this.registerCommand(new AddSheetCommand());
    this.registerCommand(new AppendSheetValuesCommand());
    this.registerCommand(new ClearSheetValuesCommand());
    this.registerCommand(new ImportSheetCsvCommand());
    this.registerCommand(new InsertDimensionCommand());
    this.registerCommand(new DeleteDimensionCommand());
  }
}
