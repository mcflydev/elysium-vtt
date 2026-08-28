import { db } from "./db.js";
import { getSessionToken, getUserFromSession } from "./auth.js";

const MASTER_ROLES = new Set(["owner", "master", "co-master"]);
const MAX_BODY_SIZE = 1024 * 1024;
const PLACEABLES = {
    tokens: { table: "vtt_tokens", scene: true },
    walls: { table: "vtt_walls", scene: true },
    tiles: { table: "vtt_tiles", scene: true },
    drawings: { table: "vtt_drawings", scene: true },
    lights: { table: "vtt_lights", scene: true },
    sounds: { table: "vtt_sounds", scene: true },
    "map-notes": { table: "vtt_map_notes", scene: true },
    regions: { table: "vtt_regions", scene: true }
};

function sendJson(response, statusCode, data) {
    response.writeHead(statusCode, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store"
    });
    response.end(JSON.stringify(data));
}

async function readJsonBody(request) {
    return await new Promise((resolve, reject) => {
        let body = "";
        let size = 0;
        request.on("data", (chunk) => {
            size += chunk.length;
            if (size > MAX_BODY_SIZE) {
                reject(new Error("BODY_TOO_LARGE"));
                request.destroy();
                return;
            }
            body += chunk;
        });
        request.on("end", () => {
            if (!body) return resolve({});
            try { resolve(JSON.parse(body)); }
            catch { reject(new Error("INVALID_JSON")); }
        });
        request.on("error", reject);
    });
}

const txt = (value, max = 5000) => String(value ?? "").trim().slice(0, max);
const num = (value, min, max, fallback = min) => {
    const n = Number(value);
    return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
};
const int = (value, min, max, fallback = min) => Math.trunc(num(value, min, max, fallback));
const bool = (value) => value ? 1 : 0;
const json = (value, fallback = {}) => {
    try { return JSON.stringify(value ?? fallback); }
    catch { return JSON.stringify(fallback); }
};
const parse = (value, fallback) => {
    try { return JSON.parse(value); }
    catch { return fallback; }
};

function userFrom(request) {
    return getUserFromSession(getSessionToken(request));
}
function membership(chronicleId, userId) {
    return db.prepare("SELECT role FROM chronicle_members WHERE chronicle_id=? AND user_id=?").get(chronicleId, userId) ?? null;
}
function auth(request, response) {
    const user = userFrom(request);
    if (!user) {
        sendJson(response, 401, { success: false, message: "Faça login para continuar." });
        return null;
    }
    return user;
}
function member(chronicleId, user, response) {
    if (user.isAdmin) return { role: "owner" };
    const m = membership(chronicleId, user.id);
    if (!m) {
        sendJson(response, 403, { success: false, message: "Você não participa desta Crônica." });
        return null;
    }
    return m;
}
function master(chronicleId, user, response) {
    const m = member(chronicleId, user, response);
    if (!m) return null;
    if (!user.isAdmin && !MASTER_ROLES.has(m.role)) {
        sendJson(response, 403, { success: false, message: "Apenas a equipe de narração pode realizar esta ação." });
        return null;
    }
    return m;
}
function canManage(user, m) {
    return Boolean(user?.isAdmin || MASTER_ROLES.has(m?.role));
}
function sceneById(id) {
    return db.prepare("SELECT * FROM scenes WHERE id=?").get(id) ?? null;
}
function placeableRow(type, id) {
    const config = PLACEABLES[type];
    if (!config) return null;
    return db.prepare(`SELECT * FROM ${config.table} WHERE id=?`).get(id) ?? null;
}
function sceneAccessible(scene, user, m) {
    if (canManage(user, m)) return true;
    return Boolean(scene.is_current || (scene.nav_visible && !scene.gm_only));
}
function cleanScene(row) {
    if (!row) return null;
    return {
        ...row,
        fog_enabled: Boolean(row.fog_enabled),
        explorer_enabled: Boolean(row.explorer_enabled),
        restrict_movement: Boolean(row.restrict_movement),
        global_illumination: Boolean(row.global_illumination),
        nav_visible: Boolean(row.nav_visible),
        gm_only: Boolean(row.gm_only),
        is_current: Boolean(row.is_current)
    };
}
function publicToken(row) {
    return { ...row, status: parse(row.status_json, []) };
}
function publicDrawing(row) {
    return { ...row, points: parse(row.points_json, []) };
}
function publicRegion(row) {
    return { ...row, behavior: parse(row.behavior_json, {}) };
}
function publicItem(row) {
    return { ...row, data: parse(row.data_json, {}) };
}
function publicTable(row) {
    return { ...row, entries: parse(row.entries_json, []) };
}
function publicDeck(row) {
    return { ...row, cards: parse(row.cards_json, []), discard: parse(row.discard_json, []) };
}
function randomFormula(formula = "1d10") {
    const match = String(formula).trim().match(/^(\d{1,2})d(\d{1,4})(?:\s*([+-])\s*(\d{1,4}))?$/i);
    if (!match) return { total: 1, rolls: [1], formula: "1d1" };
    const count = Math.max(1, Math.min(20, Number(match[1])));
    const sides = Math.max(2, Math.min(1000, Number(match[2])));
    const mod = match[3] ? Number(match[4]) * (match[3] === "-" ? -1 : 1) : 0;
    const rolls = Array.from({ length: count }, () => Math.floor(Math.random() * sides) + 1);
    return { total: rolls.reduce((a, b) => a + b, 0) + mod, rolls, formula: `${count}d${sides}${mod ? (mod > 0 ? `+${mod}` : mod) : ""}` };
}
function filterRolls(chronicleId, user, m) {
    const rows = db.prepare(`SELECT r.*,c.name AS character_name,u.name AS user_name FROM rolls r LEFT JOIN characters c ON c.id=r.character_id JOIN users u ON u.id=r.user_id WHERE r.chronicle_id=? ORDER BY r.id DESC LIMIT 100`).all(chronicleId);
    return rows.filter((r) => !r.is_secret || canManage(user, m) || r.user_id === user.id).map((r) => ({
        ...r,
        normalDice: parse(r.normal_dice_json, []),
        hungerDice: parse(r.hunger_dice_json, [])
    }));
}
function d10() { return Math.floor(Math.random() * 10) + 1; }
function v5Roll(pool, hunger) {
    const total = Math.max(1, Math.min(50, pool));
    const hungerCount = Math.min(Math.max(0, hunger), total);
    const hungerDice = Array.from({ length: hungerCount }, d10);
    const normalDice = Array.from({ length: total - hungerCount }, d10);
    const all = [...normalDice, ...hungerDice];
    const base = all.filter((d) => d >= 6).length;
    const tens = all.filter((d) => d === 10).length;
    const pairs = Math.floor(tens / 2);
    const successes = base + pairs * 2;
    let resultType = successes ? "success" : "failure";
    if (!successes && hungerDice.includes(1)) resultType = "bestial_failure";
    else if (pairs && hungerDice.includes(10)) resultType = "messy_critical";
    else if (pairs) resultType = "critical";
    return { normalDice, hungerDice, successes, resultType };
}


