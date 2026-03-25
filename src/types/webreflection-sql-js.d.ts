declare module "@webreflection/sql.js" {
  export interface SqlJsQueryResult {
    columns: unknown[];
    values: unknown[][];
  }

  export interface SqlJsDatabase {
    exec(sql: string): SqlJsQueryResult[];
    close(): void;
  }

  export interface SqlJsModule {
    Database: new (data?: Uint8Array) => SqlJsDatabase;
  }

  export interface InitSqlJsOptions {
    locateFile?: (file: string) => string;
  }

  export default function initSqlJs(
    options?: InitSqlJsOptions
  ): Promise<SqlJsModule>;
}
