import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/session/route";
import { updateSession } from "@/lib/session";
import { SESSION_COOKIE_NAME } from "@/lib/session-cookie";

describe("GET /api/session", () => {
    it("creates a cookie and returns empty state for new visitors", async () => {
        const req = new Request("http://localhost/api/session", { method: "GET" });
        const res = await GET(req);
        const payload = await res.json();

        expect(res.status).toBe(200);
        expect(payload.messages).toEqual([]);
        expect(payload.screen).toBeNull();
        expect(res.headers.get("set-cookie")).toContain(`${SESSION_COOKIE_NAME}=`);
    });

    it("reuses existing cookie session", async () => {
        const sessionId = `existing-${crypto.randomUUID()}`;
        updateSession(sessionId, {
            messages: [{ role: "assistant", content: "Existing history" }],
            screen: null,
        });

        const req = new Request("http://localhost/api/session", {
            method: "GET",
            headers: { cookie: `${SESSION_COOKIE_NAME}=${sessionId}` },
        });
        const res = await GET(req);
        const payload = await res.json();

        expect(res.status).toBe(200);
        expect(res.headers.get("set-cookie")).toBeNull();
        expect(payload.messages.at(-1)?.content).toBe("Existing history");
    });
});
