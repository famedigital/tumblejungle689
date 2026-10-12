declare module "node:sqlite" {
  export class DatabaseSync {
    constructor(path: string);
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
  }

  export class StatementSync {
    run(...params: SQLInputValue[]): { changes: number; lastInsertRowid: number | bigint };
    get(...params: SQLInputValue[]): unknown;
    all(...params: SQLInputValue[]): unknown[];
  }

  type SQLInputValue = string | number | bigint | null | Uint8Array;
}
