import { createServer } from "node:http";
import { readFile, stat, mkdir, writeFile } from "node:fs/promises";
import { networkInterfaces } from "node:os";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { randomBytes } from "node:crypto";
import { handleVttApi } from "./vtt-routes.js";

import { db, cleanupExpiredSessions, databaseFilePath } from "./db.js";
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
const uploadsDir = resolve(publicDir, "uploads");
await mkdir(uploadsDir, { recursive: true });
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "0.0.0.0";
const MAX_BODY_SIZE = 1024 * 1024;
const MAX_UPLOAD_IMAGE = 15 * 1024 * 1024;
const MAX_UPLOAD_AUDIO = 50 * 1024 * 1024;
const MAX_UPLOAD_VIDEO = 200 * 1024 * 1024;

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
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".mp3": "audio/mpeg",
    ".ogg": "audio/ogg",
    ".wav": "audio/wav",
    ".m4a": "audio/mp4"
};

const MASTER_ROLES = new Set(["owner", "master", "co-master"]);
const DEFAULT_ATTRIBUTES = {
    forca: 1, destreza: 1, vigor: 1,
    carisma: 1, manipulacao: 1, autocontrole: 1,
    inteligencia: 1, raciocinio: 1, determinacao: 1
};
const DEFAULT_SKILLS = {
    atletismo: 0, briga: 0, conducao: 0, armas_de_fogo: 0, furtividade: 0,
    ladinagem: 0, sobrevivencia: 0, armas_brancas: 0, oficios: 0,
    empatia: 0, etiqueta: 0, intimidacao: 0, lideranca: 0, manha: 0,
    performance: 0, persuasao: 0, sagacidade: 0, subterfugio: 0,
    ciencia: 0, erudicao: 0, financas: 0, investigacao: 0, medicina: 0,
    ocultismo: 0, politica: 0, tecnologia: 0
};

function sendJson(response, statusCode, data, headers = {}) {
    response.writeHead(statusCode, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        ...headers
    });
    response.end(JSON.stringify(data));
}

async function readBinaryBody(request, maxSize) {
    return await new Promise((resolveBody, rejectBody) => {
        const chunks = [];
        let size = 0;
        request.on("data", (chunk) => {
            size += chunk.length;
            if (size > maxSize) {
                rejectBody(new Error("BODY_TOO_LARGE"));
                request.destroy();
                return;
            }
            chunks.push(chunk);
        });
        request.on("end", () => resolveBody(Buffer.concat(chunks)));
        request.on("error", rejectBody);
    });
}

