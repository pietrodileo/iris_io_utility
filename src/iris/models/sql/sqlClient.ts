import * as vscode from "vscode";
import type { SQLResult, SQLColumn } from "./sqlTypes";
import { IRISStatementType, ODBCType } from "./sqlTypes";

/**
 * Class for executing IRIS SQL statements and fetching results
 */
export class SQLStatement {
  private readonly _st: any;
  public outputChannel: vscode.OutputChannel;

  constructor(
    private iris: any,
    public queryString: string,
    outputChannel: vscode.OutputChannel
  ) {
    try {
      this.outputChannel = outputChannel;
      this._st = iris.classMethodValue("%SQL.Statement", "%New", 1);
      const status = this._st.invokeString("%Prepare", this.queryString);
      if (status !== "1") {
        const message = iris.classMethodValue(
          "%SYSTEM.Status",
          "GetOneErrorText",
          status
        );
        throw new Error(message);
      }
    } catch (error: any) {
      throw new Error(`Error creating statement: ${error.message}`);
    }
  }

  execute(...args: any[]): SQLResult {
    const normalizedArgs = this.normalizeArgs(args);
    return this.createResultSet(this._st, normalizedArgs);
  }

  private normalizeArgs(args: any[]): any[] {
    if (!args || !args.length) {
      return [];
    }
    return args.map((arg) => {
      if (arg === null || arg === undefined) {
        return null;
      }
      if (typeof arg === "string") {
        return arg;
      }
      if (typeof arg === "number") {
        return arg.toString();
      }
      if (typeof arg === "boolean") {
        return arg ? "1" : "0";
      }
      if (Buffer.isBuffer(arg)) {
        return arg.toString("binary");
      }
      if (arg instanceof Date) {
        return this.dateToString(arg);
      }
      return arg;
    });
  }

  private dateToString(date: Date): string {
    const offset = date.getTimezoneOffset();
    return new Date(date.getTime() - offset * 60 * 1000)
      .toISOString()
      .replace("T", " ")
      .replace("Z", "");
  }

  private createResultSet(st: any, params: any[]): SQLResult {
    const _rs = st.invokeObject("%Execute", ...params);

    const result: SQLResult = {
      SQLCODE: _rs.getNumber("%SQLCODE"),
      Message: _rs.getString("%Message"),
      statementType: _rs.getNumber("%StatementType"),
      rows: [],
      columns: [],
      lastInsertId: null,
    };

    if (result.statementType === IRISStatementType.INSERT) {
      result.lastInsertId = _rs.getString("%ROWID");
    }

    if (result.statementType === IRISStatementType.SELECT) {
      this.fetchMetadata(_rs, result);
      this.fetchRows(_rs, result);
    }

    return result;
  }

  private fetchMetadata(_rs: any, result: SQLResult): void {
    const metadata = _rs.invokeObject("%GetMetadata");
    if (!metadata) {
      return;
    }

    const columns = metadata.getObject("columns");
    const colCount = metadata.getNumber("columnCount");

    for (let i = 0; i < colCount; i++) {
      const columnInfo = columns.invokeObject("GetAt", i + 1);
      const column: SQLColumn = {
        ODBCType: columnInfo.getNumber("ODBCType"),
        clientType: columnInfo.getNumber("clientType"),
        colName: columnInfo.getString("colName"),
        isAliased: columnInfo.getBoolean("isAliased"),
        isAutoIncrement: columnInfo.getBoolean("isAutoIncrement"),
        isCaseSensitive: columnInfo.getBoolean("isCaseSensitive"),
        isCurrency: columnInfo.getBoolean("isCurrency"),
        isExpression: columnInfo.getBoolean("isExpression"),
        isHidden: columnInfo.getBoolean("isHidden"),
        isIdentity: columnInfo.getBoolean("isIdentity"),
        isKeyColumn: columnInfo.getBoolean("isKeyColumn"),
        isList: columnInfo.getBoolean("isList"),
        isNullable: columnInfo.getBoolean("isNullable"),
        isReadOnly: columnInfo.getBoolean("isReadOnly"),
        isRowId: columnInfo.getBoolean("isRowId"),
        isRowVersion: columnInfo.getBoolean("isRowVersion"),
        isUnique: columnInfo.getBoolean("isUnique"),
        label: columnInfo.getString("label"),
        precision: columnInfo.getNumber("precision"),
        scale: columnInfo.getNumber("scale"),
        schemaName: columnInfo.getString("schemaName"),
        tableName: columnInfo.getString("tableName"),
      };
      result.columns.push(column);
    }
  }

  private fetchRows(_rs: any, result: SQLResult): void {
    const startTime = Date.now();
    let rowCount = 0;

    // Pre-create type getters for each column to avoid repeated switch statements
    // This is the KEY optimization - we create the getter functions ONCE
    const columnGetters = result.columns.map((col) => {
      const colName = col.colName;

      switch (col.ODBCType) {
        case ODBCType.INTEGER:
        case ODBCType.SMALLINT:
        case ODBCType.TINYINT:
        case ODBCType.FLOAT:
        case ODBCType.REAL:
        case ODBCType.DOUBLE:
        case ODBCType.DATE_HOROLOG:
        case ODBCType.TIME_HOROLOG:
          return (rs: any) => rs.invokeNumber("%Get", colName);

        case ODBCType.DATE:
        case ODBCType.TIMESTAMP:
          return (rs: any) => {
            const value = rs.invokeString("%Get", colName);
            return value ? new Date(value) : null;
          };

        case ODBCType.TIME:
        case ODBCType.BIGINT:
        case ODBCType.NUMERIC:
          return (rs: any) => rs.invokeString("%Get", colName);

        case ODBCType.DECIMAL:
          return (rs: any) => rs.invokeDecimal("%Get", colName);

        case ODBCType.BINARY:
        case ODBCType.LONGVARBINARY:
        case ODBCType.LONGVARCHAR:
          return (rs: any) => rs.invokeIRISList("%Get", colName);

        case ODBCType.BIT:
          return (rs: any) => rs.invokeBoolean("%Get", colName);

        case ODBCType.VARCHAR:
        default:
          return (rs: any) => rs.invokeString("%Get", colName);
      }
    });

    // Fetch all rows using optimized column getters
    while (_rs.invokeBoolean("%Next")) {
      const row: any = {};

      // Use pre-created getters instead of switch statement
      result.columns.forEach((col, index) => {
        row[col.colName] = columnGetters[index](_rs);
      });

      result.rows.push(row);
      rowCount++;
    }

    const elapsed = Date.now() - startTime;
    this.log(
      `[SQLStatement] Fetched ${rowCount} rows in ${elapsed}ms (${(
        rowCount /
        (elapsed / 1000)
      ).toFixed(0)} rows/sec)`
    );
  }

  /**
   * Log message with timestamp
   */
  public log(message: string): void {
    const timestamp = new Date().toISOString();
    this.outputChannel.appendLine(`[${timestamp}] ${message}`);
  }
}

