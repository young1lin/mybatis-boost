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

    describe('parse - Spring Boot 3.x format', () => {
        it('should recognize Spring Boot format', () => {
            const line = '2025-11-11T17:48:05.123+08:00 DEBUG 126048 --- [mybatis-boost-integration-test] [           main] c.y.m.b.i.t.mapper.UserMapper.selectById : ==>  Preparing: SELECT * FROM user WHERE id = ?';
            assert.strictEqual(LogParser.isMyBatisLog(line), true);
        });

        it('should parse Spring Boot Preparing log', () => {
            const line = '2025-11-11T17:48:05.123+08:00 DEBUG 126048 --- [mybatis-boost-integration-test] [           main] c.y.m.b.i.t.mapper.UserMapper.selectById : ==>  Preparing: SELECT * FROM user WHERE id = ?';
            const result = LogParser.parse(line);

            assert.ok(result);
            assert.strictEqual(result.timestamp, '2025-11-11T17:48:05.123+08:00');
            assert.strictEqual(result.threadId, '126048');
            assert.strictEqual(result.threadName, 'main');
            assert.strictEqual(result.mapper, 'c.y.m.b.i.t.mapper.UserMapper.selectById');
            assert.strictEqual(result.logType, LogType.Preparing);
            assert.strictEqual(result.content, 'Preparing: SELECT * FROM user WHERE id = ?');
        });

        it('should parse Spring Boot Parameters log', () => {
            const line = '2025-11-11T17:48:05.125+08:00 DEBUG 126048 --- [mybatis-boost-integration-test] [           main] c.y.m.b.i.t.mapper.UserMapper.selectById : ==> Parameters: 1(Long)';
            const result = LogParser.parse(line);

            assert.ok(result);
            assert.strictEqual(result.logType, LogType.Parameters);
            assert.strictEqual(result.threadId, '126048');
            assert.strictEqual(result.content, 'Parameters: 1(Long)');
        });

        it('should parse Spring Boot Total log', () => {
            const line = '2025-11-11T17:48:05.130+08:00 DEBUG 126048 --- [mybatis-boost-integration-test] [           main] c.y.m.b.i.t.mapper.UserMapper.selectById : <==      Total: 1';
            const result = LogParser.parse(line);

            assert.ok(result);
            assert.strictEqual(result.logType, LogType.Total);
        });

        it('should handle thread names with spaces', () => {
            const line = '2025-11-11T17:48:05.123+08:00 DEBUG 126048 --- [my-app] [  worker-1  ] c.y.m.b.mapper.UserMapper : ==>  Preparing: SELECT 1';
            const result = LogParser.parse(line);

            assert.ok(result);
            assert.strictEqual(result.threadName, 'worker-1');
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

    describe('extractUpdates', () => {
        it('should extract updates count', () => {
            const content = 'Updates: 1';
            const updates = LogParser.extractUpdates(content);

            assert.strictEqual(updates, 1);
        });

        it('should extract large numbers', () => {
            const content = 'Updates: 999';
            const updates = LogParser.extractUpdates(content);

            assert.strictEqual(updates, 999);
        });

        it('should return null for non-Updates content', () => {
            const content = 'Total: 1';
            const updates = LogParser.extractUpdates(content);

            assert.strictEqual(updates, null);
        });
    });

    describe('parse - loose pattern (custom log formats)', () => {
        describe('minimal formats', () => {
            it('should recognize minimal format with just arrow and keyword', () => {
                const line = '==> Preparing: SELECT * FROM user WHERE id = ?';
                assert.strictEqual(LogParser.isMyBatisLog(line), true);
            });

            it('should parse minimal Preparing log', () => {
                const line = '==> Preparing: SELECT * FROM user WHERE id = ?';
                const result = LogParser.parse(line);

                assert.ok(result);
                assert.strictEqual(result.logType, LogType.Preparing);
                assert.strictEqual(result.content, 'Preparing: SELECT * FROM user WHERE id = ?');
                assert.strictEqual(result.mapper, 'UnknownMapper'); // Default value
                assert.ok(result.timestamp); // Should have a timestamp (generated)
            });

            it('should parse minimal Parameters log', () => {
                const line = '==> Parameters: 1(Integer), active(String)';
                const result = LogParser.parse(line);

                assert.ok(result);
                assert.strictEqual(result.logType, LogType.Parameters);
                assert.strictEqual(result.content, 'Parameters: 1(Integer), active(String)');
            });

            it('should parse minimal Total log', () => {
                const line = '<== Total: 5';
                const result = LogParser.parse(line);

                assert.ok(result);
                assert.strictEqual(result.logType, LogType.Total);
                assert.strictEqual(result.content, 'Total: 5');
            });

            it('should parse minimal Updates log', () => {
                const line = '<== Updates: 3';
                const result = LogParser.parse(line);

                assert.ok(result);
                assert.strictEqual(result.logType, LogType.Updates);
                assert.strictEqual(result.content, 'Updates: 3');
            });
        });

        describe('custom timestamp formats', () => {
            it('should recognize and parse yyyy/MM/dd HH:mm:ss format', () => {
                const line = '2025/01/15 10:30:45.123 DEBUG UserMapper - ==> Preparing: SELECT * FROM user';
                assert.strictEqual(LogParser.isMyBatisLog(line), true);

                const result = LogParser.parse(line);
                assert.ok(result);
                assert.strictEqual(result.timestamp, '2025/01/15 10:30:45.123');
                assert.strictEqual(result.mapper, 'UserMapper');
                assert.strictEqual(result.logType, LogType.Preparing);
            });

            it('should recognize ISO 8601 format', () => {
                const line = '2025-01-15T10:30:45.123 INFO UserMapper - ==> Preparing: SELECT 1';
                assert.strictEqual(LogParser.isMyBatisLog(line), true);

                const result = LogParser.parse(line);
                assert.ok(result);
                assert.strictEqual(result.timestamp, '2025-01-15T10:30:45.123');
            });

            it('should recognize time-only format', () => {
                const line = '10:30:45.123 UserMapper ==> Preparing: SELECT 1';
                assert.strictEqual(LogParser.isMyBatisLog(line), true);

                const result = LogParser.parse(line);
                assert.ok(result);
                assert.strictEqual(result.timestamp, '10:30:45.123');
                assert.strictEqual(result.mapper, 'UserMapper');
            });

            it('should handle format without milliseconds', () => {
                const line = '2025-01-15 10:30:45 UserMapper - ==> Preparing: SELECT 1';
                assert.strictEqual(LogParser.isMyBatisLog(line), true);

                const result = LogParser.parse(line);
                assert.ok(result);
                assert.strictEqual(result.timestamp, '2025-01-15 10:30:45');
            });
        });

        describe('custom mapper name formats', () => {
            it('should extract mapper name with colon separator', () => {
                const line = 'DEBUG UserMapper: ==> Preparing: SELECT 1';
                const result = LogParser.parse(line);

                assert.ok(result);
                assert.strictEqual(result.mapper, 'UserMapper');
            });

            it('should extract mapper name with dash separator', () => {
                const line = 'DEBUG UserMapper - ==> Preparing: SELECT 1';
                const result = LogParser.parse(line);

                assert.ok(result);
                assert.strictEqual(result.mapper, 'UserMapper');
            });

            it('should extract mapper name in square brackets', () => {
                const line = '[DEBUG] [UserMapper] ==> Preparing: SELECT 1';
                const result = LogParser.parse(line);

                assert.ok(result);
                assert.strictEqual(result.mapper, 'UserMapper');
            });

            it('should extract mapper name with pipe separator', () => {
                const line = 'DEBUG | UserMapper | ==> Preparing: SELECT 1';
                const result = LogParser.parse(line);

                assert.ok(result);
                assert.strictEqual(result.mapper, 'UserMapper');
            });

            it('should extract fully qualified mapper name', () => {
                const line = 'com.example.mapper.UserMapper: ==> Preparing: SELECT 1';
                const result = LogParser.parse(line);

                assert.ok(result);
                assert.strictEqual(result.mapper, 'com.example.mapper.UserMapper');
            });
        });

        describe('real-world custom log formats', () => {
            it('should handle Logback custom pattern', () => {
                const line = '[2025-01-15 10:30:45] [DEBUG] [UserMapper] ==> Preparing: SELECT * FROM user WHERE id = ?';
                assert.strictEqual(LogParser.isMyBatisLog(line), true);

                const result = LogParser.parse(line);
                assert.ok(result);
                assert.strictEqual(result.logType, LogType.Preparing);
                assert.strictEqual(result.mapper, 'UserMapper');
                assert.strictEqual(result.timestamp, '2025-01-15 10:30:45');
            });

            it('should handle Log4j2 custom pattern', () => {
                const line = 'DEBUG | 2025-01-15 10:30:45 | com.example.UserMapper | ==> Preparing: SELECT 1';
                assert.strictEqual(LogParser.isMyBatisLog(line), true);

                const result = LogParser.parse(line);
                assert.ok(result);
                assert.strictEqual(result.mapper, 'com.example.UserMapper');
                assert.strictEqual(result.timestamp, '2025-01-15 10:30:45');
            });

            it('should handle format with request ID', () => {
                const line = '[request-123] [2025-01-15 10:30:45] DEBUG UserMapper - ==> Preparing: SELECT 1';
                assert.strictEqual(LogParser.isMyBatisLog(line), true);

                const result = LogParser.parse(line);
                assert.ok(result);
                assert.strictEqual(result.mapper, 'UserMapper');
            });

            it('should handle format with multiple metadata fields', () => {
                const line = '2025-01-15 10:30:45 [thread-1] [INFO] [UserMapper] [traceId:abc123] ==> Preparing: SELECT 1';
                assert.strictEqual(LogParser.isMyBatisLog(line), true);

                const result = LogParser.parse(line);
                assert.ok(result);
                assert.strictEqual(result.logType, LogType.Preparing);
            });

            it('should handle custom separator before arrow', () => {
                const line = '2025-01-15 10:30:45 DEBUG UserMapper - ==> Preparing: SELECT 1';
                assert.strictEqual(LogParser.isMyBatisLog(line), true);

                const result = LogParser.parse(line);
                assert.ok(result);
                assert.strictEqual(result.mapper, 'UserMapper');
            });

            it('should handle format without timestamp', () => {
                const line = 'DEBUG UserMapper - ==> Preparing: SELECT * FROM user WHERE id = ?';
                assert.strictEqual(LogParser.isMyBatisLog(line), true);

                const result = LogParser.parse(line);
                assert.ok(result);
                assert.strictEqual(result.mapper, 'UserMapper');
                assert.ok(result.timestamp); // Should have generated timestamp
            });

            it('should handle format with extra whitespace', () => {
                const line = '  2025-01-15 10:30:45   DEBUG   UserMapper   -   ==>   Preparing:   SELECT 1  ';
                assert.strictEqual(LogParser.isMyBatisLog(line), true);

                const result = LogParser.parse(line);
                assert.ok(result);
                assert.strictEqual(result.mapper, 'UserMapper');
            });
        });

        describe('edge cases', () => {
            it('should handle very long SQL statements', () => {
                const longSql = 'SELECT ' + 'column, '.repeat(100) + 'id FROM user';
                const line = `==> Preparing: ${longSql}`;

                assert.strictEqual(LogParser.isMyBatisLog(line), true);

                const result = LogParser.parse(line);
                assert.ok(result);
                assert.ok(result.content.includes(longSql));
            });

            it('should handle SQL with special characters', () => {
                const line = '==> Preparing: SELECT * FROM "user" WHERE name = ? AND status IN (?, ?) -- comment';
                assert.strictEqual(LogParser.isMyBatisLog(line), true);

                const result = LogParser.parse(line);
                assert.ok(result);
                assert.strictEqual(result.logType, LogType.Preparing);
            });

            it('should not match lines without MyBatis keywords', () => {
                const line = 'DEBUG UserMapper - Some other log message';
                assert.strictEqual(LogParser.isMyBatisLog(line), false);
            });

            it('should not match lines with only partial keywords', () => {
                const line = 'DEBUG Preparing for something';
                assert.strictEqual(LogParser.isMyBatisLog(line), false);
            });

            it('should require arrow symbol before keyword', () => {
                const line = 'Preparing: SELECT 1'; // Missing ==>
                assert.strictEqual(LogParser.isMyBatisLog(line), false);
            });

            it('should handle mixed case in log level but preserve keyword case', () => {
                const line = 'debug UserMapper - ==> Preparing: SELECT 1';
                assert.strictEqual(LogParser.isMyBatisLog(line), true);

                const result = LogParser.parse(line);
                assert.ok(result);
                assert.strictEqual(result.content, 'Preparing: SELECT 1');
            });
        });
    });
});
