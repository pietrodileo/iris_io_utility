import * as vscode from "vscode";
const irisnative = require("@intersystems/intersystems-iris-native");
import type { IrisConnectionConfig } from "./models/connection/irisConnectionConfig";
import {
  TableColumn,
  TableIndex,
  TableDescription,
  SchemaTable,
} from "./models/connection/irisTables";
import { IRISql } from "./irisSQL";

/**
 * Class that represents a connection to an IRIS instance and provides methods for executing queries.
 *  It is a wrapper around the irisnative library.
 *
 * This is an adaptation of IRIStool Python package, a wrapper around the IRIS Native Python SDK,
 *  that can be found at: https://github.com/pietrodileo/iris_tool_and_data_manager
 */
export class IrisConnector {
  private connection: any;
  private iris: any;
  private sql!: IRISql;

  public host: string;
  public port: number;
  public namespace: string;
  public username: string;
  private password: string;

  private outputChannel: vscode.OutputChannel;

  constructor(
    config: IrisConnectionConfig,
    outputChannel: vscode.OutputChannel
  ) {
    this.host = config.host;
    this.port =
      typeof config.port === "string" ? parseInt(config.port) : config.port;
    this.namespace = config.ns;
    this.username = config.user;
    this.password = config.pwd;

    this.outputChannel = outputChannel;
  }

  // ---------- Connection Management ----------
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        if (this.isConnected()) {
          this.log("[IrisConnector] Already connected");
          resolve();
          return;
        }

        const config: IrisConnectionConfig = {
          host: this.host,
          port: this.port,
          ns: this.namespace,
          user: this.username,
          pwd: this.password,
        };

        this.log("[IrisConnector] Creating connection...");
        this.connection = irisnative.createConnection(config);
        this.iris = this.connection.createIris();
        this.log("[IrisConnector] Connected successfully");

        this.log("[IrisConnector] Initializing SQL client...");
        this.sql = new IRISql(this.iris, this.outputChannel);
        this.log(`[IrisConnector] SQL client initialized: ${!!this.sql}`);

