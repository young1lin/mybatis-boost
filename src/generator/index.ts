/**
 * DDL Parser - Main entry point
 * Exports the public API for parsing CREATE TABLE statements
 */

export { parseDDL } from './parser/ddlParser';
export { ParseResult, ParsedSchema, ColumnInfo, ParseOptions } from './type';
