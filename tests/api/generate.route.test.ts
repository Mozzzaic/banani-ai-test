import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSession, updateSession } from "@/lib/session";
import { SESSION_COOKIE_NAME } from "@/lib/session-cookie";
import type { SessionState } from "@/lib/types";

const processPromptMock = vi.fn<
    (prompt: string, session: SessionState, onStatus?: (message: string) => void) => Promise<SessionState>
>();

vi.mock("@/lib/agent", () => ({
    processPrompt: (
        prompt: string,
        session: SessionState,
        onStatus?: (message: string) => void
    ) => processPromptMock(prompt, session, onStatus),
}));

import { POST } from "@/app/api/generate/route";

function extractSessionId(setCookieHeader: string | null): string | null {
    if (!setCookieHeader) return null;
    const match = setCookieHeader.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`));
    if (!match) return null;
    return decodeURIComponent(match[1]);
}

describe("POST /api/generate", () => {
    beforeEach(() => {
        processPromptMock.mockReset();
    });

    it("returns 400 for invalid payload", async () => {
        const req = new Request("http://localhost/api/generate", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ foo: "bar" }),
        });

        const res = await POST(req);
        const payload = await res.json();

        expect(res.status).toBe(400);
        expect(payload.error).toContain("Invalid or missing");
        expect(processPromptMock).not.toHaveBeenCalled();
    });

    it("streams status + done and sets cookie when session is new", async () => {
        processPromptMock.mockImplementation(async (prompt, session, onStatus) => {
            onStatus?.("Analyzing your request...");
            return {
                ...session,
                messages: [
                    ...session.messages,
                    { role: "user", content: prompt },
                    { role: "assistant", content: "Done" },
                ],
                screen: null,
            };
        });

        const req = new Request("http://localhost/api/generate", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ prompt: "Build a dashboard" }),
        });

        const res = await POST(req);
        const setCookie = res.headers.get("set-cookie");
        const sessionId = extractSessionId(setCookie);
        const streamPayload = await res.text();

        expect(res.status).toBe(200);
        expect(res.headers.get("content-type")).toContain("text/event-stream");
        expect(setCookie).toContain(`${SESSION_COOKIE_NAME}=`);
        expect(setCookie).toContain("HttpOnly");
        expect(streamPayload).toContain("event: status");
        expect(streamPayload).toContain("event: done");
        expect(streamPayload).toContain("Analyzing your request...");
        expect(processPromptMock).toHaveBeenCalledTimes(1);
        expect(sessionId).toBeTruthy();

        if (sessionId) {
            expect(getSession(sessionId).messages.at(-1)?.content).toBe("Done");
        }
    });

    it("reuses cookie session without reissuing Set-Cookie", async () => {
        const sessionId = `existing-${crypto.randomUUID()}`;
        updateSession(sessionId, {
            messages: [{ role: "assistant", content: "Previous context" }],
            screen: null,
        });

        processPromptMock.mockImplementation(async (prompt, session, onStatus) => {
            onStatus?.("Updating existing session...");
            return {
                ...session,
                messages: [
                    ...session.messages,
                    { role: "user", content: prompt },
                    { role: "assistant", content: "Updated" },
                ],
                screen: null,
            };
        });

        const req = new Request("http://localhost/api/generate", {
            method: "POST",
            headers: {
                "content-type": "application/json",
                cookie: `${SESSION_COOKIE_NAME}=${sessionId}`,
            },
            body: JSON.stringify({ prompt: "Tune the hero section" }),
        });

        const res = await POST(req);
        const streamPayload = await res.text();

        expect(res.status).toBe(200);
        expect(res.headers.get("set-cookie")).toBeNull();
        expect(streamPayload).toContain("event: done");
        expect(getSession(sessionId).messages.at(-1)?.content).toBe("Updated");
    });
});
