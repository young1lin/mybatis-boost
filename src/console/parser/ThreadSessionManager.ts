/**
 * Manage SQL sessions across multiple threads
 */

import { LogEntry, SqlSession, LogType } from '../types';

/**
 * Session manager for tracking multi-line MyBatis logs by thread
 */
export class ThreadSessionManager {
    private sessions: Map<string, SqlSession>;
    private readonly sessionTimeout: number;
    private cleanupTimer?: NodeJS.Timeout;

    constructor(sessionTimeout: number = 5000) {
        this.sessions = new Map();
        this.sessionTimeout = sessionTimeout;
        this.startCleanupTimer();
    }

    /**
     * Get or create session for a log entry
     */
    public getSession(entry: LogEntry): SqlSession {
        const sessionId = this.generateSessionId(entry);

        let session = this.sessions.get(sessionId);
        if (!session) {
            session = {
                sessionId,
                threadId: entry.threadId,
                threadName: entry.threadName,
                mapper: entry.mapper,
                startTime: Date.now()
            };
            this.sessions.set(sessionId, session);
        }

        return session;
    }

    /**
     * Update session with new log entry
     */
    public updateSession(entry: LogEntry): SqlSession {
        const session = this.getSession(entry);

        switch (entry.logType) {
            case LogType.Preparing:
                const sql = this.extractSql(entry.content);
                if (sql) {
                    session.preparing = {
                        sql,
                        timestamp: entry.timestamp,
                        rawLine: entry.rawLine
                    };
                }
                break;

            case LogType.Parameters:
                const paramString = this.extractParameterString(entry.content);
                if (paramString) {
                    session.parameters = {
                        params: [], // Will be parsed by ParameterParser
                        timestamp: entry.timestamp,
                        rawLine: entry.rawLine
                    };
                }
                break;

            case LogType.Total:
            case LogType.Updates:
                // Total (SELECT) or Updates (INSERT/UPDATE/DELETE) marks completion, session will be consumed
                break;
        }

        // Update last access time
        session.startTime = Date.now();

        return session;
    }

    /**
     * Check if session is complete (has both Preparing and Parameters)
     */
    public isSessionComplete(session: SqlSession): boolean {
        return !!(session.preparing && session.parameters);
    }

    /**
     * Remove session after it's been processed
     */
    public removeSession(sessionId: string): void {
        this.sessions.delete(sessionId);
    }

    /**
     * Clear all sessions
     */
    public clearAllSessions(): void {
        this.sessions.clear();
    }

    /**
     * Get session count
     */
    public getSessionCount(): number {
        return this.sessions.size;
    }

    /**
     * Generate unique session ID
     * If thread ID exists, use it + mapper
     * Otherwise, use timestamp + mapper
     */
    private generateSessionId(entry: LogEntry): string {
        if (entry.threadId) {
            return `thread-${entry.threadId}-${entry.mapper}`;
        }

        // Use timestamp + mapper as fallback
        return `time-${entry.timestamp}-${entry.mapper}`;
    }

    /**
     * Extract SQL from Preparing content
     */
    private extractSql(content: string): string | null {
        const match = content.match(/^Preparing:\s*(.+)$/);
        return match ? match[1].trim() : null;
    }

    /**
     * Extract parameter string from Parameters content
     */
    private extractParameterString(content: string): string | null {
        const match = content.match(/^Parameters:\s*(.+)$/);
        return match ? match[1].trim() : null;
    }

    /**
     * Start cleanup timer to remove stale sessions
     */
    private startCleanupTimer(): void {
        this.cleanupTimer = setInterval(() => {
            this.cleanupStaleSessions();
        }, this.sessionTimeout);
    }

    /**
     * Remove sessions that have timed out
     */
    private cleanupStaleSessions(): void {
        const now = Date.now();
        const staleSessionIds: string[] = [];

        this.sessions.forEach((session, sessionId) => {
            if (now - session.startTime > this.sessionTimeout) {
                staleSessionIds.push(sessionId);
            }
        });

        staleSessionIds.forEach(sessionId => {
            this.sessions.delete(sessionId);
        });
    }

    /**
     * Dispose resources
     */
    public dispose(): void {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = undefined;
        }
        this.sessions.clear();
    }
}
