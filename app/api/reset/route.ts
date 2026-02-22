import { NextResponse } from "next/server";
import { resetSession, cleanupExpiredSessions } from "@/lib/session";
import { getSessionIdFromRequest } from "@/lib/session-cookie";
import { getErrorMessage } from "@/lib/errors";

export async function POST(req: Request) {
    try {
        cleanupExpiredSessions();

        // Reset only the active browser session.
        const sessionId = getSessionIdFromRequest(req);
        if (sessionId) {
            resetSession(sessionId);
        }

        return NextResponse.json(
            { success: true },
            { status: 200 }
        );
    } catch (error: unknown) {
        console.error("Failed to reset session:", error);
        return NextResponse.json(
            { error: getErrorMessage(error, "Failed to reset session state.") },
            { status: 500 }
        );
    }
}
