/**
 * Unit tests for ThreadSessionManager
 */

import * as assert from 'assert';
import { ThreadSessionManager } from '../../../console/parser/ThreadSessionManager';
import { LogEntry, LogType } from '../../../console/types';

describe('ThreadSessionManager', () => {
    let manager: ThreadSessionManager;

    beforeEach(() => {
        manager = new ThreadSessionManager(5000);
    });

    afterEach(() => {
        if (manager) {
            manager.dispose();
        }
    });

    describe('getSession', () => {
        it('should create new session for new entry', () => {
            const entry: LogEntry = {
                timestamp: '2025-01-15 10:30:45.123',
                threadId: '12345',
                mapper: 'com.example.UserMapper',
                logType: LogType.Preparing,
                content: 'Preparing: SELECT * FROM user',
                rawLine: 'raw log line'
            };

            const session = manager.getSession(entry);

            assert.ok(session);
            assert.strictEqual(session.threadId, '12345');
            assert.strictEqual(session.mapper, 'com.example.UserMapper');
            assert.strictEqual(manager.getSessionCount(), 1);
        });

        it('should return existing session for same thread and mapper', () => {
            const entry1: LogEntry = {
                timestamp: '2025-01-15 10:30:45.123',
                threadId: '12345',
                mapper: 'com.example.UserMapper',
                logType: LogType.Preparing,
                content: 'Preparing: SELECT * FROM user',
                rawLine: 'raw log line 1'
            };

            const entry2: LogEntry = {
                timestamp: '2025-01-15 10:30:45.125',
                threadId: '12345',
                mapper: 'com.example.UserMapper',
                logType: LogType.Parameters,
                content: 'Parameters: 1(Integer)',
                rawLine: 'raw log line 2'
            };

            const session1 = manager.getSession(entry1);
            const session2 = manager.getSession(entry2);

            assert.strictEqual(session1.sessionId, session2.sessionId);
            assert.strictEqual(manager.getSessionCount(), 1);
        });

        it('should create different sessions for different threads', () => {
            const entry1: LogEntry = {
                timestamp: '2025-01-15 10:30:45.123',
                threadId: '12345',
                mapper: 'com.example.UserMapper',
                logType: LogType.Preparing,
                content: 'Preparing: SELECT * FROM user',
                rawLine: 'raw log line 1'
            };

            const entry2: LogEntry = {
                timestamp: '2025-01-15 10:30:45.125',
                threadId: '67890',
                mapper: 'com.example.UserMapper',
                logType: LogType.Preparing,
                content: 'Preparing: SELECT * FROM user',
                rawLine: 'raw log line 2'
            };

            const session1 = manager.getSession(entry1);
            const session2 = manager.getSession(entry2);

            assert.notStrictEqual(session1.sessionId, session2.sessionId);
            assert.strictEqual(manager.getSessionCount(), 2);
        });

        it('should use timestamp for session ID when no thread ID', () => {
            const entry: LogEntry = {
                timestamp: '2025-01-15 10:30:45.123',
                mapper: 'com.example.UserMapper',
                logType: LogType.Preparing,
                content: 'Preparing: SELECT * FROM user',
                rawLine: 'raw log line'
            };

            const session = manager.getSession(entry);

            assert.ok(session);
            assert.ok(session.sessionId.includes('time-'));
            assert.ok(session.sessionId.includes('2025-01-15 10:30:45.123'));
        });
    });

    describe('updateSession', () => {
        it('should update session with Preparing log', () => {
            const entry: LogEntry = {
                timestamp: '2025-01-15 10:30:45.123',
                threadId: '12345',
                mapper: 'com.example.UserMapper',
                logType: LogType.Preparing,
                content: 'Preparing: SELECT * FROM user WHERE id = ?',
                rawLine: 'raw preparing line'
            };

            const session = manager.updateSession(entry);

            assert.ok(session.preparing);
            assert.strictEqual(session.preparing.sql, 'SELECT * FROM user WHERE id = ?');
            assert.strictEqual(session.preparing.timestamp, '2025-01-15 10:30:45.123');
            assert.strictEqual(session.preparing.rawLine, 'raw preparing line');
        });

        it('should update session with Parameters log', () => {
            const entry: LogEntry = {
                timestamp: '2025-01-15 10:30:45.125',
                threadId: '12345',
                mapper: 'com.example.UserMapper',
                logType: LogType.Parameters,
                content: 'Parameters: 1(Integer), active(String)',
                rawLine: 'raw parameters line'
            };

            const session = manager.updateSession(entry);

            assert.ok(session.parameters);
            assert.strictEqual(session.parameters.timestamp, '2025-01-15 10:30:45.125');
            assert.strictEqual(session.parameters.rawLine, 'raw parameters line');
        });

        it('should handle complete session workflow', () => {
            const preparing: LogEntry = {
                timestamp: '2025-01-15 10:30:45.123',
                threadId: '12345',
                mapper: 'com.example.UserMapper',
                logType: LogType.Preparing,
                content: 'Preparing: SELECT * FROM user WHERE id = ?',
                rawLine: 'preparing line'
            };

            const parameters: LogEntry = {
                timestamp: '2025-01-15 10:30:45.125',
                threadId: '12345',
                mapper: 'com.example.UserMapper',
                logType: LogType.Parameters,
                content: 'Parameters: 1(Integer)',
                rawLine: 'parameters line'
            };

            const session1 = manager.updateSession(preparing);
            const session2 = manager.updateSession(parameters);

            assert.strictEqual(session1.sessionId, session2.sessionId);
            assert.ok(session2.preparing);
            assert.ok(session2.parameters);
        });
    });

    describe('isSessionComplete', () => {
        it('should return true when both Preparing and Parameters are present', () => {
            const preparing: LogEntry = {
                timestamp: '2025-01-15 10:30:45.123',
                threadId: '12345',
                mapper: 'com.example.UserMapper',
                logType: LogType.Preparing,
                content: 'Preparing: SELECT * FROM user WHERE id = ?',
                rawLine: 'preparing line'
            };

            const parameters: LogEntry = {
                timestamp: '2025-01-15 10:30:45.125',
                threadId: '12345',
                mapper: 'com.example.UserMapper',
                logType: LogType.Parameters,
                content: 'Parameters: 1(Integer)',
                rawLine: 'parameters line'
            };

            manager.updateSession(preparing);
            const session = manager.updateSession(parameters);

            assert.strictEqual(manager.isSessionComplete(session), true);
        });

        it('should return false when only Preparing is present', () => {
            const preparing: LogEntry = {
                timestamp: '2025-01-15 10:30:45.123',
                threadId: '12345',
                mapper: 'com.example.UserMapper',
                logType: LogType.Preparing,
                content: 'Preparing: SELECT * FROM user WHERE id = ?',
                rawLine: 'preparing line'
            };

            const session = manager.updateSession(preparing);

            assert.strictEqual(manager.isSessionComplete(session), false);
        });

        it('should return false when only Parameters is present', () => {
            const parameters: LogEntry = {
                timestamp: '2025-01-15 10:30:45.125',
                threadId: '12345',
                mapper: 'com.example.UserMapper',
                logType: LogType.Parameters,
                content: 'Parameters: 1(Integer)',
                rawLine: 'parameters line'
            };

            const session = manager.updateSession(parameters);

            assert.strictEqual(manager.isSessionComplete(session), false);
        });
    });

    describe('removeSession', () => {
        it('should remove session by ID', () => {
            const entry: LogEntry = {
                timestamp: '2025-01-15 10:30:45.123',
                threadId: '12345',
                mapper: 'com.example.UserMapper',
                logType: LogType.Preparing,
                content: 'Preparing: SELECT * FROM user',
                rawLine: 'raw line'
            };

            const session = manager.getSession(entry);
            assert.strictEqual(manager.getSessionCount(), 1);

            manager.removeSession(session.sessionId);
            assert.strictEqual(manager.getSessionCount(), 0);
        });
    });

    describe('clearAllSessions', () => {
        it('should clear all sessions', () => {
            const entry1: LogEntry = {
                timestamp: '2025-01-15 10:30:45.123',
                threadId: '12345',
                mapper: 'com.example.UserMapper',
                logType: LogType.Preparing,
                content: 'Preparing: SELECT * FROM user',
                rawLine: 'raw line 1'
            };

            const entry2: LogEntry = {
                timestamp: '2025-01-15 10:30:45.125',
                threadId: '67890',
                mapper: 'com.example.OrderMapper',
                logType: LogType.Preparing,
                content: 'Preparing: SELECT * FROM order',
                rawLine: 'raw line 2'
            };

            manager.getSession(entry1);
            manager.getSession(entry2);
            assert.strictEqual(manager.getSessionCount(), 2);

            manager.clearAllSessions();
            assert.strictEqual(manager.getSessionCount(), 0);
        });
    });

    describe('session timeout', () => {
        it('should clean up stale sessions', function (done) {
            this.timeout(7000); // Increase timeout for this test

            const shortTimeoutManager = new ThreadSessionManager(1000);

            const entry: LogEntry = {
                timestamp: '2025-01-15 10:30:45.123',
                threadId: '12345',
                mapper: 'com.example.UserMapper',
                logType: LogType.Preparing,
                content: 'Preparing: SELECT * FROM user',
                rawLine: 'raw line'
            };

            shortTimeoutManager.getSession(entry);
            assert.strictEqual(shortTimeoutManager.getSessionCount(), 1);

            // Wait for session to timeout and be cleaned up
            setTimeout(() => {
                assert.strictEqual(shortTimeoutManager.getSessionCount(), 0);
                shortTimeoutManager.dispose();
                done();
            }, 2500);
        });
    });
});
