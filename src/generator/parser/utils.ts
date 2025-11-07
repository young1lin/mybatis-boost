/**
 * Utility functions for DDL parsing
 */

/**
 * Convert snake_case to PascalCase
 * @param str - Input string in snake_case
 * @returns String in PascalCase
 * @example snakeToPascal('user_info') => 'UserInfo'
 */
export function snakeToPascal(str: string): string {
  return str
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
}

/**
 * Convert snake_case to camelCase
 * @param str - Input string in snake_case
 * @returns String in camelCase
 * @example snakeToCamel('user_name') => 'userName'
 */
export function snakeToCamel(str: string): string {
  const pascal = snakeToPascal(str);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

/**
 * Map SQL type to Java type based on database dialect and nullability
 * @param sqlType - SQL type string (e.g., 'VARCHAR(50)', 'INT', 'BIGINT')
 * @param nullable - Whether the column is nullable
 * @param dbType - Database type
 * @returns Java type string
 */
export function mapSqlTypeToJavaType(
  sqlType: string,
  nullable: boolean,
  dbType: 'mysql' | 'postgresql' | 'oracle'
): string {
  const normalizedType = sqlType.toUpperCase().replace(/\(.*\)/, '').trim();

  // Determine base type
  let baseType: string;

  switch (normalizedType) {
    // String types
    case 'VARCHAR':
    case 'CHAR':
    case 'TEXT':
    case 'LONGTEXT':
    case 'MEDIUMTEXT':
    case 'TINYTEXT':
    case 'VARCHAR2': // Oracle
    case 'CLOB':     // Oracle
      baseType = 'String';
      break;

    // Integer types (small)
    case 'TINYINT':
    case 'SMALLINT':
    case 'MEDIUMINT':
    case 'INT':
    case 'INTEGER':
      baseType = nullable ? 'Integer' : 'int';
      break;

    // Long integer types
    case 'BIGINT':
    case 'SERIAL':      // PostgreSQL
    case 'BIGSERIAL':   // PostgreSQL
    case 'NUMBER':      // Oracle (without precision, treat as Long)
      baseType = nullable ? 'Long' : 'long';
      break;

    // Decimal types
    case 'DECIMAL':
    case 'NUMERIC':
    case 'FLOAT':
    case 'DOUBLE':
    case 'REAL':
      baseType = 'BigDecimal';
      break;

    // Boolean types
    case 'BOOLEAN':
    case 'BOOL':
    case 'BIT':
      baseType = nullable ? 'Boolean' : 'boolean';
      break;

    // Date/Time types
    case 'DATE':
      baseType = 'LocalDate';
      break;

    case 'DATETIME':
    case 'TIMESTAMP':
      baseType = 'LocalDateTime';
      break;

    case 'TIME':
      baseType = 'LocalTime';
      break;

    // Binary types
    case 'BLOB':
    case 'BYTEA':       // PostgreSQL
    case 'BINARY':
    case 'VARBINARY':
      baseType = 'byte[]';
      break;

    // JSON types
    case 'JSON':
    case 'JSONB':       // PostgreSQL
      baseType = 'String'; // Can be mapped to custom types if needed
      break;

    // Default fallback
    default:
      baseType = 'String';
  }

  return baseType;
}

/**
 * Normalize SQL type string (extract base type without length/precision)
 * @param sqlType - Raw SQL type from DDL
 * @returns Normalized type string
 * @example normalizeSqlType('VARCHAR(255)') => 'VARCHAR'
 */
export function normalizeSqlType(sqlType: string): string {
  return sqlType.replace(/\(.*\)/, '').trim().toUpperCase();
}
