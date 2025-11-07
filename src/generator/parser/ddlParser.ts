/**
 * Main DDL parser coordinator
 * Handles parsing flow: validation -> detection -> library parse -> fallback parse
 */

import { ParseResult, ParseOptions } from '../type';
import { parseWithLibrary } from './libraryParser';
import { parseWithRegex } from './fallbackParser';

/**
 * Parse CREATE TABLE DDL statement
 * @param sql - SQL DDL statement
 * @param options - Parsing options
 * @returns Parse result with data or error
 */
export function parseDDL(sql: string, options?: ParseOptions): ParseResult {
  try {
    // Step 1: Quick validation - check if it's a CREATE TABLE statement
    if (!isCreateTableStatement(sql)) {
      return {
        success: false,
        error: {
          code: 'NOT_CREATE_TABLE',
          message: 'The provided SQL is not a CREATE TABLE statement.',
        },
      };
    }

    // Step 2: Detect database type if not provided
    const dbType = options?.dbType || detectDatabaseType(sql);
    const dateTimeType = options?.dateTimeType || 'LocalDateTime';

    // Step 3: Try library parser for MySQL
    if (dbType === 'mysql') {
      try {
        const result = parseWithLibrary(sql, dateTimeType);
        if (result) {
          return {
            success: true,
            data: result,
          };
        }
      } catch (error) {
        // Check if it's a composite primary key error
        if (error instanceof Error && error.message.includes('Composite primary key')) {
          return {
            success: false,
            error: {
              code: 'COMPOSITE_PRIMARY_KEY',
              message: error.message,
            },
          };
        }
        // Otherwise, fall through to regex parser
      }
    }

    // Step 4: Fallback to regex parser
    try {
      const result = parseWithRegex(sql, dbType, dateTimeType);
      if (result) {
        return {
          success: true,
          data: result,
        };
      }
    } catch (error) {
      // Check if it's a composite primary key error
      if (error instanceof Error && error.message.includes('Composite primary key')) {
        return {
          success: false,
          error: {
            code: 'COMPOSITE_PRIMARY_KEY',
            message: error.message,
          },
        };
      }
    }

    // Step 5: All parsing attempts failed
    return {
      success: false,
      error: {
        code: 'PARSE_FAILED',
        message: `Failed to parse ${dbType.toUpperCase()} DDL statement. The statement may contain unsupported syntax.`,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'PARSE_FAILED',
        message: error instanceof Error ? error.message : 'Unknown parsing error occurred.',
      },
    };
  }
}

/**
 * Quick check if SQL is a CREATE TABLE statement
 * @param sql - SQL statement
 * @returns true if CREATE TABLE statement
 */
function isCreateTableStatement(sql: string): boolean {
  return /CREATE\s+TABLE/i.test(sql);
}

/**
 * Detect database type from SQL syntax patterns
 * @param sql - SQL statement
 * @returns Detected database type (defaults to mysql)
 */
function detectDatabaseType(sql: string): 'mysql' | 'postgresql' | 'oracle' {
  // MySQL indicators
  if (/AUTO_INCREMENT|ENGINE\s*=/i.test(sql)) {
    return 'mysql';
  }

  // PostgreSQL indicators
  if (/SERIAL|BIGSERIAL/i.test(sql)) {
    return 'postgresql';
  }

  // Oracle indicators
  if (/NUMBER|VARCHAR2|CLOB/i.test(sql)) {
    return 'oracle';
  }

  // Default to MySQL
  return 'mysql';
}