function extensionForUpload(contentType, originalName = "") {
    const byMime = {
        "image/png":".png", "image/jpeg":".jpg", "image/webp":".webp", "image/gif":".gif",
        "video/mp4":".mp4", "video/webm":".webm",
        "audio/mpeg":".mp3", "audio/ogg":".ogg", "audio/wav":".wav", "audio/mp4":".m4a"
    };
    const fromMime = byMime[String(contentType || "").split(";")[0].trim().toLowerCase()];
    if (fromMime) return fromMime;
    const originalExt = extname(String(originalName || "")).toLowerCase();
    return Object.keys(contentTypes).includes(originalExt) ? originalExt : "";
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
            if (!body) return resolveBody({});
            try { resolveBody(JSON.parse(body)); }
            catch { rejectBody(new Error("INVALID_JSON")); }
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
function cleanText(value, max = 5000) {
    return String(value ?? "").trim().slice(0, max);
}
function cleanInt(value, min, max, fallback = min) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.max(min, Math.min(max, Math.trunc(number)));
}
function safeJson(value, fallback) {
    try { return JSON.parse(value); } catch { return fallback; }
}
function jsonText(value, fallback = {}) {
    try { return JSON.stringify(value ?? fallback); } catch { return JSON.stringify(fallback); }
}
function routeMatch(pathname, regex) {
    const match = pathname.match(regex);
    return match || null;
}
function currentUser(request) {
    return getUserFromSession(getSessionToken(request));
}
function requireUser(request, response) {
    const user = currentUser(request);
    if (!user) {
        sendJson(response, 401, { success: false, message: "Faça login para continuar." });
        return null;
    }
    return user;
}
function requireAdmin(request, response) {
    const user = requireUser(request, response);
    if (!user) return null;
    if (!user.isAdmin) {
        sendJson(response, 403, { success: false, message: "Acesso restrito ao administrador do Elysium." });
        return null;
    }
    return user;
}
function getMembership(chronicleId, userId) {
    return db.prepare(`
        SELECT role FROM chronicle_members
        WHERE chronicle_id = ? AND user_id = ? LIMIT 1
    `).get(chronicleId, userId) ?? null;
}
function requireMember(chronicleId, user, response) {
    if (user.isAdmin) return { role: "owner" };
    const membership = getMembership(chronicleId, user.id);
    if (!membership) {
        sendJson(response, 403, { success: false, message: "Você não participa desta Crônica." });
        return null;
    }
    return membership;
}
function requireMaster(chronicleId, user, response) {
    if (user.isAdmin) return { role: "owner" };
    const membership = getMembership(chronicleId, user.id);
    if (!membership || !MASTER_ROLES.has(membership.role)) {
        sendJson(response, 403, { success: false, message: "Apenas a equipe de narração pode realizar esta ação." });
        return null;
    }
    return membership;
}
function chronicleExists(id) {
    return db.prepare("SELECT id FROM chronicles WHERE id = ?").get(id);
}
function touchChronicle(id) {
    db.prepare("UPDATE chronicles SET updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(id);
}
function parseCharacter(row) {
    if (!row) return null;
    return {
        ...row,
        attributes: safeJson(row.attributes_json, DEFAULT_ATTRIBUTES),
        skills: safeJson(row.skills_json, DEFAULT_SKILLS),
        specialties: safeJson(row.specialties_json, []),
        disciplines: safeJson(row.disciplines_json, []),
        advantages: safeJson(row.advantages_json, []),
        flaws: safeJson(row.flaws_json, []),
        convictions: safeJson(row.convictions_json, []),
        touchstones: safeJson(row.touchstones_json, [])
    };
}
function d10() { return Math.floor(Math.random() * 10) + 1; }
function calculateV5Roll(pool, hunger) {
    const total = Math.max(1, pool);
    const hungerCount = Math.min(Math.max(0, hunger), total);
    const normalCount = total - hungerCount;
    const normalDice = Array.from({ length: normalCount }, d10);
    const hungerDice = Array.from({ length: hungerCount }, d10);
    const all = [...normalDice, ...hungerDice];
    const baseSuccesses = all.filter((die) => die >= 6).length;
    const tens = all.filter((die) => die === 10).length;
    const criticalPairs = Math.floor(tens / 2);
    const successes = baseSuccesses + criticalPairs * 2;
    const hasHungerTen = hungerDice.includes(10);
    const hasHungerOne = hungerDice.includes(1);
    let resultType = successes > 0 ? "success" : "failure";
    if (successes === 0 && hasHungerOne) resultType = "bestial_failure";
    else if (criticalPairs > 0 && hasHungerTen) resultType = "messy_critical";
    else if (criticalPairs > 0) resultType = "critical";
    return { normalDice, hungerDice, successes, resultType };
}

function publicChronicle(chronicle, role) {
    return { ...chronicle, role };
}

async function handleApi(request, response, url) {
    cleanupExpiredSessions();

    // ---------- UPLOADS LOCAIS ----------
    if (request.method === "POST" && url.pathname === "/api/upload") {
        const user = requireUser(request, response);
        if (!user) return;
        const kind = String(request.headers["x-upload-kind"] ?? "").toLowerCase();
        const contentType = String(request.headers["content-type"] ?? "").split(";")[0].trim().toLowerCase();
        const originalName = String(request.headers["x-file-name"] ?? "arquivo");
        const rules = {
            image: { prefix: "image/", max: MAX_UPLOAD_IMAGE },
            video: { prefix: "video/", max: MAX_UPLOAD_VIDEO },
            audio: { prefix: "audio/", max: MAX_UPLOAD_AUDIO }
        };
        const rule = rules[kind];
        if (!rule || !contentType.startsWith(rule.prefix)) return sendJson(response, 415, { success:false, message:"Tipo de arquivo não permitido." });
        const extension = extensionForUpload(contentType, originalName);
        if (!extension) return sendJson(response, 415, { success:false, message:"Formato de arquivo não suportado." });
        const body = await readBinaryBody(request, rule.max);
        if (!body.length) return sendJson(response, 400, { success:false, message:"Selecione um arquivo válido." });
        const fileName = `${Date.now()}-${randomBytes(8).toString("hex")}${extension}`;
        await writeFile(resolve(uploadsDir, fileName), body, { flag:"wx" });
        return sendJson(response, 201, { success:true, url:`/uploads/${fileName}`, fileName, size:body.length, kind });
    }

    // ---------- SISTEMA / REDE ----------
    if (request.method === "GET" && url.pathname === "/api/system/network") {
        const addresses = [];
        for (const [interfaceName, entries] of Object.entries(networkInterfaces())) {
            for (const entry of entries ?? []) {
                if (entry.family !== "IPv4" || entry.internal) continue;
                const address = entry.address;
                addresses.push({
                    interfaceName,
                    address,
                    url: `http://${address}:${PORT}`,
                    likelyRadmin: address.startsWith("26.")
                });
            }
        }
        const radmin = addresses.find((item) => item.likelyRadmin) ?? null;
        return sendJson(response, 200, {
            success: true,
            app: "elysium",
            port: PORT,
            localUrl: `http://127.0.0.1:${PORT}`,
            radmin,
            addresses
        });
    }

    // ---------- AUTH ----------
    if (request.method === "POST" && url.pathname === "/api/register") {
        const body = await readJsonBody(request);
        const name = cleanText(body.name, 80);
        const email = normalizeEmail(body.email);
        const password = String(body.password ?? "");
        if (name.length < 2) return sendJson(response, 400, { success: false, message: "Informe um nome válido." });
        if (!isValidEmail(email) || email.length > 254) return sendJson(response, 400, { success: false, message: "Informe um e-mail válido." });
        if (password.length < 8 || password.length > 128) return sendJson(response, 400, { success: false, message: "A senha deve ter entre 8 e 128 caracteres." });
        if (db.prepare("SELECT id FROM users WHERE email = ? COLLATE NOCASE").get(email)) {
            return sendJson(response, 409, { success: false, message: "Já existe uma conta com este e-mail." });
        }
        const isFirstUser = db.prepare("SELECT COUNT(*) AS total FROM users").get().total === 0;
        const passwordHash = await hashPassword(password);
        const result = db.prepare("INSERT INTO users (name,email,password_hash,is_admin) VALUES (?,?,?,?)")
            .run(name, email, passwordHash, isFirstUser ? 1 : 0);
        const userId = Number(result.lastInsertRowid);
        const session = createSession(userId);
        return sendJson(response, 201, { success: true, user: { id: userId, name, email, isAdmin: isFirstUser } }, {
            "Set-Cookie": sessionCookie(session.token, session.expiresAt)
        });
    }

    if (request.method === "POST" && url.pathname === "/api/login") {
        const body = await readJsonBody(request);
        const email = normalizeEmail(body.email);
        const password = String(body.password ?? "");
        const user = db.prepare("SELECT id,name,email,password_hash,is_admin FROM users WHERE email = ? COLLATE NOCASE LIMIT 1").get(email);
        const matches = user ? await verifyPassword(password, user.password_hash) : false;
        if (!user || !matches) return sendJson(response, 401, { success: false, message: "E-mail ou senha incorretos." });
        deleteSession(getSessionToken(request));
        const session = createSession(user.id);
        return sendJson(response, 200, { success: true, user: { id: user.id, name: user.name, email: user.email, isAdmin: Boolean(user.is_admin) } }, {
            "Set-Cookie": sessionCookie(session.token, session.expiresAt)
        });
    }

    if (request.method === "POST" && url.pathname === "/api/logout") {
        deleteSession(getSessionToken(request));
        return sendJson(response, 200, { success: true }, { "Set-Cookie": clearSessionCookie() });
    }

    if (request.method === "GET" && url.pathname === "/api/me") {
        const user = requireUser(request, response); if (!user) return;
        return sendJson(response, 200, { success: true, user });
    }

    // ---------- ADMIN GLOBAL ----------
    if (request.method === "GET" && url.pathname === "/api/admin/overview") {
        const admin = requireAdmin(request, response); if (!admin) return;
        const stats = {
            users: db.prepare("SELECT COUNT(*) AS total FROM users").get().total,
            chronicles: db.prepare("SELECT COUNT(*) AS total FROM chronicles").get().total,
            characters: db.prepare("SELECT COUNT(*) AS total FROM characters").get().total,
            rolls: db.prepare("SELECT COUNT(*) AS total FROM rolls").get().total
        };
        const users = db.prepare(`SELECT id,name,email,is_admin,created_at FROM users ORDER BY id`).all();
        const chronicles = db.prepare(`
            SELECT c.id,c.name,c.city,c.status,c.created_at,u.name AS owner_name,
                   (SELECT COUNT(*) FROM chronicle_members cm WHERE cm.chronicle_id=c.id) AS members
            FROM chronicles c JOIN users u ON u.id=c.owner_user_id ORDER BY c.id DESC
        `).all();
        return sendJson(response, 200, { success: true, stats, users, chronicles, databasePath: databaseFilePath() });
    }

    let match = routeMatch(url.pathname, /^\/api\/admin\/users\/(\d+)$/);
    if (match && request.method === "PATCH") {
        const admin = requireAdmin(request, response); if (!admin) return;
        const userId = Number(match[1]); const body = await readJsonBody(request);
        if (userId === admin.id && body.isAdmin === false) return sendJson(response, 400, { success: false, message: "Você não pode remover seu próprio acesso administrativo." });
        db.prepare("UPDATE users SET is_admin = ? WHERE id = ?").run(body.isAdmin ? 1 : 0, userId);
        return sendJson(response, 200, { success: true });
    }
    if (match && request.method === "DELETE") {
        const admin = requireAdmin(request, response); if (!admin) return;
        const userId = Number(match[1]);
        if (userId === admin.id) return sendJson(response, 400, { success: false, message: "Você não pode excluir sua própria conta pelo painel." });
        db.prepare("DELETE FROM users WHERE id = ?").run(userId);
        return sendJson(response, 200, { success: true });
    }

    match = routeMatch(url.pathname, /^\/api\/admin\/chronicles\/(\d+)$/);
    if (match && request.method === "DELETE") {
        const admin = requireAdmin(request, response); if (!admin) return;
        db.prepare("DELETE FROM chronicles WHERE id = ?").run(Number(match[1]));
        return sendJson(response, 200, { success: true });
    }

    // ---------- CRÔNICAS ----------
    if (request.method === "GET" && url.pathname === "/api/chronicles") {
        const user = requireUser(request, response); if (!user) return;
        const chronicles = user.isAdmin
            ? db.prepare(`SELECT c.*, 'owner' AS role FROM chronicles c ORDER BY datetime(c.updated_at) DESC`).all()
            : db.prepare(`
                SELECT c.*, cm.role FROM chronicle_members cm JOIN chronicles c ON c.id=cm.chronicle_id
                WHERE cm.user_id=? ORDER BY datetime(c.updated_at) DESC
            `).all(user.id);
        return sendJson(response, 200, { success: true, chronicles });
    }

    if (request.method === "POST" && url.pathname === "/api/chronicles") {
        const user = requireUser(request, response); if (!user) return;
        const body = await readJsonBody(request);
        const name = cleanText(body.name, 100);
        if (name.length < 2) return sendJson(response, 400, { success: false, message: "Informe um nome válido para a Crônica." });
        const values = [user.id, name, cleanText(body.subtitle,120), cleanText(body.city,100), cleanText(body.period,100), cleanText(body.style,100), cleanText(body.bannerUrl,1000), cleanText(body.description,3000)];
        db.exec("BEGIN IMMEDIATE");
        try {
            const result = db.prepare(`INSERT INTO chronicles(owner_user_id,name,subtitle,city,period,style,banner_url,description) VALUES(?,?,?,?,?,?,?,?)`).run(...values);
            const id = Number(result.lastInsertRowid);
            db.prepare("INSERT INTO chronicle_members(chronicle_id,user_id,role) VALUES(?,?,'owner')").run(id,user.id);
            db.exec("COMMIT");
            return sendJson(response, 201, { success: true, chronicle: { id, name, role: "owner" } });
        } catch (error) { db.exec("ROLLBACK"); throw error; }
    }

    match = routeMatch(url.pathname, /^\/api\/chronicles\/(\d+)$/);
    if (match && request.method === "GET") {
        const user = requireUser(request, response); if (!user) return;
        const id = Number(match[1]); const membership = requireMember(id,user,response); if (!membership) return;
        const chronicle = db.prepare("SELECT * FROM chronicles WHERE id=?").get(id);
        if (!chronicle) return sendJson(response,404,{success:false,message:"Crônica não encontrada."});
        return sendJson(response,200,{success:true,chronicle:publicChronicle(chronicle,membership.role),canManage: user.isAdmin || MASTER_ROLES.has(membership.role)});
    }
    if (match && request.method === "PATCH") {
        const user = requireUser(request,response); if(!user)return; const id=Number(match[1]); if(!requireMaster(id,user,response))return;
        const body=await readJsonBody(request); const current=db.prepare("SELECT * FROM chronicles WHERE id=?").get(id); if(!current)return sendJson(response,404,{success:false,message:"Crônica não encontrada."});
        db.prepare(`UPDATE chronicles SET name=?,subtitle=?,city=?,period=?,style=?,banner_url=?,description=?,status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(
            cleanText(body.name ?? current.name,100), cleanText(body.subtitle ?? current.subtitle,120), cleanText(body.city ?? current.city,100), cleanText(body.period ?? current.period,100), cleanText(body.style ?? current.style,100), cleanText(body.bannerUrl ?? current.banner_url,1000), cleanText(body.description ?? current.description,3000),
            ["active","paused","finished"].includes(body.status) ? body.status : current.status, id);
        return sendJson(response,200,{success:true});
    }
    if (match && request.method === "DELETE") {
        const user=requireUser(request,response); if(!user)return; const id=Number(match[1]);
        const chronicle=db.prepare("SELECT owner_user_id FROM chronicles WHERE id=?").get(id); if(!chronicle)return sendJson(response,404,{success:false,message:"Crônica não encontrada."});
        if(!user.isAdmin && chronicle.owner_user_id!==user.id)return sendJson(response,403,{success:false,message:"Apenas o dono pode excluir esta Crônica."});
        db.prepare("DELETE FROM chronicles WHERE id=?").run(id); return sendJson(response,200,{success:true});
    }

    // ---------- MEMBROS / CONVITES ----------
    match=routeMatch(url.pathname,/^\/api\/chronicles\/(\d+)\/members$/);
    if(match && request.method==="GET"){
        const user=requireUser(request,response);if(!user)return;const cid=Number(match[1]);if(!requireMember(cid,user,response))return;
        const members=db.prepare(`SELECT u.id,u.name,u.email,cm.role,cm.joined_at, CASE WHEN p.last_seen IS NOT NULL AND datetime(p.last_seen) > datetime('now','-40 seconds') THEN 1 ELSE 0 END AS is_online FROM chronicle_members cm JOIN users u ON u.id=cm.user_id LEFT JOIN presence p ON p.chronicle_id=cm.chronicle_id AND p.user_id=cm.user_id WHERE cm.chronicle_id=? ORDER BY CASE cm.role WHEN 'owner' THEN 0 WHEN 'master' THEN 1 WHEN 'co-master' THEN 2 WHEN 'player' THEN 3 ELSE 4 END,u.name`).all(cid);
        return sendJson(response,200,{success:true,members});
    }
    match=routeMatch(url.pathname,/^\/api\/chronicles\/(\d+)\/members\/(\d+)$/);
    if(match && request.method==="PATCH"){
        const user=requireUser(request,response);if(!user)return;const cid=Number(match[1]);if(!requireMaster(cid,user,response))return; const uid=Number(match[2]); const body=await readJsonBody(request); const role=String(body.role||"");
        if(!["master","co-master","player","spectator"].includes(role))return sendJson(response,400,{success:false,message:"Papel inválido."});
        const target=db.prepare("SELECT role FROM chronicle_members WHERE chronicle_id=? AND user_id=?").get(cid,uid); if(!target)return sendJson(response,404,{success:false,message:"Participante não encontrado."}); if(target.role==="owner")return sendJson(response,400,{success:false,message:"O dono não pode ter o papel alterado."});
        db.prepare("UPDATE chronicle_members SET role=? WHERE chronicle_id=? AND user_id=?").run(role,cid,uid); return sendJson(response,200,{success:true});
    }
    if(match && request.method==="DELETE"){
        const user=requireUser(request,response);if(!user)return;const cid=Number(match[1]);if(!requireMaster(cid,user,response))return;const uid=Number(match[2]);const target=db.prepare("SELECT role FROM chronicle_members WHERE chronicle_id=? AND user_id=?").get(cid,uid);if(!target)return sendJson(response,404,{success:false,message:"Participante não encontrado."});if(target.role==="owner")return sendJson(response,400,{success:false,message:"O dono não pode ser removido."});db.prepare("DELETE FROM chronicle_members WHERE chronicle_id=? AND user_id=?").run(cid,uid);return sendJson(response,200,{success:true});
    }
    match=routeMatch(url.pathname,/^\/api\/chronicles\/(\d+)\/invitations$/);
    if(match && request.method==="POST"){
        const user=requireUser(request,response);if(!user)return;const cid=Number(match[1]);if(!requireMaster(cid,user,response))return;const body=await readJsonBody(request);const role=["master","co-master","player","spectator"].includes(body.role)?body.role:"player";const code=randomBytes(4).toString("hex").toUpperCase();const expiresAt=new Date(Date.now()+7*86400000).toISOString();db.prepare("INSERT INTO invitations(chronicle_id,code,role,created_by_user_id,expires_at) VALUES(?,?,?,?,?)").run(cid,code,role,user.id,expiresAt);return sendJson(response,201,{success:true,code,role,expiresAt});
    }
    if(request.method==="POST" && url.pathname==="/api/invitations/join"){
        const user=requireUser(request,response);if(!user)return;const body=await readJsonBody(request);const code=cleanText(body.code,30).toUpperCase();const invite=db.prepare("SELECT * FROM invitations WHERE code=? AND (expires_at IS NULL OR datetime(expires_at)>datetime('now'))").get(code);if(!invite)return sendJson(response,404,{success:false,message:"Convite inválido ou expirado."});db.prepare("INSERT OR IGNORE INTO chronicle_members(chronicle_id,user_id,role) VALUES(?,?,?)").run(invite.chronicle_id,user.id,invite.role);touchChronicle(invite.chronicle_id);return sendJson(response,200,{success:true,chronicleId:invite.chronicle_id});
    }

    // ---------- PRESENÇA / ONLINE ----------
    match=routeMatch(url.pathname,/^\/api\/chronicles\/(\d+)\/presence$/);
    if(match && request.method==="POST"){
        const user=requireUser(request,response);if(!user)return;const cid=Number(match[1]);if(!requireMember(cid,user,response))return;db.prepare(`INSERT INTO presence(chronicle_id,user_id,last_seen) VALUES(?,?,CURRENT_TIMESTAMP) ON CONFLICT(chronicle_id,user_id) DO UPDATE SET last_seen=CURRENT_TIMESTAMP`).run(cid,user.id);return sendJson(response,200,{success:true});
    }

    // ---------- PERSONAGENS ----------
    match=routeMatch(url.pathname,/^\/api\/chronicles\/(\d+)\/characters$/);
    if(match && request.method==="GET"){
        const user=requireUser(request,response);if(!user)return;const cid=Number(match[1]);if(!requireMember(cid,user,response))return;const rows=db.prepare(`SELECT c.*,u.name AS player_name FROM characters c JOIN users u ON u.id=c.user_id WHERE c.chronicle_id=? ORDER BY c.name`).all(cid);return sendJson(response,200,{success:true,characters:rows.map(parseCharacter)});
    }
    if(match && request.method==="POST"){
        const user=requireUser(request,response);if(!user)return;const cid=Number(match[1]);const membership=requireMember(cid,user,response);if(!membership)return;if(membership.role==="spectator"&&!user.isAdmin)return sendJson(response,403,{success:false,message:"Espectadores não podem criar personagens."});const body=await readJsonBody(request);const targetUserId=(MASTER_ROLES.has(membership.role)||user.isAdmin)&&body.userId?Number(body.userId):user.id;const name=cleanText(body.name,100);if(name.length<2)return sendJson(response,400,{success:false,message:"Informe o nome do personagem."});
        if(!getMembership(cid,targetUserId) && !user.isAdmin)return sendJson(response,400,{success:false,message:"O jogador precisa participar da Crônica."});
        const result=db.prepare(`INSERT INTO characters(chronicle_id,user_id,name,concept,clan,predator,attributes_json,skills_json) VALUES(?,?,?,?,?,?,?,?)`).run(cid,targetUserId,name,cleanText(body.concept,150),cleanText(body.clan,80),cleanText(body.predator,100),jsonText(DEFAULT_ATTRIBUTES),jsonText(DEFAULT_SKILLS));touchChronicle(cid);return sendJson(response,201,{success:true,characterId:Number(result.lastInsertRowid)});
    }
    match=routeMatch(url.pathname,/^\/api\/characters\/(\d+)$/);
    if(match){
        const user=requireUser(request,response);if(!user)return;const id=Number(match[1]);const character=db.prepare("SELECT * FROM characters WHERE id=?").get(id);if(!character)return sendJson(response,404,{success:false,message:"Personagem não encontrado."});const membership=requireMember(character.chronicle_id,user,response);if(!membership)return;const canEdit=user.isAdmin||MASTER_ROLES.has(membership.role)||character.user_id===user.id;
        if(request.method==="GET")return sendJson(response,200,{success:true,character:parseCharacter(character),canEdit});
        if(request.method==="PATCH"){
            if(!canEdit)return sendJson(response,403,{success:false,message:"Você não pode editar este personagem."});const body=await readJsonBody(request);
            const current=parseCharacter(character);
            const attrs=body.attributes && typeof body.attributes==="object" ? {...current.attributes,...body.attributes}:current.attributes;
            const skills=body.skills && typeof body.skills==="object" ? {...current.skills,...body.skills}:current.skills;
            db.prepare(`UPDATE characters SET name=?,concept=?,clan=?,predator=?,avatar_url=?,story=?,attributes_json=?,skills_json=?,specialties_json=?,disciplines_json=?,advantages_json=?,flaws_json=?,convictions_json=?,touchstones_json=?,hunger=?,humanity=?,stains=?,health_current=?,health_max=?,willpower_current=?,willpower_max=?,blood_potency=?,resonance=?,xp_available=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(
                cleanText(body.name??current.name,100),cleanText(body.concept??current.concept,150),cleanText(body.clan??current.clan,80),cleanText(body.predator??current.predator,100),cleanText(body.avatarUrl??current.avatar_url,1000),cleanText(body.story??current.story,10000),jsonText(attrs),jsonText(skills),jsonText(body.specialties??current.specialties,[]),jsonText(body.disciplines??current.disciplines,[]),jsonText(body.advantages??current.advantages,[]),jsonText(body.flaws??current.flaws,[]),jsonText(body.convictions??current.convictions,[]),jsonText(body.touchstones??current.touchstones,[]),cleanInt(body.hunger??current.hunger,0,5,current.hunger),cleanInt(body.humanity??current.humanity,0,10,current.humanity),cleanInt(body.stains??current.stains,0,10,current.stains),cleanInt(body.healthCurrent??current.health_current,0,20,current.health_current),cleanInt(body.healthMax??current.health_max,1,20,current.health_max),cleanInt(body.willpowerCurrent??current.willpower_current,0,20,current.willpower_current),cleanInt(body.willpowerMax??current.willpower_max,1,20,current.willpower_max),cleanInt(body.bloodPotency??current.blood_potency,0,10,current.blood_potency),cleanText(body.resonance??current.resonance,100),cleanInt(body.xpAvailable??current.xp_available,0,999,current.xp_available),id);
            touchChronicle(character.chronicle_id);return sendJson(response,200,{success:true});
        }
        if(request.method==="DELETE"){
            if(!canEdit)return sendJson(response,403,{success:false,message:"Você não pode excluir este personagem."});db.prepare("DELETE FROM characters WHERE id=?").run(id);touchChronicle(character.chronicle_id);return sendJson(response,200,{success:true});
        }
    }

    // ---------- XP ----------
    match=routeMatch(url.pathname,/^\/api\/characters\/(\d+)\/xp$/);
    if(match && request.method==="POST"){
        const user=requireUser(request,response);if(!user)return;const character=db.prepare("SELECT * FROM characters WHERE id=?").get(Number(match[1]));if(!character)return sendJson(response,404,{success:false,message:"Personagem não encontrado."});if(!requireMaster(character.chronicle_id,user,response))return;const body=await readJsonBody(request);const amount=cleanInt(body.amount,-999,999,0);db.exec("BEGIN IMMEDIATE");try{db.prepare("UPDATE characters SET xp_available=MAX(0,xp_available+?),updated_at=CURRENT_TIMESTAMP WHERE id=?").run(amount,character.id);db.prepare("INSERT INTO xp_history(character_id,user_id,amount,reason) VALUES(?,?,?,?)").run(character.id,user.id,amount,cleanText(body.reason,500));db.exec("COMMIT");return sendJson(response,200,{success:true});}catch(e){db.exec("ROLLBACK");throw e;}
    }

    // ---------- ROLAGENS ----------
    match=routeMatch(url.pathname,/^\/api\/chronicles\/(\d+)\/rolls$/);
    if(match && request.method==="GET"){
        const user=requireUser(request,response);if(!user)return;const cid=Number(match[1]);const membership=requireMember(cid,user,response);if(!membership)return;const canSeeSecret=user.isAdmin||MASTER_ROLES.has(membership.role);const secretClause=canSeeSecret?"":"AND COALESCE(r.is_secret,0)=0";const rolls=db.prepare(`SELECT r.*,c.name AS character_name,u.name AS user_name FROM rolls r LEFT JOIN characters c ON c.id=r.character_id JOIN users u ON u.id=r.user_id WHERE r.chronicle_id=? ${secretClause} ORDER BY r.id DESC LIMIT 100`).all(cid).map(r=>({...r,normalDice:safeJson(r.normal_dice_json,[]),hungerDice:safeJson(r.hunger_dice_json,[])}));return sendJson(response,200,{success:true,rolls});
    }
    if(match && request.method==="POST"){
        const user=requireUser(request,response);if(!user)return;const cid=Number(match[1]);const membership=requireMember(cid,user,response);if(!membership)return;if(membership.role==="spectator"&&!user.isAdmin)return sendJson(response,403,{success:false,message:"Espectadores não podem realizar testes."});const body=await readJsonBody(request);let character=null;if(body.characterId){character=db.prepare("SELECT * FROM characters WHERE id=? AND chronicle_id=?").get(Number(body.characterId),cid);if(!character)return sendJson(response,404,{success:false,message:"Personagem não encontrado."});if(!user.isAdmin&&!MASTER_ROLES.has(membership.role)&&character.user_id!==user.id)return sendJson(response,403,{success:false,message:"Você só pode rolar por seu personagem."});}
        let basePool=cleanInt(body.pool,1,50,1);let hunger=cleanInt(body.hunger,0,5,0);const attributeName=cleanText(body.attributeName,80);const skillName=cleanText(body.skillName,80);const modifier=cleanInt(body.modifier,-20,20,0);const difficulty=body.difficulty==null?null:cleanInt(body.difficulty,1,20,1);
        if(character){const parsed=parseCharacter(character);if(attributeName && Object.prototype.hasOwnProperty.call(parsed.attributes,attributeName)) basePool=Number(parsed.attributes[attributeName]||0)+(skillName?Number(parsed.skills[skillName]||0):0);hunger=character.hunger;}
        const pool=Math.max(1,basePool+modifier);const result=calculateV5Roll(pool,hunger);const insert=db.prepare(`INSERT INTO rolls(chronicle_id,character_id,user_id,attribute_name,skill_name,pool,hunger,modifier,difficulty,normal_dice_json,hunger_dice_json,successes,result_type) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(cid,character?.id??null,user.id,attributeName,skillName,pool,hunger,modifier,difficulty,jsonText(result.normalDice,[]),jsonText(result.hungerDice,[]),result.successes,result.resultType);
        const rollId=Number(insert.lastInsertRowid);
        if(body.requestId){
            db.prepare(`UPDATE roll_requests SET status='completed',completed_at=CURRENT_TIMESTAMP WHERE id=? AND chronicle_id=? AND target_user_id=? AND status='pending'`).run(Number(body.requestId),cid,user.id);
        }
        const rollWho=character?.name??user.name;
        db.prepare(`INSERT INTO messages(chronicle_id,sender_user_id,channel,content) VALUES(?,?,'rolls',?)`).run(cid,user.id,`${rollWho} realizou um teste: ${result.successes} sucesso(s) — ${result.resultType}.`);
        touchChronicle(cid);return sendJson(response,201,{success:true,roll:{id:rollId,pool,hunger,difficulty,...result}});
    }

    // ---------- SOLICITAÇÕES DE ROLAGEM ----------
    match=routeMatch(url.pathname,/^\/api\/chronicles\/(\d+)\/roll-requests$/);
    if(match && request.method==="GET"){
        const user=requireUser(request,response);if(!user)return;const cid=Number(match[1]);const membership=requireMember(cid,user,response);if(!membership)return;
        const master=user.isAdmin||MASTER_ROLES.has(membership.role);
        const requests=master
            ? db.prepare(`SELECT rr.*,u.name AS target_name,c.name AS character_name FROM roll_requests rr JOIN users u ON u.id=rr.target_user_id LEFT JOIN characters c ON c.id=rr.character_id WHERE rr.chronicle_id=? AND rr.status='pending' ORDER BY rr.id DESC`).all(cid)
            : db.prepare(`SELECT rr.*,u.name AS target_name,c.name AS character_name FROM roll_requests rr JOIN users u ON u.id=rr.target_user_id LEFT JOIN characters c ON c.id=rr.character_id WHERE rr.chronicle_id=? AND rr.target_user_id=? AND rr.status='pending' ORDER BY rr.id DESC`).all(cid,user.id);
        return sendJson(response,200,{success:true,requests});
    }
    if(match && request.method==="POST"){
        const user=requireUser(request,response);if(!user)return;const cid=Number(match[1]);if(!requireMaster(cid,user,response))return;const body=await readJsonBody(request);
        const targetUserId=Number(body.targetUserId);if(!getMembership(cid,targetUserId))return sendJson(response,400,{success:false,message:"Jogador inválido."});
        if(body.characterId){const requestedCharacter=db.prepare("SELECT user_id FROM characters WHERE id=? AND chronicle_id=?").get(Number(body.characterId),cid);if(!requestedCharacter||requestedCharacter.user_id!==targetUserId)return sendJson(response,400,{success:false,message:"O personagem selecionado não pertence ao jogador escolhido."});}
        const attributeName=cleanText(body.attributeName,80);if(!Object.prototype.hasOwnProperty.call(DEFAULT_ATTRIBUTES,attributeName))return sendJson(response,400,{success:false,message:"Atributo inválido."});
        const skillName=cleanText(body.skillName,80);
        const result=db.prepare(`INSERT INTO roll_requests(chronicle_id,requested_by_user_id,target_user_id,character_id,attribute_name,skill_name,difficulty,modifier,prompt) VALUES(?,?,?,?,?,?,?,?,?)`).run(cid,user.id,targetUserId,body.characterId?Number(body.characterId):null,attributeName,skillName,body.difficulty?cleanInt(body.difficulty,1,20,1):null,cleanInt(body.modifier,-20,20,0),cleanText(body.prompt,500));
        return sendJson(response,201,{success:true,id:Number(result.lastInsertRowid)});
    }
    match=routeMatch(url.pathname,/^\/api\/roll-requests\/(\d+)\/cancel$/);
    if(match && request.method==="POST"){
        const user=requireUser(request,response);if(!user)return;const item=db.prepare("SELECT * FROM roll_requests WHERE id=?").get(Number(match[1]));if(!item)return sendJson(response,404,{success:false,message:"Solicitação não encontrada."});if(!requireMaster(item.chronicle_id,user,response))return;db.prepare(`UPDATE roll_requests SET status='cancelled' WHERE id=?`).run(item.id);return sendJson(response,200,{success:true});
    }

    // ---------- CENAS ----------
    match=routeMatch(url.pathname,/^\/api\/chronicles\/(\d+)\/scenes$/);
    if(match && request.method==="GET"){
        const user=requireUser(request,response);if(!user)return;const cid=Number(match[1]);const membership=requireMember(cid,user,response);if(!membership)return;const canManage=user.isAdmin||["owner","master","co-master"].includes(membership.role);const scenes=canManage?db.prepare("SELECT * FROM scenes WHERE chronicle_id=? ORDER BY is_current DESC,id DESC").all(cid):db.prepare("SELECT * FROM scenes WHERE chronicle_id=? AND is_current=1 ORDER BY id DESC").all(cid);return sendJson(response,200,{success:true,scenes});
    }
    if(match && request.method==="POST"){
        const user=requireUser(request,response);if(!user)return;const cid=Number(match[1]);if(!requireMaster(cid,user,response))return;const body=await readJsonBody(request);const title=cleanText(body.title,150);if(!title)return sendJson(response,400,{success:false,message:"Informe o título da cena."});const result=db.prepare("INSERT INTO scenes(chronicle_id,title,description,image_url,narrative_time,weather,music_url) VALUES(?,?,?,?,?,?,?)").run(cid,title,cleanText(body.description,5000),cleanText(body.imageUrl,1000),cleanText(body.narrativeTime,100),cleanText(body.weather,100),cleanText(body.musicUrl,1000));return sendJson(response,201,{success:true,id:Number(result.lastInsertRowid)});
    }
    match=routeMatch(url.pathname,/^\/api\/scenes\/(\d+)\/(activate)$/);
    if(match && request.method==="POST"){
        const user=requireUser(request,response);if(!user)return;const scene=db.prepare("SELECT * FROM scenes WHERE id=?").get(Number(match[1]));if(!scene)return sendJson(response,404,{success:false,message:"Cena não encontrada."});if(!requireMaster(scene.chronicle_id,user,response))return;db.exec("BEGIN IMMEDIATE");try{db.prepare("UPDATE scenes SET is_current=0 WHERE chronicle_id=?").run(scene.chronicle_id);db.prepare("UPDATE scenes SET is_current=1,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(scene.id);db.exec("COMMIT");return sendJson(response,200,{success:true});}catch(e){db.exec("ROLLBACK");throw e;}
    }
    match=routeMatch(url.pathname,/^\/api\/scenes\/(\d+)$/);
    if(match && request.method==="DELETE"){
        const user=requireUser(request,response);if(!user)return;const scene=db.prepare("SELECT * FROM scenes WHERE id=?").get(Number(match[1]));if(!scene)return sendJson(response,404,{success:false,message:"Cena não encontrada."});if(!requireMaster(scene.chronicle_id,user,response))return;db.prepare("DELETE FROM scenes WHERE id=?").run(scene.id);return sendJson(response,200,{success:true});
    }

    // ---------- NOTAS ----------
    match=routeMatch(url.pathname,/^\/api\/chronicles\/(\d+)\/notes$/);
    if(match && request.method==="GET"){
        const user=requireUser(request,response);if(!user)return;const cid=Number(match[1]);const membership=requireMember(cid,user,response);if(!membership)return;let notes;
        if(user.isAdmin||MASTER_ROLES.has(membership.role)) notes=db.prepare(`SELECT n.*,u.name AS author_name FROM notes n JOIN users u ON u.id=n.author_user_id WHERE n.chronicle_id=? ORDER BY n.id DESC`).all(cid);
        else notes=db.prepare(`SELECT DISTINCT n.*,u.name AS author_name FROM notes n JOIN users u ON u.id=n.author_user_id LEFT JOIN note_recipients nr ON nr.note_id=n.id WHERE n.chronicle_id=? AND (n.author_user_id=? OR (n.is_revealed=1 AND n.visibility='all') OR (n.is_revealed=1 AND n.visibility='selected' AND nr.user_id=?)) ORDER BY n.id DESC`).all(cid,user.id,user.id);
        return sendJson(response,200,{success:true,notes});
    }
    if(match && request.method==="POST"){
        const user=requireUser(request,response);if(!user)return;const cid=Number(match[1]);const membership=requireMember(cid,user,response);if(!membership)return;const body=await readJsonBody(request);const isMaster=user.isAdmin||MASTER_ROLES.has(membership.role);const visibility=isMaster&&["master","all","selected"].includes(body.visibility)?body.visibility:"master";const revealed=isMaster?Boolean(body.isRevealed):true;const category=isMaster?cleanText(body.category||"note",50):"player_private";const result=db.prepare("INSERT INTO notes(chronicle_id,author_user_id,character_id,title,content,category,visibility,is_revealed) VALUES(?,?,?,?,?,?,?,?)").run(cid,user.id,body.characterId?Number(body.characterId):null,cleanText(body.title,150)||"Nota",cleanText(body.content,10000),category,visibility,revealed?1:0);const noteId=Number(result.lastInsertRowid);if(visibility==="selected"&&Array.isArray(body.recipientIds)){const stmt=db.prepare("INSERT OR IGNORE INTO note_recipients(note_id,user_id) VALUES(?,?)");for(const uid of body.recipientIds)stmt.run(noteId,Number(uid));}return sendJson(response,201,{success:true,id:noteId});
    }
    match=routeMatch(url.pathname,/^\/api\/notes\/(\d+)\/reveal$/);
    if(match && request.method==="POST"){
        const user=requireUser(request,response);if(!user)return;const note=db.prepare("SELECT * FROM notes WHERE id=?").get(Number(match[1]));if(!note)return sendJson(response,404,{success:false,message:"Nota não encontrada."});if(!requireMaster(note.chronicle_id,user,response))return;db.prepare("UPDATE notes SET is_revealed=1,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(note.id);return sendJson(response,200,{success:true});
    }

    // ---------- CHAT ----------
    match=routeMatch(url.pathname,/^\/api\/chronicles\/(\d+)\/messages$/);
    if(match && request.method==="GET"){
        const user=requireUser(request,response);if(!user)return;const cid=Number(match[1]);if(!requireMember(cid,user,response))return;const after=cleanInt(url.searchParams.get("after"),0,2147483647,0);const messages=db.prepare(`SELECT m.*,u.name AS sender_name,ru.name AS recipient_name FROM messages m JOIN users u ON u.id=m.sender_user_id LEFT JOIN users ru ON ru.id=m.recipient_user_id WHERE m.chronicle_id=? AND m.id>? AND (m.channel!='whisper' OR m.sender_user_id=? OR m.recipient_user_id=?) ORDER BY m.id ASC LIMIT 200`).all(cid,after,user.id,user.id);return sendJson(response,200,{success:true,messages});
    }
    if(match && request.method==="POST"){
        const user=requireUser(request,response);if(!user)return;const cid=Number(match[1]);if(!requireMember(cid,user,response))return;const body=await readJsonBody(request);const content=cleanText(body.content,3000);if(!content)return sendJson(response,400,{success:false,message:"Digite uma mensagem."});const channel=["general","notes","whisper"].includes(body.channel)?body.channel:"general";const recipientId=channel==="whisper"&&body.recipientId?Number(body.recipientId):null;const result=db.prepare("INSERT INTO messages(chronicle_id,sender_user_id,recipient_user_id,channel,content) VALUES(?,?,?,?,?)").run(cid,user.id,recipientId,channel,content);return sendJson(response,201,{success:true,id:Number(result.lastInsertRowid)});
    }

    // ---------- CONFLITOS ----------
    match=routeMatch(url.pathname,/^\/api\/chronicles\/(\d+)\/conflicts$/);
    if(match && request.method==="GET"){
        const user=requireUser(request,response);if(!user)return;const cid=Number(match[1]);if(!requireMember(cid,user,response))return;const conflicts=db.prepare("SELECT * FROM conflicts WHERE chronicle_id=? ORDER BY status='active' DESC,id DESC").all(cid).map(i=>({...i,participants:safeJson(i.participants_json,[])}));return sendJson(response,200,{success:true,conflicts});
    }
    if(match && request.method==="POST"){
        const user=requireUser(request,response);if(!user)return;const cid=Number(match[1]);if(!requireMaster(cid,user,response))return;const body=await readJsonBody(request);const result=db.prepare("INSERT INTO conflicts(chronicle_id,title,mode,participants_json,notes) VALUES(?,?,?,?,?)").run(cid,cleanText(body.title,150)||"Conflito",body.mode==="detailed"?"detailed":"narrative",jsonText(Array.isArray(body.participants)?body.participants:[],[]),cleanText(body.notes,3000));return sendJson(response,201,{success:true,id:Number(result.lastInsertRowid)});
    }
    match=routeMatch(url.pathname,/^\/api\/conflicts\/(\d+)$/);
    if(match && request.method==="PATCH"){
        const user=requireUser(request,response);if(!user)return;const item=db.prepare("SELECT * FROM conflicts WHERE id=?").get(Number(match[1]));if(!item)return sendJson(response,404,{success:false,message:"Conflito não encontrado."});if(!requireMaster(item.chronicle_id,user,response))return;const body=await readJsonBody(request);const round=cleanInt(body.round??item.round,1,999,item.round);const status=["active","finished"].includes(body.status)?body.status:item.status;db.prepare("UPDATE conflicts SET round=?,status=?,participants_json=?,notes=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(round,status,body.participants?jsonText(body.participants,[]):item.participants_json,cleanText(body.notes??item.notes,3000),item.id);return sendJson(response,200,{success:true});
    }

    // Generic master-owned resources: NPCS, DIARY, STORY, TIMELINE, MEDIA, CUTSCENES, EVENTS, MAPS, CLOCKS
    const generic = [
        {key:"npcs",table:"npcs"},{key:"diary",table:"diary_entries"},{key:"story",table:"story_nodes"},{key:"timeline",table:"timeline_events"},{key:"media",table:"media_items"},{key:"cutscenes",table:"cutscenes"},{key:"events",table:"chronicle_events"},{key:"maps",table:"maps"},{key:"clocks",table:"clocks"}
    ];
    for(const resource of generic){
        match=routeMatch(url.pathname,new RegExp(`^/api/chronicles/(\\d+)/${resource.key}$`));
        if(match && request.method==="GET"){
            const user=requireUser(request,response);if(!user)return;const cid=Number(match[1]);const membership=requireMember(cid,user,response);if(!membership)return;let rows=db.prepare(`SELECT * FROM ${resource.table} WHERE chronicle_id=? ORDER BY id DESC`).all(cid);
            if(resource.key==="diary"&&!user.isAdmin&&!MASTER_ROLES.has(membership.role)) rows=rows.filter(r=>r.visibility==="all");
            if(resource.key==="timeline"&&!user.isAdmin&&!MASTER_ROLES.has(membership.role)) rows=rows.filter(r=>r.visibility!=="master");
            return sendJson(response,200,{success:true,items:rows});
        }
        if(match && request.method==="POST"){
            const user=requireUser(request,response);if(!user)return;const cid=Number(match[1]);if(!requireMaster(cid,user,response))return;const b=await readJsonBody(request);let result;
            switch(resource.key){
                case "npcs": result=db.prepare("INSERT INTO npcs(chronicle_id,name,type,importance,image_url,description,defense,health,damage,pools_json) VALUES(?,?,?,?,?,?,?,?,?,?)").run(cid,cleanText(b.name,120)||"NPC",cleanText(b.type,50)||"Vampiro",cleanText(b.importance,30)||"quick",cleanText(b.imageUrl,1000),cleanText(b.description,5000),cleanInt(b.defense,0,30,0),cleanInt(b.health,1,30,3),cleanInt(b.damage,0,30,1),jsonText(b.pools,{}));break;
                case "diary": result=db.prepare("INSERT INTO diary_entries(chronicle_id,author_user_id,entry_type,title,content,visibility,occurred_at) VALUES(?,?,?,?,?,?,?)").run(cid,user.id,cleanText(b.entryType,50)||"session",cleanText(b.title,150)||"Registro",cleanText(b.content,10000),b.visibility==="master"?"master":"all",cleanText(b.occurredAt,100));break;
                case "story": result=db.prepare("INSERT INTO story_nodes(chronicle_id,parent_id,node_type,title,description,position) VALUES(?,?,?,?,?,?)").run(cid,b.parentId?Number(b.parentId):null,["season","episode","act","scene"].includes(b.nodeType)?b.nodeType:"scene",cleanText(b.title,150)||"Novo item",cleanText(b.description,5000),cleanInt(b.position,0,9999,0));break;
                case "timeline": result=db.prepare("INSERT INTO timeline_events(chronicle_id,title,content,event_date,visibility) VALUES(?,?,?,?,?)").run(cid,cleanText(b.title,150)||"Evento",cleanText(b.content,5000),cleanText(b.eventDate,100),["master","partial","all"].includes(b.visibility)?b.visibility:"all");break;
                case "media": result=db.prepare("INSERT INTO media_items(chronicle_id,title,category,url,media_type) VALUES(?,?,?,?,?)").run(cid,cleanText(b.title,150)||"Mídia",cleanText(b.category,80)||"Ambiente",cleanText(b.url,1500),["youtube","audio","video","image"].includes(b.mediaType)?b.mediaType:"youtube");break;
                case "cutscenes": result=db.prepare("INSERT INTO cutscenes(chronicle_id,title,steps_json,video_url) VALUES(?,?,?,?)").run(cid,cleanText(b.title,150)||"Cutscene",jsonText(b.steps,[]),cleanText(b.videoUrl,1500));break;
                case "events": result=db.prepare("INSERT INTO chronicle_events(chronicle_id,event_type,title,content,payload_json) VALUES(?,?,?,?,?)").run(cid,cleanText(b.eventType,50)||"narrative",cleanText(b.title,150)||"Evento",cleanText(b.content,5000),jsonText(b.payload,{}));break;
                case "maps": result=db.prepare("INSERT INTO maps(chronicle_id,title,map_type,image_url,grid_enabled,markers_json) VALUES(?,?,?,?,?,?)").run(cid,cleanText(b.title,150)||"Mapa",b.mapType==="tactical"?"tactical":"narrative",cleanText(b.imageUrl,1500),b.gridEnabled?1:0,jsonText(b.markers,[]));break;
                case "clocks": result=db.prepare("INSERT INTO clocks(chronicle_id,title,segments,progress,consequence) VALUES(?,?,?,?,?)").run(cid,cleanText(b.title,150)||"Relógio",cleanInt(b.segments,2,12,4),0,cleanText(b.consequence,1000));break;
            }
            return sendJson(response,201,{success:true,id:Number(result.lastInsertRowid)});
        }
    }

    // Controle cinematográfico de Cutscenes: lançar, pausar, retomar e encerrar.
    match=routeMatch(url.pathname,/^\/api\/cutscenes\/(\d+)\/(launch|pause|resume|end)$/);
    if(match && request.method==="POST"){
        const user=requireUser(request,response);if(!user)return;const item=db.prepare("SELECT * FROM cutscenes WHERE id=?").get(Number(match[1]));if(!item)return sendJson(response,404,{success:false,message:"Cutscene não encontrada."});if(!requireMaster(item.chronicle_id,user,response))return;
        const action=match[2];
        if(action==="launch"){db.exec("BEGIN IMMEDIATE");try{db.prepare("UPDATE cutscenes SET is_active=0,playback_state='stopped',playback_position=0,playback_started_at='' WHERE chronicle_id=?").run(item.chronicle_id);db.prepare("UPDATE cutscenes SET is_active=1,playback_state='playing',playback_position=0,playback_started_at=CURRENT_TIMESTAMP WHERE id=?").run(item.id);db.exec("COMMIT");return sendJson(response,200,{success:true,state:"playing",position:0});}catch(error){db.exec("ROLLBACK");throw error;}}
        if(action==="pause"){db.prepare(`UPDATE cutscenes SET playback_position=playback_position+CASE WHEN playback_started_at!='' THEN MAX(0,(julianday('now')-julianday(playback_started_at))*86400.0) ELSE 0 END,playback_state='paused',playback_started_at='' WHERE id=? AND is_active=1`).run(item.id);const row=db.prepare("SELECT playback_position FROM cutscenes WHERE id=?").get(item.id);return sendJson(response,200,{success:true,state:"paused",position:Number(row?.playback_position||0)});}
        if(action==="resume"){db.prepare("UPDATE cutscenes SET is_active=1,playback_state='playing',playback_started_at=CURRENT_TIMESTAMP WHERE id=?").run(item.id);return sendJson(response,200,{success:true,state:"playing",position:Number(item.playback_position||0)});}
        db.prepare("UPDATE cutscenes SET is_active=0,playback_state='stopped',playback_position=0,playback_started_at='' WHERE id=?").run(item.id);return sendJson(response,200,{success:true,state:"stopped",position:0});
    }

    // Actions for media/cutscenes/events/clocks
    match=routeMatch(url.pathname,/^\/api\/(media|cutscenes|events)\/(\d+)\/(activate|deactivate)$/);
    if(match && request.method==="POST"){
        const user=requireUser(request,response);if(!user)return;const map={media:["media_items","is_active"],cutscenes:["cutscenes","is_active"],events:["chronicle_events","is_active"]};const [table,column]=map[match[1]];const item=db.prepare(`SELECT * FROM ${table} WHERE id=?`).get(Number(match[2]));if(!item)return sendJson(response,404,{success:false,message:"Item não encontrado."});if(!requireMaster(item.chronicle_id,user,response))return;
        if(match[3]==="deactivate"){db.prepare(`UPDATE ${table} SET ${column}=0 WHERE id=?`).run(item.id);return sendJson(response,200,{success:true});}
        db.exec("BEGIN IMMEDIATE");try{db.prepare(`UPDATE ${table} SET ${column}=0 WHERE chronicle_id=?`).run(item.chronicle_id);db.prepare(`UPDATE ${table} SET ${column}=1 WHERE id=?`).run(item.id);db.exec("COMMIT");return sendJson(response,200,{success:true});}catch(e){db.exec("ROLLBACK");throw e;}
    }
    match=routeMatch(url.pathname,/^\/api\/maps\/(\d+)$/);
    if(match && request.method==="PATCH"){
        const user=requireUser(request,response);if(!user)return;const item=db.prepare("SELECT * FROM maps WHERE id=?").get(Number(match[1]));if(!item)return sendJson(response,404,{success:false,message:"Mapa não encontrado."});if(!requireMaster(item.chronicle_id,user,response))return;const b=await readJsonBody(request);db.prepare("UPDATE maps SET markers_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(jsonText(Array.isArray(b.markers)?b.markers:safeJson(item.markers_json,[]),[]),item.id);return sendJson(response,200,{success:true});
    }
    match=routeMatch(url.pathname,/^\/api\/clocks\/(\d+)$/);
    if(match && request.method==="PATCH"){
        const user=requireUser(request,response);if(!user)return;const item=db.prepare("SELECT * FROM clocks WHERE id=?").get(Number(match[1]));if(!item)return sendJson(response,404,{success:false,message:"Relógio não encontrado."});if(!requireMaster(item.chronicle_id,user,response))return;const b=await readJsonBody(request);const progress=cleanInt(b.progress,0,item.segments,item.progress);db.prepare("UPDATE clocks SET progress=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(progress,item.id);return sendJson(response,200,{success:true});
    }

    // ---------- EXCLUSÃO DE RECURSOS DA CRÔNICA ----------
    match=routeMatch(url.pathname,/^\/api\/(npcs|diary|story|timeline|media|cutscenes|events|maps|clocks)\/(\d+)$/);
    if(match && request.method==="DELETE"){
        const user=requireUser(request,response);if(!user)return;
        const tables={npcs:"npcs",diary:"diary_entries",story:"story_nodes",timeline:"timeline_events",media:"media_items",cutscenes:"cutscenes",events:"chronicle_events",maps:"maps",clocks:"clocks"};
        const table=tables[match[1]];const item=db.prepare(`SELECT id,chronicle_id FROM ${table} WHERE id=?`).get(Number(match[2]));
        if(!item)return sendJson(response,404,{success:false,message:"Registro não encontrado."});if(!requireMaster(item.chronicle_id,user,response))return;db.prepare(`DELETE FROM ${table} WHERE id=?`).run(item.id);return sendJson(response,200,{success:true});
    }
    match=routeMatch(url.pathname,/^\/api\/notes\/(\d+)$/);
    if(match && request.method==="DELETE"){
        const user=requireUser(request,response);if(!user)return;const note=db.prepare("SELECT * FROM notes WHERE id=?").get(Number(match[1]));if(!note)return sendJson(response,404,{success:false,message:"Nota não encontrada."});const membership=requireMember(note.chronicle_id,user,response);if(!membership)return;if(!user.isAdmin&&!MASTER_ROLES.has(membership.role)&&note.author_user_id!==user.id)return sendJson(response,403,{success:false,message:"Você não pode excluir esta nota."});db.prepare("DELETE FROM notes WHERE id=?").run(note.id);return sendJson(response,200,{success:true});
    }

    // Active session state used by player room / transmission
    match=routeMatch(url.pathname,/^\/api\/chronicles\/(\d+)\/live$/);
    if(match && request.method==="GET"){
        const user=requireUser(request,response);if(!user)return;const cid=Number(match[1]);if(!requireMember(cid,user,response))return;
        const scene=db.prepare("SELECT * FROM scenes WHERE chronicle_id=? AND is_current=1 ORDER BY id DESC LIMIT 1").get(cid)||null;
        const media=db.prepare("SELECT * FROM media_items WHERE chronicle_id=? AND is_active=1 ORDER BY id DESC LIMIT 1").get(cid)||null;
        const cutscene=db.prepare("SELECT * FROM cutscenes WHERE chronicle_id=? AND is_active=1 ORDER BY id DESC LIMIT 1").get(cid)||null;
        const event=db.prepare("SELECT * FROM chronicle_events WHERE chronicle_id=? AND is_active=1 ORDER BY id DESC LIMIT 1").get(cid)||null;
        const recentRoll=db.prepare(`SELECT r.*,c.name AS character_name FROM rolls r LEFT JOIN characters c ON c.id=r.character_id WHERE r.chronicle_id=? AND COALESCE(r.is_secret,0)=0 ORDER BY r.id DESC LIMIT 1`).get(cid)||null;
        if(cutscene){cutscene.steps=safeJson(cutscene.steps_json,[]);cutscene.playbackPosition=Number(cutscene.playback_position||0);if(cutscene.playback_state==="playing"&&cutscene.playback_started_at){const started=new Date(cutscene.playback_started_at.replace(" ","T")+"Z").getTime();if(Number.isFinite(started))cutscene.playbackPosition+=Math.max(0,(Date.now()-started)/1000);}cutscene.playbackState=cutscene.playback_state||"stopped";}if(event)event.payload=safeJson(event.payload_json,{});if(recentRoll){recentRoll.normalDice=safeJson(recentRoll.normal_dice_json,[]);recentRoll.hungerDice=safeJson(recentRoll.hunger_dice_json,[]);}
        return sendJson(response,200,{success:true,scene,media,cutscene,event,recentRoll});
    }

    if (await handleVttApi(request, response, url)) return;

    sendJson(response,404,{success:false,message:"Rota não encontrada."});
}

function safePublicPath(pathname) {
    const decoded = decodeURIComponent(pathname);
    const requestedPath = decoded === "/" ? "index.html" : decoded.replace(/^\/+/, "");
    const normalized = normalize(requestedPath).replace(/^([.][.][/\\])+/, "");
    const fullPath = resolve(join(publicDir, normalized));
    if (!fullPath.startsWith(publicDir)) return null;
    return fullPath;
}

async function serveStatic(response, pathname) {
    const filePath = safePublicPath(pathname);
    if (!filePath) { response.writeHead(403,{"Content-Type":"text/plain; charset=utf-8"}); response.end("Acesso negado."); return; }
    try {
        const fileStat=await stat(filePath); if(!fileStat.isFile()) throw new Error("NOT_A_FILE");
        const content=await readFile(filePath); const extension=extname(filePath).toLowerCase();
        response.writeHead(200,{"Content-Type":contentTypes[extension]??"application/octet-stream","Cache-Control":"no-cache"}); response.end(content);
    } catch {
        response.writeHead(404,{"Content-Type":"text/html; charset=utf-8"});
        response.end(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>404 | Elysium</title></head><body style="font-family:sans-serif;background:#09090b;color:#f3efec;padding:3rem"><h1>404</h1><p>Página não encontrada.</p><a href="/" style="color:#d76578">Voltar ao Elysium</a></body></html>`);
    }
}

const server=createServer(async(request,response)=>{
    const url=new URL(request.url,`http://${request.headers.host??"localhost"}`);
    try{
        if(url.pathname.startsWith("/api/")){await handleApi(request,response,url);return;}
        await serveStatic(response,url.pathname);
    }catch(error){
        console.error(error);
        if(!response.headersSent){const status=error.message==="BODY_TOO_LARGE"?413:500;sendJson(response,status,{success:false,message:status===413?"Requisição muito grande.":"Erro interno do Elysium."});}
        else response.end();
    }
});

server.listen(PORT,HOST,()=>{
    console.log("\nELYSIUM iniciado.\n");
    console.log(`Local:   http://localhost:${PORT}`);
    for(const entries of Object.values(networkInterfaces())) for(const entry of entries??[]) if(entry.family==="IPv4"&&!entry.internal) console.log(`Rede:   http://${entry.address}:${PORT}`);
    console.log(`\nNo Codespaces, abra a porta ${PORT} na aba PORTS. Em LAN/Radmin, use o IP de rede exibido acima.\n`);
});
