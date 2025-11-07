/**
 * Represents the parsed database schema from DDL SQL statement
 */
export interface ParsedSchema {
  tableName: string;           // e.g., user_info
  className: string;           // e.g., UserInfo
  columns: ColumnInfo[];
  primaryKey?: ColumnInfo;     // Single primary key only (composite keys not supported)
  databaseType: 'mysql' | 'postgresql' | 'oracle';
}

/**
 * Represents column metadata extracted from DDL
 */
export interface ColumnInfo {
  columnName: string;          // e.g., user_name
  fieldName: string;           // e.g., userName
  sqlType: string;             // e.g., VARCHAR(50)
  javaType: string;            // e.g., String, Integer, Long
  nullable: boolean;
  comment?: string;
  isPrimaryKey: boolean;
  defaultValue?: string;
}

/**
 * Result of DDL parsing operation
 */
export interface ParseResult {
  success: boolean;
  data?: ParsedSchema;
  error?: {
    code: 'NOT_CREATE_TABLE' | 'PARSE_FAILED' | 'UNSUPPORTED_DB' | 'COMPOSITE_PRIMARY_KEY';
    message: string;
  };
}

/**
 * Options for DDL parsing
 */
export interface ParseOptions {
  dbType?: 'mysql' | 'postgresql' | 'oracle';
}
