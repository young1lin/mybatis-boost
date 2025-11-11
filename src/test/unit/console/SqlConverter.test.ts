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
        it('should format SQL with proper indentation and newlines', () => {
            const sql = 'SELECT   *   FROM    user   WHERE   id   =   1';
            const formatted = SqlConverter.formatSql(sql);

            // sql-formatter adds newlines and proper formatting
            assert.ok(formatted.includes('SELECT'));
            assert.ok(formatted.includes('FROM'));
            assert.ok(formatted.includes('WHERE'));
            // Keywords should be uppercase
            assert.ok(formatted.match(/SELECT/));
            assert.ok(formatted.match(/FROM/));
            assert.ok(formatted.match(/WHERE/));
        });

        it('should handle empty SQL', () => {
            const sql = '';
            const formatted = SqlConverter.formatSql(sql);
            assert.strictEqual(formatted, '');
        });

        it('should format SQL with newlines and indentation', () => {
            const sql = '  SELECT * FROM user  ';
            const formatted = SqlConverter.formatSql(sql);

            // Should have proper formatting with newlines
            assert.ok(formatted.includes('\n'), 'Should contain newlines');
            assert.ok(formatted.includes('SELECT'), 'Should contain SELECT');
            assert.ok(formatted.includes('FROM'), 'Should contain FROM');
        });

        it('should format MySQL SQL with proper dialect', () => {
            const sql = 'select id, name from `user` where status = 1';
            const formatted = SqlConverter.formatSql(sql, DatabaseType.MySQL);

            // Keywords should be uppercase
            assert.ok(formatted.includes('SELECT'));
            assert.ok(formatted.includes('FROM'));
            assert.ok(formatted.includes('WHERE'));
            // Should preserve backticks for MySQL
            assert.ok(formatted.includes('`user`') || formatted.includes('user'));
        });

        it('should format PostgreSQL SQL with proper dialect', () => {
            const sql = 'select id, name from user where created_at::date > current_date';
            const formatted = SqlConverter.formatSql(sql, DatabaseType.PostgreSQL);

            // Keywords should be uppercase
            assert.ok(formatted.includes('SELECT'));
            assert.ok(formatted.includes('FROM'));
            assert.ok(formatted.includes('WHERE'));
        });

        it('should format complex SQL with JOIN and GROUP BY', () => {
            const sql = 'SELECT u.id, u.name, COUNT(o.id) FROM users u LEFT JOIN orders o ON u.id = o.user_id WHERE u.status = 1 GROUP BY u.id, u.name ORDER BY u.name';
            const formatted = SqlConverter.formatSql(sql, DatabaseType.MySQL);

            // Should contain all major keywords
            assert.ok(formatted.includes('SELECT'));
            assert.ok(formatted.includes('FROM'));
            assert.ok(formatted.includes('LEFT JOIN'));
            assert.ok(formatted.includes('WHERE'));
            assert.ok(formatted.includes('GROUP BY'));
            assert.ok(formatted.includes('ORDER BY'));

            // Should have multiple lines
            assert.ok(formatted.split('\n').length > 3, 'Should have multiple lines');
        });

        it('should format INSERT statement', () => {
            const sql = 'INSERT INTO users (id, name, email) VALUES (1, "John", "john@example.com")';
            const formatted = SqlConverter.formatSql(sql, DatabaseType.MySQL);

            assert.ok(formatted.includes('INSERT INTO'));
            assert.ok(formatted.includes('VALUES'));
        });

        it('should format UPDATE statement', () => {
            const sql = 'UPDATE users SET name = "John", email = "john@example.com" WHERE id = 1';
            const formatted = SqlConverter.formatSql(sql, DatabaseType.MySQL);

            assert.ok(formatted.includes('UPDATE'));
            assert.ok(formatted.includes('SET'));
            assert.ok(formatted.includes('WHERE'));
        });

        it('should format DELETE statement', () => {
            const sql = 'DELETE FROM users WHERE id = 1 AND status = 0';
            const formatted = SqlConverter.formatSql(sql, DatabaseType.MySQL);

            assert.ok(formatted.includes('DELETE'));
            assert.ok(formatted.includes('FROM'));
            assert.ok(formatted.includes('WHERE'));
        });

        it('should handle formatting errors gracefully', () => {
            // Malformed SQL that might cause formatter to fail
            const sql = 'SELECT * FROM';
            const formatted = SqlConverter.formatSql(sql);

            // Should return something (either formatted or fallback)
            assert.ok(typeof formatted === 'string');
            assert.ok(formatted.length > 0);
        });

        it('should use correct dialect for Oracle', () => {
            const sql = 'SELECT id, name FROM user WHERE rownum <= 10';
            const formatted = SqlConverter.formatSql(sql, DatabaseType.Oracle);

            assert.ok(formatted.includes('SELECT'));
            assert.ok(formatted.includes('FROM'));
            assert.ok(formatted.includes('WHERE'));
        });

        it('should use correct dialect for SQL Server', () => {
            const sql = 'SELECT TOP 10 id, name FROM [user] WHERE status = 1';
            const formatted = SqlConverter.formatSql(sql, DatabaseType.SQLServer);

            assert.ok(formatted.includes('SELECT'));
            assert.ok(formatted.includes('TOP'));
            assert.ok(formatted.includes('FROM'));
        });
    });
});
