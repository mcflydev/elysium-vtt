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

// Campos adicionais do VTT em cenas/rolagens/presença. addColumn mantém bancos antigos compatíveis.
addColumn("scenes", "folder_id INTEGER");
addColumn("scenes", "position INTEGER NOT NULL DEFAULT 0");
addColumn("scenes", "nav_visible INTEGER NOT NULL DEFAULT 1 CHECK(nav_visible IN (0,1))");
addColumn("scenes", "gm_only INTEGER NOT NULL DEFAULT 0 CHECK(gm_only IN (0,1))");
addColumn("scenes", "width INTEGER NOT NULL DEFAULT 1920");
addColumn("scenes", "height INTEGER NOT NULL DEFAULT 1080");
addColumn("scenes", "grid_type TEXT NOT NULL DEFAULT 'square'");
addColumn("scenes", "grid_size INTEGER NOT NULL DEFAULT 70");
addColumn("scenes", "grid_units TEXT NOT NULL DEFAULT 'm'");
addColumn("scenes", "grid_distance REAL NOT NULL DEFAULT 1.5");
addColumn("scenes", "background_color TEXT NOT NULL DEFAULT '#09090b'");
addColumn("scenes", "foreground_url TEXT NOT NULL DEFAULT ''");
addColumn("scenes", "darkness REAL NOT NULL DEFAULT 0.45");
addColumn("scenes", "global_illumination INTEGER NOT NULL DEFAULT 1 CHECK(global_illumination IN (0,1))");
addColumn("scenes", "fog_enabled INTEGER NOT NULL DEFAULT 0 CHECK(fog_enabled IN (0,1))");
addColumn("scenes", "explorer_enabled INTEGER NOT NULL DEFAULT 0 CHECK(explorer_enabled IN (0,1))");
addColumn("scenes", "restrict_movement INTEGER NOT NULL DEFAULT 1 CHECK(restrict_movement IN (0,1))");
addColumn("scenes", "weather_effect TEXT NOT NULL DEFAULT ''");
addColumn("rolls", "is_secret INTEGER NOT NULL DEFAULT 0 CHECK(is_secret IN (0,1))");
addColumn("presence", "scene_id INTEGER");
addColumn("presence", "cursor_x REAL");
addColumn("presence", "cursor_y REAL");

addColumn("cutscenes", "video_url TEXT NOT NULL DEFAULT ''");
addColumn("cutscenes", "playback_state TEXT NOT NULL DEFAULT 'stopped'");
addColumn("cutscenes", "playback_position REAL NOT NULL DEFAULT 0");
addColumn("cutscenes", "playback_started_at TEXT NOT NULL DEFAULT ''");
addColumn("vtt_drawings", "author_user_id INTEGER");
