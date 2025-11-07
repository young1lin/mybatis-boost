/**
 * Library-based parser adapter using sql-ddl-to-json-schema for MySQL
 */

import { Parser } from 'sql-ddl-to-json-schema';
import { ParsedSchema, ColumnInfo } from '../type';
import { snakeToPascal, snakeToCamel, mapSqlTypeToJavaType } from './utils';

/**
 * Parse MySQL DDL using sql-ddl-to-json-schema library
 * @param sql - CREATE TABLE SQL statement
 * @returns Parsed schema or null if parsing failed
 * @throws Error if composite primary key detected
 */
export function parseWithLibrary(sql: string): ParsedSchema | null {
  try {
    const parser = new Parser('mysql');
    parser.feed(sql);

    const compactJson = parser.toCompactJson(parser.results);

    if (!compactJson || compactJson.length === 0) {
      return null;
    }

    const tableData = compactJson[0];

    // Extract table name
    const tableName = tableData.name;
    if (!tableName) {
      return null;
    }

    // Detect composite primary key
    const primaryKeyColumns: string[] = [];
    if (tableData.primaryKey && tableData.primaryKey.columns) {
      tableData.primaryKey.columns.forEach((col: any) => {
        primaryKeyColumns.push(col.column);
      });
    }

    if (primaryKeyColumns.length > 1) {
      throw new Error(
        `Composite primary key detected (${primaryKeyColumns.join(', ')}). ` +
        'Only single primary keys are supported.'
      );
    }

    const primaryKeyColumn = primaryKeyColumns.length === 1 ? primaryKeyColumns[0] : undefined;

    // Parse columns
    const columns: ColumnInfo[] = [];
    let primaryKey: ColumnInfo | undefined;

    if (tableData.columns && Array.isArray(tableData.columns)) {
      for (const col of tableData.columns) {
        const columnName = col.name;
        const fieldName = snakeToCamel(columnName);
        const isPrimaryKey = columnName === primaryKeyColumn;

        // Extract SQL type
        let sqlType = col.type?.datatype || 'VARCHAR';
        if (col.type?.length) {
          sqlType += `(${col.type.length})`;
        } else if (col.type?.digits) {
          sqlType += `(${col.type.digits}${col.type.decimals ? `,${col.type.decimals}` : ''})`;
        }

        // Determine nullability
        const nullable = col.options?.nullable === undefined || col.options?.nullable === true;

        // Map to Java type
        const javaType = mapSqlTypeToJavaType(sqlType, nullable, 'mysql');

        // Extract default value
        let defaultValue: string | undefined;
        if (col.options?.default) {
          const defaultVal = col.options.default;
          if (typeof defaultVal === 'object' && defaultVal !== null) {
            defaultValue = (defaultVal as any).value?.value || (defaultVal as any).value;
          } else {
            defaultValue = String(defaultVal);
          }
        }

        const columnInfo: ColumnInfo = {
          columnName,
          fieldName,
          sqlType,
          javaType,
          nullable,
          isPrimaryKey,
          comment: col.options?.comment,
          defaultValue,
        };

        columns.push(columnInfo);

        if (isPrimaryKey) {
          primaryKey = columnInfo;
        }
      }
    }

    const schema: ParsedSchema = {
      tableName,
      className: snakeToPascal(tableName),
      columns,
      primaryKey,
      databaseType: 'mysql',
    };

    return schema;
  } catch (error) {
    // Re-throw composite primary key error
    if (error instanceof Error && error.message.includes('Composite primary key')) {
      throw error;
    }
    // Return null for other parsing errors (will trigger fallback)
    return null;
  }
}
