/* SQL Statement Types */
export enum IRISStatementType {
  SELECT = 1,
  INSERT = 2,
  UPDATE = 3,
  DELETE = 4,
  CALL = 45,
}

/* ODBC Types */
export enum ODBCType {
  BIGINT = -5,
  BINARY = -2,
  BIT = -7,
  CHAR = 1,
  DECIMAL = 3,
  DOUBLE = 8,
  FLOAT = 6,
  GUID = -11,
  INTEGER = 4,
  LONGVARBINARY = -4,
  LONGVARCHAR = -1,
  NUMERIC = 2,
  REAL = 7,
  SMALLINT = 5,
  DATE = 9,
  TIME = 10,
  TIMESTAMP = 11,
  TINYINT = -6,
  TYPE_DATE = 91,
  TYPE_TIME = 92,
  TYPE_TIMESTAMP = 93,
  VARBINARY = -3,
  VARCHAR = 12,
  WCHAR = -8,
  WLONGVARCHAR = -10,
  WVARCHAR = -9,
  DATE_HOROLOG = 1091,
  TIME_HOROLOG = 1092,
  TIMESTAMP_POSIX = 1093,
}

/* IRIS SQL Column Metadata */
export interface SQLColumn {
  ODBCType: ODBCType;
  clientType: string;
  colName: string;
  isAliased?: boolean;
  isAutoIncrement?: boolean;
  isCaseSensitive?: boolean;
  isCurrency?: boolean;
  isExpression?: boolean;
  isHidden?: boolean;
  isIdentity?: boolean;
  isKeyColumn?: boolean;
  isList?: boolean;
  isNullable?: boolean;
  isReadOnly?: boolean;
  isRowId?: boolean;
  isRowVersion?: boolean;
  isUnique?: boolean;
  label?: string;
  precision?: number;
  scale?: number;
  schemaName?: string;
  tableName?: string;
}

/* IRIS SQL Statement Result */
export interface SQLResult {
  SQLCODE?: number;
  Message?: string;
  rows: any[];
  columns: SQLColumn[];
  lastInsertId?: any;
  statementType: IRISStatementType;
}
