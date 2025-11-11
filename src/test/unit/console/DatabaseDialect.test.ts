/**
 * Unit tests for DatabaseDialect
 */

import * as assert from 'assert';
import { DatabaseDialect } from '../../../console/converter/DatabaseDialect';
import { DatabaseType } from '../../../console/types';

describe('DatabaseDialect', () => {
    describe('detectDatabase', () => {
        it('should detect MySQL from backticks', () => {
            const sql = 'SELECT `id`, `name` FROM `user`';
            assert.strictEqual(DatabaseDialect.detectDatabase(sql), DatabaseType.MySQL);
        });

        it('should detect MySQL from LIMIT', () => {
            const sql = 'SELECT * FROM user LIMIT 10';
            assert.strictEqual(DatabaseDialect.detectDatabase(sql), DatabaseType.MySQL);
        });

        it('should detect PostgreSQL from cast syntax', () => {
            const sql = "SELECT created_at::date FROM user";
            assert.strictEqual(DatabaseDialect.detectDatabase(sql), DatabaseType.PostgreSQL);
        });

        it('should detect PostgreSQL from OFFSET before LIMIT', () => {
            const sql = 'SELECT * FROM user OFFSET 10 LIMIT 20';
            assert.strictEqual(DatabaseDialect.detectDatabase(sql), DatabaseType.PostgreSQL);
        });

        it('should detect Oracle from ROWNUM', () => {
            const sql = 'SELECT * FROM user WHERE ROWNUM <= 10';
            assert.strictEqual(DatabaseDialect.detectDatabase(sql), DatabaseType.Oracle);
        });

        it('should detect Oracle from DUAL', () => {
            const sql = 'SELECT SYSDATE FROM DUAL';
            assert.strictEqual(DatabaseDialect.detectDatabase(sql), DatabaseType.Oracle);
        });

        it('should detect SQL Server from TOP', () => {
            const sql = 'SELECT TOP 10 * FROM user';
            assert.strictEqual(DatabaseDialect.detectDatabase(sql), DatabaseType.SQLServer);
        });

        it('should default to MySQL for unknown SQL', () => {
            const sql = 'SELECT * FROM user';
            assert.strictEqual(DatabaseDialect.detectDatabase(sql), DatabaseType.MySQL);
        });

        it('should handle empty SQL', () => {
            const sql = '';
            assert.strictEqual(DatabaseDialect.detectDatabase(sql), DatabaseType.Unknown);
        });
    });

    describe('formatParameter', () => {
        describe('NULL handling', () => {
            it('should format null value as NULL', () => {
                const param = { value: 'null', type: 'String' };
                const formatted = DatabaseDialect.formatParameter(param, DatabaseType.MySQL);
                assert.strictEqual(formatted, 'NULL');
            });
        });

        describe('Numeric types', () => {
            it('should format Integer without quotes', () => {
                const param = { value: '123', type: 'Integer' };
                const formatted = DatabaseDialect.formatParameter(param, DatabaseType.MySQL);
                assert.strictEqual(formatted, '123');
            });

            it('should format Long without quotes', () => {
                const param = { value: '999999', type: 'Long' };
                const formatted = DatabaseDialect.formatParameter(param, DatabaseType.MySQL);
                assert.strictEqual(formatted, '999999');
            });

            it('should format Double without quotes', () => {
                const param = { value: '3.14', type: 'Double' };
                const formatted = DatabaseDialect.formatParameter(param, DatabaseType.MySQL);
                assert.strictEqual(formatted, '3.14');
            });

            it('should format BigDecimal without quotes', () => {
                const param = { value: '99.99', type: 'BigDecimal' };
                const formatted = DatabaseDialect.formatParameter(param, DatabaseType.MySQL);
                assert.strictEqual(formatted, '99.99');
            });
        });

        describe('Boolean types', () => {
            it('should format true for MySQL', () => {
                const param = { value: 'true', type: 'Boolean' };
                const formatted = DatabaseDialect.formatParameter(param, DatabaseType.MySQL);
                assert.strictEqual(formatted, 'TRUE');
            });

            it('should format false for MySQL', () => {
                const param = { value: 'false', type: 'Boolean' };
                const formatted = DatabaseDialect.formatParameter(param, DatabaseType.MySQL);
                assert.strictEqual(formatted, 'FALSE');
            });

            it('should format true for PostgreSQL', () => {
                const param = { value: 'true', type: 'Boolean' };
                const formatted = DatabaseDialect.formatParameter(param, DatabaseType.PostgreSQL);
                assert.strictEqual(formatted, 'TRUE');
            });

            it('should format true as 1 for Oracle', () => {
                const param = { value: 'true', type: 'Boolean' };
                const formatted = DatabaseDialect.formatParameter(param, DatabaseType.Oracle);
                assert.strictEqual(formatted, '1');
            });

            it('should format false as 0 for Oracle', () => {
                const param = { value: 'false', type: 'Boolean' };
                const formatted = DatabaseDialect.formatParameter(param, DatabaseType.Oracle);
                assert.strictEqual(formatted, '0');
            });
        });

        describe('Date/Time types', () => {
            it('should format Timestamp for MySQL', () => {
                const param = { value: '2025-01-15 10:30:45', type: 'Timestamp' };
                const formatted = DatabaseDialect.formatParameter(param, DatabaseType.MySQL);
                assert.strictEqual(formatted, "'2025-01-15 10:30:45'");
            });

            it('should format LocalDateTime for PostgreSQL', () => {
                const param = { value: '2025-01-15 10:30:45', type: 'LocalDateTime' };
                const formatted = DatabaseDialect.formatParameter(param, DatabaseType.PostgreSQL);
                assert.strictEqual(formatted, "'2025-01-15 10:30:45'::timestamp");
            });

            it('should format LocalDate for PostgreSQL', () => {
                const param = { value: '2025-01-15', type: 'LocalDate' };
                const formatted = DatabaseDialect.formatParameter(param, DatabaseType.PostgreSQL);
                assert.strictEqual(formatted, "'2025-01-15'::date");
            });

            it('should format Date for Oracle', () => {
                const param = { value: '2025-01-15', type: 'Date' };
                const formatted = DatabaseDialect.formatParameter(param, DatabaseType.Oracle);
                assert.strictEqual(formatted, "TO_DATE('2025-01-15', 'YYYY-MM-DD')");
            });

            it('should format Timestamp for Oracle', () => {
                const param = { value: '2025-01-15 10:30:45', type: 'Timestamp' };
                const formatted = DatabaseDialect.formatParameter(param, DatabaseType.Oracle);
                assert.strictEqual(formatted, "TO_TIMESTAMP('2025-01-15 10:30:45', 'YYYY-MM-DD HH24:MI:SS.FF')");
            });
        });

        describe('String types', () => {
            it('should format string with single quotes', () => {
                const param = { value: 'active', type: 'String' };
                const formatted = DatabaseDialect.formatParameter(param, DatabaseType.MySQL);
                assert.strictEqual(formatted, "'active'");
            });

            it('should escape single quotes in string', () => {
                const param = { value: "O'Brien", type: 'String' };
                const formatted = DatabaseDialect.formatParameter(param, DatabaseType.MySQL);
                assert.strictEqual(formatted, "'O''Brien'");
            });

            it('should handle empty string', () => {
                const param = { value: '', type: 'String' };
                const formatted = DatabaseDialect.formatParameter(param, DatabaseType.MySQL);
                assert.strictEqual(formatted, "''");
            });

            it('should handle string with multiple quotes', () => {
                const param = { value: "It's a 'test'", type: 'String' };
                const formatted = DatabaseDialect.formatParameter(param, DatabaseType.MySQL);
                assert.strictEqual(formatted, "'It''s a ''test'''");
            });
        });
    });
});
