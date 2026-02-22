import { NextResponse } from "next/server";
import { getSession, cleanupExpiredSessions } from "@/lib/session";
import {
    getSessionIdFromRequest,
    createSessionId,
    buildSessionCookie,
} from "@/lib/session-cookie";
import { getErrorMessage } from "@/lib/errors";

export async function GET(req: Request) {
    try {
        cleanupExpiredSessions();

        const existingSessionId = getSessionIdFromRequest(req);
        const sessionId = existingSessionId || createSessionId();
        const session = getSession(sessionId);

        const response = NextResponse.json(
            {
                screen: session.screen,
                messages: session.messages,
            },
            { status: 200 }
        );

        if (!existingSessionId) {
            response.headers.set("Set-Cookie", buildSessionCookie(sessionId));
        }

        return response;
    } catch (error: unknown) {
        console.error("Failed to read session:", error);
        return NextResponse.json(
            { error: getErrorMessage(error, "Failed to read session.") },
            { status: 500 }
        );
    }
}
