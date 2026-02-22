import { SessionState } from "./types";

// In-memory store by session ID. Good for this take-home;
// production would use Redis or a database.
interface SessionRecord {
    state: SessionState;
    updatedAt: number;
}

const sessionStore = new Map<string, SessionRecord>();
export const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24h inactivity window

const emptyState = (): SessionState => ({ messages: [], screen: null });

function touch(sessionId: string, state: SessionState): void {
    sessionStore.set(sessionId, { state, updatedAt: Date.now() });
}

function isExpired(record: SessionRecord, now: number): boolean {
    return now - record.updatedAt > SESSION_TTL_MS;
}

export function getSession(sessionId: string): SessionState {
    const now = Date.now();
    const existing = sessionStore.get(sessionId);

    if (!existing || isExpired(existing, now)) {
        const fresh = emptyState();
        touch(sessionId, fresh);
        return fresh;
    }

    // Refresh activity timestamp on read to keep active sessions alive.
    touch(sessionId, existing.state);
    return existing.state;
}

export function updateSession(sessionId: string, newState: SessionState): void {
    touch(sessionId, newState);
}

export function resetSession(sessionId: string): void {
    touch(sessionId, emptyState());
}

export function cleanupExpiredSessions(now = Date.now()): void {
    for (const [sessionId, record] of sessionStore.entries()) {
        if (isExpired(record, now)) {
            sessionStore.delete(sessionId);
        }
    }
}
