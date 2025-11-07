/**
 * VS Code integration helper for DDL parser
 * This file provides utilities to integrate the DDL parser with VS Code configuration
 */

import * as vscode from 'vscode';
import { parseDDL } from './parser/ddlParser';
import { ParseResult, ParseOptions, DateTimeType } from './type';

/**
 * Parse DDL with configuration from VS Code settings
 * @param sql - SQL DDL statement
 * @param options - Parsing options (dateTimeType will be read from config if not provided)
 * @returns Parse result with data or error
 */
export function parseDDLWithConfig(sql: string, options?: ParseOptions): ParseResult {
  const config = vscode.workspace.getConfiguration('mybatis-boost.generator');

  // Read dateTimeType from configuration if not explicitly provided
  const dateTimeType = options?.dateTimeType ||
    (config.get<DateTimeType>('datetime') ?? 'LocalDateTime');

  // Merge with other options
  const finalOptions: ParseOptions = {
    ...options,
    dateTimeType,
  };

  return parseDDL(sql, finalOptions);
}
