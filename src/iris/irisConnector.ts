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

  // ---------- File Analysis & Import Operations ----------

  /**
   * Analyze a file and infer column types
   */
  async analyzeFile(
    filePath: string,
    fileFormat: string
  ): Promise<{ columns: ColumnAnalysis[] }> {
    this.log(`[IrisConnector] Analyzing file: ${filePath} (${fileFormat})`);

    const fs = require("fs");
    let columns: ColumnAnalysis[] = [];

    try {
      if (fileFormat === "csv" || fileFormat === "txt") {
        columns = await this.analyzeCsvFile(filePath);
      } else if (fileFormat === "json") {
        columns = await this.analyzeJsonFile(filePath);
      } else if (fileFormat === "xlsx" || fileFormat === "xls") {
        columns = await this.analyzeExcelFile(filePath);
      } else {
        throw new Error(`Unsupported file format: ${fileFormat}`);
      }

      this.log(
        `[IrisConnector] Analysis complete: ${columns.length} columns found`
      );
      return { columns };
    } catch (error: any) {
      this.log(`[IrisConnector] Analysis failed: ${error.message}`);
      throw error;
    }
  }

  private async analyzeCsvFile(filePath: string): Promise<ColumnAnalysis[]> {
    const fs = require("fs");
    const content = fs.readFileSync(filePath, "utf8");

    // Split by lines and filter empty
    const lines = content.split(/\r?\n/).filter((line: string) => line.trim() !== "");

    if (lines.length === 0) {
      throw new Error("File is empty");
    }

    // Detect delimiter (comma, semicolon, or tab)
    const firstLine = lines[0];
    const delimiter = firstLine.includes("\t")
      ? "\t"
      : firstLine.includes(";")
      ? ";"
      : ",";

    // Parse headers
    const headers = this.parseCsvLine(lines[0], delimiter);

    // Get sample rows (up to 100 for analysis)
    const sampleSize = Math.min(100, lines.length - 1);
    const sampleRows = lines
      .slice(1, sampleSize + 1)
      .map((line: string) => this.parseCsvLine(line, delimiter));

    // Analyze each column
    return headers.map((header, index) => {
      const originalName = header;
      const sanitizedName = this.sanitizeColumnName(header);
      const values = sampleRows
        .map((row: any[]) => row[index])
        .filter((v: string) => v && v.trim() !== "");

      return {
        name: sanitizedName,
        originalName,
        inferredType: this.inferColumnType(values),
        sampleValue: values[0] || "NULL",
      };
    });
  }

  private async analyzeJsonFile(filePath: string): Promise<ColumnAnalysis[]> {
    const fs = require("fs");
    const content = fs.readFileSync(filePath, "utf8");
    const json = JSON.parse(content);

    // Handle both array and single object
    const sample = Array.isArray(json) ? json[0] : json;

    if (!sample || typeof sample !== "object") {
      throw new Error(
        "Invalid JSON structure: expected object or array of objects"
      );
    }

    return Object.entries(sample).map(([key, value]) => ({
      name: this.sanitizeColumnName(key),
      originalName: key,
      inferredType: this.inferTypeFromValue(value),
      sampleValue: String(value).substring(0, 50),
    }));
  }

  private async analyzeExcelFile(filePath: string): Promise<ColumnAnalysis[]> {
    // This requires xlsx library: npm install xlsx
    try {
      const XLSX = require("xlsx");
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];

      // Convert to JSON
      const data = XLSX.utils.sheet_to_json(sheet, { defval: "" });

      if (data.length === 0) {
        throw new Error("Excel file is empty");
      }

      const sample = data[0] as Record<string, any>;
      const sampleRows = data.slice(0, 100);

      return Object.keys(sample).map((key) => {
        const values = sampleRows
          .map((row: { [x: string]: any; }) => row[key])
          .filter((v: string) => v !== "");

        return {
          name: this.sanitizeColumnName(key),
          originalName: key,
          inferredType: this.inferColumnType(values.map(String)),
          sampleValue: String(values[0] || "NULL").substring(0, 50),
        };
      });
    } catch (error: any) {
      if (error.code === "MODULE_NOT_FOUND") {
        throw new Error(
          'Excel support requires "xlsx" package. Please install it: npm install xlsx'
        );
      }
      throw error;
    }
  }

  /**
   * Parse a CSV line handling quoted fields
   */
  private parseCsvLine(line: string, delimiter: string): string[] {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current.trim());

    return result;
  }

  /**
   * Sanitize column name for SQL compatibility
   */
  private sanitizeColumnName(name: string): string {
    return name
      .trim()
      .replace(/[^A-Za-z0-9_]/g, "_")
      .replace(/^(\d)/, "_$1")
      .substring(0, 128);
  }

  /**
   * Infer SQL type from sample values
   */
  private inferColumnType(values: string[]): string {
    if (values.length === 0) {return "VARCHAR(255)";}

    const nonEmpty = values.filter((v) => v && v.trim() !== "");
    if (nonEmpty.length === 0) {return "VARCHAR(255)";}

    // Check for integer
    if (nonEmpty.every((v) => /^-?\d+$/.test(v))) {
      const max = Math.max(...nonEmpty.map((v) => Math.abs(parseInt(v))));
      return max > 2147483647 ? "BIGINT" : "INTEGER";
    }

    // Check for decimal/numeric
    if (nonEmpty.every((v) => /^-?\d+(\.\d+)?$/.test(v))) {
      return "DOUBLE";
    }

    // Check for date
    if (nonEmpty.every((v) => /^\d{4}-\d{2}-\d{2}/.test(v))) {
      // Check if includes time
      if (nonEmpty.some((v) => /\d{2}:\d{2}:\d{2}/.test(v))) {
        return "TIMESTAMP";
      }
      return "DATE";
    }

    // Check for boolean
    if (nonEmpty.every((v) => /^(true|false|0|1|yes|no)$/i.test(v))) {
      return "BOOLEAN";
    }

    // Check string length
    const maxLength = Math.max(...nonEmpty.map((v) => v.length));
    if (maxLength > 4000) {
      return "CLOB";
    } else if (maxLength > 255) {
      return "VARCHAR(4000)";
    }

    return "VARCHAR(255)";
  }

  /**
   * Infer type from a JSON value
   */
  private inferTypeFromValue(value: any): string {
    if (value === null || value === undefined) {return "VARCHAR(255)";}

    if (typeof value === "number") {
      return Number.isInteger(value) ? "INTEGER" : "DOUBLE";
    }

    if (typeof value === "boolean") {return "BOOLEAN";}

    if (typeof value === "string") {
      if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
        return /\d{2}:\d{2}:\d{2}/.test(value) ? "TIMESTAMP" : "DATE";
      }
      return value.length > 255 ? "VARCHAR(4000)" : "VARCHAR(255)";
    }

    if (typeof value === "object") {return "CLOB";} // Store as JSON string

    return "VARCHAR(255)";
  }

  /**
   * Import data into a new table
   */
  async importToNewTable(
    filePath: string,
    tableName: string,
    schema: string,
    fileFormat: string,
    columnTypes?: Record<string, string>
  ): Promise<void> {
    this.log(`[IrisConnector] Importing to new table: ${schema}.${tableName}`);

    try {
      // 1. Analyze file to get columns
      const analysis = await this.analyzeFile(filePath, fileFormat);

      // 2. Build column definitions
      const columns: Record<string, string> = {};
      analysis.columns.forEach((col) => {
        columns[col.name] = columnTypes?.[col.name] || col.inferredType;
      });

      // 3. Create table
      await this.createTable(tableName, columns, [], schema);
      this.log(`[IrisConnector] Table created: ${schema}.${tableName}`);

      // 4. Import data
      await this.importDataToTable(
        filePath,
        tableName,
        schema,
        fileFormat,
        analysis.columns
      );

      this.log(`[IrisConnector] Import complete`);
    } catch (error: any) {
      this.log(`[IrisConnector] Import failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Import data into an existing table
   */
  async importToExistingTable(
    filePath: string,
    tableName: string,
    schema: string,
    fileFormat: string,
    dataAction: "append" | "replace"
  ): Promise<void> {
    this.log(
      `[IrisConnector] Importing to existing table: ${schema}.${tableName} (${dataAction})`
    );

    try {
      // 1. If replace, truncate table
      if (dataAction === "replace") {
        await this.execute(`TRUNCATE TABLE ${schema}.${tableName}`);
        this.log(`[IrisConnector] Table truncated`);
      }

      // 2. Get table structure
      const tableInfo = await this.describeTable(tableName, schema);
      const columns = tableInfo.columns.map((c) => ({
        name: c.COLUMN_NAME,
        originalName: c.COLUMN_NAME,
        inferredType: c.DATA_TYPE,
        sampleValue: "",
      }));

      // 3. Import data
      await this.importDataToTable(
        filePath,
        tableName,
        schema,
        fileFormat,
        columns
      );

      this.log(`[IrisConnector] Import complete`);
    } catch (error: any) {
      this.log(`[IrisConnector] Import failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Import data from file to table (internal method)
   */
  private async importDataToTable(
    filePath: string,
    tableName: string,
    schema: string,
    fileFormat: string,
    columns: ColumnAnalysis[]
  ): Promise<void> {
    const fs = require("fs");

    // Read and parse file based on format
    let rows: Record<string, any>[] = [];

    if (fileFormat === "csv" || fileFormat === "txt") {
      const content = fs.readFileSync(filePath, "utf8");
      const lines = content.split(/\r?\n/).filter((line: string) => line.trim() !== "");
      const delimiter = lines[0].includes("\t")
        ? "\t"
        : lines[0].includes(";")
        ? ";"
        : ",";

      // Skip header
      for (let i = 1; i < lines.length; i++) {
        const values = this.parseCsvLine(lines[i], delimiter);
        const row: Record<string, any> = {};

        columns.forEach((col, index) => {
          row[col.name] = values[index] || null;
        });

        rows.push(row);
      }
    } else if (fileFormat === "json") {
      const content = fs.readFileSync(filePath, "utf8");
      const json = JSON.parse(content);
      rows = Array.isArray(json) ? json : [json];

      // Map original keys to sanitized column names
      rows = rows.map((row) => {
        const mappedRow: Record<string, any> = {};
        columns.forEach((col) => {
          mappedRow[col.name] = row[col.originalName];
        });
        return mappedRow;
      });
    } else if (fileFormat === "xlsx" || fileFormat === "xls") {
      const XLSX = require("xlsx");
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(sheet);

      // Map to sanitized column names
      rows = data.map((row: any) => {
        const mappedRow: Record<string, any> = {};
        columns.forEach((col) => {
          mappedRow[col.name] = row[col.originalName];
        });
        return mappedRow;
      });
    }

    // Insert rows in batches of 100
    const batchSize = 100;
    let inserted = 0;

    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      const count = await this.insertMany(tableName, batch, schema);
      inserted += count;

      this.log(`[IrisConnector] Inserted ${inserted}/${rows.length} rows`);
    }

    this.log(`[IrisConnector] Total rows inserted: ${inserted}`);
  }

  /**
   * Log message with timestamp
   */
  public log(message: string): void {
    const timestamp = new Date().toISOString();
    this.outputChannel.appendLine(`[${timestamp}] ${message}`);
  }
}

interface ColumnAnalysis {
  name: string;
  originalName: string;
  inferredType: string;
  sampleValue: string;
}
