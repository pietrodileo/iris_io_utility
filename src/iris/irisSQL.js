"use strict";
/**
 * irisSQL.ts - Improved with unified interface
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.OdbcSqlClient = exports.IRISql = void 0;
exports.createSqlClient = createSqlClient;
const sqlClient_1 = require("./models/sql/sqlClient");
const sqlTypes_1 = require("./models/sql/sqlTypes");
/**
 * IRIS Native SDK SQL Client
 */
class IRISql {
    iris;
    outputChannel;
    constructor(iris, outputChannel) {
        this.iris = iris;
        if (!iris) {
            throw new Error("IRISql: IRIS instance not provided.");
        }
        this.outputChannel = outputChannel;
    }
    async query(sql, parameters = []) {
        try {
            // this.log(`[IRISql] Executing query: ${sql.substring(0, 100)}...`);
            const statement = new sqlClient_1.SQLStatement(this.iris, sql, this.outputChannel);
            const result = statement.execute(...parameters);
            if (result.Message) {
                throw new Error(result.Message);
            }
            this.log(`[IRISql] Retrieved ${result.rows.length} rows`);
            return result.rows;
        }
        catch (error) {
            this.log(`[IRISql] Query failed: ${error.message}`);
            throw error;
        }
    }
    async execute(sql, parameters = []) {
        try {
            // this.log(`[IRISql] Executing statement: ${sql.substring(0, 100)}...`);
            const statement = new sqlClient_1.SQLStatement(this.iris, sql, this.outputChannel);
            const result = statement.execute(...parameters);
            if (result.Message) {
                throw new Error(result.Message);
            }
            if (result.statementType === sqlTypes_1.IRISStatementType.INSERT &&
                result.lastInsertId) {
                this.log(`[IRISql] Inserted with ID: ${result.lastInsertId}`);
                return 1;
            }
            // this.log(`[IRISql] Statement executed successfully`);
            return result.rows.length || 0;
        }
        catch (error) {
            this.log(`[IRISql] Execute failed: ${error.message}`);
            throw error;
        }
    }
    async queryWithMetadata(sql, parameters = []) {
        try {
            const statement = new sqlClient_1.SQLStatement(this.iris, sql, this.outputChannel);
            const result = statement.execute(...parameters);
            if (result.Message) {
                throw new Error(result.Message);
            }
            return result;
        }
        catch (error) {
            this.log(`[IRISql] Query with metadata failed: ${error.message}`);
            throw error;
        }
    }
    log(message) {
        const timestamp = new Date().toISOString();
        this.outputChannel.appendLine(`[${timestamp}] ${message}`);
    }
}
exports.IRISql = IRISql;
/**
 * ODBC SQL Client (50-100x faster for SELECT queries)
 */
class OdbcSqlClient {
    connection;
    outputChannel;
    constructor(connection, outputChannel) {
        this.connection = connection;
        this.outputChannel = outputChannel;
    }
    async query(sql, parameters = []) {
        try {
            // this.log(`[ODBC] Executing query: ${sql.substring(0, 100)}...`);
            const startTime = Date.now();
            let result;
            if (parameters && parameters.length > 0) {
                result = await this.connection.query(sql, parameters);
            }
            else {
                result = await this.connection.query(sql);
            }
            const elapsed = Date.now() - startTime;
            const rate = elapsed > 0 ? Math.round(result.length / (elapsed / 1000)) : 0;
            this.log(`[ODBC] Retrieved ${result.length} rows in ${elapsed}ms (${rate} rows/sec)`);
            return result;
        }
        catch (error) {
            this.log(`[ODBC] Query failed: ${error.message}`);
            throw error;
        }
    }
    async execute(sql, parameters = []) {
        try {
            // this.log(`[ODBC] Executing statement: ${sql}`);
            const startTime = Date.now();
            let result;
            if (parameters && parameters.length > 0) {
                result = await this.connection.query(sql, parameters);
            }
            else {
                result = await this.connection.query(sql);
            }
            const elapsed = Date.now() - startTime;
            // ODBC returns affected rows in different ways depending on the operation
            const affected = result.count || result.length || 0;
            // this.log(`[ODBC] Statement executed in ${elapsed}ms, affected rows: ${affected}`);
            return affected;
        }
        catch (error) {
            this.log(`[ODBC] Execute failed: ${error.message}`);
            throw error;
        }
    }
    /**
     * ODBC doesn't provide detailed metadata like Native SDK
     * This returns a simplified SQLResult
     */
    async queryWithMetadata(sql, parameters = []) {
        const rows = await this.query(sql, parameters);
        // Create minimal SQLResult structure
        const result = {
            rows,
            columns: [],
            statementType: sqlTypes_1.IRISStatementType.SELECT,
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
            }));
        }
        return result;
    }
    log(message) {
        const timestamp = new Date().toISOString();
        this.outputChannel.appendLine(`[${timestamp}] ${message}`);
    }
}
exports.OdbcSqlClient = OdbcSqlClient;
/**
 * Factory function to create appropriate SQL client
 */
function createSqlClient(connectionType, connection, outputChannel) {
    if (connectionType === "odbc") {
        return new OdbcSqlClient(connection, outputChannel);
    }
    else {
        // For native, connection has createIris() method
        const iris = connection.createIris();
        return new IRISql(iris, outputChannel);
    }
}
//# sourceMappingURL=irisSQL.js.map