function segmentsIntersect(a,b,c,d) {
    const orient=(p,q,r)=>Math.sign((q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x));
    const o1=orient(a,b,c),o2=orient(a,b,d),o3=orient(c,d,a),o4=orient(c,d,b);
    return o1!==o2 && o3!==o4;
}
function serverMovementBlocked(row, body) {
    const scene=sceneById(row.scene_id);
    if(!scene?.restrict_movement) return false;
    const nx=num(body.x,-100000,100000,row.x), ny=num(body.y,-100000,100000,row.y);
    const a={x:row.x+row.width/2,y:row.y+row.height/2};
    const b={x:nx+row.width/2,y:ny+row.height/2};
    const walls=db.prepare("SELECT * FROM vtt_walls WHERE scene_id=? AND blocks_movement=1").all(row.scene_id);
    return walls.some(w=>{
        if(w.wall_type!=="wall" && w.door_state==="open") return false;
        return segmentsIntersect(a,b,{x:w.x1,y:w.y1},{x:w.x2,y:w.y2});
    });
}

function createPlaceable(type, scene, b, authorUserId = null) {
    const cid = scene.chronicle_id;
    switch (type) {
        case "tokens": return db.prepare(`INSERT INTO vtt_tokens(chronicle_id,scene_id,character_id,npc_id,owner_user_id,name,image_url,x,y,width,height,rotation,elevation,hidden,locked,vision_enabled,vision_range,disposition,bar1_value,bar1_max,bar2_value,bar2_max,status_json) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
            cid, scene.id, b.characterId ? Number(b.characterId) : null, b.npcId ? Number(b.npcId) : null, b.ownerUserId ? Number(b.ownerUserId) : null,
            txt(b.name, 120) || "Token", txt(b.imageUrl, 1500), num(b.x, -100000, 100000, 200), num(b.y, -100000, 100000, 200), num(b.width, 10, 2000, scene.grid_size || 70), num(b.height, 10, 2000, scene.grid_size || 70), num(b.rotation, -3600, 3600, 0), num(b.elevation, -1000, 1000, 0), bool(b.hidden), bool(b.locked), b.visionEnabled === false ? 0 : 1, num(b.visionRange, 0, 5000, 420), ["friendly","neutral","hostile","secret"].includes(b.disposition) ? b.disposition : "neutral", int(b.bar1Value, -999, 999, 0), int(b.bar1Max, 0, 999, 0), int(b.bar2Value, -999, 999, 0), int(b.bar2Max, 0, 999, 0), json(Array.isArray(b.status) ? b.status : [], [])
        );
        case "walls": return db.prepare(`INSERT INTO vtt_walls(chronicle_id,scene_id,x1,y1,x2,y2,wall_type,door_state,blocks_vision,blocks_movement,blocks_sound) VALUES(?,?,?,?,?,?,?,?,?,?,?)`).run(
            cid, scene.id, num(b.x1,-100000,100000,0), num(b.y1,-100000,100000,0), num(b.x2,-100000,100000,0), num(b.y2,-100000,100000,0), ["wall","door","secret"].includes(b.wallType) ? b.wallType : "wall", ["open","closed","locked"].includes(b.doorState) ? b.doorState : "closed", b.blocksVision === false ? 0 : 1, b.blocksMovement === false ? 0 : 1, b.blocksSound === false ? 0 : 1
        );
        case "tiles": return db.prepare(`INSERT INTO vtt_tiles(chronicle_id,scene_id,name,image_url,x,y,width,height,rotation,layer,opacity,hidden,locked) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
            cid, scene.id, txt(b.name,120)||"Tile", txt(b.imageUrl,1500), num(b.x,-100000,100000,200), num(b.y,-100000,100000,200), num(b.width,10,5000,300), num(b.height,10,5000,300), num(b.rotation,-3600,3600,0), ["under","over","gm"].includes(b.layer)?b.layer:"under", num(b.opacity,0,1,1), bool(b.hidden), bool(b.locked)
        );
        case "drawings": return db.prepare(`INSERT INTO vtt_drawings(chronicle_id,scene_id,drawing_type,x,y,width,height,points_json,text,stroke,fill,stroke_width,hidden,author_user_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
            cid, scene.id, ["freehand","rect","ellipse","text"].includes(b.drawingType)?b.drawingType:"freehand", num(b.x,-100000,100000,0), num(b.y,-100000,100000,0), num(b.width,-100000,100000,0), num(b.height,-100000,100000,0), json(Array.isArray(b.points)?b.points:[],[]), txt(b.text,2000), txt(b.stroke,30)||"#b23750", txt(b.fill,30)||"transparent", num(b.strokeWidth,1,30,3), bool(b.hidden), authorUserId
        );
        case "lights": return db.prepare(`INSERT INTO vtt_lights(chronicle_id,scene_id,name,x,y,bright_radius,dim_radius,angle,color,intensity,hidden) VALUES(?,?,?,?,?,?,?,?,?,?,?)`).run(
            cid, scene.id, txt(b.name,120)||"Luz", num(b.x,-100000,100000,0), num(b.y,-100000,100000,0), num(b.brightRadius,0,5000,140), num(b.dimRadius,0,5000,280), num(b.angle,1,360,360), txt(b.color,30)||"#f6d59a", num(b.intensity,0,2,1), bool(b.hidden)
        );
        case "sounds": return db.prepare(`INSERT INTO vtt_sounds(chronicle_id,scene_id,name,media_item_id,url,x,y,radius,volume,hidden) VALUES(?,?,?,?,?,?,?,?,?,?)`).run(
            cid, scene.id, txt(b.name,120)||"Som ambiente", b.mediaItemId?Number(b.mediaItemId):null, txt(b.url,1500), num(b.x,-100000,100000,0), num(b.y,-100000,100000,0), num(b.radius,1,5000,420), num(b.volume,0,1,.7), bool(b.hidden)
        );
        case "map-notes": return db.prepare(`INSERT INTO vtt_map_notes(chronicle_id,scene_id,diary_entry_id,title,content,x,y,icon,visibility) VALUES(?,?,?,?,?,?,?,?,?)`).run(
            cid, scene.id, b.diaryEntryId?Number(b.diaryEntryId):null, txt(b.title,150)||"Nota", txt(b.content,10000), num(b.x,-100000,100000,0), num(b.y,-100000,100000,0), txt(b.icon,10)||"◆", b.visibility==="master"?"master":"all"
        );
        case "regions": return db.prepare(`INSERT INTO vtt_regions(chronicle_id,scene_id,name,x,y,width,height,shape,color,behavior_json,hidden) VALUES(?,?,?,?,?,?,?,?,?,?,?)`).run(
            cid, scene.id, txt(b.name,120)||"Região", num(b.x,-100000,100000,0), num(b.y,-100000,100000,0), num(b.width,10,5000,240), num(b.height,10,5000,180), b.shape==="ellipse"?"ellipse":"rect", txt(b.color,30)||"#7d1a2a", json(b.behavior||{},{}), bool(b.hidden)
        );
        default: return null;
    }
}

function patchPlaceable(type, row, b, moveOnly = false) {
    const table = PLACEABLES[type]?.table;
    if (!table) return;
    if (type === "tokens") {
        if (moveOnly) {
            db.prepare(`UPDATE vtt_tokens SET x=?,y=?,rotation=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(num(b.x,-100000,100000,row.x),num(b.y,-100000,100000,row.y),num(b.rotation,-3600,3600,row.rotation),row.id);
            return;
        }
        db.prepare(`UPDATE vtt_tokens SET name=?,image_url=?,x=?,y=?,width=?,height=?,rotation=?,elevation=?,hidden=?,locked=?,vision_enabled=?,vision_range=?,disposition=?,bar1_value=?,bar1_max=?,bar2_value=?,bar2_max=?,status_json=?,owner_user_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(
            txt(b.name??row.name,120),txt(b.imageUrl??row.image_url,1500),num(b.x,-100000,100000,row.x),num(b.y,-100000,100000,row.y),num(b.width,10,2000,row.width),num(b.height,10,2000,row.height),num(b.rotation,-3600,3600,row.rotation),num(b.elevation,-1000,1000,row.elevation),b.hidden==null?row.hidden:bool(b.hidden),b.locked==null?row.locked:bool(b.locked),b.visionEnabled==null?row.vision_enabled:bool(b.visionEnabled),num(b.visionRange,0,5000,row.vision_range),["friendly","neutral","hostile","secret"].includes(b.disposition)?b.disposition:row.disposition,int(b.bar1Value,-999,999,row.bar1_value),int(b.bar1Max,0,999,row.bar1_max),int(b.bar2Value,-999,999,row.bar2_value),int(b.bar2Max,0,999,row.bar2_max),b.status?json(b.status,[]):row.status_json,b.ownerUserId===null?null:(b.ownerUserId?Number(b.ownerUserId):row.owner_user_id),row.id
        ); return;
    }
    if (type === "walls") { db.prepare(`UPDATE vtt_walls SET x1=?,y1=?,x2=?,y2=?,wall_type=?,door_state=?,blocks_vision=?,blocks_movement=?,blocks_sound=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(num(b.x1,-100000,100000,row.x1),num(b.y1,-100000,100000,row.y1),num(b.x2,-100000,100000,row.x2),num(b.y2,-100000,100000,row.y2),["wall","door","secret"].includes(b.wallType)?b.wallType:row.wall_type,["open","closed","locked"].includes(b.doorState)?b.doorState:row.door_state,b.blocksVision==null?row.blocks_vision:bool(b.blocksVision),b.blocksMovement==null?row.blocks_movement:bool(b.blocksMovement),b.blocksSound==null?row.blocks_sound:bool(b.blocksSound),row.id); return; }
    if (type === "tiles") { db.prepare(`UPDATE vtt_tiles SET name=?,image_url=?,x=?,y=?,width=?,height=?,rotation=?,layer=?,opacity=?,hidden=?,locked=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(txt(b.name??row.name,120),txt(b.imageUrl??row.image_url,1500),num(b.x,-100000,100000,row.x),num(b.y,-100000,100000,row.y),num(b.width,10,5000,row.width),num(b.height,10,5000,row.height),num(b.rotation,-3600,3600,row.rotation),["under","over","gm"].includes(b.layer)?b.layer:row.layer,num(b.opacity,0,1,row.opacity),b.hidden==null?row.hidden:bool(b.hidden),b.locked==null?row.locked:bool(b.locked),row.id); return; }
    if (type === "drawings") { db.prepare(`UPDATE vtt_drawings SET x=?,y=?,width=?,height=?,points_json=?,text=?,stroke=?,fill=?,stroke_width=?,hidden=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(num(b.x,-100000,100000,row.x),num(b.y,-100000,100000,row.y),num(b.width,-100000,100000,row.width),num(b.height,-100000,100000,row.height),b.points?json(b.points,[]):row.points_json,txt(b.text??row.text,2000),txt(b.stroke??row.stroke,30),txt(b.fill??row.fill,30),num(b.strokeWidth,1,30,row.stroke_width),b.hidden==null?row.hidden:bool(b.hidden),row.id); return; }
    if (type === "lights") { db.prepare(`UPDATE vtt_lights SET name=?,x=?,y=?,bright_radius=?,dim_radius=?,angle=?,color=?,intensity=?,hidden=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(txt(b.name??row.name,120),num(b.x,-100000,100000,row.x),num(b.y,-100000,100000,row.y),num(b.brightRadius,0,5000,row.bright_radius),num(b.dimRadius,0,5000,row.dim_radius),num(b.angle,1,360,row.angle),txt(b.color??row.color,30),num(b.intensity,0,2,row.intensity),b.hidden==null?row.hidden:bool(b.hidden),row.id); return; }
    if (type === "sounds") { db.prepare(`UPDATE vtt_sounds SET name=?,media_item_id=?,url=?,x=?,y=?,radius=?,volume=?,hidden=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(txt(b.name??row.name,120),b.mediaItemId===null?null:(b.mediaItemId?Number(b.mediaItemId):row.media_item_id),txt(b.url??row.url,1500),num(b.x,-100000,100000,row.x),num(b.y,-100000,100000,row.y),num(b.radius,1,5000,row.radius),num(b.volume,0,1,row.volume),b.hidden==null?row.hidden:bool(b.hidden),row.id); return; }
    if (type === "map-notes") { db.prepare(`UPDATE vtt_map_notes SET title=?,content=?,x=?,y=?,icon=?,visibility=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(txt(b.title??row.title,150),txt(b.content??row.content,10000),num(b.x,-100000,100000,row.x),num(b.y,-100000,100000,row.y),txt(b.icon??row.icon,10),b.visibility==="master"?"master":row.visibility,row.id); return; }
    if (type === "regions") { db.prepare(`UPDATE vtt_regions SET name=?,x=?,y=?,width=?,height=?,shape=?,color=?,behavior_json=?,hidden=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(txt(b.name??row.name,120),num(b.x,-100000,100000,row.x),num(b.y,-100000,100000,row.y),num(b.width,10,5000,row.width),num(b.height,10,5000,row.height),b.shape==="ellipse"?"ellipse":row.shape,txt(b.color??row.color,30),b.behavior?json(b.behavior,{}):row.behavior_json,b.hidden==null?row.hidden:bool(b.hidden),row.id); }
}

function scenePayload(scene, user, m) {
    const gm = canManage(user, m);
    const tokenRows = db.prepare("SELECT * FROM vtt_tokens WHERE scene_id=? ORDER BY id").all(scene.id).filter((r) => gm || !r.hidden).map(publicToken);
    const wallRows = db.prepare("SELECT * FROM vtt_walls WHERE scene_id=? ORDER BY id").all(scene.id).filter((r) => gm || r.wall_type !== "secret");
    const tileRows = db.prepare("SELECT * FROM vtt_tiles WHERE scene_id=? ORDER BY id").all(scene.id).filter((r) => gm || (!r.hidden && r.layer !== "gm"));
    const drawingRows = db.prepare("SELECT * FROM vtt_drawings WHERE scene_id=? ORDER BY id").all(scene.id).filter((r) => gm || !r.hidden).map(publicDrawing);
    const lightRows = db.prepare("SELECT * FROM vtt_lights WHERE scene_id=? ORDER BY id").all(scene.id).filter((r) => gm || !r.hidden);
    const soundRows = db.prepare("SELECT * FROM vtt_sounds WHERE scene_id=? ORDER BY id").all(scene.id).filter((r) => gm || !r.hidden);
    const noteRows = db.prepare("SELECT * FROM vtt_map_notes WHERE scene_id=? ORDER BY id").all(scene.id).filter((r) => gm || r.visibility === "all");
    const regionRows = db.prepare("SELECT * FROM vtt_regions WHERE scene_id=? ORDER BY id").all(scene.id).filter((r) => gm || !r.hidden).map(publicRegion);
    const globalFog = db.prepare("SELECT * FROM vtt_fog WHERE scene_id=? AND user_id=0").get(scene.id) ?? { revealed_json: "[]", explored_json: "[]" };
    const userFog = db.prepare("SELECT * FROM vtt_fog WHERE scene_id=? AND user_id=?").get(scene.id, user.id) ?? { revealed_json: "[]", explored_json: "[]" };
    const pings = db.prepare(`SELECT p.*,u.name AS user_name FROM vtt_pings p JOIN users u ON u.id=p.user_id WHERE p.scene_id=? AND datetime(p.created_at) >= datetime('now','-8 seconds') ORDER BY p.id DESC LIMIT 30`).all(scene.id);
    return {
        scene: cleanScene(scene),
        objects: { tokens: tokenRows, walls: wallRows, tiles: tileRows, drawings: drawingRows, lights: lightRows, sounds: soundRows, notes: noteRows, regions: regionRows },
        fog: { global: { revealed: parse(globalFog.revealed_json, []), explored: parse(globalFog.explored_json, []) }, user: { revealed: parse(userFog.revealed_json, []), explored: parse(userFog.explored_json, []) } },
        pings
    };
}

export async function handleVttApi(request, response, url) {
    if (!url.pathname.startsWith("/api/vtt/")) return false;
    let match;

    // Bootstrap do mundo/VTT.
    match = url.pathname.match(/^\/api\/vtt\/chronicles\/(\d+)\/bootstrap$/);
    if (match && request.method === "GET") {
        const user = auth(request, response); if (!user) return true;
        const cid = Number(match[1]); const m = member(cid, user, response); if (!m) return true;
        const gm = canManage(user, m);
        const chronicle = db.prepare("SELECT * FROM chronicles WHERE id=?").get(cid);
        if (!chronicle) { sendJson(response, 404, { success:false, message:"Crônica não encontrada." }); return true; }
        db.prepare("INSERT OR IGNORE INTO vtt_world_state(chronicle_id) VALUES(?)").run(cid);
        const scenes = (gm
            ? db.prepare("SELECT * FROM scenes WHERE chronicle_id=? ORDER BY position ASC,is_current DESC,id ASC").all(cid)
            : db.prepare("SELECT * FROM scenes WHERE chronicle_id=? AND (is_current=1 OR (nav_visible=1 AND gm_only=0)) ORDER BY position ASC,is_current DESC,id ASC").all(cid)
        ).map(cleanScene);
        const folders = gm ? db.prepare("SELECT * FROM scene_folders WHERE chronicle_id=? ORDER BY position,id").all(cid) : [];
        const members = db.prepare(`SELECT u.id,u.name,u.email,cm.role,p.last_seen,p.scene_id,p.cursor_x,p.cursor_y,CASE WHEN p.last_seen IS NOT NULL AND datetime(p.last_seen)>=datetime('now','-35 seconds') THEN 1 ELSE 0 END AS is_online FROM chronicle_members cm JOIN users u ON u.id=cm.user_id LEFT JOIN presence p ON p.chronicle_id=cm.chronicle_id AND p.user_id=cm.user_id WHERE cm.chronicle_id=? ORDER BY CASE cm.role WHEN 'owner' THEN 0 WHEN 'master' THEN 1 WHEN 'co-master' THEN 2 ELSE 3 END,u.name`).all(cid);
        const characters = db.prepare("SELECT id,user_id,name,concept,clan,avatar_url,hunger,humanity,health_current,health_max,willpower_current,willpower_max FROM characters WHERE chronicle_id=? AND active=1 ORDER BY name").all(cid);
        const npcs = gm ? db.prepare("SELECT id,name,type,importance,image_url,health,defense,damage FROM npcs WHERE chronicle_id=? ORDER BY name").all(cid) : [];
        const items = db.prepare("SELECT * FROM vtt_items WHERE chronicle_id=? ORDER BY folder,name").all(cid).filter((r) => gm || r.visibility === "all").map(publicItem);
        const journals = db.prepare("SELECT * FROM diary_entries WHERE chronicle_id=? ORDER BY id DESC").all(cid).filter((r) => gm || r.visibility === "all");
        const tables = db.prepare("SELECT * FROM vtt_roll_tables WHERE chronicle_id=? ORDER BY folder,name").all(cid).map(publicTable);
        const decks = db.prepare("SELECT * FROM vtt_card_decks WHERE chronicle_id=? ORDER BY folder,name").all(cid).map(publicDeck);
        const macros = db.prepare("SELECT * FROM vtt_macros WHERE chronicle_id=? AND (user_id=? OR visibility='all') ORDER BY slot IS NULL,slot,id").all(cid,user.id);
        const media = db.prepare("SELECT * FROM media_items WHERE chronicle_id=? ORDER BY category,title").all(cid);
        const cutscenes = db.prepare("SELECT * FROM cutscenes WHERE chronicle_id=? ORDER BY id DESC").all(cid).map(r=>({...r,steps:parse(r.steps_json,[])}));
        const encounters = db.prepare("SELECT * FROM conflicts WHERE chronicle_id=? ORDER BY status='active' DESC,id DESC LIMIT 20").all(cid).map((r) => ({...r, participants:parse(r.participants_json,[])}));
        const world = db.prepare("SELECT * FROM vtt_world_state WHERE chronicle_id=?").get(cid);
        const rolls = filterRolls(cid,user,m);
        sendJson(response,200,{success:true,me:{id:user.id,name:user.name,email:user.email,isAdmin:Boolean(user.isAdmin)},chronicle,role:m.role,canManage:gm,permissions:{canManage:gm,canMoveTokens:m.role!=="spectator",canRoll:m.role!=="spectator",canUseDoors:m.role!=="spectator"},scenes,folders,members,characters,npcs,items,journals,tables,decks,macros,media,cutscenes,encounters,world:{paused:Boolean(world?.paused)},rolls});
        return true;
    }

    // Cena: obter estado completo.
    match = url.pathname.match(/^\/api\/vtt\/scenes\/(\d+)$/);
    if (match && request.method === "GET") {
        const user=auth(request,response); if(!user)return true; const scene=sceneById(Number(match[1])); if(!scene){sendJson(response,404,{success:false,message:"Cena não encontrada."});return true;} const m=member(scene.chronicle_id,user,response);if(!m)return true;if(!sceneAccessible(scene,user,m)){sendJson(response,403,{success:false,message:"Esta cena ainda não foi revelada."});return true;} sendJson(response,200,{success:true,...scenePayload(scene,user,m)}); return true;
    }

    // Cenas VTT: criar/editar/ativar/remover.
    match = url.pathname.match(/^\/api\/vtt\/chronicles\/(\d+)\/scenes$/);
    if (match && request.method === "POST") {
        const user=auth(request,response);if(!user)return true;const cid=Number(match[1]);if(!master(cid,user,response))return true;const b=await readJsonBody(request);const title=txt(b.title,150);if(!title){sendJson(response,400,{success:false,message:"Informe o nome da cena."});return true;}
        const result=db.prepare(`INSERT INTO scenes(chronicle_id,title,description,image_url,narrative_time,weather,music_url,folder_id,position,nav_visible,gm_only,width,height,grid_type,grid_size,grid_units,grid_distance,background_color,foreground_url,darkness,global_illumination,fog_enabled,explorer_enabled,restrict_movement,weather_effect) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(cid,title,txt(b.description,5000),txt(b.imageUrl,1500),txt(b.narrativeTime,100),txt(b.weather,100),txt(b.musicUrl,1500),b.folderId?Number(b.folderId):null,int(b.position,0,99999,0),b.navVisible===false?0:1,bool(b.gmOnly),int(b.width,500,10000,1920),int(b.height,500,10000,1080),["square","hex-row","hex-column","gridless"].includes(b.gridType)?b.gridType:"square",int(b.gridSize,20,300,70),txt(b.gridUnits,20)||"m",num(b.gridDistance,.1,100,1.5),txt(b.backgroundColor,30)||"#09090b",txt(b.foregroundUrl,1500),num(b.darkness,0,1,.45),b.globalIllumination===false?0:1,bool(b.fogEnabled),bool(b.explorerEnabled),b.restrictMovement===false?0:1,txt(b.weatherEffect,40));
        sendJson(response,201,{success:true,id:Number(result.lastInsertRowid)});return true;
    }
    match = url.pathname.match(/^\/api\/vtt\/scenes\/(\d+)$/);
    if (match && request.method === "PATCH") {
        const user=auth(request,response);if(!user)return true;const scene=sceneById(Number(match[1]));if(!scene){sendJson(response,404,{success:false,message:"Cena não encontrada."});return true;}if(!master(scene.chronicle_id,user,response))return true;const b=await readJsonBody(request);
        db.prepare(`UPDATE scenes SET title=?,description=?,image_url=?,narrative_time=?,weather=?,music_url=?,folder_id=?,position=?,nav_visible=?,gm_only=?,width=?,height=?,grid_type=?,grid_size=?,grid_units=?,grid_distance=?,background_color=?,foreground_url=?,darkness=?,global_illumination=?,fog_enabled=?,explorer_enabled=?,restrict_movement=?,weather_effect=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(txt(b.title??scene.title,150),txt(b.description??scene.description,5000),txt(b.imageUrl??scene.image_url,1500),txt(b.narrativeTime??scene.narrative_time,100),txt(b.weather??scene.weather,100),txt(b.musicUrl??scene.music_url,1500),b.folderId===null?null:(b.folderId?Number(b.folderId):scene.folder_id),int(b.position,0,99999,scene.position),b.navVisible==null?scene.nav_visible:bool(b.navVisible),b.gmOnly==null?scene.gm_only:bool(b.gmOnly),int(b.width,500,10000,scene.width),int(b.height,500,10000,scene.height),["square","hex-row","hex-column","gridless"].includes(b.gridType)?b.gridType:scene.grid_type,int(b.gridSize,20,300,scene.grid_size),txt(b.gridUnits??scene.grid_units,20),num(b.gridDistance,.1,100,scene.grid_distance),txt(b.backgroundColor??scene.background_color,30),txt(b.foregroundUrl??scene.foreground_url,1500),num(b.darkness,0,1,scene.darkness),b.globalIllumination==null?scene.global_illumination:bool(b.globalIllumination),b.fogEnabled==null?scene.fog_enabled:bool(b.fogEnabled),b.explorerEnabled==null?scene.explorer_enabled:bool(b.explorerEnabled),b.restrictMovement==null?scene.restrict_movement:bool(b.restrictMovement),txt(b.weatherEffect??scene.weather_effect,40),scene.id);
        sendJson(response,200,{success:true});return true;
    }
    match = url.pathname.match(/^\/api\/vtt\/scenes\/(\d+)\/activate$/);
    if (match && request.method === "POST") {
        const user=auth(request,response);if(!user)return true;const scene=sceneById(Number(match[1]));if(!scene){sendJson(response,404,{success:false,message:"Cena não encontrada."});return true;}if(!master(scene.chronicle_id,user,response))return true;db.exec("BEGIN IMMEDIATE");try{db.prepare("UPDATE scenes SET is_current=0 WHERE chronicle_id=?").run(scene.chronicle_id);db.prepare("UPDATE scenes SET is_current=1,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(scene.id);db.exec("COMMIT");sendJson(response,200,{success:true});}catch(e){db.exec("ROLLBACK");throw e;}return true;
    }
    match = url.pathname.match(/^\/api\/vtt\/scenes\/(\d+)$/);
    if (match && request.method === "DELETE") {
        const user=auth(request,response);if(!user)return true;const scene=sceneById(Number(match[1]));if(!scene){sendJson(response,404,{success:false,message:"Cena não encontrada."});return true;}if(!master(scene.chronicle_id,user,response))return true;db.prepare("DELETE FROM scenes WHERE id=?").run(scene.id);sendJson(response,200,{success:true});return true;
    }

    // Pastas de cena.
    match = url.pathname.match(/^\/api\/vtt\/chronicles\/(\d+)\/scene-folders$/);
    if (match && request.method === "POST") { const user=auth(request,response);if(!user)return true;const cid=Number(match[1]);if(!master(cid,user,response))return true;const b=await readJsonBody(request);const r=db.prepare("INSERT INTO scene_folders(chronicle_id,name,position) VALUES(?,?,?)").run(cid,txt(b.name,100)||"Pasta",int(b.position,0,99999,0));sendJson(response,201,{success:true,id:Number(r.lastInsertRowid)});return true; }
    match = url.pathname.match(/^\/api\/vtt\/scene-folders\/(\d+)$/);
    if (match && request.method === "DELETE") { const user=auth(request,response);if(!user)return true;const f=db.prepare("SELECT * FROM scene_folders WHERE id=?").get(Number(match[1]));if(!f){sendJson(response,404,{success:false,message:"Pasta não encontrada."});return true;}if(!master(f.chronicle_id,user,response))return true;db.prepare("UPDATE scenes SET folder_id=NULL WHERE folder_id=?").run(f.id);db.prepare("DELETE FROM scene_folders WHERE id=?").run(f.id);sendJson(response,200,{success:true});return true; }

    // Placeables no canvas.
    match = url.pathname.match(/^\/api\/vtt\/scenes\/(\d+)\/(tokens|walls|tiles|drawings|lights|sounds|map-notes|regions)$/);
    if (match && request.method === "POST") {
        const user=auth(request,response);if(!user)return true;const scene=sceneById(Number(match[1]));if(!scene){sendJson(response,404,{success:false,message:"Cena não encontrada."});return true;}
        const type=match[2]; const m=member(scene.chronicle_id,user,response);if(!m)return true;const gm=canManage(user,m);
        if(type!=="drawings"&&!gm){sendJson(response,403,{success:false,message:"Somente a equipe de narração pode adicionar este objeto."});return true;}
        if(type==="drawings"&&!gm&&m.role==="spectator"){sendJson(response,403,{success:false,message:"Espectadores não podem desenhar na cena."});return true;}
        const b=await readJsonBody(request);const r=createPlaceable(type,scene,b,user.id);sendJson(response,201,{success:true,id:Number(r.lastInsertRowid)});return true;
    }
    match = url.pathname.match(/^\/api\/vtt\/(tokens|walls|tiles|drawings|lights|sounds|map-notes|regions)\/(\d+)$/);
    if (match && request.method === "PATCH") {
        const user=auth(request,response);if(!user)return true;const type=match[1];const row=placeableRow(type,Number(match[2]));if(!row){sendJson(response,404,{success:false,message:"Objeto não encontrado."});return true;}const m=member(row.chronicle_id,user,response);if(!m)return true;const gm=canManage(user,m);const body=await readJsonBody(request);
        if(type==="tokens"&&!gm){const world=db.prepare("SELECT paused FROM vtt_world_state WHERE chronicle_id=?").get(row.chronicle_id);if(world?.paused){sendJson(response,409,{success:false,message:"A mesa está pausada."});return true;}if(m.role==="spectator"||row.owner_user_id!==user.id||row.locked){sendJson(response,403,{success:false,message:"Você não controla este token."});return true;}if(serverMovementBlocked(row,body)){sendJson(response,409,{success:false,message:"Uma parede bloqueia este movimento."});return true;}patchPlaceable(type,row,body,true);sendJson(response,200,{success:true});return true;}
        if(!gm){sendJson(response,403,{success:false,message:"Somente a equipe de narração pode editar este objeto."});return true;}patchPlaceable(type,row,body,false);sendJson(response,200,{success:true});return true;
    }
    if (match && request.method === "DELETE") {
        const user=auth(request,response);if(!user)return true;const type=match[1];const row=placeableRow(type,Number(match[2]));if(!row){sendJson(response,404,{success:false,message:"Objeto não encontrado."});return true;}
        const m=member(row.chronicle_id,user,response);if(!m)return true;const gm=canManage(user,m);
        if(!gm && !(type==="drawings" && row.author_user_id===user.id)){sendJson(response,403,{success:false,message:"Você só pode apagar as suas próprias marcações."});return true;}
        db.prepare(`DELETE FROM ${PLACEABLES[type].table} WHERE id=?`).run(row.id);sendJson(response,200,{success:true});return true;
    }

    // Porta: jogadores podem abrir portas normais, mas não secretas/trancadas.
    match = url.pathname.match(/^\/api\/vtt\/walls\/(\d+)\/toggle$/);
    if (match && request.method === "POST") {
        const user=auth(request,response);if(!user)return true;const wall=db.prepare("SELECT * FROM vtt_walls WHERE id=?").get(Number(match[1]));if(!wall){sendJson(response,404,{success:false,message:"Porta não encontrada."});return true;}const m=member(wall.chronicle_id,user,response);if(!m)return true;const gm=canManage(user,m);if(wall.wall_type==="wall"||(!gm&&wall.wall_type==="secret")){sendJson(response,403,{success:false,message:"Você não pode manipular esta passagem."});return true;}if(!gm&&wall.door_state==="locked"){sendJson(response,409,{success:false,message:"A porta está trancada."});return true;}const next=wall.door_state==="open"?"closed":"open";db.prepare("UPDATE vtt_walls SET door_state=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(next,wall.id);sendJson(response,200,{success:true,doorState:next});return true;
    }

    // Fog / Explorer.
    match = url.pathname.match(/^\/api\/vtt\/scenes\/(\d+)\/fog$/);
    if (match && request.method === "PUT") {
        const user=auth(request,response);if(!user)return true;const scene=sceneById(Number(match[1]));if(!scene){sendJson(response,404,{success:false,message:"Cena não encontrada."});return true;}const m=member(scene.chronicle_id,user,response);if(!m)return true;const b=await readJsonBody(request);const target=b.scope==="user"?user.id:0;if(target===0&&!canManage(user,m)){sendJson(response,403,{success:false,message:"Somente o Mestre altera o Fog global."});return true;}db.prepare(`INSERT INTO vtt_fog(scene_id,user_id,revealed_json,explored_json,updated_at) VALUES(?,?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(scene_id,user_id) DO UPDATE SET revealed_json=excluded.revealed_json,explored_json=excluded.explored_json,updated_at=CURRENT_TIMESTAMP`).run(scene.id,target,json(Array.isArray(b.revealed)?b.revealed:[],[]),json(Array.isArray(b.explored)?b.explored:[],[]));sendJson(response,200,{success:true});return true;
    }

    // Presença, cursores remotos e pings.
    match = url.pathname.match(/^\/api\/vtt\/chronicles\/(\d+)\/presence$/);
    if (match && request.method === "POST") { const user=auth(request,response);if(!user)return true;const cid=Number(match[1]);if(!member(cid,user,response))return true;const b=await readJsonBody(request);db.prepare(`INSERT INTO presence(chronicle_id,user_id,last_seen,scene_id,cursor_x,cursor_y) VALUES(?,?,CURRENT_TIMESTAMP,?,?,?) ON CONFLICT(chronicle_id,user_id) DO UPDATE SET last_seen=CURRENT_TIMESTAMP,scene_id=excluded.scene_id,cursor_x=excluded.cursor_x,cursor_y=excluded.cursor_y`).run(cid,user.id,b.sceneId?Number(b.sceneId):null,b.cursorX==null?null:num(b.cursorX,-100000,100000,0),b.cursorY==null?null:num(b.cursorY,-100000,100000,0));sendJson(response,200,{success:true});return true; }
    match = url.pathname.match(/^\/api\/vtt\/scenes\/(\d+)\/pings$/);
    if (match && request.method === "POST") { const user=auth(request,response);if(!user)return true;const scene=sceneById(Number(match[1]));if(!scene){sendJson(response,404,{success:false,message:"Cena não encontrada."});return true;}if(!member(scene.chronicle_id,user,response))return true;const b=await readJsonBody(request);const r=db.prepare("INSERT INTO vtt_pings(chronicle_id,scene_id,user_id,x,y,ping_type,label) VALUES(?,?,?,?,?,?,?)").run(scene.chronicle_id,scene.id,user.id,num(b.x,-100000,100000,0),num(b.y,-100000,100000,0),["ping","focus","fx"].includes(b.pingType)?b.pingType:"ping",txt(b.label,100));sendJson(response,201,{success:true,id:Number(r.lastInsertRowid)});return true; }
    match = url.pathname.match(/^\/api\/vtt\/pings\/(\d+)$/);
    if (match && request.method === "DELETE") { const user=auth(request,response);if(!user)return true;const ping=db.prepare("SELECT * FROM vtt_pings WHERE id=?").get(Number(match[1]));if(!ping){sendJson(response,404,{success:false,message:"Ping não encontrado."});return true;}const m=member(ping.chronicle_id,user,response);if(!m)return true;if(!canManage(user,m)&&ping.user_id!==user.id){sendJson(response,403,{success:false,message:"Você só pode apagar seus próprios pings."});return true;}db.prepare("DELETE FROM vtt_pings WHERE id=?").run(ping.id);sendJson(response,200,{success:true});return true; }

    match = url.pathname.match(/^\/api\/vtt\/scenes\/(\d+)\/clear-markings$/);
    if (match && request.method === "POST") { const user=auth(request,response);if(!user)return true;const scene=sceneById(Number(match[1]));if(!scene){sendJson(response,404,{success:false,message:"Cena não encontrada."});return true;}if(!master(scene.chronicle_id,user,response))return true;db.exec("BEGIN IMMEDIATE");try{for(const table of ["vtt_drawings","vtt_walls","vtt_map_notes","vtt_regions","vtt_pings"]){db.prepare(`DELETE FROM ${table} WHERE scene_id=?`).run(scene.id);}db.exec("COMMIT");sendJson(response,200,{success:true});return true;}catch(error){db.exec("ROLLBACK");throw error;} }

    // Pausa da mesa.
    match = url.pathname.match(/^\/api\/vtt\/chronicles\/(\d+)\/pause$/);
    if (match && request.method === "POST") { const user=auth(request,response);if(!user)return true;const cid=Number(match[1]);if(!master(cid,user,response))return true;const b=await readJsonBody(request);db.prepare(`INSERT INTO vtt_world_state(chronicle_id,paused,paused_by_user_id,updated_at) VALUES(?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(chronicle_id) DO UPDATE SET paused=excluded.paused,paused_by_user_id=excluded.paused_by_user_id,updated_at=CURRENT_TIMESTAMP`).run(cid,bool(b.paused),user.id);sendJson(response,200,{success:true,paused:Boolean(b.paused)});return true; }

    // Items do mundo.
    match = url.pathname.match(/^\/api\/vtt\/chronicles\/(\d+)\/items$/);
    if (match && request.method === "POST") { const user=auth(request,response);if(!user)return true;const cid=Number(match[1]);if(!master(cid,user,response))return true;const b=await readJsonBody(request);const r=db.prepare("INSERT INTO vtt_items(chronicle_id,name,item_type,description,image_url,data_json,folder,visibility) VALUES(?,?,?,?,?,?,?,?)").run(cid,txt(b.name,150)||"Item",txt(b.itemType,60)||"item",txt(b.description,10000),txt(b.imageUrl,1500),json(b.data||{},{}),txt(b.folder,100),b.visibility==="master"?"master":"all");sendJson(response,201,{success:true,id:Number(r.lastInsertRowid)});return true; }
    match = url.pathname.match(/^\/api\/vtt\/items\/(\d+)$/);
    if (match && ["PATCH","DELETE"].includes(request.method)) { const user=auth(request,response);if(!user)return true;const row=db.prepare("SELECT * FROM vtt_items WHERE id=?").get(Number(match[1]));if(!row){sendJson(response,404,{success:false,message:"Item não encontrado."});return true;}if(!master(row.chronicle_id,user,response))return true;if(request.method==="DELETE"){db.prepare("DELETE FROM vtt_items WHERE id=?").run(row.id);sendJson(response,200,{success:true});return true;}const b=await readJsonBody(request);db.prepare("UPDATE vtt_items SET name=?,item_type=?,description=?,image_url=?,data_json=?,folder=?,visibility=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(txt(b.name??row.name,150),txt(b.itemType??row.item_type,60),txt(b.description??row.description,10000),txt(b.imageUrl??row.image_url,1500),b.data?json(b.data,{}):row.data_json,txt(b.folder??row.folder,100),b.visibility==="master"?"master":(b.visibility==="all"?"all":row.visibility),row.id);sendJson(response,200,{success:true});return true; }

    // Rollable Tables.
    match = url.pathname.match(/^\/api\/vtt\/chronicles\/(\d+)\/tables$/);
    if (match && request.method === "POST") { const user=auth(request,response);if(!user)return true;const cid=Number(match[1]);if(!master(cid,user,response))return true;const b=await readJsonBody(request);const r=db.prepare("INSERT INTO vtt_roll_tables(chronicle_id,name,formula,entries_json,folder) VALUES(?,?,?,?,?)").run(cid,txt(b.name,150)||"Tabela",txt(b.formula,30)||"1d10",json(Array.isArray(b.entries)?b.entries:[],[]),txt(b.folder,100));sendJson(response,201,{success:true,id:Number(r.lastInsertRowid)});return true; }
    match = url.pathname.match(/^\/api\/vtt\/tables\/(\d+)\/roll$/);
    if (match && request.method === "POST") { const user=auth(request,response);if(!user)return true;const row=db.prepare("SELECT * FROM vtt_roll_tables WHERE id=?").get(Number(match[1]));if(!row){sendJson(response,404,{success:false,message:"Tabela não encontrada."});return true;}const m=member(row.chronicle_id,user,response);if(!m)return true;const b=await readJsonBody(request);const secret=Boolean(b.secret)&&canManage(user,m);const rolled=randomFormula(row.formula);const entries=parse(row.entries_json,[]);let result=entries.find((e)=>rolled.total>=Number(e.min??e.value??0)&&rolled.total<=Number(e.max??e.value??0));if(!result&&entries.length)result=entries[Math.floor(Math.random()*entries.length)];const content=`Tabela ${row.name}: ${result?.text??result?.label??"Sem resultado"} (${rolled.total})`;if(!secret)db.prepare("INSERT INTO messages(chronicle_id,sender_user_id,channel,content) VALUES(?,?,'rolls',?)").run(row.chronicle_id,user.id,content);sendJson(response,200,{success:true,roll:rolled,result:result??null,secret});return true; }
    match = url.pathname.match(/^\/api\/vtt\/tables\/(\d+)$/);
    if (match && request.method === "DELETE") { const user=auth(request,response);if(!user)return true;const row=db.prepare("SELECT * FROM vtt_roll_tables WHERE id=?").get(Number(match[1]));if(!row){sendJson(response,404,{success:false,message:"Tabela não encontrada."});return true;}if(!master(row.chronicle_id,user,response))return true;db.prepare("DELETE FROM vtt_roll_tables WHERE id=?").run(row.id);sendJson(response,200,{success:true});return true; }

    // Cards / Decks.
    match = url.pathname.match(/^\/api\/vtt\/chronicles\/(\d+)\/decks$/);
    if (match && request.method === "POST") { const user=auth(request,response);if(!user)return true;const cid=Number(match[1]);if(!master(cid,user,response))return true;const b=await readJsonBody(request);const cards=Array.isArray(b.cards)?b.cards:[];const r=db.prepare("INSERT INTO vtt_card_decks(chronicle_id,name,cards_json,discard_json,folder) VALUES(?,?,?,?,?)").run(cid,txt(b.name,150)||"Baralho",json(cards,[]),"[]",txt(b.folder,100));sendJson(response,201,{success:true,id:Number(r.lastInsertRowid)});return true; }
    match = url.pathname.match(/^\/api\/vtt\/decks\/(\d+)\/(draw|shuffle|reset)$/);
    if (match && request.method === "POST") { const user=auth(request,response);if(!user)return true;const row=db.prepare("SELECT * FROM vtt_card_decks WHERE id=?").get(Number(match[1]));if(!row){sendJson(response,404,{success:false,message:"Baralho não encontrado."});return true;}if(!member(row.chronicle_id,user,response))return true;let cards=parse(row.cards_json,[]),discard=parse(row.discard_json,[]);if(match[2]==="draw"){if(!cards.length){sendJson(response,409,{success:false,message:"O baralho está vazio."});return true;}const card=cards.shift();discard.push(card);db.prepare("UPDATE vtt_card_decks SET cards_json=?,discard_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(json(cards,[]),json(discard,[]),row.id);sendJson(response,200,{success:true,card,remaining:cards.length});return true;}if(!master(row.chronicle_id,user,response))return true;if(match[2]==="reset"){cards=[...cards,...discard];discard=[];}for(let i=cards.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[cards[i],cards[j]]=[cards[j],cards[i]];}db.prepare("UPDATE vtt_card_decks SET cards_json=?,discard_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(json(cards,[]),json(discard,[]),row.id);sendJson(response,200,{success:true,remaining:cards.length});return true; }
    match = url.pathname.match(/^\/api\/vtt\/decks\/(\d+)$/);
    if (match && request.method === "DELETE") { const user=auth(request,response);if(!user)return true;const row=db.prepare("SELECT * FROM vtt_card_decks WHERE id=?").get(Number(match[1]));if(!row){sendJson(response,404,{success:false,message:"Baralho não encontrado."});return true;}if(!master(row.chronicle_id,user,response))return true;db.prepare("DELETE FROM vtt_card_decks WHERE id=?").run(row.id);sendJson(response,200,{success:true});return true; }

    // Macros / hotbar.
    match = url.pathname.match(/^\/api\/vtt\/chronicles\/(\d+)\/macros$/);
    if (match && request.method === "POST") { const user=auth(request,response);if(!user)return true;const cid=Number(match[1]);if(!member(cid,user,response))return true;const b=await readJsonBody(request);const r=db.prepare("INSERT INTO vtt_macros(chronicle_id,user_id,name,command,icon,slot,visibility) VALUES(?,?,?,?,?,?,?)").run(cid,user.id,txt(b.name,100)||"Macro",txt(b.command,1000),txt(b.icon,10)||"◆",b.slot==null?null:int(b.slot,0,9,0),b.visibility==="all"?"all":"private");sendJson(response,201,{success:true,id:Number(r.lastInsertRowid)});return true; }
    match = url.pathname.match(/^\/api\/vtt\/macros\/(\d+)$/);
    if (match && ["PATCH","DELETE"].includes(request.method)) { const user=auth(request,response);if(!user)return true;const row=db.prepare("SELECT * FROM vtt_macros WHERE id=?").get(Number(match[1]));if(!row){sendJson(response,404,{success:false,message:"Macro não encontrada."});return true;}const m=member(row.chronicle_id,user,response);if(!m)return true;if(row.user_id!==user.id&&!canManage(user,m)){sendJson(response,403,{success:false,message:"Esta macro não pertence a você."});return true;}if(request.method==="DELETE"){db.prepare("DELETE FROM vtt_macros WHERE id=?").run(row.id);sendJson(response,200,{success:true});return true;}const b=await readJsonBody(request);db.prepare("UPDATE vtt_macros SET name=?,command=?,icon=?,slot=?,visibility=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(txt(b.name??row.name,100),txt(b.command??row.command,1000),txt(b.icon??row.icon,10),b.slot===null?null:(b.slot==null?row.slot:int(b.slot,0,9,0)),b.visibility==="all"?"all":(b.visibility==="private"?"private":row.visibility),row.id);sendJson(response,200,{success:true});return true; }

    // Rolagem V5 com suporte a segredo real no servidor.
    match = url.pathname.match(/^\/api\/vtt\/chronicles\/(\d+)\/rolls$/);
    if (match && request.method === "GET") { const user=auth(request,response);if(!user)return true;const cid=Number(match[1]);const m=member(cid,user,response);if(!m)return true;sendJson(response,200,{success:true,rolls:filterRolls(cid,user,m)});return true; }
    if (match && request.method === "POST") { const user=auth(request,response);if(!user)return true;const cid=Number(match[1]);const m=member(cid,user,response);if(!m)return true;if(m.role==="spectator"&&!user.isAdmin){sendJson(response,403,{success:false,message:"Espectadores não podem rolar."});return true;}const b=await readJsonBody(request);const secret=Boolean(b.secret)&&canManage(user,m);let character=null;if(b.characterId){character=db.prepare("SELECT * FROM characters WHERE id=? AND chronicle_id=?").get(Number(b.characterId),cid);if(!character){sendJson(response,404,{success:false,message:"Personagem não encontrado."});return true;}if(!canManage(user,m)&&character.user_id!==user.id){sendJson(response,403,{success:false,message:"Você só pode rolar pelo seu personagem."});return true;}}let pool=int(b.pool,1,50,1),hunger=int(b.hunger,0,5,0);if(character){hunger=character.hunger;}const modifier=int(b.modifier,-20,20,0);pool=Math.max(1,pool+modifier);const difficulty=b.difficulty==null?null:int(b.difficulty,1,20,1);const rolled=v5Roll(pool,hunger);const r=db.prepare(`INSERT INTO rolls(chronicle_id,character_id,user_id,attribute_name,skill_name,pool,hunger,modifier,difficulty,normal_dice_json,hunger_dice_json,successes,result_type,is_secret) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(cid,character?.id??null,user.id,txt(b.attributeName,80),txt(b.skillName,80),pool,hunger,modifier,difficulty,json(rolled.normalDice,[]),json(rolled.hungerDice,[]),rolled.successes,rolled.resultType,bool(secret));if(!secret){const who=character?.name??user.name;db.prepare("INSERT INTO messages(chronicle_id,sender_user_id,channel,content) VALUES(?,?,'rolls',?)").run(cid,user.id,`${who} realizou um teste: ${rolled.successes} sucesso(s) — ${rolled.resultType}.`);}sendJson(response,201,{success:true,roll:{id:Number(r.lastInsertRowid),pool,hunger,difficulty,is_secret:secret,...rolled}});return true; }

    sendJson(response,404,{success:false,message:"Rota VTT não encontrada."});
    return true;
}
