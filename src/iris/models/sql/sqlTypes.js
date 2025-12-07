"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ODBCType = exports.IRISStatementType = void 0;
/* SQL Statement Types */
var IRISStatementType;
(function (IRISStatementType) {
    IRISStatementType[IRISStatementType["SELECT"] = 1] = "SELECT";
    IRISStatementType[IRISStatementType["INSERT"] = 2] = "INSERT";
    IRISStatementType[IRISStatementType["UPDATE"] = 3] = "UPDATE";
    IRISStatementType[IRISStatementType["DELETE"] = 4] = "DELETE";
    IRISStatementType[IRISStatementType["CALL"] = 45] = "CALL";
})(IRISStatementType || (exports.IRISStatementType = IRISStatementType = {}));
/* ODBC Types */
var ODBCType;
(function (ODBCType) {
    ODBCType[ODBCType["BIGINT"] = -5] = "BIGINT";
    ODBCType[ODBCType["BINARY"] = -2] = "BINARY";
    ODBCType[ODBCType["BIT"] = -7] = "BIT";
    ODBCType[ODBCType["CHAR"] = 1] = "CHAR";
    ODBCType[ODBCType["DECIMAL"] = 3] = "DECIMAL";
    ODBCType[ODBCType["DOUBLE"] = 8] = "DOUBLE";
    ODBCType[ODBCType["FLOAT"] = 6] = "FLOAT";
    ODBCType[ODBCType["GUID"] = -11] = "GUID";
    ODBCType[ODBCType["INTEGER"] = 4] = "INTEGER";
    ODBCType[ODBCType["LONGVARBINARY"] = -4] = "LONGVARBINARY";
    ODBCType[ODBCType["LONGVARCHAR"] = -1] = "LONGVARCHAR";
    ODBCType[ODBCType["NUMERIC"] = 2] = "NUMERIC";
    ODBCType[ODBCType["REAL"] = 7] = "REAL";
    ODBCType[ODBCType["SMALLINT"] = 5] = "SMALLINT";
    ODBCType[ODBCType["DATE"] = 9] = "DATE";
    ODBCType[ODBCType["TIME"] = 10] = "TIME";
    ODBCType[ODBCType["TIMESTAMP"] = 11] = "TIMESTAMP";
    ODBCType[ODBCType["TINYINT"] = -6] = "TINYINT";
    ODBCType[ODBCType["TYPE_DATE"] = 91] = "TYPE_DATE";
    ODBCType[ODBCType["TYPE_TIME"] = 92] = "TYPE_TIME";
    ODBCType[ODBCType["TYPE_TIMESTAMP"] = 93] = "TYPE_TIMESTAMP";
    ODBCType[ODBCType["VARBINARY"] = -3] = "VARBINARY";
    ODBCType[ODBCType["VARCHAR"] = 12] = "VARCHAR";
    ODBCType[ODBCType["WCHAR"] = -8] = "WCHAR";
    ODBCType[ODBCType["WLONGVARCHAR"] = -10] = "WLONGVARCHAR";
    ODBCType[ODBCType["WVARCHAR"] = -9] = "WVARCHAR";
    ODBCType[ODBCType["DATE_HOROLOG"] = 1091] = "DATE_HOROLOG";
    ODBCType[ODBCType["TIME_HOROLOG"] = 1092] = "TIME_HOROLOG";
    ODBCType[ODBCType["TIMESTAMP_POSIX"] = 1093] = "TIMESTAMP_POSIX";
})(ODBCType || (exports.ODBCType = ODBCType = {}));
//# sourceMappingURL=sqlTypes.js.map