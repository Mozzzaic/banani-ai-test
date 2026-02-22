import { describe, expect, it } from "vitest";
import {
    getSession,
    updateSession,
    resetSession,
    cleanupExpiredSessions,
    SESSION_TTL_MS,
} from "@/lib/session";
import type { SessionState } from "@/lib/types";

function makeState(label: string): SessionState {
    return {
        messages: [{ role: "user", content: `prompt-${label}` }],
        screen: null,
    };
}

describe("session store", () => {
    it("isolates data by session ID", () => {
        const sessionA = `a-${crypto.randomUUID()}`;
        const sessionB = `b-${crypto.randomUUID()}`;

        updateSession(sessionA, makeState("a"));
        updateSession(sessionB, makeState("b"));

        expect(getSession(sessionA).messages[0]?.content).toBe("prompt-a");
        expect(getSession(sessionB).messages[0]?.content).toBe("prompt-b");
    });

    it("resets only the targeted session", () => {
        const sessionA = `a-${crypto.randomUUID()}`;
        const sessionB = `b-${crypto.randomUUID()}`;

        updateSession(sessionA, makeState("a"));
        updateSession(sessionB, makeState("b"));
        resetSession(sessionA);

        expect(getSession(sessionA).messages).toHaveLength(0);
        expect(getSession(sessionB).messages).toHaveLength(1);
    });

    it("removes stale sessions during cleanup", () => {
        const sessionId = `stale-${crypto.randomUUID()}`;
        updateSession(sessionId, makeState("stale"));

        cleanupExpiredSessions(Date.now() + SESSION_TTL_MS + 1);

        expect(getSession(sessionId).messages).toHaveLength(0);
    });
});
