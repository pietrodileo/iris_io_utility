import * as vscode from "vscode";
import { SQLStatement } from "./models/sql/sqlClient";
import { IRISStatementType, SQLResult } from "./models/sql/sqlTypes";

/**
 * IRIS SQL Implementation
 * Provides SQL query capabilities for InterSystems IRIS Native SDK
 * 
 * This is needed because the IRIS Native SDK does not support SQL statements natively. 
 * This class provides a wrapper around the IRIS Native SDK to execute SQL queries to perform the 
 *  Prepare, Execute, and Fetch operations without the need of explicitily declaring them at every SQL call.
 * 
 * The same implementation can be found at: https://github.com/caretdev/typeorm-iris
 */

/**
 * IRIS SQL Client - provides SQL query capabilities
 */
export class IRISql {
  public outputChannel: vscode.OutputChannel;

  constructor(private iris: any, outputChannel: vscode.OutputChannel) {
    if (!iris) {
      throw new Error("IRISql: IRIS instance not provided.");
    }
    this.outputChannel = outputChannel;
  }

  /**
   * Execute a SQL query and return results
   */
  async query(sql: string, parameters: any[] = []): Promise<any[]> {
    try {
      this.log(`[IRISql] Executing query: ${sql}`);

      const statement = new SQLStatement(this.iris, sql, this.outputChannel);
      const result = statement.execute(...parameters);

      if (result.Message) {
        throw new Error(result.Message);
      }

      this.log(`[IRISql] Retrieved ${result.rows.length} rows`);
      return result.rows;
    } catch (error: any) {
      console.error(`[IRISql] Query failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Execute a SQL statement (INSERT, UPDATE, DELETE)
   */
  async execute(sql: string, parameters: any[] = []): Promise<number> {
    try {
      this.log(`[IRISql] Executing statement: ${sql}`);

      const statement = new SQLStatement(this.iris, sql, this.outputChannel);
      const result = statement.execute(...parameters);

      if (result.Message) {
        throw new Error(result.Message);
      }

      // For INSERT, return lastInsertId; for others, return affected rows
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
      console.error(`[IRISql] Execute failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Execute a query and return the full result object with metadata
   */
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
      console.error(`[IRISql] Query with metadata failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Log message with timestamp
   */
  private log(message: string): void {
    const timestamp = new Date().toISOString();
    this.outputChannel.appendLine(`[${timestamp}] ${message}`);
  }
}
