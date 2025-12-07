"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IrisConnector = void 0;
const irisSQL_1 = require("./irisSQL");
const inference_1 = require("./models/sql/inference");
const settingsManager_1 = require("../webviews/settingsManager");
const odbc_1 = __importDefault(require("odbc"));
const fs = require("fs");
const XLSX = require("xlsx");
const papaparse_1 = __importDefault(require("papaparse"));
// const irisnative = require("@intersystems/intersystems-iris-native");
/**
 * Class that represents a connection to an IRIS instance and provides methods for executing queries.
 *  It is a wrapper around the irisnative library.
 *
 * This is an adaptation of IRIStool Python package, a wrapper around the IRIS Native Python SDK,
 *  that can be found at: https://github.com/pietrodileo/iris_tool_and_data_manager
 */
class IrisConnector extends inference_1.IrisInference {
    connection;
    iris;
    sql; // Unified SQL Client Interface (odbc or native)
    host;
    superServerPort;
    webServerPort;
    namespace;
    username;
    password;
    connectionType;
    context;
    constructor(config, outputChannel, context) {
        super(outputChannel);
        this.host = config.host;
        this.superServerPort =
            typeof config.superServerPort === "string"
                ? parseInt(config.superServerPort)
                : config.superServerPort;
        this.webServerPort =
            typeof config.webServerPort === "string"
                ? parseInt(config.webServerPort)
                : config.webServerPort;
        this.namespace = config.ns;
        this.username = config.user;
        this.password = config.pwd;
        this.connectionType = config.connectionType;
        this.context = context;
    }
    // ---------- Connection Management ----------
    async connect() {
        try {
            if (this.isConnected()) {
                this.log("[IrisConnector] Already connected");
                return;
            }
            this.log(`[IrisConnector] Creating ${this.connectionType.toUpperCase()} connection...`);
            // if (this.connectionType === "native") {
            //   await this.connectNative();
            // } else 
            if (this.connectionType === "odbc") { // Make odbc default
                await this.connectOdbc();
            }
            else {
                throw new Error(`Unknown connection type: ${this.connectionType}`);
            }
            this.log("[IrisConnector] Connected successfully");
        }
        catch (err) {
            this.log(`[IrisConnector] Connection failed: ${err.message}`);
            throw err;
        }
    }
    // private async connectNative(): Promise<void> {
    //   this.log(
    //     `[IrisConnector] Native connecting to ${this.host}:${this.superServerPort}/${this.namespace}...`
    //   );
    //   const connectionInfo = {
    //     host: this.host,
    //     port: this.superServerPort,
    //     ns: this.namespace,
    //     user: this.username,
    //     pwd: this.password,
    //   };
    //   this.connection = irisnative.createConnection(connectionInfo);
    //   this.log(`[IrisConnector] Creating IRIS`);
    //   this.iris = this.connection.createIris();
    //   // Create Native SQL client
    //   this.sql = createSqlClient("native", this.connection, this.outputChannel);
    //   this.log("[IrisConnector] Native SDK initialized");
    // }
    async connectOdbc() {
        // Build ODBC connection string
        try {
            // Get the ODBC driver from settings
            const odbcDriver = settingsManager_1.SettingsManager.getOdbcDriver(this.context);
            this.log(`[IrisConnector] ODBC connecting to ${this.host}:${this.superServerPort}/${this.namespace} using ODBC driver ${odbcDriver}...`);
            // Form the connection string
            const connStr = [
                `DRIVER=${odbcDriver}`,
                `SERVER=${this.host}`,
                `PORT=${this.superServerPort}`,
                `DATABASE=${this.namespace}`,
                `UID=${this.username}`,
                `PWD=${this.password}`,
            ].join(";");
            // Connect via ODBC
            this.connection = await odbc_1.default.connect(connStr);
            // Create ODBC SQL client
            this.sql = (0, irisSQL_1.createSqlClient)("odbc", this.connection, this.outputChannel);
            this.log(`[IrisConnector] ODBC connection successful.`);
        }
        catch (error) {
            // Log the high-level error
            this.log(`[IrisConnector] Connection failed: ${error.message}`);
            // Log the detailed ODBC errors if they exist
            if (error.odbcErrors) {
                this.log("[IrisConnector] ODBC Driver Error Details:");
                for (const odbcError of error.odbcErrors) {
                    this.log(`  - State: ${odbcError.state}, Code: ${odbcError.code}, Message: ${odbcError.message}`);
                }
            }
            // Re-throw or handle the error as per your application's logic
            throw error;
        }
    }
    isConnected() {
        if (this.connectionType === "native") {
            // Return true if the native connection object exists
            return this.iris !== null && this.iris !== undefined;
        }
        if (this.connectionType === "odbc") {
            // Return true if the odbc connection object exists AND is connected
            return (this.connection !== null &&
                this.connection !== undefined &&
                this.connection.connected === true);
        }
        // If connectionType is unknown or not set, it's not connected.
        return false;
    }
    close() {
        if (this.connection) {
            try {
                if (this.connectionType === "odbc") {
                    // ODBC close is async, but we'll call it synchronously
                    this.connection.close().catch((err) => {
                        this.log(`[IrisConnector] Error closing ODBC: ${err.message}`);
                    });
                }
                else {
                    this.connection.close();
                }
                this.log("[IrisConnector] Connection closed");
            }
            catch (error) {
                this.log(`[IrisConnector] Error closing: ${error.message}`);
            }
            this.connection = null;
            this.iris = null;
            this.sql = null;
        }
    }
    toString() {
        return `IRIS connection [${this.connectionType.toUpperCase()}] [${this.username}@${this.host}:${this.superServerPort}/${this.namespace}]`;
    }
    // ---------- Query Execution ----------
    async query(sql, parameters = []) {
        if (!this.isConnected()) {
            throw new Error("Not connected to IRIS");
        }
        if (!this.sql) {
            this.log(`[IrisConnector] SQL client not initialized. Call connect() first. Details: ${this.sql}`);
            throw new Error("SQL client not initialized. Call connect() first.");
        }
        return await this.sql.query(sql, parameters);
    }
    async execute(sql, parameters = []) {
        try {
            if (!this.isConnected()) {
                throw new Error("Not connected to IRIS");
            }
            return await this.sql.execute(sql, parameters);
        }
        catch (error) {
            this.log(`[IrisConnector] Execute failed: ${error.message}`);
            // throw error;
            this.log("[IrisConnector] Execute failed for row: " + sql + " " + error.message);
            return 0;
        }
    }
    // ---------- Schema & Table Information ----------
    async getSchemas(filter = null) {
        this.log(`[IrisConnector] Getting schemas`);
        let sql = `
      SELECT DISTINCT TABLE_SCHEMA
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_TYPE='BASE TABLE'
    `;
        let parameters = [];
        if (typeof filter === "string" && filter.trim() !== "") {
            sql += ` AND TABLE_SCHEMA LIKE ? `;
            parameters.push(`${filter}%`);
        }
        sql += " ORDER BY TABLE_SCHEMA ";
        const results = await this.query(sql, parameters);
        return results.map((row) => row.TABLE_SCHEMA);
    }
    async getTables(schema) {
        this.log(`[IrisConnector] Getting tables for schema ${schema}`);
        const sql = `
      SELECT TABLE_NAME
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = ?
      AND TABLE_TYPE='BASE TABLE'
      ORDER BY TABLE_NAME
    `;
        const results = await this.query(sql, [schema]);
        this.log(`[IrisConnector] Got ${results.length} tables for schema ${schema}`);
        return results.map((row) => row.TABLE_NAME);
    }
    async getAllTables(tableNameFilter, schemaFilter) {
        let sql = `
      SELECT TABLE_SCHEMA, TABLE_NAME
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_TYPE='BASE TABLE'
    `;
        const parameters = [];
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
    async tableExists(tableName, schema = "SQLUser") {
        const sql = `
      SELECT COUNT(*) as num_rows
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_NAME = ?
      AND TABLE_SCHEMA = ?
    `;
        const results = await this.query(sql, [tableName, schema]);
        return results[0]?.num_rows > 0;
    }
    async describeTable(tableName, schema = "SQLUser") {
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
    async exportTableToJson(tableName, schema = "SQLUser", limit) {
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
    async exportTableToCsv(tableName, schema = "SQLUser", limit) {
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
        const csvRows = new Array(estimatedSize);
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
                if (stringValue.includes(",") ||
                    stringValue.includes('"') ||
                    stringValue.includes("\n")) {
                    return `"${stringValue.replace(/"/g, '""')}"`;
                }
                return stringValue;
            });
            csvRows[i + 1] = values.join(",");
        }
        const result = csvRows.join("\n");
        const elapsed = Date.now() - startTime;
        this.log(`[IrisConnector] CSV export completed in ${elapsed}ms (${Math.round(result.length / 1024)}KB)`);
        return result;
    }
    async exportTableToTxt(tableName, schema = "SQLUser", delimiter = ",", limit) {
        this.log(`[IrisConnector] Exporting ${schema}.${tableName} to TXT...`);
        const startTime = Date.now();
        const data = await this.exportTableToJson(tableName, schema, limit);
        if (data.length === 0) {
            return "";
        }
        // Get headers
        const headers = Object.keys(data[0]);
        // Pre-allocate array
        const rows = new Array(data.length + 1);
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
    async exportTableToExcelData(tableName, schema = "SQLUser", limit) {
        const jsonData = await this.exportTableToJson(tableName, schema, limit);
        if (jsonData.length === 0) {
            return { headers: [], data: [] };
        }
        const headers = Object.keys(jsonData[0]);
        const data = jsonData.map((row) => headers.map((header) => row[header]));
        return { headers, data };
    }
    // ---------- Validation ----------
    validateTableName(tableName, schema) {
        if (tableName.includes(".") || tableName.includes("_")) {
            throw new Error(`Invalid table_name '${tableName}'. ` +
                "Do not include schema or underscores in table_name. " +
                "Example: table_schema='EnsLib_Background_Workflow', table_name='ExportResponse'.");
        }
        if (schema && schema.includes(".")) {
            throw new Error(`Invalid table_schema '${schema}'. ` +
                "Do not include periods in table_schema.");
        }
        return schema ? `${schema}.${tableName}` : tableName;
    }
    getNameAndSchema(fullName) {
        const parts = fullName.split(".");
        if (parts.length === 1) {
            return { tableName: parts[0], schema: "SQLUser" };
        }
        const tableName = parts[parts.length - 1];
        const schema = parts[0];
        if (tableName.includes(".") || tableName.includes("_")) {
            throw new Error(`Invalid table_name '${fullName}'. ` +
                "Do not include schema or underscores in table_name.");
        }
        if (schema.includes(".")) {
            throw new Error(`Invalid table_schema '${schema}'. ` +
                "Do not include periods in table_schema.");
        }
        return { tableName, schema };
    }
    // ---------- Insert Operations ----------
    async insertRow(tableName, values, schema = "SQLUser") {
        const fullName = this.validateTableName(tableName, schema);
        const columns = Object.keys(values).join(", ");
        const placeholders = Object.keys(values)
            .map(() => "?")
            .join(", ");
        const sql = `INSERT INTO ${fullName} (${columns}) VALUES (${placeholders})`;
        try {
            await this.execute(sql, Object.values(values));
            this.log(`Inserted row into ${fullName}`);
        }
        catch (error) {
            console.error(`Failed to insert into ${fullName}: ${error.message}`);
            throw error;
        }
    }
    async insertMany(tableName, rows, schema = "SQLUser") {
        const fullTable = this.validateTableName(tableName, schema);
        try {
            // this.log(`[IrisConnector] ROWS ${rows}`);
            this.log(`[IrisConnector] Inserting ${rows.length} row(s) into ${fullTable}`);
            if (rows.length === 0) {
                throw new Error("No rows to insert");
            }
            const columns = Object.keys(rows[0]);
            const colStr = columns.join(", ");
            const placeholders = columns.map(() => "?").join(", ");
            const sql = `INSERT INTO ${fullTable} (${colStr}) VALUES (${placeholders})`;
            // this.log(`[IrisConnector] sql ${sql}`);
            let count = 0;
            for (const row of rows) {
                const values = columns.map((col) => row[col]);
                // this.log(`[IrisConnector] values ${values}`);
                await this.execute(sql, values);
                count++;
            }
            this.log(`[IrisConnector] Inserted ${count} row(s) into ${fullTable}`);
            return count;
        }
        catch (error) {
            console.error(`Failed to insert into ${fullTable}: ${error.message}`);
            throw error;
        }
    }
    // ---------- Table Management ----------
    async createTable(tableName, columns, constraints = [], schema = "SQLUser") {
        const fullTableName = this.validateTableName(tableName, schema);
        try {
            const colDefs = Object.entries(columns).map(([col, type]) => `${col} ${type}`);
            const allDefs = [...colDefs, ...constraints];
            const sql = `CREATE TABLE ${fullTableName} ( ${allDefs.join(", ")} )`;
            await this.execute(sql);
            this.log(`Table ${fullTableName} created successfully`);
        }
        catch (error) {
            console.error(`Error creating table ${fullTableName}: ${error.message}`);
            throw error;
        }
    }
    async dropTable(tableName, schema = "SQLUser", ifExists = true) {
        const fullName = this.validateTableName(tableName, schema);
        const sql = `DROP TABLE ${ifExists ? "IF EXISTS " : ""}${fullName}`;
        try {
            await this.execute(sql);
            this.log(`Table ${fullName} dropped successfully`);
        }
        catch (error) {
            console.error(`Error dropping table ${fullName}: ${error.message}`);
            throw error;
        }
    }
    async createIndex(tableName, columnName, indexName, indexType = "INDEX", schema = "SQLUser") {
        const fullName = this.validateTableName(tableName, schema);
        let sql = "";
        if (indexType && indexType !== "INDEX") {
            sql = `CREATE ${indexType} INDEX ${indexName} ON ${fullName}(${columnName})`;
        }
        else {
            sql = `CREATE INDEX ${indexName} ON ${fullName}(${columnName})`;
        }
        this.log(`Query to create index: ${sql}`);
        try {
            await this.execute(sql);
            this.log(`Index ${indexName} created on ${fullName}.${columnName}`);
        }
        catch (err) {
            this.log(`Failed to create index ${indexName}: ${err.message}`);
            throw err;
        }
    }
    // ---------- File Import Operations ----------
    /**
     * Import data into a new table
     */
    async importToNewTable(filePath, tableName, schema, fileFormat, columnTypes, columnIndexes, delimiter) {
        this.log(`[IrisConnector] Importing to new table: ${schema}.${tableName}`);
        try {
            // 0. Verify if the table already exists and return an error if it does
            const tableExists = await this.tableExists(tableName, schema);
            if (tableExists) {
                this.log(`[IrisConnector] Table ${schema}.${tableName} already exists`);
                throw new Error(`Table ${schema}.${tableName} already exists`);
            }
            // 1. Analyze file to get columns
            const analysis = await this.analyzeFile(filePath, fileFormat, delimiter);
            // 2. Build column definitions
            const columns = {};
            analysis.columns.forEach((col) => {
                columns[col.name] = columnTypes?.[col.name] || col.inferredType;
            });
            // 3. Create table
            await this.createTable(tableName, columns, [], schema);
            this.log(`[IrisConnector] Table created: ${schema}.${tableName}`);
            // 4. Create indexes (NEW)
            if (columnIndexes) {
                for (const [colName, indexInfo] of Object.entries(columnIndexes)) {
                    // Skip columns with no index
                    if (!indexInfo || indexInfo.index !== true) {
                        continue;
                    }
                    const indexName = indexInfo.name || `${tableName}_${colName}_idx`; // default index name
                    const indexType = indexInfo.type || "INDEX"; // default index type
                    this.log(`[IrisConnector] Creating index ${indexName} (${indexType})...`);
                    await this.createIndex(tableName, colName, indexName, indexType, schema);
                    this.log(`[IrisConnector] Created index ${indexName} (${indexType})`);
                }
            }
            // 5. Import data
            await this.importDataToTable(filePath, tableName, schema, fileFormat, analysis.columns, delimiter);
            this.log(`[IrisConnector] Import complete`);
        }
        catch (error) {
            this.log(`[IrisConnector] Import failed: ${error.message}`);
            throw error;
        }
    }
    /**
     * Import data into an existing table
     */
    async importToExistingTable(filePath, tableName, schema, fileFormat, dataAction, delimiter) {
        this.log(`[IrisConnector] Importing to existing table: ${schema}.${tableName} (${dataAction})`);
        try {
            // 1. If replace, truncate table
            if (dataAction === "replace") {
                await this.execute(`TRUNCATE TABLE ${schema}.${tableName}`);
                this.log(`[IrisConnector] Table truncated`);
            }
            // 2. Get table structure
            const tableInfo = await this.describeTable(tableName, schema);
            // this.log(`[IrisConnector] Table structure: ${JSON.stringify(tableInfo)}`);
            const columns = tableInfo.columns.map((c) => ({
                name: c.COLUMN_NAME,
                originalName: c.COLUMN_NAME,
                inferredType: c.DATA_TYPE,
                sampleValue: "",
            }));
            // 3. Import data
            await this.importDataToTable(filePath, tableName, schema, fileFormat, columns, delimiter);
            this.log(`[IrisConnector] Import complete`);
        }
        catch (error) {
            this.log(`[IrisConnector] Import failed: ${error.message}`);
            throw error;
        }
    }
    /**
     * Import data from file to table (internal method)
     */
    async importDataToTable(filePath, tableName, schema, fileFormat, columns, delimiter) {
        try {
            let rows = [];
            this.log(`[IrisConnector] Importing data from ${filePath} with format ${fileFormat}`);
            // -----------------------------
            // JSON
            // -----------------------------
            if (fileFormat === "json") {
                const content = fs.readFileSync(filePath, "utf8");
                const json = JSON.parse(content);
                rows = Array.isArray(json) ? json : [json];
                rows = rows.map((row) => {
                    const mapped = {};
                    for (const col of columns) {
                        mapped[col.name] = row[col.originalName] ?? null;
                    }
                    return mapped;
                });
            }
            // -----------------------------
            // CSV and TXT
            // -----------------------------
            else if (fileFormat === "csv" || fileFormat === "txt") {
                let file_delimiter = ",";
                if (fileFormat === "txt") {
                    file_delimiter = delimiter || ",";
                }
                const content = fs.readFileSync(filePath, "utf8");
                const parsed = papaparse_1.default.parse(content, {
                    header: true,
                    delimiter: file_delimiter,
                    skipEmptyLines: true,
                    dynamicTyping: false,
                });
                if (parsed.errors.length > 0) {
                    throw new Error(`${fileFormat} parsing failed: ${parsed.errors[0].message}`);
                }
                rows = parsed.data.map((row) => {
                    const mapped = {};
                    columns.forEach((col) => {
                        mapped[col.name] = row[col.originalName] ?? null;
                    });
                    return mapped;
                });
            }
            // -----------------------------
            // Excel (xlsx/xls)
            // -----------------------------
            else if (fileFormat === "xlsx" || fileFormat === "xls") {
                const workbook = XLSX.readFile(filePath);
                const sheetName = workbook.SheetNames[0];
                const sheet = workbook.Sheets[sheetName];
                const data = XLSX.utils.sheet_to_json(sheet);
                rows = data.map((row) => {
                    const mapped = {};
                    columns.forEach((col) => {
                        mapped[col.name] = row[col.originalName] ?? null;
                    });
                    return mapped;
                });
            }
            // -----------------------------
            // Log + Insert
            // -----------------------------
            this.log(`[IrisConnector] Mapped ${rows.length} rows`);
            // batch is 30% of total
            const batchSize = Math.floor(rows.length * 0.3);
            this.log(`[IrisConnector] Batch size: ${batchSize} rows`);
            let inserted = 0;
            for (let i = 0; i < rows.length; i += batchSize) {
                const batch = rows.slice(i, i + batchSize);
                const count = await this.insertMany(tableName, batch, schema);
                inserted += count;
                this.log(`[IrisConnector] Batch ${i / batchSize + 1} Inserted ${inserted}/${rows.length} rows`);
            }
            this.log(`[IrisConnector] Total rows inserted: ${inserted}`);
        }
        catch (error) {
            this.log(`[IrisConnector] Import failed: ${error.message}`);
            throw error;
        }
    }
}
exports.IrisConnector = IrisConnector;
//# sourceMappingURL=irisConnector.js.map