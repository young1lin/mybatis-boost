/**
 * Represents the parsed database schema from DDL SQL statement
 */
export interface ParsedSchema {
  tableName: string;           // e.g., user_info (use snakeToPascal to get class name when needed)
  columns: ColumnInfo[];
  primaryKey?: ColumnInfo;     // Single primary key only (composite keys not supported)
  databaseType: 'mysql' | 'postgresql' | 'oracle';
  comment?: string;
}

/**
 * Represents column metadata extracted from DDL
 */
export interface ColumnInfo {
  columnName: string;          // e.g., user_name (use snakeToCamel to get field name when needed)
  sqlType: string;             // e.g., VARCHAR(50)
  javaType: string;            // e.g., String, Integer, Long (simple type name)
  javaTypeFullName: string;    // e.g., '', 'java.math.BigDecimal', 'java.time.LocalDateTime' (empty for java.lang types)
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
 * Date/Time type mapping strategy
 */
export type DateTimeType = 'Date' | 'LocalDateTime' | 'Instant';

/**
 * Options for DDL parsing
 */
export interface ParseOptions {
  dbType?: 'mysql' | 'postgresql' | 'oracle';
  dateTimeType?: DateTimeType;  // Default: 'LocalDateTime'
}
