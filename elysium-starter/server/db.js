import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const dataDir = resolve(projectRoot, "data");
const databasePath = resolve(dataDir, "elysium.db");
const schemaPath = resolve(__dirname, "schema.sql");

mkdirSync(dataDir, { recursive: true });

export const db = new DatabaseSync(databasePath, {
    timeout: 5000
});

db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA foreign_keys = ON;");
db.exec("PRAGMA busy_timeout = 5000;");

db.exec(readFileSync(schemaPath, "utf8"));

export function cleanupExpiredSessions() {
    db.prepare(`
        DELETE FROM sessions
        WHERE datetime(expires_at) <= datetime('now')
    `).run();
}
