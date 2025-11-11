/**
 * Unit tests for SqlConverter
 */

import * as assert from 'assert';
import { SqlConverter } from '../../../console/converter/SqlConverter';
import { DatabaseType } from '../../../console/types';

describe('SqlConverter', () => {
    describe('convert', () => {
        it('should replace single parameter', () => {
            const sql = 'SELECT * FROM user WHERE id = ?';
            const params = [{ value: '1', type: 'Integer' }];

            const result = SqlConverter.convert(sql, params, DatabaseType.MySQL);
            assert.strictEqual(result, 'SELECT * FROM user WHERE id = 1');
        });

        it('should replace multiple parameters', () => {
            const sql = 'SELECT * FROM user WHERE id = ? AND status = ?';
            const params = [
                { value: '1', type: 'Integer' },
                { value: 'active', type: 'String' }
            ];

            const result = SqlConverter.convert(sql, params, DatabaseType.MySQL);
            assert.strictEqual(result, "SELECT * FROM user WHERE id = 1 AND status = 'active'");
        });

        it('should handle IN clause with multiple placeholders', () => {
            const sql = 'SELECT * FROM user WHERE status IN (?, ?, ?)';
            const params = [
                { value: '0', type: 'String' },
                { value: '1', type: 'String' },
                { value: '2', type: 'String' }
            ];

            const result = SqlConverter.convert(sql, params, DatabaseType.MySQL);
            assert.strictEqual(result, "SELECT * FROM user WHERE status IN ('0', '1', '2')");
        });

        it('should handle NULL parameters', () => {
            const sql = 'SELECT * FROM user WHERE deleted_at = ? AND name = ?';
            const params = [
                { value: 'null', type: 'Timestamp' },
                { value: 'John', type: 'String' }
            ];

            const result = SqlConverter.convert(sql, params, DatabaseType.MySQL);
            assert.strictEqual(result, "SELECT * FROM user WHERE deleted_at = NULL AND name = 'John'");
        });

        it('should handle mixed parameter types', () => {
            const sql = 'INSERT INTO user (id, name, age, active) VALUES (?, ?, ?, ?)';
            const params = [
                { value: '1', type: 'Long' },
                { value: 'John', type: 'String' },
                { value: '25', type: 'Integer' },
                { value: 'true', type: 'Boolean' }
            ];

            const result = SqlConverter.convert(sql, params, DatabaseType.MySQL);
            assert.strictEqual(result, "INSERT INTO user (id, name, age, active) VALUES (1, 'John', 25, TRUE)");
        });

        it('should auto-detect database type from MySQL backticks', () => {
            const sql = 'SELECT * FROM `user` WHERE `id` = ?';
            const params = [{ value: '1', type: 'Integer' }];

            const result = SqlConverter.convert(sql, params);
            assert.strictEqual(result, 'SELECT * FROM `user` WHERE `id` = 1');
        });

        it('should handle PostgreSQL cast syntax', () => {
            const sql = 'SELECT * FROM user WHERE created_at::date = ?';
            const params = [{ value: '2025-01-15', type: 'LocalDate' }];

            const result = SqlConverter.convert(sql, params);
            assert.strictEqual(result, "SELECT * FROM user WHERE created_at::date = '2025-01-15'::date");
        });

        it('should leave placeholders when not enough parameters', () => {
            const sql = 'SELECT * FROM user WHERE id = ? AND status = ?';
            const params = [{ value: '1', type: 'Integer' }];

            const result = SqlConverter.convert(sql, params, DatabaseType.MySQL);
            assert.strictEqual(result, 'SELECT * FROM user WHERE id = 1 AND status = ?');
        });

        it('should handle empty parameter array', () => {
            const sql = 'SELECT * FROM user';
            const params: any[] = [];

            const result = SqlConverter.convert(sql, params, DatabaseType.MySQL);
            assert.strictEqual(result, 'SELECT * FROM user');
        });

        it('should handle SQL with no placeholders', () => {
            const sql = 'SELECT * FROM user';
            const params = [{ value: '1', type: 'Integer' }];

            const result = SqlConverter.convert(sql, params, DatabaseType.MySQL);
            assert.strictEqual(result, 'SELECT * FROM user');
        });

        it('should handle empty SQL', () => {
            const sql = '';
            const params = [{ value: '1', type: 'Integer' }];

            const result = SqlConverter.convert(sql, params, DatabaseType.MySQL);
            assert.strictEqual(result, '');
        });

        it('should handle strings with special characters', () => {
            const sql = 'SELECT * FROM user WHERE name = ?';
            const params = [{ value: "O'Brien", type: 'String' }];

            const result = SqlConverter.convert(sql, params, DatabaseType.MySQL);
            assert.strictEqual(result, "SELECT * FROM user WHERE name = 'O''Brien'");
        });
    });

    describe('validateParameterCount', () => {
        it('should validate matching counts', () => {
            const sql = 'SELECT * FROM user WHERE id = ? AND status = ?';
            const params = [
                { value: '1', type: 'Integer' },
                { value: 'active', type: 'String' }
            ];

            const result = SqlConverter.validateParameterCount(sql, params);
            assert.strictEqual(result.valid, true);
            assert.strictEqual(result.expected, 2);
            assert.strictEqual(result.actual, 2);
        });

        it('should detect mismatch - too few parameters', () => {
            const sql = 'SELECT * FROM user WHERE id = ? AND status = ?';
            const params = [{ value: '1', type: 'Integer' }];

            const result = SqlConverter.validateParameterCount(sql, params);
            assert.strictEqual(result.valid, false);
            assert.strictEqual(result.expected, 2);
            assert.strictEqual(result.actual, 1);
        });

        it('should detect mismatch - too many parameters', () => {
            const sql = 'SELECT * FROM user WHERE id = ?';
            const params = [
                { value: '1', type: 'Integer' },
                { value: 'active', type: 'String' }
            ];

            const result = SqlConverter.validateParameterCount(sql, params);
            assert.strictEqual(result.valid, false);
            assert.strictEqual(result.expected, 1);
            assert.strictEqual(result.actual, 2);
        });

        it('should handle SQL with no placeholders', () => {
            const sql = 'SELECT * FROM user';
            const params: any[] = [];

            const result = SqlConverter.validateParameterCount(sql, params);
            assert.strictEqual(result.valid, true);
            assert.strictEqual(result.expected, 0);
            assert.strictEqual(result.actual, 0);
        });
    });

    describe('formatSql', () => {
        it('should clean up extra whitespace', () => {
            const sql = 'SELECT   *   FROM    user   WHERE   id   =   1';
            const formatted = SqlConverter.formatSql(sql);
            assert.strictEqual(formatted, 'SELECT * FROM user WHERE id = 1');
        });

        it('should handle empty SQL', () => {
            const sql = '';
            const formatted = SqlConverter.formatSql(sql);
            assert.strictEqual(formatted, '');
        });

        it('should trim leading and trailing whitespace', () => {
            const sql = '  SELECT * FROM user  ';
            const formatted = SqlConverter.formatSql(sql);
            assert.strictEqual(formatted, 'SELECT * FROM user');
        });
    });
});
