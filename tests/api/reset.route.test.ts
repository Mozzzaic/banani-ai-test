import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/reset/route";
import { getSession, updateSession } from "@/lib/session";
import { SESSION_COOKIE_NAME } from "@/lib/session-cookie";
import type { SessionState } from "@/lib/types";

function makeState(label: string): SessionState {
    return {
        messages: [{ role: "user", content: `prompt-${label}` }],
        screen: null,
    };
}

describe("POST /api/reset", () => {
    it("resets only the active browser session", async () => {
        const sessionA = `a-${crypto.randomUUID()}`;
        const sessionB = `b-${crypto.randomUUID()}`;

        updateSession(sessionA, makeState("a"));
        updateSession(sessionB, makeState("b"));

        const req = new Request("http://localhost/api/reset", {
            method: "POST",
            headers: {
                cookie: `${SESSION_COOKIE_NAME}=${sessionA}`,
            },
        });

        const res = await POST(req);
        const payload = await res.json();

        expect(res.status).toBe(200);
        expect(payload).toEqual({ success: true });
        expect(getSession(sessionA).messages).toHaveLength(0);
        expect(getSession(sessionB).messages).toHaveLength(1);
    });

    it("returns success and keeps state untouched when no cookie exists", async () => {
        const sessionId = `session-${crypto.randomUUID()}`;
        updateSession(sessionId, makeState("keep"));

        const req = new Request("http://localhost/api/reset", { method: "POST" });
        const res = await POST(req);
        const payload = await res.json();

        expect(res.status).toBe(200);
        expect(payload).toEqual({ success: true });
        expect(getSession(sessionId).messages).toHaveLength(1);
    });
});
