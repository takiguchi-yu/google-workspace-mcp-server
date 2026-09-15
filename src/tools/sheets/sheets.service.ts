import { BaseCommandService } from '../base/service.interface.js';
import { AddConditionalFormatCommand } from './commands/add-conditional-format.command.js';
import { AddSheetCommand } from './commands/add-sheet.command.js';
import { AppendSheetValuesCommand } from './commands/append-sheet-values.command.js';
import { BatchUpdateSheetValuesCommand } from './commands/batch-update-sheet-values.command.js';
import { ClearBasicFilterCommand } from './commands/clear-basic-filter.command.js';
import { ClearDataValidationCommand } from './commands/clear-data-validation.command.js';
import { ClearSheetValuesCommand } from './commands/clear-sheet-values.command.js';
import { CreateSpreadsheetCommand } from './commands/create-spreadsheet.command.js';
import { DeleteConditionalFormatCommand } from './commands/delete-conditional-format.command.js';
import { DeleteDimensionCommand } from './commands/delete-dimension.command.js';
import { DeleteSheetCommand } from './commands/delete-sheet.command.js';
import { DuplicateSheetCommand } from './commands/duplicate-sheet.command.js';
import { FormatCellsCommand } from './commands/format-cells.command.js';
import { FreezePanesCommand } from './commands/freeze-panes.command.js';
import { GetSpreadsheetInfoCommand } from './commands/get-spreadsheet-info.command.js';
import { ImportSheetCsvCommand } from './commands/import-sheet-csv.command.js';
import { InsertDimensionCommand } from './commands/insert-dimension.command.js';
import { ListConditionalFormatsCommand } from './commands/list-conditional-formats.command.js';
import { ListSpreadsheetsCommand } from './commands/list-spreadsheets.command.js';
import { MergeCellsCommand } from './commands/merge-cells.command.js';
import { ReadSheetValuesCommand } from './commands/read-sheet-values.command.js';
import { ResizeDimensionCommand } from './commands/resize-dimension.command.js';
import { SetBasicFilterCommand } from './commands/set-basic-filter.command.js';
import { SetBordersCommand } from './commands/set-borders.command.js';
import { SetDataValidationCommand } from './commands/set-data-validation.command.js';
import { SortRangeCommand } from './commands/sort-range.command.js';
import { UpdateSheetPropertiesCommand } from './commands/update-sheet-properties.command.js';
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
    this.registerCommand(new DeleteSheetCommand());
    this.registerCommand(new DuplicateSheetCommand());
    this.registerCommand(new UpdateSheetPropertiesCommand());
    this.registerCommand(new AppendSheetValuesCommand());
    this.registerCommand(new ClearSheetValuesCommand());
    this.registerCommand(new ImportSheetCsvCommand());
    this.registerCommand(new InsertDimensionCommand());
    this.registerCommand(new DeleteDimensionCommand());
    this.registerCommand(new SortRangeCommand());
    this.registerCommand(new SetBasicFilterCommand());
    this.registerCommand(new ClearBasicFilterCommand());
    this.registerCommand(new SetDataValidationCommand());
    this.registerCommand(new ClearDataValidationCommand());
    this.registerCommand(new FormatCellsCommand());
    this.registerCommand(new SetBordersCommand());
    this.registerCommand(new MergeCellsCommand());
    this.registerCommand(new ResizeDimensionCommand());
    this.registerCommand(new FreezePanesCommand());
    this.registerCommand(new AddConditionalFormatCommand());
    this.registerCommand(new DeleteConditionalFormatCommand());
    this.registerCommand(new ListConditionalFormatsCommand());
  }
}
