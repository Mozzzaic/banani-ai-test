import { NextResponse } from "next/server";
import { getSession, updateSession, cleanupExpiredSessions } from "@/lib/session";
import { processPrompt } from "@/lib/agent";
import {
    getSessionIdFromRequest,
    createSessionId,
    buildSessionCookie,
} from "@/lib/session-cookie";
import { getErrorMessage } from "@/lib/errors";

interface GeneratePayload {
    prompt: string;
}

function isGeneratePayload(payload: unknown): payload is GeneratePayload {
    if (!payload || typeof payload !== "object") return false;

    const maybePrompt = (payload as { prompt?: unknown }).prompt;
    return typeof maybePrompt === "string" && maybePrompt.trim().length > 0;
}

export async function POST(req: Request) {
    let body: unknown;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json(
            { error: "Invalid JSON body." },
            { status: 400 }
        );
    }

    if (!isGeneratePayload(body)) {
        return NextResponse.json(
            { error: "Invalid or missing 'prompt' field in request body." },
            { status: 400 }
        );
    }

    cleanupExpiredSessions();

    const existingSessionId = getSessionIdFromRequest(req);
    const sessionId = existingSessionId || createSessionId();
    const shouldSetCookie = !existingSessionId;
    const prompt = body.prompt.trim();

    // SSE streaming: push status updates to the client as the agent works,
    // then send the final result as a "done" event.
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
        async start(controller) {
            // Helper to push an SSE event to the stream
            function send(event: string, data: unknown) {
                controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
            }

            try {
                const session = getSession(sessionId);

                // Process the prompt, emitting status events along the way
                const updatedSession = await processPrompt(prompt, session, (message) => {
                    send("status", { message });
                });

                updateSession(sessionId, updatedSession);

                // Final payload — same shape as the old JSON response
                send("done", {
                    screen: updatedSession.screen,
                    messages: updatedSession.messages,
                });
            } catch (error: unknown) {
                console.error("Error in generate route:", error);
                send("error", {
                    error: getErrorMessage(error, "An unexpected error occurred during generation."),
                });
            } finally {
                controller.close();
            }
        },
    });

    const headers = new Headers({
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
    });

    if (shouldSetCookie) {
        headers.set("Set-Cookie", buildSessionCookie(sessionId));
    }

    return new Response(stream, {
        headers,
    });
}
