PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    is_admin INTEGER NOT NULL DEFAULT 0 CHECK(is_admin IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS chronicles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    subtitle TEXT NOT NULL DEFAULT '',
    city TEXT NOT NULL DEFAULT '',
    period TEXT NOT NULL DEFAULT '',
    style TEXT NOT NULL DEFAULT '',
    banner_url TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'paused', 'finished')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS chronicle_members (
    chronicle_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    role TEXT NOT NULL DEFAULT 'player' CHECK(role IN ('owner', 'master', 'co-master', 'player', 'spectator')),
    joined_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (chronicle_id, user_id),
    FOREIGN KEY (chronicle_id) REFERENCES chronicles(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS invitations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chronicle_id INTEGER NOT NULL,
    code TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL DEFAULT 'player' CHECK(role IN ('master', 'co-master', 'player', 'spectator')),
    created_by_user_id INTEGER NOT NULL,
    expires_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (chronicle_id) REFERENCES chronicles(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS characters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chronicle_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    concept TEXT NOT NULL DEFAULT '',
    clan TEXT NOT NULL DEFAULT '',
    predator TEXT NOT NULL DEFAULT '',
    avatar_url TEXT NOT NULL DEFAULT '',
    story TEXT NOT NULL DEFAULT '',
    attributes_json TEXT NOT NULL DEFAULT '{}',
    skills_json TEXT NOT NULL DEFAULT '{}',
    specialties_json TEXT NOT NULL DEFAULT '[]',
    disciplines_json TEXT NOT NULL DEFAULT '[]',
    advantages_json TEXT NOT NULL DEFAULT '[]',
    flaws_json TEXT NOT NULL DEFAULT '[]',
    convictions_json TEXT NOT NULL DEFAULT '[]',
    touchstones_json TEXT NOT NULL DEFAULT '[]',
    hunger INTEGER NOT NULL DEFAULT 1 CHECK(hunger BETWEEN 0 AND 5),
    humanity INTEGER NOT NULL DEFAULT 7 CHECK(humanity BETWEEN 0 AND 10),
    stains INTEGER NOT NULL DEFAULT 0 CHECK(stains BETWEEN 0 AND 10),
    health_current INTEGER NOT NULL DEFAULT 3,
    health_max INTEGER NOT NULL DEFAULT 3,
    willpower_current INTEGER NOT NULL DEFAULT 3,
    willpower_max INTEGER NOT NULL DEFAULT 3,
    blood_potency INTEGER NOT NULL DEFAULT 1 CHECK(blood_potency BETWEEN 0 AND 10),
    resonance TEXT NOT NULL DEFAULT '',
    xp_available INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (chronicle_id) REFERENCES chronicles(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS rolls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chronicle_id INTEGER NOT NULL,
    character_id INTEGER,
    user_id INTEGER NOT NULL,
    attribute_name TEXT NOT NULL DEFAULT '',
    skill_name TEXT NOT NULL DEFAULT '',
    pool INTEGER NOT NULL,
    hunger INTEGER NOT NULL DEFAULT 0,
    modifier INTEGER NOT NULL DEFAULT 0,
    difficulty INTEGER,
    normal_dice_json TEXT NOT NULL DEFAULT '[]',
    hunger_dice_json TEXT NOT NULL DEFAULT '[]',
    successes INTEGER NOT NULL DEFAULT 0,
    result_type TEXT NOT NULL DEFAULT 'failure',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (chronicle_id) REFERENCES chronicles(id) ON DELETE CASCADE,
    FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE SET NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS scenes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chronicle_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    image_url TEXT NOT NULL DEFAULT '',
    narrative_time TEXT NOT NULL DEFAULT '',
    weather TEXT NOT NULL DEFAULT '',
    music_url TEXT NOT NULL DEFAULT '',
    is_current INTEGER NOT NULL DEFAULT 0 CHECK(is_current IN (0,1)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (chronicle_id) REFERENCES chronicles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chronicle_id INTEGER NOT NULL,
    author_user_id INTEGER NOT NULL,
    character_id INTEGER,
    title TEXT NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT 'note',
    visibility TEXT NOT NULL DEFAULT 'master' CHECK(visibility IN ('master', 'all', 'selected')),
    is_revealed INTEGER NOT NULL DEFAULT 0 CHECK(is_revealed IN (0,1)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (chronicle_id) REFERENCES chronicles(id) ON DELETE CASCADE,
    FOREIGN KEY (author_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS note_recipients (
    note_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    PRIMARY KEY(note_id, user_id),
    FOREIGN KEY(note_id) REFERENCES notes(id) ON DELETE CASCADE,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chronicle_id INTEGER NOT NULL,
    sender_user_id INTEGER NOT NULL,
    recipient_user_id INTEGER,
    channel TEXT NOT NULL DEFAULT 'general' CHECK(channel IN ('general', 'rolls', 'notes', 'whisper')),
    content TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (chronicle_id) REFERENCES chronicles(id) ON DELETE CASCADE,
    FOREIGN KEY (sender_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (recipient_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS npcs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chronicle_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'Vampiro',
    importance TEXT NOT NULL DEFAULT 'quick',
    image_url TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    defense INTEGER NOT NULL DEFAULT 0,
    health INTEGER NOT NULL DEFAULT 3,
    damage INTEGER NOT NULL DEFAULT 1,
    pools_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (chronicle_id) REFERENCES chronicles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS diary_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chronicle_id INTEGER NOT NULL,
    author_user_id INTEGER NOT NULL,
    entry_type TEXT NOT NULL DEFAULT 'session',
    title TEXT NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    visibility TEXT NOT NULL DEFAULT 'all' CHECK(visibility IN ('master', 'all')),
    occurred_at TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (chronicle_id) REFERENCES chronicles(id) ON DELETE CASCADE,
    FOREIGN KEY (author_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS story_nodes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chronicle_id INTEGER NOT NULL,
    parent_id INTEGER,
    node_type TEXT NOT NULL CHECK(node_type IN ('season','episode','act','scene')),
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    position INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (chronicle_id) REFERENCES chronicles(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_id) REFERENCES story_nodes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS timeline_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chronicle_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    event_date TEXT NOT NULL DEFAULT '',
    visibility TEXT NOT NULL DEFAULT 'all' CHECK(visibility IN ('master','partial','all')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (chronicle_id) REFERENCES chronicles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS media_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chronicle_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'Ambiente',
    url TEXT NOT NULL,
    media_type TEXT NOT NULL DEFAULT 'youtube' CHECK(media_type IN ('youtube','audio','video','image')),
    is_active INTEGER NOT NULL DEFAULT 0 CHECK(is_active IN (0,1)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (chronicle_id) REFERENCES chronicles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS cutscenes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chronicle_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    steps_json TEXT NOT NULL DEFAULT '[]',
    is_active INTEGER NOT NULL DEFAULT 0 CHECK(is_active IN (0,1)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (chronicle_id) REFERENCES chronicles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS chronicle_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chronicle_id INTEGER NOT NULL,
    event_type TEXT NOT NULL DEFAULT 'narrative',
    title TEXT NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    payload_json TEXT NOT NULL DEFAULT '{}',
    is_active INTEGER NOT NULL DEFAULT 0 CHECK(is_active IN (0,1)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (chronicle_id) REFERENCES chronicles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS maps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chronicle_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    map_type TEXT NOT NULL DEFAULT 'narrative' CHECK(map_type IN ('narrative','tactical')),
    image_url TEXT NOT NULL DEFAULT '',
    grid_enabled INTEGER NOT NULL DEFAULT 0 CHECK(grid_enabled IN (0,1)),
    markers_json TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (chronicle_id) REFERENCES chronicles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS clocks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chronicle_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    segments INTEGER NOT NULL DEFAULT 4 CHECK(segments BETWEEN 2 AND 12),
    progress INTEGER NOT NULL DEFAULT 0,
    consequence TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (chronicle_id) REFERENCES chronicles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS xp_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    character_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    amount INTEGER NOT NULL,
    reason TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_chronicle_members_user ON chronicle_members(user_id);
CREATE INDEX IF NOT EXISTS idx_characters_chronicle ON characters(chronicle_id);
CREATE INDEX IF NOT EXISTS idx_rolls_chronicle ON rolls(chronicle_id, id DESC);
CREATE INDEX IF NOT EXISTS idx_messages_chronicle ON messages(chronicle_id, id DESC);
CREATE INDEX IF NOT EXISTS idx_notes_chronicle ON notes(chronicle_id);
CREATE INDEX IF NOT EXISTS idx_scenes_chronicle ON scenes(chronicle_id);

CREATE TABLE IF NOT EXISTS roll_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chronicle_id INTEGER NOT NULL,
    requested_by_user_id INTEGER NOT NULL,
    target_user_id INTEGER NOT NULL,
    character_id INTEGER,
    attribute_name TEXT NOT NULL,
    skill_name TEXT NOT NULL DEFAULT '',
    difficulty INTEGER,
    modifier INTEGER NOT NULL DEFAULT 0,
    prompt TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','completed','cancelled')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TEXT,
    FOREIGN KEY (chronicle_id) REFERENCES chronicles(id) ON DELETE CASCADE,
    FOREIGN KEY (requested_by_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS conflicts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chronicle_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    mode TEXT NOT NULL DEFAULT 'narrative' CHECK(mode IN ('narrative','detailed')),
    round INTEGER NOT NULL DEFAULT 1,
    participants_json TEXT NOT NULL DEFAULT '[]',
    notes TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','finished')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (chronicle_id) REFERENCES chronicles(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_roll_requests_target ON roll_requests(target_user_id, status);
CREATE INDEX IF NOT EXISTS idx_conflicts_chronicle ON conflicts(chronicle_id, status);

CREATE TABLE IF NOT EXISTS presence (
    chronicle_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    last_seen TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (chronicle_id, user_id),
    FOREIGN KEY (chronicle_id) REFERENCES chronicles(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_presence_last_seen ON presence(last_seen);
