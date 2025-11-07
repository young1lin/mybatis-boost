/**
 * Fallback regex-based DDL parser for PostgreSQL, Oracle, and MySQL backup
 */

import { ParsedSchema, ColumnInfo, DateTimeType } from '../type';
import { mapSqlTypeToJavaType, toFullyQualifiedType } from './utils';

/**
 * Parse DDL using regex-based approach
 * @param sql - CREATE TABLE SQL statement
 * @param dbType - Database type
 * @param dateTimeType - Date/Time type preference (default: 'LocalDateTime')
 * @returns Parsed schema or null if parsing failed
 * @throws Error if composite primary key detected
 */
export function parseWithRegex(
  sql: string,
  dbType: 'mysql' | 'postgresql' | 'oracle',
  dateTimeType: DateTimeType = 'LocalDateTime'
): ParsedSchema | null {
  try {
    // Extract table name
    const tableNameMatch = sql.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:`)?(\w+)(?:`)?/i);
    if (!tableNameMatch) {
      return null;
    }

    const tableName = tableNameMatch[1];

    // Extract column definitions section
    const columnsMatch = sql.match(/\(([\s\S]+)\)/);
    if (!columnsMatch) {
      return null;
    }

    const columnsSection = columnsMatch[1];

    // Split by comma, but be careful with nested parentheses (e.g., DECIMAL(10,2))
    const columnLines = splitColumnDefinitions(columnsSection);

    const columns: ColumnInfo[] = [];
    const primaryKeyColumns: string[] = [];
    let primaryKey: ColumnInfo | undefined;

    for (const line of columnLines) {
      const trimmedLine = line.trim();

      // Check for PRIMARY KEY constraint (standalone)
      if (/^\s*PRIMARY\s+KEY\s*\(/i.test(trimmedLine)) {
        const pkMatch = trimmedLine.match(/PRIMARY\s+KEY\s*\(([^)]+)\)/i);
        if (pkMatch) {
          const pkColumns = pkMatch[1].split(',').map(c => c.trim().replace(/[`"]/g, ''));
          primaryKeyColumns.push(...pkColumns);
        }
        continue;
      }

      // Check for CONSTRAINT definitions (skip for now)
      if (/^\s*CONSTRAINT/i.test(trimmedLine)) {
        continue;
      }

      // Parse column definition
      const columnInfo = parseColumnDefinition(trimmedLine, dbType, dateTimeType);
      if (columnInfo) {
        columns.push(columnInfo);
      }
    }

    // Detect composite primary key
    if (primaryKeyColumns.length > 1) {
      throw new Error(
        `Composite primary key detected (${primaryKeyColumns.join(', ')}). ` +
        'Only single primary keys are supported.'
      );
    }

    // Mark primary key column
    if (primaryKeyColumns.length === 1) {
      const pkColumn = columns.find(c => c.columnName === primaryKeyColumns[0]);
      if (pkColumn) {
        pkColumn.isPrimaryKey = true;
        primaryKey = pkColumn;
      }
    } else {
      // Check for inline PRIMARY KEY definitions
      const inlinePkColumn = columns.find(c => c.isPrimaryKey);
      if (inlinePkColumn) {
        primaryKey = inlinePkColumn;
      }
    }

    const schema: ParsedSchema = {
      tableName,
      columns,
      primaryKey,
      databaseType: dbType,
    };

    return schema;
  } catch (error) {
    // Re-throw composite primary key error
    if (error instanceof Error && error.message.includes('Composite primary key')) {
      throw error;
    }
    // Return null for other parsing errors
    return null;
  }
}

/**
 * Parse individual column definition
 * @param line - Column definition line
 * @param dbType - Database type
 * @param dateTimeType - Date/Time type preference
 * @returns ColumnInfo or null if parsing failed
 */
function parseColumnDefinition(
  line: string,
  dbType: 'mysql' | 'postgresql' | 'oracle',
  dateTimeType: DateTimeType
): ColumnInfo | null {
  // Remove leading/trailing whitespace and quotes
  line = line.trim();

  // Extract column name (first word, possibly quoted)
  const columnNameMatch = line.match(/^(?:`|")?(\w+)(?:`|")?/);
  if (!columnNameMatch) {
    return null;
  }

  const columnName = columnNameMatch[1];

  // Remove column name from line
  const remaining = line.substring(columnNameMatch[0].length).trim();

  // Extract data type (including length/precision)
  const typeMatch = remaining.match(/^(\w+)(?:\(([^)]+)\))?/i);
  if (!typeMatch) {
    return null;
  }

  const baseType = typeMatch[1];
  const typeParams = typeMatch[2] || '';
  const sqlType = typeParams ? `${baseType}(${typeParams})` : baseType;

  // Check for PRIMARY KEY
  const isPrimaryKey = /PRIMARY\s+KEY/i.test(remaining);

  // Check for NOT NULL
  const isNotNull = /NOT\s+NULL/i.test(remaining);
  const nullable = !isNotNull && !isPrimaryKey; // Primary keys are implicitly NOT NULL

  // Extract DEFAULT value
  let defaultValue: string | undefined;
  const defaultMatch = remaining.match(/DEFAULT\s+([^,\s]+)/i);
  if (defaultMatch) {
    defaultValue = defaultMatch[1].replace(/['"]/g, '');
  }

  // Extract COMMENT
  let comment: string | undefined;
  const commentMatch = remaining.match(/COMMENT\s+['"]([^'"]+)['"]/i);
  if (commentMatch) {
    comment = commentMatch[1];
  }

  // Map to Java type
  const javaType = mapSqlTypeToJavaType(sqlType, dateTimeType);
  const javaTypeFullName = toFullyQualifiedType(javaType);

  return {
    columnName,
    sqlType,
    javaType,
    javaTypeFullName,
    nullable,
    isPrimaryKey,
    comment,
    defaultValue,
  };
}

/**
 * Split column definitions by commas, respecting nested parentheses
 * @param columnsSection - The content inside CREATE TABLE (...)
 * @returns Array of column definition strings
 */
function splitColumnDefinitions(columnsSection: string): string[] {
  const lines: string[] = [];
  let currentLine = '';
  let parenDepth = 0;

  for (let i = 0; i < columnsSection.length; i++) {
    const char = columnsSection[i];

    if (char === '(') {
      parenDepth++;
    } else if (char === ')') {
      parenDepth--;
    } else if (char === ',' && parenDepth === 0) {
      // Found a top-level comma
      lines.push(currentLine.trim());
      currentLine = '';
      continue;
    }

    currentLine += char;
  }

  // Add the last line
  if (currentLine.trim()) {
    lines.push(currentLine.trim());
  }

  return lines;
}
