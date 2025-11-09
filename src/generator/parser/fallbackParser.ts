/**
 * Fallback regex-based DDL parser for PostgreSQL, Oracle, and MySQL backup
 */

import { ParsedSchema, ColumnInfo, DateTimeType } from '../type';
import { mapSqlTypeToJavaType, toFullyQualifiedType, normalizeSqlType } from '../utils';

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
    // Extract table name (supports unquoted, backticks `, and double quotes ")
    const tableNameMatch = sql.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:[`"])?(\w+)(?:[`"])?/i);
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

    // Extract table-level comment based on database type
    let tableComment: string | undefined;

    if (dbType === 'oracle' || dbType === 'postgresql') {
      // Oracle/PostgreSQL: Extract from COMMENT ON TABLE/COLUMN statements
      const commentMetadata = extractExternalComments(sql, tableName);
      tableComment = commentMetadata.tableComment;

      // Merge COMMENT ON COLUMN statements with inline comments
      for (const column of columns) {
        if (!column.comment && commentMetadata.columnComments[column.columnName]) {
          column.comment = commentMetadata.columnComments[column.columnName];
        }
      }
    } else if (dbType === 'mysql') {
      // MySQL: Extract table comment from table options
      tableComment = extractTableComment(sql);
    }

    const schema: ParsedSchema = {
      tableName,
      columns,
      primaryKey,
      databaseType: dbType,
      comment: tableComment,
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

  const sqlType = normalizeSqlType(typeMatch[1]);
  const typeParams = typeMatch[2] || '';

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
  const javaType = mapSqlTypeToJavaType(sqlType, dateTimeType, typeParams);
  const javaTypeFullName = toFullyQualifiedType(javaType);

  return {
    columnName,
    sqlType,
    typeParams,
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

/**
 * Extract table comment from MySQL/PostgreSQL table options
 * Handles formats like: COMMENT='table comment' or COMMENT 'table comment'
 * @param sql - DDL SQL statement
 * @returns Table comment or undefined
 */
function extractTableComment(sql: string): string | undefined {
  // MySQL/PostgreSQL: COMMENT='...' or COMMENT '...' or COMMENT="..." at table level (after closing parenthesis)
  // Must match COMMENT after the last closing parenthesis of column definitions
  // Use greedy match to get to the last ) before COMMENT to avoid matching column comments
  const commentMatch = sql.match(/\)[\s\S]*COMMENT\s*=?\s*['"]([^'"]+)['"]\s*$/i);
  if (commentMatch) {
    return commentMatch[1];
  }
  return undefined;
}

/**
 * Extract COMMENT ON TABLE and COMMENT ON COLUMN statements (PostgreSQL/Oracle)
 * Both PostgreSQL and Oracle use the same syntax: COMMENT ON COLUMN table.column IS 'comment'
 * @param sql - Full DDL SQL (may contain multiple statements)
 * @param tableName - Table name to extract comments for
 * @returns Object containing table comment and column comments
 */
function extractExternalComments(
  sql: string,
  tableName: string
): { tableComment?: string; columnComments: Record<string, string> } {
  const result: { tableComment?: string; columnComments: Record<string, string> } = {
    columnComments: {},
  };

  // Escape table name for regex (handle special characters)
  const escapedTableName = tableName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Extract COMMENT ON TABLE statement
  // Pattern: COMMENT ON TABLE table_name IS 'comment text' or COMMENT ON TABLE "table_name" IS 'comment text';
  const tableCommentRegex = new RegExp(
    `COMMENT\\s+ON\\s+TABLE\\s+(?:${escapedTableName}|"${escapedTableName}")\\s+IS\\s+['"]([^'"]+)['"]`,
    'i'
  );
  const tableCommentMatch = sql.match(tableCommentRegex);
  if (tableCommentMatch) {
    result.tableComment = tableCommentMatch[1];
  }

  // Extract COMMENT ON COLUMN statements
  // Pattern: COMMENT ON COLUMN table_name.column_name IS 'comment text' or with quotes;
  const columnCommentRegex = new RegExp(
    `COMMENT\\s+ON\\s+COLUMN\\s+(?:${escapedTableName}|"${escapedTableName}")\\.(?:(\\w+)|"(\\w+)")\\s+IS\\s+['"]([^'"]+)['"]`,
    'gi'
  );

  let match;
  while ((match = columnCommentRegex.exec(sql)) !== null) {
    const columnName = match[1] || match[2]; // Handle both quoted and unquoted column names
    const comment = match[3];
    if (columnName) {
      result.columnComments[columnName] = comment;
    }
  }

  return result;
}
