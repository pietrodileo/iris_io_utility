import type { SQLResult, SQLColumn } from "./sqlTypes";
import { IRISStatementType, ODBCType } from "./sqlTypes";

/**
 * Class for executing IRIS SQL statements and fetching results
 */
export class SQLStatement {
  private readonly _st: any;

  constructor(private iris: any, public queryString: string) {
    try {
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
      if (arg === null || arg === undefined) {return null;}
      if (typeof arg === "string") {return arg;}
      if (typeof arg === "number") {return arg.toString();}
      if (typeof arg === "boolean") {return arg ? "1" : "0";}
      if (Buffer.isBuffer(arg)) {return arg.toString("binary");}
      if (arg instanceof Date) {return this.dateToString(arg);}
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
    if (!metadata) {return;}

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
    while (_rs.invokeBoolean("%Next")) {
      const row: any = {};
      result.columns.forEach((col) => {
        const colName = col.colName;
        let value;

        switch (col.ODBCType) {
          case ODBCType.INTEGER:
          case ODBCType.SMALLINT:
          case ODBCType.TINYINT:
            value = _rs.invokeNumber("%Get", colName);
            break;
          case ODBCType.DATE:
          case ODBCType.TIMESTAMP:
            value = _rs.invokeString("%Get", colName);
            value = new Date(value);
            break;
          case ODBCType.TIME:
            value = _rs.invokeString("%Get", colName);
            break;
          case ODBCType.DATE_HOROLOG:
          case ODBCType.TIME_HOROLOG:
            value = _rs.invokeNumber("%Get", colName);
            break;
          case ODBCType.BIGINT:
            value = _rs.invokeString("%Get", colName);
            break;
          case ODBCType.NUMERIC:
            value = _rs.invokeString("%Get", colName);
            break;
          case ODBCType.FLOAT:
          case ODBCType.REAL:
          case ODBCType.DOUBLE:
            value = _rs.invokeNumber("%Get", colName);
            break;
          case ODBCType.DECIMAL:
            value = _rs.invokeDecimal("%Get", colName);
            break;
          case ODBCType.BINARY:
          case ODBCType.LONGVARBINARY:
          case ODBCType.LONGVARCHAR:
            value = _rs.invokeIRISList("%Get", colName);
            break;
          case ODBCType.BIT:
            value = _rs.invokeBoolean("%Get", colName);
            break;
          case ODBCType.VARCHAR:
            value = _rs.invokeString("%Get", colName);
            break;
          default:
            value = _rs.invokeString("%Get", colName);
        }
        row[colName] = value;
      });
      result.rows.push(row);
    }
  }
}
