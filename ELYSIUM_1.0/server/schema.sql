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
    video_url TEXT NOT NULL DEFAULT '',
    playback_state TEXT NOT NULL DEFAULT 'stopped',
    playback_position REAL NOT NULL DEFAULT 0,
    playback_started_at TEXT NOT NULL DEFAULT '',
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

-- =========================================================
-- ELYSIUM VTT CORE (v0.8)
-- =========================================================

CREATE TABLE IF NOT EXISTS scene_folders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chronicle_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (chronicle_id) REFERENCES chronicles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS vtt_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chronicle_id INTEGER NOT NULL,
    scene_id INTEGER NOT NULL,
    character_id INTEGER,
    npc_id INTEGER,
    owner_user_id INTEGER,
    name TEXT NOT NULL DEFAULT 'Token',
    image_url TEXT NOT NULL DEFAULT '',
    x REAL NOT NULL DEFAULT 200,
    y REAL NOT NULL DEFAULT 200,
    width REAL NOT NULL DEFAULT 70,
    height REAL NOT NULL DEFAULT 70,
    rotation REAL NOT NULL DEFAULT 0,
    elevation REAL NOT NULL DEFAULT 0,
    hidden INTEGER NOT NULL DEFAULT 0 CHECK(hidden IN (0,1)),
    locked INTEGER NOT NULL DEFAULT 0 CHECK(locked IN (0,1)),
    vision_enabled INTEGER NOT NULL DEFAULT 1 CHECK(vision_enabled IN (0,1)),
    vision_range REAL NOT NULL DEFAULT 420,
    disposition TEXT NOT NULL DEFAULT 'neutral' CHECK(disposition IN ('friendly','neutral','hostile','secret')),
    bar1_value INTEGER NOT NULL DEFAULT 0,
    bar1_max INTEGER NOT NULL DEFAULT 0,
    bar2_value INTEGER NOT NULL DEFAULT 0,
    bar2_max INTEGER NOT NULL DEFAULT 0,
    status_json TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (chronicle_id) REFERENCES chronicles(id) ON DELETE CASCADE,
    FOREIGN KEY (scene_id) REFERENCES scenes(id) ON DELETE CASCADE,
    FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE SET NULL,
    FOREIGN KEY (npc_id) REFERENCES npcs(id) ON DELETE SET NULL,
    FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS vtt_walls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chronicle_id INTEGER NOT NULL,
    scene_id INTEGER NOT NULL,
    x1 REAL NOT NULL,
    y1 REAL NOT NULL,
    x2 REAL NOT NULL,
    y2 REAL NOT NULL,
    wall_type TEXT NOT NULL DEFAULT 'wall' CHECK(wall_type IN ('wall','door','secret')),
    door_state TEXT NOT NULL DEFAULT 'closed' CHECK(door_state IN ('open','closed','locked')),
    blocks_vision INTEGER NOT NULL DEFAULT 1 CHECK(blocks_vision IN (0,1)),
    blocks_movement INTEGER NOT NULL DEFAULT 1 CHECK(blocks_movement IN (0,1)),
    blocks_sound INTEGER NOT NULL DEFAULT 1 CHECK(blocks_sound IN (0,1)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (chronicle_id) REFERENCES chronicles(id) ON DELETE CASCADE,
    FOREIGN KEY (scene_id) REFERENCES scenes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS vtt_tiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chronicle_id INTEGER NOT NULL,
    scene_id INTEGER NOT NULL,
    name TEXT NOT NULL DEFAULT 'Tile',
    image_url TEXT NOT NULL,
    x REAL NOT NULL DEFAULT 200,
    y REAL NOT NULL DEFAULT 200,
    width REAL NOT NULL DEFAULT 300,
    height REAL NOT NULL DEFAULT 300,
    rotation REAL NOT NULL DEFAULT 0,
    layer TEXT NOT NULL DEFAULT 'under' CHECK(layer IN ('under','over','gm')),
    opacity REAL NOT NULL DEFAULT 1,
    hidden INTEGER NOT NULL DEFAULT 0 CHECK(hidden IN (0,1)),
    locked INTEGER NOT NULL DEFAULT 0 CHECK(locked IN (0,1)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (chronicle_id) REFERENCES chronicles(id) ON DELETE CASCADE,
    FOREIGN KEY (scene_id) REFERENCES scenes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS vtt_drawings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chronicle_id INTEGER NOT NULL,
    scene_id INTEGER NOT NULL,
    drawing_type TEXT NOT NULL DEFAULT 'freehand' CHECK(drawing_type IN ('freehand','rect','ellipse','text')),
    x REAL NOT NULL DEFAULT 0,
    y REAL NOT NULL DEFAULT 0,
    width REAL NOT NULL DEFAULT 0,
    height REAL NOT NULL DEFAULT 0,
    points_json TEXT NOT NULL DEFAULT '[]',
    text TEXT NOT NULL DEFAULT '',
    stroke TEXT NOT NULL DEFAULT '#b23750',
    fill TEXT NOT NULL DEFAULT 'transparent',
    stroke_width REAL NOT NULL DEFAULT 3,
    hidden INTEGER NOT NULL DEFAULT 0 CHECK(hidden IN (0,1)),
    author_user_id INTEGER,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (chronicle_id) REFERENCES chronicles(id) ON DELETE CASCADE,
    FOREIGN KEY (scene_id) REFERENCES scenes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS vtt_lights (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chronicle_id INTEGER NOT NULL,
    scene_id INTEGER NOT NULL,
    name TEXT NOT NULL DEFAULT 'Luz',
    x REAL NOT NULL,
    y REAL NOT NULL,
    bright_radius REAL NOT NULL DEFAULT 140,
    dim_radius REAL NOT NULL DEFAULT 280,
    angle REAL NOT NULL DEFAULT 360,
    color TEXT NOT NULL DEFAULT '#f6d59a',
    intensity REAL NOT NULL DEFAULT 1,
    hidden INTEGER NOT NULL DEFAULT 0 CHECK(hidden IN (0,1)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (chronicle_id) REFERENCES chronicles(id) ON DELETE CASCADE,
    FOREIGN KEY (scene_id) REFERENCES scenes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS vtt_sounds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chronicle_id INTEGER NOT NULL,
    scene_id INTEGER NOT NULL,
    name TEXT NOT NULL DEFAULT 'Som ambiente',
    media_item_id INTEGER,
    url TEXT NOT NULL DEFAULT '',
    x REAL NOT NULL,
    y REAL NOT NULL,
    radius REAL NOT NULL DEFAULT 420,
    volume REAL NOT NULL DEFAULT 0.7,
    hidden INTEGER NOT NULL DEFAULT 0 CHECK(hidden IN (0,1)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (chronicle_id) REFERENCES chronicles(id) ON DELETE CASCADE,
    FOREIGN KEY (scene_id) REFERENCES scenes(id) ON DELETE CASCADE,
    FOREIGN KEY (media_item_id) REFERENCES media_items(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS vtt_map_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chronicle_id INTEGER NOT NULL,
    scene_id INTEGER NOT NULL,
    diary_entry_id INTEGER,
    title TEXT NOT NULL DEFAULT 'Nota',
    content TEXT NOT NULL DEFAULT '',
    x REAL NOT NULL,
    y REAL NOT NULL,
    icon TEXT NOT NULL DEFAULT '◆',
    visibility TEXT NOT NULL DEFAULT 'all' CHECK(visibility IN ('all','master')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (chronicle_id) REFERENCES chronicles(id) ON DELETE CASCADE,
    FOREIGN KEY (scene_id) REFERENCES scenes(id) ON DELETE CASCADE,
    FOREIGN KEY (diary_entry_id) REFERENCES diary_entries(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS vtt_regions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chronicle_id INTEGER NOT NULL,
    scene_id INTEGER NOT NULL,
    name TEXT NOT NULL DEFAULT 'Região',
    x REAL NOT NULL,
    y REAL NOT NULL,
    width REAL NOT NULL DEFAULT 240,
    height REAL NOT NULL DEFAULT 180,
    shape TEXT NOT NULL DEFAULT 'rect' CHECK(shape IN ('rect','ellipse')),
    color TEXT NOT NULL DEFAULT '#7d1a2a',
    behavior_json TEXT NOT NULL DEFAULT '{}',
    hidden INTEGER NOT NULL DEFAULT 0 CHECK(hidden IN (0,1)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (chronicle_id) REFERENCES chronicles(id) ON DELETE CASCADE,
    FOREIGN KEY (scene_id) REFERENCES scenes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS vtt_fog (
    scene_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL DEFAULT 0,
    revealed_json TEXT NOT NULL DEFAULT '[]',
    explored_json TEXT NOT NULL DEFAULT '[]',
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (scene_id, user_id),
    FOREIGN KEY (scene_id) REFERENCES scenes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS vtt_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chronicle_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    item_type TEXT NOT NULL DEFAULT 'item',
    description TEXT NOT NULL DEFAULT '',
    image_url TEXT NOT NULL DEFAULT '',
    data_json TEXT NOT NULL DEFAULT '{}',
    folder TEXT NOT NULL DEFAULT '',
    visibility TEXT NOT NULL DEFAULT 'all' CHECK(visibility IN ('all','master')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (chronicle_id) REFERENCES chronicles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS vtt_roll_tables (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chronicle_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    formula TEXT NOT NULL DEFAULT '1d10',
    entries_json TEXT NOT NULL DEFAULT '[]',
    folder TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (chronicle_id) REFERENCES chronicles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS vtt_card_decks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chronicle_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    cards_json TEXT NOT NULL DEFAULT '[]',
    discard_json TEXT NOT NULL DEFAULT '[]',
    folder TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (chronicle_id) REFERENCES chronicles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS vtt_macros (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chronicle_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    command TEXT NOT NULL DEFAULT '',
    icon TEXT NOT NULL DEFAULT '◆',
    slot INTEGER,
    visibility TEXT NOT NULL DEFAULT 'private' CHECK(visibility IN ('private','all')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (chronicle_id) REFERENCES chronicles(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS vtt_pings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chronicle_id INTEGER NOT NULL,
    scene_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    x REAL NOT NULL,
    y REAL NOT NULL,
    ping_type TEXT NOT NULL DEFAULT 'ping' CHECK(ping_type IN ('ping','focus','fx')),
    label TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (chronicle_id) REFERENCES chronicles(id) ON DELETE CASCADE,
    FOREIGN KEY (scene_id) REFERENCES scenes(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS vtt_world_state (
    chronicle_id INTEGER PRIMARY KEY,
    paused INTEGER NOT NULL DEFAULT 0 CHECK(paused IN (0,1)),
    paused_by_user_id INTEGER,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (chronicle_id) REFERENCES chronicles(id) ON DELETE CASCADE,
    FOREIGN KEY (paused_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_vtt_tokens_scene ON vtt_tokens(scene_id);
CREATE INDEX IF NOT EXISTS idx_vtt_walls_scene ON vtt_walls(scene_id);
CREATE INDEX IF NOT EXISTS idx_vtt_tiles_scene ON vtt_tiles(scene_id);
CREATE INDEX IF NOT EXISTS idx_vtt_drawings_scene ON vtt_drawings(scene_id);
CREATE INDEX IF NOT EXISTS idx_vtt_lights_scene ON vtt_lights(scene_id);
CREATE INDEX IF NOT EXISTS idx_vtt_sounds_scene ON vtt_sounds(scene_id);
CREATE INDEX IF NOT EXISTS idx_vtt_notes_scene ON vtt_map_notes(scene_id);
CREATE INDEX IF NOT EXISTS idx_vtt_regions_scene ON vtt_regions(scene_id);
CREATE INDEX IF NOT EXISTS idx_vtt_pings_scene ON vtt_pings(scene_id, id DESC);
