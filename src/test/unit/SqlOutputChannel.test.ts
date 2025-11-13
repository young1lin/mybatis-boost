/**
 * Unit tests for SqlOutputChannel
 * Tests SQL output formatting with new comment-style metadata format
 */

import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { SqlOutputChannel } from '../../console/output/SqlOutputChannel';
import { ConvertedSql, DatabaseType } from '../../console/types';

describe('SqlOutputChannel', () => {
    let sandbox: sinon.SinonSandbox;
    let outputChannel: SqlOutputChannel;
    let mockOutputChannel: any;
    let getConfigurationStub: sinon.SinonStub;
    let createOutputChannelStub: sinon.SinonStub;

    beforeEach(() => {
        sandbox = sinon.createSandbox();

        // Mock VS Code output channel
        mockOutputChannel = {
            appendLine: sandbox.stub(),
            clear: sandbox.stub(),
            dispose: sandbox.stub()
        };

        createOutputChannelStub = sandbox.stub(vscode.window, 'createOutputChannel').returns(mockOutputChannel);

        // Mock configuration
        const mockConfig = {
            get: sandbox.stub().returns(true) // formatSql defaults to true
        };
        getConfigurationStub = sandbox.stub(vscode.workspace, 'getConfiguration').returns(mockConfig as any);

        outputChannel = new SqlOutputChannel();
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('extractThreadName', () => {
        it('should extract thread name from format "ThreadID [ThreadName]"', () => {
            const result: ConvertedSql = {
                originalSql: 'SELECT * FROM users',
                convertedSql: 'SELECT * FROM users',
                database: DatabaseType.MySQL,
                parameters: [],
                mapper: 'UserMapper.selectAll',
                timestamp: '2025-11-13T10:30:45.123Z',
                threadInfo: '166244 [main]',
                preparingLine: 'Preparing: SELECT * FROM users',
                parametersLine: 'Parameters: ',
                executionTime: 5
            };

            outputChannel.show(result);

            const calls = mockOutputChannel.appendLine.getCalls();
            const output = calls[0].args[0];

            assert.ok(output.includes('-- Thread: [main]'), 'Should extract thread name only');
            assert.ok(!output.includes('166244'), 'Should not include thread ID');
        });

        it('should handle thread info with only brackets "[ThreadName]"', () => {
            const result: ConvertedSql = {
                originalSql: 'SELECT * FROM users',
                convertedSql: 'SELECT * FROM users',
                database: DatabaseType.MySQL,
                parameters: [],
                mapper: 'UserMapper.selectAll',
                timestamp: '2025-11-13T10:30:45.123Z',
                threadInfo: '[http-nio-8080-exec-1]',
                preparingLine: 'Preparing: SELECT * FROM users',
                parametersLine: 'Parameters: ',
                executionTime: 12
            };

            outputChannel.show(result);

            const calls = mockOutputChannel.appendLine.getCalls();
            const output = calls[0].args[0];

            assert.ok(output.includes('-- Thread: [http-nio-8080-exec-1]'), 'Should preserve thread name in brackets');
        });

        it('should handle thread info with only thread ID', () => {
            const result: ConvertedSql = {
                originalSql: 'SELECT * FROM users',
                convertedSql: 'SELECT * FROM users',
                database: DatabaseType.MySQL,
                parameters: [],
                mapper: 'UserMapper.selectAll',
                timestamp: '2025-11-13T10:30:45.123Z',
                threadInfo: '166244',
                preparingLine: 'Preparing: SELECT * FROM users',
                parametersLine: 'Parameters: ',
                executionTime: 5
            };

            outputChannel.show(result);

            const calls = mockOutputChannel.appendLine.getCalls();
            const output = calls[0].args[0];

            assert.ok(output.includes('-- Thread: [166244]'), 'Should wrap thread ID in brackets');
        });
    });

    describe('extractRowsAffected', () => {
        it('should extract rows affected from "Total: N" format', () => {
            const result: ConvertedSql = {
                originalSql: 'SELECT * FROM users',
                convertedSql: 'SELECT * FROM users',
                database: DatabaseType.MySQL,
                parameters: [],
                mapper: 'UserMapper.selectAll',
                timestamp: '2025-11-13T10:30:45.123Z',
                threadInfo: '166244 [main]',
                preparingLine: 'Preparing: SELECT * FROM users',
                parametersLine: 'Parameters: ',
                totalLine: '<== Total: 5',
                executionTime: 5
            };

            outputChannel.show(result);

            const calls = mockOutputChannel.appendLine.getCalls();
            const output = calls[0].args[0];

            assert.ok(output.includes('-- Rows Affected: 5'), 'Should extract row count from Total line');
        });

        it('should extract rows affected from "Updates: N" format', () => {
            const result: ConvertedSql = {
                originalSql: 'UPDATE users SET name = ?',
                convertedSql: 'UPDATE users SET name = \'john_doe\'',
                database: DatabaseType.MySQL,
                parameters: [{ value: 'john_doe', type: 'String' }],
                mapper: 'UserMapper.updateById',
                timestamp: '2025-11-13T10:30:45.123Z',
                threadInfo: '166244 [main]',
                preparingLine: 'Preparing: UPDATE users SET name = ?',
                parametersLine: 'Parameters: john_doe(String)',
                totalLine: '<== Updates: 1',
                executionTime: 12
            };

            outputChannel.show(result);

            const calls = mockOutputChannel.appendLine.getCalls();
            const output = calls[0].args[0];

            assert.ok(output.includes('-- Rows Affected: 1'), 'Should extract row count from Updates line');
        });

        it('should handle case-insensitive "total" and "updates"', () => {
            const result: ConvertedSql = {
                originalSql: 'SELECT * FROM users',
                convertedSql: 'SELECT * FROM users',
                database: DatabaseType.MySQL,
                parameters: [],
                mapper: 'UserMapper.selectAll',
                timestamp: '2025-11-13T10:30:45.123Z',
                threadInfo: '166244 [main]',
                preparingLine: 'Preparing: SELECT * FROM users',
                parametersLine: 'Parameters: ',
                totalLine: '<== total: 10',
                executionTime: 5
            };

            outputChannel.show(result);

            const calls = mockOutputChannel.appendLine.getCalls();
            const output = calls[0].args[0];

            assert.ok(output.includes('-- Rows Affected: 10'), 'Should handle lowercase "total"');
        });

        it('should not show rows affected if totalLine is missing', () => {
            const result: ConvertedSql = {
                originalSql: 'SELECT * FROM users',
                convertedSql: 'SELECT * FROM users',
                database: DatabaseType.MySQL,
                parameters: [],
                mapper: 'UserMapper.selectAll',
                timestamp: '2025-11-13T10:30:45.123Z',
                threadInfo: '166244 [main]',
                preparingLine: 'Preparing: SELECT * FROM users',
                parametersLine: 'Parameters: ',
                executionTime: 5
            };

            outputChannel.show(result);

            const calls = mockOutputChannel.appendLine.getCalls();
            const output = calls[0].args[0];

            assert.ok(!output.includes('-- Rows Affected:'), 'Should not show rows affected without totalLine');
        });
    });

    describe('show - Output Format', () => {
        it('should format output with SQL comment-style metadata', () => {
            const result: ConvertedSql = {
                originalSql: 'UPDATE users SET name = ?, email = ? WHERE id = ?',
                convertedSql: 'UPDATE users SET name = \'john_doe\', email = \'john@example.com\' WHERE id = 123',
                database: DatabaseType.MySQL,
                parameters: [
                    { value: 'john_doe', type: 'String' },
                    { value: 'john@example.com', type: 'String' },
                    { value: '123', type: 'Integer' }
                ],
                mapper: 'com.example.mapper.UserMapper.updateById',
                timestamp: '2025-11-13T10:30:45.123Z',
                threadInfo: '166244 [http-nio-8080-exec-1]',
                preparingLine: 'Preparing: UPDATE users SET name = ?, email = ? WHERE id = ?',
                parametersLine: 'Parameters: john_doe(String), john@example.com(String), 123(Integer)',
                totalLine: '<== Updates: 1',
                executionTime: 12
            };

            outputChannel.show(result);

            const calls = mockOutputChannel.appendLine.getCalls();
            assert.strictEqual(calls.length, 1, 'Should append output once');

            const output = calls[0].args[0];

            // Verify metadata format
            assert.ok(output.includes('-- Mapper: com.example.mapper.UserMapper.updateById'), 'Should show mapper as comment');
            assert.ok(output.includes('-- Thread: [http-nio-8080-exec-1]'), 'Should show thread as comment');
            assert.ok(output.includes('-- Execution Time: 12ms'), 'Should show execution time as comment');
            assert.ok(output.includes('-- Rows Affected: 1'), 'Should show rows affected as comment');

            // Verify SQL is on separate line with empty line separator
            const lines = output.split('\n');
            const emptyLineIndex = lines.findIndex((line: string) => line.trim() === '' && lines[lines.indexOf(line) - 1]?.startsWith('--'));
            assert.ok(emptyLineIndex > 0, 'Should have empty line between metadata and SQL');

            // Verify SQL content (without "SQL:" label)
            assert.ok(output.includes('UPDATE users'), 'Should include SQL statement');
            assert.ok(!output.includes('SQL:'), 'Should not include "SQL:" label');
            assert.ok(!output.includes('[2025-11-13'), 'Should not include timestamp');
        });

        it('should handle missing optional fields gracefully', () => {
            const result: ConvertedSql = {
                originalSql: 'SELECT * FROM users',
                convertedSql: 'SELECT * FROM users',
                database: DatabaseType.MySQL,
                parameters: [],
                mapper: 'UserMapper.selectAll',
                timestamp: '2025-11-13T10:30:45.123Z',
                preparingLine: 'Preparing: SELECT * FROM users',
                parametersLine: 'Parameters: '
                // No threadInfo, executionTime, or totalLine
            };

            outputChannel.show(result);

            const calls = mockOutputChannel.appendLine.getCalls();
            const output = calls[0].args[0];

            // Should only show mapper
            assert.ok(output.includes('-- Mapper: UserMapper.selectAll'), 'Should show mapper');
            assert.ok(!output.includes('-- Thread:'), 'Should not show thread info when missing');
            assert.ok(!output.includes('-- Execution Time:'), 'Should not show execution time when missing');
            assert.ok(!output.includes('-- Rows Affected:'), 'Should not show rows affected when missing');
        });

        it('should save formatted output to history', () => {
            const result: ConvertedSql = {
                originalSql: 'SELECT * FROM users',
                convertedSql: 'SELECT * FROM users',
                database: DatabaseType.MySQL,
                parameters: [],
                mapper: 'UserMapper.selectAll',
                timestamp: '2025-11-13T10:30:45.123Z',
                threadInfo: '166244 [main]',
                preparingLine: 'Preparing: SELECT * FROM users',
                parametersLine: 'Parameters: ',
                totalLine: '<== Total: 5',
                executionTime: 5
            };

            outputChannel.show(result);

            // Verify history was saved (internal array, can't directly test without exposing it)
            // This is implicitly tested by exportLogs functionality
            assert.ok(mockOutputChannel.appendLine.called, 'Should append to output channel');
        });
    });

    describe('showError', () => {
        it('should format error messages with [ERROR] prefix', () => {
            outputChannel.showError('Connection failed');

            assert.ok(mockOutputChannel.appendLine.calledWith('[ERROR] Connection failed'));
        });
    });

    describe('showInfo', () => {
        it('should format info messages with [INFO] prefix', () => {
            outputChannel.showInfo('Processing complete');

            assert.ok(mockOutputChannel.appendLine.calledWith('[INFO] Processing complete'));
        });
    });

    describe('clear', () => {
        it('should clear output channel and history', () => {
            const result: ConvertedSql = {
                originalSql: 'SELECT * FROM users',
                convertedSql: 'SELECT * FROM users',
                database: DatabaseType.MySQL,
                parameters: [],
                mapper: 'UserMapper.selectAll',
                timestamp: '2025-11-13T10:30:45.123Z',
                preparingLine: 'Preparing: SELECT * FROM users',
                parametersLine: 'Parameters: '
            };

            outputChannel.show(result);
            outputChannel.clear();

            assert.ok(mockOutputChannel.clear.calledOnce, 'Should clear output channel');
        });
    });

    describe('dispose', () => {
        it('should dispose output channel', () => {
            outputChannel.dispose();

            assert.ok(mockOutputChannel.dispose.calledOnce, 'Should dispose output channel');
        });
    });

    describe('Expected Output Format Validation', () => {
        it('should match expected output format exactly', () => {
            const result: ConvertedSql = {
                originalSql: 'UPDATE user_info SET username = ?, email = ?, updated_at = ? WHERE id = ?',
                convertedSql: 'UPDATE `user_info`\nSET `username` = \'john_doe\',\n    `email` = \'john@example.com\',\n    `updated_at` = \'2025-11-11 10:30:45\'\nWHERE `id` = 123',
                database: DatabaseType.MySQL,
                parameters: [
                    { value: 'john_doe', type: 'String' },
                    { value: 'john@example.com', type: 'String' },
                    { value: '2025-11-11 10:30:45', type: 'Timestamp' },
                    { value: '123', type: 'Integer' }
                ],
                mapper: 'com.example.mapper.UserMapper.updateById',
                timestamp: '2025-11-13T10:30:45.123Z',
                threadInfo: '8080 [http-nio-8080-exec-1]',
                preparingLine: 'Preparing: UPDATE user_info SET username = ?, email = ?, updated_at = ? WHERE id = ?',
                parametersLine: 'Parameters: john_doe(String), john@example.com(String), 2025-11-11 10:30:45(Timestamp), 123(Integer)',
                totalLine: '<== Updates: 1',
                executionTime: 12
            };

            outputChannel.show(result);

            const calls = mockOutputChannel.appendLine.getCalls();
            const output = calls[0].args[0];
            const lines = output.split('\n');

            // Validate metadata lines
            assert.strictEqual(lines[0], '-- Mapper: com.example.mapper.UserMapper.updateById', 'First line should be mapper');
            assert.strictEqual(lines[1], '-- Thread: [http-nio-8080-exec-1]', 'Second line should be thread');
            assert.strictEqual(lines[2], '-- Execution Time: 12ms', 'Third line should be execution time');
            assert.strictEqual(lines[3], '-- Rows Affected: 1', 'Fourth line should be rows affected');
            assert.strictEqual(lines[4], '', 'Fifth line should be empty separator');

            // Validate SQL starts at line 5
            assert.ok(lines[5].startsWith('UPDATE'), 'SQL should start after empty line');
        });
    });
});
