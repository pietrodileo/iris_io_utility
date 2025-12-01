/**
 * irisSQL.ts - Improved with unified interface
 */

import * as vscode from "vscode";
import { SQLStatement } from "./models/sql/sqlClient";
import { IRISStatementType, SQLResult } from "./models/sql/sqlTypes";
import * as odbc from "odbc";

/**
 * Base SQL Client Interface
 * Both IRISql and OdbcSqlClient implement this
 */
export interface ISqlClient {
  query(sql: string, parameters?: any[]): Promise<any[]>;
  execute(sql: string, parameters?: any[]): Promise<number>;
  queryWithMetadata?(sql: string, parameters?: any[]): Promise<SQLResult>;
}

/**
 * IRIS Native SDK SQL Client
 */
export class IRISql implements ISqlClient {
  public outputChannel: vscode.OutputChannel;

  constructor(private iris: any, outputChannel: vscode.OutputChannel) {
    if (!iris) {
      throw new Error("IRISql: IRIS instance not provided.");
    }
    this.outputChannel = outputChannel;
  }

  async query(sql: string, parameters: any[] = []): Promise<any[]> {
    try {
      this.log(`[IRISql] Executing query: ${sql.substring(0, 100)}...`);

      const statement = new SQLStatement(this.iris, sql, this.outputChannel);
      const result = statement.execute(...parameters);

      if (result.Message) {
        throw new Error(result.Message);
      }

      this.log(`[IRISql] Retrieved ${result.rows.length} rows`);
      return result.rows;
    } catch (error: any) {
      this.log(`[IRISql] Query failed: ${error.message}`);
      throw error;
    }
  }

  async execute(sql: string, parameters: any[] = []): Promise<number> {
    try {
      this.log(`[IRISql] Executing statement: ${sql.substring(0, 100)}...`);

      const statement = new SQLStatement(this.iris, sql, this.outputChannel);
      const result = statement.execute(...parameters);

      if (result.Message) {
        throw new Error(result.Message);
      }

      if (
        result.statementType === IRISStatementType.INSERT &&
        result.lastInsertId
      ) {
        this.log(`[IRISql] Inserted with ID: ${result.lastInsertId}`);
        return 1;
      }

      this.log(`[IRISql] Statement executed successfully`);
      return result.rows.length || 0;
    } catch (error: any) {
      this.log(`[IRISql] Execute failed: ${error.message}`);
      throw error;
    }
  }

  async queryWithMetadata(
    sql: string,
    parameters: any[] = []
  ): Promise<SQLResult> {
    try {
      const statement = new SQLStatement(this.iris, sql, this.outputChannel);
      const result = statement.execute(...parameters);

      if (result.Message) {
        throw new Error(result.Message);
      }

      return result;
    } catch (error: any) {
      this.log(`[IRISql] Query with metadata failed: ${error.message}`);
      throw error;
    }
  }

  private log(message: string): void {
    const timestamp = new Date().toISOString();
    this.outputChannel.appendLine(`[${timestamp}] ${message}`);
  }
}

/**
 * ODBC SQL Client (50-100x faster for SELECT queries)
 */
export class OdbcSqlClient implements ISqlClient {
  constructor(
    private connection: odbc.Connection,
    private outputChannel: vscode.OutputChannel
  ) {}

  async query(sql: string, parameters: any[] = []): Promise<any[]> {
    try {
      this.log(`[ODBC] Executing query: ${sql.substring(0, 100)}...`);
      const startTime = Date.now();

      let result: any[];
      if (parameters && parameters.length > 0) {
        result = await this.connection.query(sql, parameters);
      } else {
        result = await this.connection.query(sql);
      }

      const elapsed = Date.now() - startTime;
      const rate =
        elapsed > 0 ? Math.round(result.length / (elapsed / 1000)) : 0;
      this.log(
        `[ODBC] Retrieved ${result.length} rows in ${elapsed}ms (${rate} rows/sec)`
      );

      return result;
    } catch (error: any) {
      this.log(`[ODBC] Query failed: ${error.message}`);
      throw error;
    }
  }

  async execute(sql: string, parameters: any[] = []): Promise<number> {
    try {
      this.log(`[ODBC] Executing statement: ${sql}`);
      const startTime = Date.now();

      let result: any;
      if (parameters && parameters.length > 0) {
        result = await this.connection.query(sql, parameters);
      } else {
        result = await this.connection.query(sql);
      }

      const elapsed = Date.now() - startTime;

      // ODBC returns affected rows in different ways depending on the operation
      const affected = result.count || result.length || 0;
      this.log(
        `[ODBC] Statement executed in ${elapsed}ms, affected rows: ${affected}`
      );

      return affected;
    } catch (error: any) {
      this.log(`[ODBC] Execute failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * ODBC doesn't provide detailed metadata like Native SDK
   * This returns a simplified SQLResult
   */
  async queryWithMetadata(
    sql: string,
    parameters: any[] = []
  ): Promise<SQLResult> {
    const rows = await this.query(sql, parameters);

    // Create minimal SQLResult structure
    const result: SQLResult = {
      rows,
      columns: [],
      statementType: IRISStatementType.SELECT,
      SQLCODE: 0,
      Message: undefined,
      lastInsertId: undefined,
    };

    // Extract column info from first row if available
    if (rows.length > 0) {
      const firstRow = rows[0];
      result.columns = Object.keys(firstRow).map((colName) => ({
        ODBCType: 0,
        clientType: "",
        colName,
        isNullable: true,
      })) as any;
    }

    return result;
  }

  private log(message: string): void {
    const timestamp = new Date().toISOString();
    this.outputChannel.appendLine(`[${timestamp}] ${message}`);
  }
}

/**
 * Factory function to create appropriate SQL client
 */
export function createSqlClient(
  connectionType: "native" | "odbc",
  connection: any,
  outputChannel: vscode.OutputChannel
): ISqlClient {
  if (connectionType === "odbc") {
    return new OdbcSqlClient(connection, outputChannel);
  } else {
    // For native, connection has createIris() method
    const iris = connection.createIris();
    return new IRISql(iris, outputChannel);
  }
}
