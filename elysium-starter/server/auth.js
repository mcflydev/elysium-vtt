import {
    createHash,
    randomBytes,
    scrypt,
    timingSafeEqual
} from "node:crypto";
import { promisify } from "node:util";
import { db } from "./db.js";

const scryptAsync = promisify(scrypt);
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
const SESSION_COOKIE = "elysium_session";

export async function hashPassword(password) {
    const salt = randomBytes(16);
    const derivedKey = await scryptAsync(password, salt, 64);

    return `${salt.toString("hex")}:${derivedKey.toString("hex")}`;
}

export async function verifyPassword(password, storedHash) {
    try {
        const [saltHex, keyHex] = storedHash.split(":");

        if (!saltHex || !keyHex) {
            return false;
        }

        const salt = Buffer.from(saltHex, "hex");
        const storedKey = Buffer.from(keyHex, "hex");
        const derivedKey = await scryptAsync(password, salt, storedKey.length);

        if (storedKey.length !== derivedKey.length) {
            return false;
        }

        return timingSafeEqual(storedKey, derivedKey);
    } catch {
        return false;
    }
}

function hashSessionToken(token) {
    return createHash("sha256").update(token).digest("hex");
}

export function createSession(userId) {
    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = hashSessionToken(rawToken);
    const expiresAt = new Date(Date.now() + SESSION_DURATION_MS).toISOString();

    db.prepare(`
        INSERT INTO sessions (user_id, token_hash, expires_at)
        VALUES (?, ?, ?)
    `).run(userId, tokenHash, expiresAt);

    return {
        token: rawToken,
        expiresAt
    };
}

export function deleteSession(rawToken) {
    if (!rawToken) {
        return;
    }

    const tokenHash = hashSessionToken(rawToken);

    db.prepare(`
        DELETE FROM sessions
        WHERE token_hash = ?
    `).run(tokenHash);
}

export function getUserFromSession(rawToken) {
    if (!rawToken) {
        return null;
    }

    const tokenHash = hashSessionToken(rawToken);

    const session = db.prepare(`
        SELECT
            users.id,
            users.name,
            users.email,
            sessions.expires_at
        FROM sessions
        JOIN users ON users.id = sessions.user_id
        WHERE sessions.token_hash = ?
          AND datetime(sessions.expires_at) > datetime('now')
        LIMIT 1
    `).get(tokenHash);

    if (!session) {
        return null;
    }

    return {
        id: session.id,
        name: session.name,
        email: session.email
    };
}

export function parseCookies(request) {
    const header = request.headers.cookie;

    if (!header) {
        return {};
    }

    return Object.fromEntries(
        header.split(";").map((part) => {
            const separator = part.indexOf("=");

            if (separator === -1) {
                return [part.trim(), ""];
            }

            const key = part.slice(0, separator).trim();
            const value = part.slice(separator + 1).trim();

            return [key, decodeURIComponent(value)];
        })
    );
}

export function getSessionToken(request) {
    return parseCookies(request)[SESSION_COOKIE] ?? null;
}

export function sessionCookie(token, expiresAt) {
    const expires = new Date(expiresAt).toUTCString();

    return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Expires=${expires}`;
}

export function clearSessionCookie() {
    return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}
