import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { networkInterfaces } from "node:os";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

import { db, cleanupExpiredSessions } from "./db.js";
import {
    clearSessionCookie,
    createSession,
    deleteSession,
    getSessionToken,
    getUserFromSession,
    hashPassword,
    sessionCookie,
    verifyPassword
} from "./auth.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(__dirname, "../public");

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "0.0.0.0";
const MAX_BODY_SIZE = 64 * 1024;

const contentTypes = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".webp": "image/webp"
};

function sendJson(response, statusCode, data, headers = {}) {
    response.writeHead(statusCode, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        ...headers
    });

    response.end(JSON.stringify(data));
}

async function readJsonBody(request) {
    return await new Promise((resolveBody, rejectBody) => {
        let body = "";
        let size = 0;

        request.on("data", (chunk) => {
            size += chunk.length;

            if (size > MAX_BODY_SIZE) {
                rejectBody(new Error("BODY_TOO_LARGE"));
                request.destroy();
                return;
            }

            body += chunk;
        });

        request.on("end", () => {
            if (!body) {
                resolveBody({});
                return;
            }

            try {
                resolveBody(JSON.parse(body));
            } catch {
                rejectBody(new Error("INVALID_JSON"));
            }
        });

        request.on("error", rejectBody);
    });
}

function normalizeEmail(email) {
    return String(email ?? "").trim().toLowerCase();
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validateRegistration(body) {
    const name = String(body.name ?? "").trim();
    const email = normalizeEmail(body.email);
    const password = String(body.password ?? "");

    if (name.length < 2 || name.length > 80) {
        return { ok: false, message: "Informe um nome válido." };
    }

    if (!isValidEmail(email) || email.length > 254) {
        return { ok: false, message: "Informe um e-mail válido." };
    }

    if (password.length < 8 || password.length > 128) {
        return { ok: false, message: "A senha deve ter entre 8 e 128 caracteres." };
    }

    return {
        ok: true,
        data: { name, email, password }
    };
}

async function handleApi(request, response, url) {
    cleanupExpiredSessions();

    if (request.method === "POST" && url.pathname === "/api/register") {
        const body = await readJsonBody(request);
        const validation = validateRegistration(body);

        if (!validation.ok) {
            sendJson(response, 400, {
                success: false,
                message: validation.message
            });
            return;
        }

        const { name, email, password } = validation.data;

        const existingUser = db.prepare(`
            SELECT id
            FROM users
            WHERE email = ? COLLATE NOCASE
            LIMIT 1
        `).get(email);

        if (existingUser) {
            sendJson(response, 409, {
                success: false,
                message: "Já existe uma conta com este e-mail."
            });
            return;
        }

        const passwordHash = await hashPassword(password);

        const result = db.prepare(`
            INSERT INTO users (name, email, password_hash)
            VALUES (?, ?, ?)
        `).run(name, email, passwordHash);

        const userId = Number(result.lastInsertRowid);
        const session = createSession(userId);

        sendJson(
            response,
            201,
            {
                success: true,
                user: {
                    id: userId,
                    name,
                    email
                }
            },
            {
                "Set-Cookie": sessionCookie(session.token, session.expiresAt)
            }
        );

        return;
    }

    if (request.method === "POST" && url.pathname === "/api/login") {
        const body = await readJsonBody(request);
        const email = normalizeEmail(body.email);
        const password = String(body.password ?? "");

        if (!isValidEmail(email) || password === "") {
            sendJson(response, 400, {
                success: false,
                message: "E-mail ou senha incorretos."
            });
            return;
        }

        const user = db.prepare(`
            SELECT id, name, email, password_hash
            FROM users
            WHERE email = ? COLLATE NOCASE
            LIMIT 1
        `).get(email);

        const passwordMatches = user
            ? await verifyPassword(password, user.password_hash)
            : false;

        if (!user || !passwordMatches) {
            sendJson(response, 401, {
                success: false,
                message: "E-mail ou senha incorretos."
            });
            return;
        }

        const oldToken = getSessionToken(request);
        deleteSession(oldToken);

        const session = createSession(user.id);

        sendJson(
            response,
            200,
            {
                success: true,
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email
                }
            },
            {
                "Set-Cookie": sessionCookie(session.token, session.expiresAt)
            }
        );

        return;
    }

    if (request.method === "POST" && url.pathname === "/api/logout") {
        const token = getSessionToken(request);
        deleteSession(token);

        sendJson(
            response,
            200,
            { success: true },
            { "Set-Cookie": clearSessionCookie() }
        );

        return;
    }

    if (request.method === "GET" && url.pathname === "/api/me") {
        const user = getUserFromSession(getSessionToken(request));

        if (!user) {
            sendJson(response, 401, {
                success: false,
                message: "Sessão inválida ou expirada."
            });
            return;
        }

        sendJson(response, 200, {
            success: true,
            user
        });

        return;
    }

    if (request.method === "GET" && url.pathname === "/api/chronicles") {
        const user = getUserFromSession(getSessionToken(request));

        if (!user) {
            sendJson(response, 401, {
                success: false,
                message: "Faça login para continuar."
            });
            return;
        }

        const chronicles = db.prepare(`
            SELECT
                chronicles.id,
                chronicles.name,
                chronicles.city,
                chronicles.description,
                chronicles.status,
                chronicle_members.role,
                chronicles.created_at
            FROM chronicle_members
            JOIN chronicles
              ON chronicles.id = chronicle_members.chronicle_id
            WHERE chronicle_members.user_id = ?
            ORDER BY datetime(chronicles.updated_at) DESC
        `).all(user.id);

        sendJson(response, 200, {
            success: true,
            chronicles
        });

        return;
    }

    if (request.method === "POST" && url.pathname === "/api/chronicles") {
        const user = getUserFromSession(getSessionToken(request));

        if (!user) {
            sendJson(response, 401, {
                success: false,
                message: "Faça login para continuar."
            });
            return;
        }

        const body = await readJsonBody(request);
        const name = String(body.name ?? "").trim();
        const city = String(body.city ?? "").trim();
        const description = String(body.description ?? "").trim();

        if (name.length < 2 || name.length > 100) {
            sendJson(response, 400, {
                success: false,
                message: "Informe um nome válido para a Crônica."
            });
            return;
        }

        if (city.length > 100 || description.length > 1000) {
            sendJson(response, 400, {
                success: false,
                message: "Os dados da Crônica excedem o tamanho permitido."
            });
            return;
        }

        db.exec("BEGIN IMMEDIATE");

        try {
            const result = db.prepare(`
                INSERT INTO chronicles (
                    owner_user_id,
                    name,
                    city,
                    description
                )
                VALUES (?, ?, ?, ?)
            `).run(user.id, name, city, description);

            const chronicleId = Number(result.lastInsertRowid);

            db.prepare(`
                INSERT INTO chronicle_members (
                    chronicle_id,
                    user_id,
                    role
                )
                VALUES (?, ?, 'owner')
            `).run(chronicleId, user.id);

            db.exec("COMMIT");

            sendJson(response, 201, {
                success: true,
                chronicle: {
                    id: chronicleId,
                    name,
                    city,
                    description,
                    status: "active",
                    role: "owner"
                }
            });
        } catch (error) {
            db.exec("ROLLBACK");
            throw error;
        }

        return;
    }

    sendJson(response, 404, {
        success: false,
        message: "Rota não encontrada."
    });
}

