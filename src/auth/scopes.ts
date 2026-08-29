/**
 * ユーザー認可（OAuth）で要求するスコープ。
 *
 * Drive については drive.file（非機密）に留めている。認可した利用者の Drive 全体ではなく、
 * このアプリが作成・利用したファイルだけを対象にするため。
 */
export const OAUTH_SCOPES = [
  'https://www.googleapis.com/auth/presentations',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/documents',
];

/**
 * サービスアカウントで要求するスコープ。
 *
 * サービスアカウントは「共有されたファイル」を扱うのが目的なので、drive.file ではなく drive を使う。
 * drive.file はアプリ自身が作成したファイルしか対象にせず、共有されたファイルが見えないため。
 * サービスアカウントには同意画面が存在せず、アクセス範囲はファイルの共有設定だけで決まる。
 */
export const SERVICE_ACCOUNT_SCOPES = [
  'https://www.googleapis.com/auth/presentations',
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/documents',
];