        resolve();
      } catch (err: any) {
        console.error("[IrisConnector] Connection failed:", err.message);
        reject(err);
      }
    });
  }

  isConnected(): boolean {
    return this.iris !== null && this.iris !== undefined;
  }

  close(): void {
    if (this.connection) {
      try {
        this.connection.close();
        this.log("[IrisConnector] Connection closed");
      } catch (error: any) {
        console.error("[IrisConnector] Error closing:", error.message);
      }
      this.connection = null;
      this.iris = null;
      this.sql = null as any;
    }
  }

  async test(): Promise<boolean> {
    try {
      this.log("[IrisConnector] Starting connection test...");
      if (!this.isConnected()) {
        this.log("[IrisConnector] Not connected, test failed");
        return false;
      }
      return true;
    } catch (error: any) {
      console.error("[IrisConnector] Test failed with error:", error.message);
      console.error("[IrisConnector] Error details:", error);
      return false;
    }
  }

  toString(): string {
    return `IRIS connection [${this.username}@${this.host}:${this.port}/${this.namespace}]`;
  }

  // ---------- Query Execution ----------
  async query(sql: string, parameters: any[] = []): Promise<any[]> {
    if (!this.isConnected()) {
      throw new Error("Not connected to IRIS");
    }
    if (!this.sql) {
      throw new Error("SQL client not initialized. Call connect() first.");
    }
    return await this.sql.query(sql, parameters);
  }

  async execute(sql: string, parameters: any[] = []): Promise<number> {
    if (!this.isConnected()) {
      throw new Error("Not connected to IRIS");
    }
    return await this.sql.execute(sql, parameters);
  }

  // ---------- Schema & Table Information ----------
  async getSchemas(filter: string | null = null): Promise<string[]> {
    this.log(`[IrisConnector] Getting schemas`);
    let sql = `
      SELECT DISTINCT TABLE_SCHEMA
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_TYPE='BASE TABLE'
    `;
    let parameters: any[] = [];
    if (typeof filter === "string" && filter.trim() !== "") {
      sql += ` AND TABLE_SCHEMA LIKE ? `;
      parameters.push(`${filter}%`);
    }
    sql += " ORDER BY TABLE_SCHEMA ";

    const results = await this.query(sql, parameters);
    this.log(`[IrisConnector] Got ${results.length} schemas`);
    return results.map((row) => row.TABLE_SCHEMA);
  }

  async getTables(schema: string): Promise<string[]> {
    this.log(`[IrisConnector] Getting tables for schema ${schema}`);
    const sql = `
      SELECT TABLE_NAME
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = ?
      AND TABLE_TYPE='BASE TABLE'
      ORDER BY TABLE_NAME
    `;
    const results = await this.query(sql, [schema]);
    this.log(
      `[IrisConnector] Got ${results.length} tables for schema ${schema}`
    );
    return results.map((row) => row.TABLE_NAME);
  }

  async getAllTables(
    tableNameFilter?: string,
    schemaFilter?: string
  ): Promise<SchemaTable[]> {
    let sql = `
      SELECT TABLE_SCHEMA, TABLE_NAME
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_TYPE='BASE TABLE'
    `;

    const parameters: any[] = [];

    if (tableNameFilter) {
      sql += " AND TABLE_NAME = ?";
      parameters.push(tableNameFilter);
    }

    if (schemaFilter) {
      sql += " AND TABLE_SCHEMA = ?";
      parameters.push(schemaFilter);
    }

    sql += " ORDER BY TABLE_SCHEMA, TABLE_NAME";

    return await this.query(sql, parameters);
  }

  async tableExists(
    tableName: string,
    schema: string = "SQLUser"
  ): Promise<boolean> {
    const sql = `
      SELECT COUNT(*) as num_rows
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_NAME = ?
      AND TABLE_SCHEMA = ?
    `;

    const results = await this.query(sql, [tableName, schema]);
    return results[0]?.num_rows > 0;
  }

  async describeTable(
    tableName: string,
    schema: string = "SQLUser"
  ): Promise<TableDescription> {
    // Get columns
    const columnsSql = `
      SELECT TABLE_SCHEMA, TABLE_NAME, 
        COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, 
        IS_NULLABLE, AUTO_INCREMENT, UNIQUE_COLUMN, PRIMARY_KEY, ODBCTYPE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = ?
      AND TABLE_SCHEMA = ?
    `;

    const columns = await this.query(columnsSql, [tableName, schema]);

    // Get indexes
    const indexesSql = `
      SELECT INDEX_NAME, COLUMN_NAME, PRIMARY_KEY, NON_UNIQUE
      FROM INFORMATION_SCHEMA.INDEXES
      WHERE TABLE_NAME = ?
      AND TABLE_SCHEMA = ?
    `;

    const indexes = await this.query(indexesSql, [tableName, schema]);

    return {
      columns,
      indexes,
    };
  }

  // ---------- Table Data Export (OPTIMIZED) ----------
  async exportTableToJson(
    tableName: string,
    schema: string = "SQLUser",
    limit?: number
  ): Promise<any[]> {
    const fullTableName = `${schema}.${tableName}`;
    const sql = limit
      ? `SELECT TOP ${limit} * FROM ${fullTableName}`
      : `SELECT * FROM ${fullTableName}`;

    this.log(`[IrisConnector] Exporting ${fullTableName} to JSON...`);
    const startTime = Date.now();

    const result = await this.query(sql);

    const elapsed = Date.now() - startTime;
    this.log(`[IrisConnector] Exported ${result.length} rows in ${elapsed}ms`);

    return result;
  }

  async exportTableToCsv(
    tableName: string,
    schema: string = "SQLUser",
    limit?: number
  ): Promise<string> {
    this.log(`[IrisConnector] Exporting ${schema}.${tableName} to CSV...`);
    const startTime = Date.now();

    const data = await this.exportTableToJson(tableName, schema, limit);

    if (data.length === 0) {
      return "";
    }

    // Get headers
    const headers = Object.keys(data[0]);

    // Pre-allocate array with estimated size for better performance
    const estimatedSize = data.length + 1;
    const csvRows: string[] = new Array(estimatedSize);
    csvRows[0] = headers.join(",");

    // Batch process rows for better performance
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const values = headers.map((header) => {
        const value = row[header];
        if (value === null || value === undefined) {
          return "";
        }
        const stringValue = String(value);
        // Only escape if necessary
        if (
          stringValue.includes(",") ||
          stringValue.includes('"') ||
          stringValue.includes("\n")
        ) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
      });
      csvRows[i + 1] = values.join(",");
    }

    const result = csvRows.join("\n");
    const elapsed = Date.now() - startTime;
    this.log(
      `[IrisConnector] CSV export completed in ${elapsed}ms (${Math.round(
        result.length / 1024
      )}KB)`
    );

    return result;
  }

  async exportTableToTxt(
    tableName: string,
    schema: string = "SQLUser",
    delimiter: string = "\t",
    limit?: number
  ): Promise<string> {
    this.log(`[IrisConnector] Exporting ${schema}.${tableName} to TXT...`);
    const startTime = Date.now();

    const data = await this.exportTableToJson(tableName, schema, limit);

    if (data.length === 0) {
      return "";
    }

    // Get headers
    const headers = Object.keys(data[0]);

    // Pre-allocate array
    const rows: string[] = new Array(data.length + 1);
    rows[0] = headers.join(delimiter);

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const values = headers.map((header) => {
        const value = row[header];
        return value === null || value === undefined ? "" : String(value);
      });
      rows[i + 1] = values.join(delimiter);
    }

    const result = rows.join("\n");
    const elapsed = Date.now() - startTime;
    this.log(`[IrisConnector] TXT export completed in ${elapsed}ms`);

    return result;
  }

  async exportTableToExcelData(
    tableName: string,
    schema: string = "SQLUser",
    limit?: number
  ): Promise<{ headers: string[]; data: any[][] }> {
    const jsonData = await this.exportTableToJson(tableName, schema, limit);

    if (jsonData.length === 0) {
      return { headers: [], data: [] };
    }

    const headers = Object.keys(jsonData[0]);
    const data = jsonData.map((row) => headers.map((header) => row[header]));

    return { headers, data };
  }

  // ---------- Validation ----------
  validateTableName(tableName: string, schema?: string): string {
    if (tableName.includes(".") || tableName.includes("_")) {
      throw new Error(
        `Invalid table_name '${tableName}'. ` +
          "Do not include schema or underscores in table_name. " +
          "Example: table_schema='EnsLib_Background_Workflow', table_name='ExportResponse'."
      );
    }

    if (schema && schema.includes(".")) {
      throw new Error(
        `Invalid table_schema '${schema}'. ` +
          "Do not include periods in table_schema."
      );
    }

    return schema ? `${schema}.${tableName}` : tableName;
  }

  getNameAndSchema(fullName: string): { tableName: string; schema: string } {
    const parts = fullName.split(".");

    if (parts.length === 1) {
      return { tableName: parts[0], schema: "SQLUser" };
    }

    const tableName = parts[parts.length - 1];
    const schema = parts[0];

    if (tableName.includes(".") || tableName.includes("_")) {
      throw new Error(
        `Invalid table_name '${fullName}'. ` +
          "Do not include schema or underscores in table_name."
      );
    }

    if (schema.includes(".")) {
      throw new Error(
        `Invalid table_schema '${schema}'. ` +
          "Do not include periods in table_schema."
      );
    }

    return { tableName, schema };
  }

  // ---------- Insert Operations ----------
  async insertRow(
    tableName: string,
    values: Record<string, any>,
    schema: string = "SQLUser"
  ): Promise<void> {
    const fullName = this.validateTableName(tableName, schema);
    const columns = Object.keys(values).join(", ");
    const placeholders = Object.keys(values)
      .map(() => "?")
      .join(", ");
    const sql = `INSERT INTO ${fullName} (${columns}) VALUES (${placeholders})`;

    try {
      await this.execute(sql, Object.values(values));
      this.log(`Inserted row into ${fullName}`);
    } catch (error: any) {
      console.error(`Failed to insert into ${fullName}: ${error.message}`);
      throw error;
    }
  }

  async insertMany(
    tableName: string,
    rows: Record<string, any>[],
    schema: string = "SQLUser"
  ): Promise<number> {
    if (rows.length === 0) {
      return 0;
    }

    const fullTable = this.validateTableName(tableName, schema);
    const columns = Object.keys(rows[0]);
    const colStr = columns.join(", ");
    const placeholders = columns.map(() => "?").join(", ");
    const sql = `INSERT INTO ${fullTable} (${colStr}) VALUES (${placeholders})`;

    let count = 0;
    try {
      for (const row of rows) {
        const values = columns.map((col) => row[col]);
        await this.execute(sql, values);
        count++;
      }
      this.log(`${count} row(s) added into ${fullTable}`);
      return count;
    } catch (error: any) {
      console.error(`Failed to insert into ${fullTable}: ${error.message}`);
      throw error;
    }
  }

  // ---------- Table Management ----------
  async createTable(
    tableName: string,
    columns: Record<string, string>,
    constraints: string[] = [],
    schema: string = "SQLUser"
  ): Promise<void> {
    const fullTableName = this.validateTableName(tableName, schema);

    const colDefs = Object.entries(columns).map(
      ([col, type]) => `${col} ${type}`
    );
    const allDefs = [...colDefs, ...constraints];
    const sql = `CREATE TABLE ${fullTableName} ( ${allDefs.join(", ")} )`;

    try {
      await this.execute(sql);
      this.log(`Table ${fullTableName} created successfully`);
    } catch (error: any) {
      console.error(`Error creating table ${fullTableName}: ${error.message}`);
      throw error;
    }
  }

  async dropTable(
    tableName: string,
    schema: string = "SQLUser",
    ifExists: boolean = true
  ): Promise<void> {
    const fullName = this.validateTableName(tableName, schema);
    const sql = `DROP TABLE ${ifExists ? "IF EXISTS " : ""}${fullName}`;

    try {
      await this.execute(sql);
      this.log(`Table ${fullName} dropped successfully`);
    } catch (error: any) {
      console.error(`Error dropping table ${fullName}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Log message with timestamp
   */
  public log(message: string): void {
    const timestamp = new Date().toISOString();
    this.outputChannel.appendLine(`[${timestamp}] ${message}`);
  }
}
