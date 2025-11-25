/* Interface that represents a table column */
export interface TableColumn {
  TABLE_SCHEMA: string;
  TABLE_NAME: string;
  COLUMN_NAME: string;
  DATA_TYPE: string;
  CHARACTER_MAXIMUM_LENGTH: number | null;
  IS_NULLABLE: string;
  AUTO_INCREMENT: boolean;
  UNIQUE_COLUMN: boolean;
  PRIMARY_KEY: boolean;
  ODBCTYPE: string;
}

/* Interface that represents a table index */
export interface TableIndex {
  INDEX_NAME: string;
  COLUMN_NAME: string;
  PRIMARY_KEY: boolean;
  NON_UNIQUE: boolean;
}

/* Interface that represents a table */
export interface TableDescription {
  columns: TableColumn[];
  indexes: TableIndex[];
}

/* Interface that represents a schema table */
export interface SchemaTable {
  TABLE_SCHEMA: string;
  TABLE_NAME: string;
}
