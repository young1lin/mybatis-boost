/**
 * Unit tests for LogParser
 */

import * as assert from 'assert';
import { LogParser } from '../../../console/parser/LogParser';
import { LogType } from '../../../console/types';

describe('LogParser', () => {
    describe('isMyBatisLog', () => {
        it('should recognize standard format log', () => {
            const line = '2025-01-15 10:30:45.123 DEBUG com.example.UserMapper.selectById - ==>  Preparing: SELECT * FROM user WHERE id = ?';
            assert.strictEqual(LogParser.isMyBatisLog(line), true);
        });

        it('should recognize custom format log with traceId', () => {
            const line = '[traceId:] 2025-11-11 16:51:45.067 DEBUG 21104 --- [-update-coinMap] c.z.i.d.m.C.selectListByCondition        : ==>  Preparing: SELECT id FROM tstd_coin';
            assert.strictEqual(LogParser.isMyBatisLog(line), true);
        });

        it('should reject non-MyBatis log', () => {
            const line = 'Some random log message';
            assert.strictEqual(LogParser.isMyBatisLog(line), false);
        });

        it('should handle empty string', () => {
            assert.strictEqual(LogParser.isMyBatisLog(''), false);
        });

        it('should handle null input', () => {
            assert.strictEqual(LogParser.isMyBatisLog(null as any), false);
        });
    });

    describe('parse - standard format', () => {
        it('should parse Preparing log', () => {
            const line = '2025-01-15 10:30:45.123 DEBUG com.example.UserMapper.selectById - ==>  Preparing: SELECT * FROM user WHERE id = ?';
            const result = LogParser.parse(line);

            assert.ok(result);
            assert.strictEqual(result.timestamp, '2025-01-15 10:30:45.123');
            assert.strictEqual(result.mapper, 'com.example.UserMapper.selectById');
            assert.strictEqual(result.logType, LogType.Preparing);
            assert.strictEqual(result.content, 'Preparing: SELECT * FROM user WHERE id = ?');
            assert.strictEqual(result.threadId, undefined);
        });

        it('should parse Parameters log', () => {
            const line = '2025-01-15 10:30:45.125 DEBUG com.example.UserMapper.selectById - ==> Parameters: 1(Integer), active(String)';
            const result = LogParser.parse(line);

            assert.ok(result);
            assert.strictEqual(result.logType, LogType.Parameters);
            assert.strictEqual(result.content, 'Parameters: 1(Integer), active(String)');
        });

        it('should parse Total log', () => {
            const line = '2025-01-15 10:30:45.130 DEBUG com.example.UserMapper.selectById - <==      Total: 1';
            const result = LogParser.parse(line);

            assert.ok(result);
            assert.strictEqual(result.logType, LogType.Total);
            assert.strictEqual(result.content, 'Total: 1');
        });
    });

    describe('parse - custom format', () => {
        it('should parse custom format with thread info', () => {
            const line = '[traceId:] 2025-11-11 16:51:45.067 DEBUG 21104 --- [-update-coinMap] c.z.i.d.m.C.selectListByCondition        : ==>  Preparing: SELECT id FROM tstd_coin';
            const result = LogParser.parse(line);

            assert.ok(result);
            assert.strictEqual(result.timestamp, '2025-11-11 16:51:45.067');
            assert.strictEqual(result.threadId, '21104');
            assert.strictEqual(result.threadName, '-update-coinMap');
            assert.strictEqual(result.mapper, 'c.z.i.d.m.C.selectListByCondition');
            assert.strictEqual(result.logType, LogType.Preparing);
        });

        it('should parse custom format Parameters', () => {
            const line = '[traceId:] 2025-11-11 16:51:45.067 DEBUG 21104 --- [-update-coinMap] c.z.i.d.m.C.selectListByCondition        : ==> Parameters: MATIC(String), 0(String), 1(String)';
            const result = LogParser.parse(line);

            assert.ok(result);
            assert.strictEqual(result.logType, LogType.Parameters);
            assert.strictEqual(result.threadId, '21104');
        });

        it('should parse custom format Total', () => {
            const line = '[traceId:] 2025-11-11 16:51:45.074 DEBUG 21104 --- [-update-coinMap] c.z.i.d.m.C.selectListByCondition        : <==      Total: 1';
            const result = LogParser.parse(line);

            assert.ok(result);
            assert.strictEqual(result.logType, LogType.Total);
        });
    });

    describe('extractSql', () => {
        it('should extract SQL from Preparing content', () => {
            const content = 'Preparing: SELECT * FROM user WHERE id = ?';
            const sql = LogParser.extractSql(content);

            assert.strictEqual(sql, 'SELECT * FROM user WHERE id = ?');
        });

        it('should return null for non-Preparing content', () => {
            const content = 'Parameters: 1(Integer)';
            const sql = LogParser.extractSql(content);

            assert.strictEqual(sql, null);
        });
    });

    describe('extractParameterString', () => {
        it('should extract parameter string', () => {
            const content = 'Parameters: 1(Integer), active(String)';
            const params = LogParser.extractParameterString(content);

            assert.strictEqual(params, '1(Integer), active(String)');
        });

        it('should return null for non-Parameters content', () => {
            const content = 'Preparing: SELECT * FROM user';
            const params = LogParser.extractParameterString(content);

            assert.strictEqual(params, null);
        });
    });

    describe('extractTotal', () => {
        it('should extract total count', () => {
            const content = 'Total: 1';
            const total = LogParser.extractTotal(content);

            assert.strictEqual(total, 1);
        });

        it('should extract large numbers', () => {
            const content = 'Total: 12345';
            const total = LogParser.extractTotal(content);

            assert.strictEqual(total, 12345);
        });

        it('should return null for non-Total content', () => {
            const content = 'Parameters: 1(Integer)';
            const total = LogParser.extractTotal(content);

            assert.strictEqual(total, null);
        });
    });
});
