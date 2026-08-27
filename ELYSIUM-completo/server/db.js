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

export const db = new DatabaseSync(databasePath, { timeout: 5000 });

db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA foreign_keys = ON;");
db.exec("PRAGMA busy_timeout = 5000;");
db.exec(readFileSync(schemaPath, "utf8"));

// Migrações pequenas para quem já rodou uma versão anterior do starter.
function hasColumn(tableName, columnName) {
    return db.prepare(`PRAGMA table_info(${tableName})`).all().some((column) => column.name === columnName);
}

function addColumn(tableName, definition) {
    const columnName = definition.trim().split(/\s+/)[0];
    if (!hasColumn(tableName, columnName)) {
        db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${definition}`);
    }
}

addColumn("users", "is_admin INTEGER NOT NULL DEFAULT 0 CHECK(is_admin IN (0,1))");
addColumn("chronicles", "subtitle TEXT NOT NULL DEFAULT ''");
addColumn("chronicles", "period TEXT NOT NULL DEFAULT ''");
addColumn("chronicles", "style TEXT NOT NULL DEFAULT ''");
addColumn("chronicles", "banner_url TEXT NOT NULL DEFAULT ''");

// A versão inicial não possuía o papel spectator no CHECK da tabela.
const memberTableSql = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='chronicle_members'").get()?.sql ?? "";
if (memberTableSql && !memberTableSql.includes("spectator")) {
    db.exec("PRAGMA foreign_keys = OFF;");
    db.exec("BEGIN IMMEDIATE;");
    try {
        db.exec(`
            ALTER TABLE chronicle_members RENAME TO chronicle_members_legacy;
            CREATE TABLE chronicle_members (
                chronicle_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                role TEXT NOT NULL DEFAULT 'player' CHECK(role IN ('owner','master','co-master','player','spectator')),
                joined_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (chronicle_id, user_id),
                FOREIGN KEY (chronicle_id) REFERENCES chronicles(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
            INSERT INTO chronicle_members(chronicle_id,user_id,role,joined_at)
            SELECT chronicle_id,user_id,role,joined_at FROM chronicle_members_legacy;
            DROP TABLE chronicle_members_legacy;
            CREATE INDEX IF NOT EXISTS idx_chronicle_members_user ON chronicle_members(user_id);
        `);
        db.exec("COMMIT;");
    } catch (error) {
        db.exec("ROLLBACK;");
        throw error;
    } finally {
        db.exec("PRAGMA foreign_keys = ON;");
    }
}

export function cleanupExpiredSessions() {
    db.prepare(`DELETE FROM sessions WHERE datetime(expires_at) <= datetime('now')`).run();
}

export function databaseFilePath() {
    return databasePath;
}

// Garante que instalações antigas tenham ao menos um administrador global.
const adminCount = db.prepare("SELECT COUNT(*) AS total FROM users WHERE is_admin = 1").get().total;
if (adminCount === 0) {
    const firstUser = db.prepare("SELECT id FROM users ORDER BY id ASC LIMIT 1").get();
    if (firstUser) {
        db.prepare("UPDATE users SET is_admin = 1 WHERE id = ?").run(firstUser.id);
    }
}
