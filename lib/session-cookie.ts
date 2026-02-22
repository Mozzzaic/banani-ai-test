export const SESSION_COOKIE_NAME = "banani_session_id";
export const SESSION_COOKIE_MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 7 days

function parseCookies(cookieHeader: string | null): Record<string, string> {
    if (!cookieHeader) return {};

    const parsed: Record<string, string> = {};
    const pairs = cookieHeader.split(";");
    for (const pair of pairs) {
        const [rawKey, ...rawValue] = pair.trim().split("=");
        if (!rawKey || rawValue.length === 0) continue;
        parsed[rawKey] = decodeURIComponent(rawValue.join("="));
    }
    return parsed;
}

export function getSessionIdFromRequest(req: Request): string | null {
    const cookieHeader = req.headers.get("cookie");
    const cookies = parseCookies(cookieHeader);
    return cookies[SESSION_COOKIE_NAME] || null;
}

export function createSessionId(): string {
    return crypto.randomUUID();
}

export function buildSessionCookie(sessionId: string): string {
    const secureFlag = process.env.NODE_ENV === "production" ? "; Secure" : "";
    return `${SESSION_COOKIE_NAME}=${encodeURIComponent(sessionId)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_COOKIE_MAX_AGE_SECONDS}${secureFlag}`;
}
