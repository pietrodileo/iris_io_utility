"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SQLStatement = void 0;
const sqlTypes_1 = require("./sqlTypes");
/**
 * Class for executing IRIS SQL statements and fetching results
 */
class SQLStatement {
    iris;
    queryString;
    _st;
    outputChannel;
    constructor(iris, queryString, outputChannel) {
        this.iris = iris;
        this.queryString = queryString;
        try {
            this.outputChannel = outputChannel;
            this._st = iris.classMethodValue("%SQL.Statement", "%New", 1);
            const status = this._st.invokeString("%Prepare", this.queryString);
            if (status !== "1") {
                const message = iris.classMethodValue("%SYSTEM.Status", "GetOneErrorText", status);
                throw new Error(message);
            }
        }
        catch (error) {
            throw new Error(`Error creating statement: ${error.message}`);
        }
    }
    execute(...args) {
        const normalizedArgs = this.normalizeArgs(args);
        return this.createResultSet(this._st, normalizedArgs);
    }
    normalizeArgs(args) {
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
    dateToString(date) {
        const offset = date.getTimezoneOffset();
        return new Date(date.getTime() - offset * 60 * 1000)
            .toISOString()
            .replace("T", " ")
            .replace("Z", "");
    }
    createResultSet(st, params) {
        const _rs = st.invokeObject("%Execute", ...params);
        const result = {
            SQLCODE: _rs.getNumber("%SQLCODE"),
            Message: _rs.getString("%Message"),
            statementType: _rs.getNumber("%StatementType"),
            rows: [],
            columns: [],
            lastInsertId: null,
        };
        if (result.statementType === sqlTypes_1.IRISStatementType.INSERT) {
            result.lastInsertId = _rs.getString("%ROWID");
        }
        if (result.statementType === sqlTypes_1.IRISStatementType.SELECT) {
            this.fetchMetadata(_rs, result);
            this.fetchRows(_rs, result);
        }
        return result;
    }
    fetchMetadata(_rs, result) {
        const metadata = _rs.invokeObject("%GetMetadata");
        if (!metadata) {
            return;
        }
        const columns = metadata.getObject("columns");
        const colCount = metadata.getNumber("columnCount");
        for (let i = 0; i < colCount; i++) {
            const columnInfo = columns.invokeObject("GetAt", i + 1);
            const column = {
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
    fetchRows(_rs, result) {
        const startTime = Date.now();
        let rowCount = 0;
        // Pre-create type getters for each column to avoid repeated switch statements
        // This is the KEY optimization - we create the getter functions ONCE
        const columnGetters = result.columns.map((col) => {
            const colName = col.colName;
            switch (col.ODBCType) {
                case sqlTypes_1.ODBCType.INTEGER:
                case sqlTypes_1.ODBCType.SMALLINT:
                case sqlTypes_1.ODBCType.TINYINT:
                case sqlTypes_1.ODBCType.FLOAT:
                case sqlTypes_1.ODBCType.REAL:
                case sqlTypes_1.ODBCType.DOUBLE:
                case sqlTypes_1.ODBCType.DATE_HOROLOG:
                case sqlTypes_1.ODBCType.TIME_HOROLOG:
                    return (rs) => rs.invokeNumber("%Get", colName);
                case sqlTypes_1.ODBCType.DATE:
                case sqlTypes_1.ODBCType.TIMESTAMP:
                    return (rs) => {
                        const value = rs.invokeString("%Get", colName);
                        return value ? new Date(value) : null;
                    };
                case sqlTypes_1.ODBCType.TIME:
                case sqlTypes_1.ODBCType.BIGINT:
                case sqlTypes_1.ODBCType.NUMERIC:
                    return (rs) => rs.invokeString("%Get", colName);
                case sqlTypes_1.ODBCType.DECIMAL:
                    return (rs) => rs.invokeDecimal("%Get", colName);
                case sqlTypes_1.ODBCType.BINARY:
                case sqlTypes_1.ODBCType.LONGVARBINARY:
                case sqlTypes_1.ODBCType.LONGVARCHAR:
                    return (rs) => rs.invokeIRISList("%Get", colName);
                case sqlTypes_1.ODBCType.BIT:
                    return (rs) => rs.invokeBoolean("%Get", colName);
                case sqlTypes_1.ODBCType.VARCHAR:
                default:
                    return (rs) => rs.invokeString("%Get", colName);
            }
        });
        // Fetch all rows using optimized column getters
        while (_rs.invokeBoolean("%Next")) {
            const row = {};
            // Use pre-created getters instead of switch statement
            result.columns.forEach((col, index) => {
                row[col.colName] = columnGetters[index](_rs);
            });
            result.rows.push(row);
            rowCount++;
        }
        const elapsed = Date.now() - startTime;
        this.log(`[SQLStatement] Fetched ${rowCount} rows in ${elapsed}ms (${(rowCount /
            (elapsed / 1000)).toFixed(0)} rows/sec)`);
    }
    /**
     * Log message with timestamp
     */
    log(message) {
        const timestamp = new Date().toISOString();
        this.outputChannel.appendLine(`[${timestamp}] ${message}`);
    }
}
exports.SQLStatement = SQLStatement;
//# sourceMappingURL=sqlClient.js.map