function safePublicPath(pathname) {
    const decoded = decodeURIComponent(pathname);
    const requestedPath = decoded === "/" ? "/index.html" : decoded;
    const normalized = normalize(requestedPath).replace(/^([.][.][/\\])+/, "");
    const fullPath = resolve(join(publicDir, normalized));

    if (!fullPath.startsWith(publicDir)) {
        return null;
    }

    return fullPath;
}

async function serveStatic(response, pathname) {
    const filePath = safePublicPath(pathname);

    if (!filePath) {
        response.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
        response.end("Acesso negado.");
        return;
    }

    try {
        const fileStat = await stat(filePath);

        if (!fileStat.isFile()) {
            throw new Error("NOT_A_FILE");
        }

        const content = await readFile(filePath);
        const extension = extname(filePath).toLowerCase();

        response.writeHead(200, {
            "Content-Type": contentTypes[extension] ?? "application/octet-stream",
            "Cache-Control": "no-cache"
        });

        response.end(content);
    } catch {
        response.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
        response.end(`
            <!doctype html>
            <html lang="pt-BR">
                <head><meta charset="utf-8"><title>404 | Elysium</title></head>
                <body style="font-family:sans-serif;background:#09090b;color:#f3efec;padding:3rem">
                    <h1>404</h1>
                    <p>Página não encontrada.</p>
                    <a href="/" style="color:#d76578">Voltar ao Elysium</a>
                </body>
            </html>
        `);
    }
}

const server = createServer(async (request, response) => {
    const url = new URL(request.url, `http://${request.headers.host ?? "localhost"}`);

    try {
        if (url.pathname.startsWith("/api/")) {
            await handleApi(request, response, url);
            return;
        }

        await serveStatic(response, url.pathname);
    } catch (error) {
        console.error(error);

        if (!response.headersSent) {
            const status = error.message === "BODY_TOO_LARGE" ? 413 : 500;

            sendJson(response, status, {
                success: false,
                message:
                    status === 413
                        ? "Requisição muito grande."
                        : "Erro interno do Elysium."
            });
        } else {
            response.end();
        }
    }
});

server.listen(PORT, HOST, () => {
    console.log("\nELYSIUM iniciado.\n");
    console.log(`Local:   http://localhost:${PORT}`);

    const interfaces = networkInterfaces();

    for (const entries of Object.values(interfaces)) {
        for (const entry of entries ?? []) {
            if (entry.family === "IPv4" && !entry.internal) {
                console.log(`Rede:   http://${entry.address}:${PORT}`);
            }
        }
    }

    console.log("\nUse o endereço da interface Radmin para os outros jogadores.\n");
});
