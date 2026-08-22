import { createHmac, timingSafeEqual } from "node:crypto";
import type { IncomingMessage } from "node:http";
import { ensureEnv } from "./env.ts";

export const SESSION_COOKIE = "price_update_session";
const SESSION_TTL_SEC = 7 * 24 * 60 * 60;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 10;

export type AuthConfig = {
  username: string;
  password: string;
  secret: string;
  configured: boolean;
};

type SessionPayload = {
  u: string;
  exp: number;
};

const loginAttempts = new Map<string, { count: number; resetAt: number }>();

export function getAuthConfig(): AuthConfig {
  ensureEnv();
  const username = (process.env.APP_AUTH_USERNAME ?? "").trim();
  const password = process.env.APP_AUTH_PASSWORD ?? "";
  const explicitSecret = (process.env.APP_AUTH_SECRET ?? "").trim();
  const secret =
    explicitSecret ||
    (password ? createHmac("sha256", "price-update-auth").update(password).digest("hex") : "");
  return {
    username,
    password,
    secret,
    configured: Boolean(username && password && secret),
  };
}

export function clientKey(req: IncomingMessage): string {
  const forwarded = String(req.headers["x-forwarded-for"] ?? "")
    .split(",")[0]
    ?.trim();
  return forwarded || req.socket.remoteAddress || "unknown";
}

export function allowLoginAttempt(key: string, now = Date.now()): boolean {
  const current = loginAttempts.get(key);
  if (!current || current.resetAt <= now) {
    loginAttempts.set(key, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
    return true;
  }
  if (current.count >= LOGIN_MAX_ATTEMPTS) return false;
  current.count += 1;
  return true;
}

export function resetLoginAttempts(key: string): void {
  loginAttempts.delete(key);
}

export function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function verifyCredentials(username: string, password: string, config = getAuthConfig()): boolean {
  if (!config.configured) return false;
  return safeEqual(username.trim(), config.username) && safeEqual(password, config.password);
}

export function signSession(username: string, config = getAuthConfig(), now = Date.now()): string {
  const payload: SessionPayload = {
    u: username,
    exp: Math.floor(now / 1000) + SESSION_TTL_SEC,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", config.secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function readSession(token: string | null | undefined, config = getAuthConfig(), now = Date.now()): string | null {
  if (!token || !config.configured) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", config.secret).update(body).digest("base64url");
  if (!safeEqual(sig, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
    if (!payload.u || typeof payload.exp !== "number") return null;
    if (payload.exp * 1000 <= now) return null;
    if (!safeEqual(payload.u, config.username)) return null;
    return payload.u;
  } catch {
    return null;
  }
}

export function parseCookie(header: string | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    const key = part.slice(0, eq).trim();
    if (key !== name) continue;
    return decodeURIComponent(part.slice(eq + 1).trim());
  }
  return null;
}

export function sessionFromRequest(req: IncomingMessage, config = getAuthConfig()): string | null {
  return readSession(parseCookie(req.headers.cookie, SESSION_COOKIE), config);
}

export function cookieSecure(req: IncomingMessage): boolean {
  const proto = String(req.headers["x-forwarded-proto"] ?? "").split(",")[0]?.trim();
  return proto === "https";
}

export function sessionCookieHeader(token: string, req: IncomingMessage): string {
  const parts = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${SESSION_TTL_SEC}`,
  ];
  if (cookieSecure(req)) parts.push("Secure");
  return parts.join("; ");
}

export function clearSessionCookieHeader(req: IncomingMessage): string {
  const parts = [`${SESSION_COOKIE}=`, "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=0"];
  if (cookieSecure(req)) parts.push("Secure");
  return parts.join("; ");
}

export function isPublicApi(method: string, pathname: string): boolean {
  if (method === "POST" && pathname === "/api/login") return true;
  if (method === "POST" && pathname === "/api/logout") return true;
  if (method === "GET" && pathname === "/api/auth/me") return true;
  return false;
}
