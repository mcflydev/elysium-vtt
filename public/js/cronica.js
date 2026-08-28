import { apiRequest, ApiError, uploadLocalFile } from "./api.js";

const params = new URLSearchParams(location.search);
const chronicleId = Number(params.get("id"));
if (!chronicleId) location.href = "/pages/cronicas.html";

const state = {
    me: null,
    chronicle: null,
    role: null,
    canManage: false,
    members: [],
    characters: [],
    scenes: [],
    notes: [],
    live: null,
    lastMessageId: 0,
    lastSeenRollId: null,
    currentRequestId: null,
    rollRequests: [],
    conflicts: [],
    maps: [],
    liveMediaId: null
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const escapeHtml = (value) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]));
const text = (selector, value) => { const el=$(selector); if(el) el.textContent = value ?? ""; };
const val = (selector) => $(selector)?.value ?? "";
const numberVal = (selector, fallback = 0) => Number(val(selector)) || fallback;

function toast(message) {
    const el = $("#toast");
    el.textContent = message;
    el.hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => { el.hidden = true; }, 2600);
}

function roleLabel(role) {
    return ({owner:"Dono / Mestre",master:"Mestre","co-master":"Co-Mestre",player:"Jogador",spectator:"Espectador"})[role] ?? role;
}
function statusLabel(status) {
    return ({active:"Em andamento",paused:"Pausada",finished:"Encerrada"})[status] ?? status;
}
function resultLabel(type) {
    return ({success:"Sucesso",failure:"Falha",critical:"Sucesso crítico",messy_critical:"Crítico Bestial",bestial_failure:"Falha Bestial"})[type] ?? type;
}
function fmtDate(raw) {
    if (!raw) return "";
    const normalized = raw.includes("T") ? raw : raw.replace(" ", "T") + "Z";
    const date = new Date(normalized);
    return Number.isNaN(date.getTime()) ? raw : new Intl.DateTimeFormat("pt-BR", { dateStyle:"short", timeStyle:"short" }).format(date);
}
function masterOnlyVisibility() {
    $$(".master-only").forEach((el) => el.hidden = !state.canManage);
    $$(".owner-only").forEach((el) => el.hidden = !(state.role === "owner" || state.me?.isAdmin));
    $$(".admin-only").forEach((el) => el.hidden = !state.me?.isAdmin);
}
function handleAuth(error) {
    if (error instanceof ApiError && error.status === 401) {
        location.href = "/pages/login.html";
        return true;
    }
    return false;
}
async function request(path, options) {
    try { return await apiRequest(path, options); }
    catch (error) {
        if (handleAuth(error)) throw error;
        toast(error instanceof ApiError ? error.message : "Não foi possível concluir a operação.");
        throw error;
    }
}

// ---------- NAVEGAÇÃO ----------
function activateTab(name) {
    document.body.classList.toggle("room-mode", name === "room");
    $$(".nav-button[data-tab]").forEach((button) => button.classList.toggle("active", button.dataset.tab === name));
    $$(".page-section").forEach((section) => section.classList.toggle("active", section.id === `tab-${name}`));
    $("#sidebar").classList.remove("open");
    const labels = {
        overview:["Visão Geral","Configuração, mesa e identidade da Crônica."], room:["Sala da Crônica","A cena atual é o centro da sessão."], characters:["Personagens","Coterie e fichas V5."], rolls:["Rolagens","Testes V5, Fome e histórico."], director:["Diretor da Crônica","Controle o ritmo e os acontecimentos da sessão."], notes:["Notas & Segredos","Informação pública, seletiva e privada."], diary:["Diário","O registro vivo da Crônica."], npcs:["NPC Engine","Elenco e antagonistas da história."], media:["Música & Ambiente","Trilha e atmosfera da sessão."], cutscenes:["Cutscenes & Eventos","Momentos narrativos para toda a mesa."], story:["Atos & Timeline","Estruture temporadas, episódios e acontecimentos."], maps:["Mapas","Cenários narrativos e táticos."], conflicts:["Conflitos","Ordem de ação, rodadas e condições narrativas."], clocks:["Relógios","Ameaças, tensão e consequências."], chat:["Chat","Conversa, notas e sussurros."]
    };
    const [title, subtitle] = labels[name] ?? ["Crônica",""];
    text("#page-title", title); text("#page-subtitle", subtitle);
}
$$(".nav-button[data-tab]").forEach((button) => button.addEventListener("click", () => activateTab(button.dataset.tab)));
$("#open-vtt")?.addEventListener("click", () => { window.location.href = `/pages/vtt.html?id=${chronicleId}`; });
$("#mobile-nav").addEventListener("click", () => $("#sidebar").classList.toggle("open"));
$("#refresh-button").addEventListener("click", () => loadAll(true));

// ---------- VISÃO GERAL ----------
function renderChronicle() {
    const c = state.chronicle;
    text("#sidebar-title", c.name); text("#sidebar-role", roleLabel(state.role));
    text("#room-chronicle-name", c.name);
    text("#chronicle-title", c.name);
    text("#chronicle-description", c.description || "Nenhuma descrição registrada.");
    text("#chronicle-meta", [c.city, c.period, c.style, statusLabel(c.status)].filter(Boolean).join(" • "));
    const hero = $("#chronicle-hero");
    hero.style.backgroundImage = c.banner_url ? `url("${c.banner_url.replaceAll('"','%22')}")` : "";
    $("#transmission-link").href = `/pages/transmissao.html?id=${chronicleId}`;
    $("#edit-name").value = c.name; $("#edit-subtitle").value = c.subtitle || ""; $("#edit-city").value = c.city || "";
    $("#edit-period").value = c.period || ""; $("#edit-style").value = c.style || "";
    $("#edit-description").value = c.description || ""; $("#edit-status").value = c.status;
}
function renderMembers() {
    const html = state.members.map((member) => `
        <div class="list-item"><div class="list-item-main"><h4>${escapeHtml(member.name)}</h4><p>${escapeHtml(member.email)}</p></div><div class="list-actions"><span class="tag ${member.is_online?'success':''}">${member.is_online?'Online':'Offline'}</span><span class="tag ${member.role === 'owner' ? 'wine':''}">${escapeHtml(roleLabel(member.role))}</span></div></div>
    `).join("") || `<div class="empty">Nenhum participante.</div>`;
    $("#member-list").innerHTML = html;
    $("#char-user").innerHTML = state.members.filter(m=>m.role!=="spectator").map(m=>`<option value="${m.id}">${escapeHtml(m.name)} — ${escapeHtml(roleLabel(m.role))}</option>`).join("");
    $("#request-user").innerHTML = state.members.filter(m=>m.role==="player"||m.role==="co-master"||m.role==="master"||m.role==="owner").map(m=>`<option value="${m.id}">${escapeHtml(m.name)}</option>`).join("");
    $("#note-recipients").innerHTML = state.members.filter(m=>m.id!==state.me.id).map(m=>`<option value="${m.id}">${escapeHtml(m.name)}</option>`).join("");
    $("#chat-recipient").innerHTML = state.members.filter(m=>m.id!==state.me.id).map(m=>`<option value="${m.id}">${escapeHtml(m.name)}</option>`).join("");
    const roomRecipient=$("#room-chat-recipient");
    if(roomRecipient) roomRecipient.innerHTML = state.members.filter(m=>m.id!==state.me.id).map(m=>`<option value="${m.id}">${escapeHtml(m.name)}</option>`).join("");
    const onlineCount=state.members.filter(m=>m.is_online).length;
    text("#room-online-count", `${onlineCount} online${onlineCount===1?"":"s"}`);
    const onlineList=$("#room-online-list");
    if(onlineList) onlineList.innerHTML=state.members.map(m=>`<div class="room-online-member"><div><strong>${escapeHtml(m.name)}</strong><small>${escapeHtml(roleLabel(m.role))}</small></div><span class="room-online-dot ${m.is_online?'online':''}" title="${m.is_online?'Online':'Offline'}"></span></div>`).join("");
    if (state.canManage) renderDirectorMembers();
}
$("#invite-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = await request(`/api/chronicles/${chronicleId}/invitations`, { method:"POST", body:JSON.stringify({ role:val("#invite-role") }) });
    text("#invite-result", `Código: ${data.code} — válido por 7 dias. Compartilhe apenas com quem deve entrar na mesa.`);
});
$("#chronicle-edit-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    let bannerUrl = state.chronicle?.banner_url || "";
    const bannerFile = $("#edit-banner")?.files?.[0];
    if (bannerFile) bannerUrl = (await uploadLocalFile(bannerFile, "image")).url;
    await request(`/api/chronicles/${chronicleId}`, { method:"PATCH", body:JSON.stringify({
        name:val("#edit-name"), subtitle:val("#edit-subtitle"), city:val("#edit-city"), period:val("#edit-period"), style:val("#edit-style"), bannerUrl, description:val("#edit-description"), status:val("#edit-status")
    }) });
    event.currentTarget.reset();
    toast("Crônica atualizada."); await loadChronicle();
});
$("#delete-chronicle").addEventListener("click", async () => {
    if (!confirm(`Excluir a Crônica "${state.chronicle.name}"?\n\nTodos os personagens, notas, rolagens e registros associados serão apagados.`)) return;
    await request(`/api/chronicles/${chronicleId}`, { method:"DELETE" });
    location.href = "/pages/cronicas.html";
});

// ---------- PERSONAGENS ----------
function renderCharacters() {
    const grid = $("#character-grid");
    grid.innerHTML = state.characters.map((c) => `
        <article class="card"><div class="card-header"><div><p class="eyebrow">${escapeHtml(c.clan || "Sem clã")}</p><h3>${escapeHtml(c.name)}</h3></div><span class="tag">Fome ${c.hunger}</span></div><p>${escapeHtml(c.concept || "Conceito não definido")}</p><p style="margin-top:.5rem">Jogador: ${escapeHtml(c.player_name || "—")}</p><div class="form-actions"><a class="button-ghost" href="/pages/personagem.html?id=${c.id}">Abrir ficha</a></div></article>
    `).join("") || `<div class="empty">Nenhum personagem criado.</div>`;
    const options = state.characters.map(c=>`<option value="${c.id}">${escapeHtml(c.name)} — ${escapeHtml(c.player_name || "")}</option>`).join("");
    $("#roll-character").innerHTML = options || `<option value="">Nenhum personagem</option>`;
    $("#request-character").innerHTML = `<option value="">Automático pelo jogador</option>` + options;
}
$("#character-create-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const submittedForm = event.currentTarget;
    const body = { name:val("#char-name"), concept:val("#char-concept"), clan:val("#char-clan"), predator:val("#char-predator") };
    if (state.canManage) body.userId = Number(val("#char-user"));
    const data = await request(`/api/chronicles/${chronicleId}/characters`, { method:"POST", body:JSON.stringify(body) });
    submittedForm.reset(); toast("Personagem criado."); await loadCharacters();
    location.href = `/pages/personagem.html?id=${data.characterId}`;
});

// ---------- ROLAGENS ----------
const ATTRIBUTES = {forca:"Força",destreza:"Destreza",vigor:"Vigor",carisma:"Carisma",manipulacao:"Manipulação",autocontrole:"Autocontrole",inteligencia:"Inteligência",raciocinio:"Raciocínio",determinacao:"Determinação"};
const SKILLS = {atletismo:"Atletismo",briga:"Briga",conducao:"Condução",armas_de_fogo:"Armas de Fogo",furtividade:"Furtividade",ladinagem:"Ladinagem",sobrevivencia:"Sobrevivência",armas_brancas:"Armas Brancas",oficios:"Ofícios",empatia:"Empatia",etiqueta:"Etiqueta",intimidacao:"Intimidação",lideranca:"Liderança",manha:"Manha",performance:"Performance",persuasao:"Persuasão",sagacidade:"Sagacidade",subterfugio:"Subterfúgio",ciencia:"Ciência",erudicao:"Erudição",financas:"Finanças",investigacao:"Investigação",medicina:"Medicina",ocultismo:"Ocultismo",politica:"Política",tecnologia:"Tecnologia"};
$("#roll-attribute").innerHTML = Object.entries(ATTRIBUTES).map(([k,v])=>`<option value="${k}">${v}</option>`).join("");
$("#roll-skill").insertAdjacentHTML("beforeend", Object.entries(SKILLS).map(([k,v])=>`<option value="${k}">${v}</option>`).join(""));
$("#request-attribute").innerHTML = Object.entries(ATTRIBUTES).map(([k,v])=>`<option value="${k}">${v}</option>`).join("");
$("#request-skill").insertAdjacentHTML("beforeend", Object.entries(SKILLS).map(([k,v])=>`<option value="${k}">${v}</option>`).join(""));
function diceHtml(values, hunger=false) { return values.map((die,i)=>`<span class="die ${hunger?'hunger':''}" style="animation-delay:${i*35}ms">${die}</span>`).join(""); }
function renderRollResult(roll) {
    $("#roll-result").innerHTML = `<div class="dice-result"><p class="eyebrow">Resultado</p><h3 class="result-title ${roll.resultType}">${escapeHtml(resultLabel(roll.resultType))} — ${roll.successes} sucesso(s)</h3><div class="dice-row">${diceHtml(roll.normalDice)}${diceHtml(roll.hungerDice,true)}</div><p>Pool ${roll.pool} • Fome ${roll.hunger}${roll.difficulty ? ` • Dificuldade ${roll.difficulty}` : ""}</p></div>`;
}
function renderRollHistory(rolls) {
    $("#roll-history").innerHTML = rolls.map(r=>`<div class="list-item"><div class="list-item-main"><h4>${escapeHtml(r.character_name || r.user_name)} — ${escapeHtml(ATTRIBUTES[r.attribute_name]||r.attribute_name)}${r.skill_name?` + ${escapeHtml(SKILLS[r.skill_name]||r.skill_name)}`:""}</h4><p>${escapeHtml(resultLabel(r.result_type))} • ${r.successes} sucesso(s) • ${fmtDate(r.created_at)}</p></div><span class="tag ${['messy_critical','bestial_failure'].includes(r.result_type)?'wine':''}">${r.pool}d10</span></div>`).join("") || `<div class="empty">Nenhuma rolagem registrada.</div>`;
}
$("#roll-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!val("#roll-character")) return toast("Crie ou selecione um personagem primeiro.");
    const difficultyText=val("#roll-difficulty");
    const data=await request(`/api/chronicles/${chronicleId}/rolls`,{method:"POST",body:JSON.stringify({characterId:Number(val("#roll-character")),attributeName:val("#roll-attribute"),skillName:val("#roll-skill"),modifier:numberVal("#roll-modifier"),difficulty:difficultyText?Number(difficultyText):null,requestId:state.currentRequestId})});
    state.currentRequestId=null; renderRollResult(data.roll); await loadRolls(); await loadRollRequests(); await loadLive();
});

// ---------- SALA / LIVE ----------
function youtubeEmbedUrl(url) {
    try {
        const parsed = new URL(url);
        if (parsed.hostname.includes("youtu.be")) return `https://www.youtube.com/embed/${parsed.pathname.slice(1)}?controls=1`;
        if (parsed.hostname.includes("youtube.com")) { const id = parsed.searchParams.get("v"); if (id) return `https://www.youtube.com/embed/${id}?controls=1`; }
    } catch {}
    return null;
}
function showRollAnimation(roll) {
    const panel=document.createElement("div");panel.className="toast";panel.style.maxWidth="520px";panel.style.bottom="1rem";panel.style.right="1rem";panel.innerHTML=`<p class="eyebrow">${escapeHtml(roll.character_name||"Jogador")} realizou um teste</p><h3 class="result-title ${roll.result_type}">${escapeHtml(resultLabel(roll.result_type))} — ${roll.successes} sucesso(s)</h3><div class="dice-row">${diceHtml(roll.normalDice||[])}${diceHtml(roll.hungerDice||[],true)}</div>`;document.body.append(panel);setTimeout(()=>panel.remove(),4300);
}
function renderLive() {
    const live=state.live||{}; const scene=live.scene;
    const display=$("#scene-display");
    if(scene){ display.style.backgroundImage=scene.image_url?`url("${scene.image_url.replaceAll('"','%22')}")`:""; text("#room-scene-title",scene.title);text("#room-scene-meta",[scene.narrative_time,scene.weather].filter(Boolean).join(" • "));text("#room-scene-description",scene.description||"");text("#room-current-scene-label",scene.title.toUpperCase()); }
    else { display.style.backgroundImage=""; text("#room-scene-title","Nenhuma cena ativa");text("#room-scene-meta","");text("#room-scene-description","O Mestre ainda não abriu uma cena.");text("#room-current-scene-label","AGUARDANDO CENA"); }
    text("#live-media-title",live.media?.title||"Sem mídia ativa"); text("#live-media-url",live.media?.url||"");
    text("#room-audio-now-title",live.media?.title||"Nenhuma mídia ativa"); text("#room-audio-now-url",live.media?.url||"");
    if (live.media?.id !== state.liveMediaId) {
        state.liveMediaId=live.media?.id??null; const player=$("#live-media-player"); player.innerHTML=""; player.hidden=true;
        if(live.media?.url){const embed=youtubeEmbedUrl(live.media.url);if(embed)player.innerHTML=`<iframe title="Música da cena" src="${escapeHtml(embed)}" style="width:100%;aspect-ratio:16/9;border:0;border-radius:7px" allow="autoplay; encrypted-media" allowfullscreen></iframe>`;else player.innerHTML=`<a class="button-ghost" target="_blank" href="${escapeHtml(live.media.url)}">Abrir mídia</a>`;}
    }
    text("#live-event-title",live.event?.title||"Sem evento ativo"); text("#live-event-copy",live.event?.content||"");
    if(live.recentRoll) {
        $("#live-roll-summary").innerHTML=`<h3>${escapeHtml(live.recentRoll.character_name||"Teste")}</h3><p>${escapeHtml(resultLabel(live.recentRoll.result_type))} • ${live.recentRoll.successes} sucesso(s)</p>`;
        if(state.lastSeenRollId===null) state.lastSeenRollId=live.recentRoll.id;
        else if(live.recentRoll.id!==state.lastSeenRollId){state.lastSeenRollId=live.recentRoll.id;showRollAnimation(live.recentRoll);}
    }
    if(live.cutscene?.playbackState === "playing" || live.cutscene?.playback_state === "playing") showCutscene(live.cutscene);
    else hideCutscene();
}
function hideCutscene(){
    const overlay=$("#cutscene-overlay");
    const video=$("#legacy-cutscene-video");
    if(video) video.pause();
    if(overlay) overlay.hidden=true;
}
function showCutscene(cutscene) {
    const overlay=$("#cutscene-overlay"); const content=$("#cutscene-overlay-content");
    if(!overlay||!content||!cutscene.video_url) return;
    const expected=Number(cutscene.playbackPosition??cutscene.playback_position??0);
    content.innerHTML=`<p class="eyebrow">Cutscene</p><h2>${escapeHtml(cutscene.title)}</h2><video id="legacy-cutscene-video" src="${escapeHtml(cutscene.video_url)}" playsinline controls style="width:min(1100px,92vw);max-height:75vh;border-radius:10px;background:#000"></video><p class="help">A cena retorna automaticamente quando o Mestre pausa ou encerra a cutscene.</p>`;
    overlay.hidden=false;
    const video=$("#legacy-cutscene-video");
    video.currentTime=Math.max(0,expected);
    video.play().catch(()=>{});
    video.addEventListener("ended",()=>{ if(state.canManage) request(`/api/cutscenes/${cutscene.id}/end`,{method:"POST"}).then(loadLive).catch(()=>{}); });
}

// ---------- SOLICITAÇÕES DE ROLAGEM ----------
function renderRollRequests(){
    const pending=state.rollRequests; const playerList=$("#roll-request-list"); const panel=$("#roll-request-panel");
    if(!state.canManage){panel.hidden=pending.length===0;playerList.innerHTML=pending.map(r=>`<div class="list-item"><div class="list-item-main"><h4>${escapeHtml(r.prompt||"O Mestre solicitou um teste")}</h4><p>${escapeHtml(ATTRIBUTES[r.attribute_name]||r.attribute_name)}${r.skill_name?` + ${escapeHtml(SKILLS[r.skill_name]||r.skill_name)}`:""}${r.difficulty?` • Dificuldade ${r.difficulty}`:""}</p></div><button class="button accept-roll-request" data-id="${r.id}" data-char="${r.character_id||''}" data-attr="${r.attribute_name}" data-skill="${r.skill_name||''}" data-diff="${r.difficulty||''}" data-mod="${r.modifier||0}">Preparar teste</button></div>`).join("");
        $$(".accept-roll-request").forEach(b=>b.addEventListener("click",()=>{state.currentRequestId=Number(b.dataset.id);if(b.dataset.char)$("#roll-character").value=b.dataset.char;$("#roll-attribute").value=b.dataset.attr;$("#roll-skill").value=b.dataset.skill;$("#roll-difficulty").value=b.dataset.diff;$("#roll-modifier").value=b.dataset.mod;activateTab("rolls");$("#roll-result").innerHTML=`<p class="help">Teste solicitado preparado. Confira os dados e clique em Rolar dados.</p>`;}));
    } else {
        $("#master-roll-request-list").innerHTML=pending.map(r=>`<div class="list-item"><div class="list-item-main"><h4>${escapeHtml(r.target_name)} — ${escapeHtml(ATTRIBUTES[r.attribute_name]||r.attribute_name)}${r.skill_name?` + ${escapeHtml(SKILLS[r.skill_name]||r.skill_name)}`:""}</h4><p>${escapeHtml(r.prompt||"")}</p></div><button class="button-danger cancel-roll-request" data-id="${r.id}">Cancelar</button></div>`).join("")||`<div class="empty">Nenhuma solicitação pendente.</div>`;
        $$(".cancel-roll-request").forEach(b=>b.addEventListener("click",async()=>{await request(`/api/roll-requests/${b.dataset.id}/cancel`,{method:"POST"});await loadRollRequests();}));
    }
}
$("#roll-request-form").addEventListener("submit",async e=>{e.preventDefault();const submittedForm=e.currentTarget;await request(`/api/chronicles/${chronicleId}/roll-requests`,{method:"POST",body:JSON.stringify({targetUserId:Number(val("#request-user")),characterId:val("#request-character")?Number(val("#request-character")):null,attributeName:val("#request-attribute"),skillName:val("#request-skill"),difficulty:val("#request-difficulty")?Number(val("#request-difficulty")):null,modifier:numberVal("#request-modifier"),prompt:val("#request-prompt")})});submittedForm.reset();await loadRollRequests();toast("Teste solicitado ao jogador.");});

// ---------- DIRETOR / CENAS / EVENTOS ----------
function renderScenes() {
    const listHtml=state.scenes.map(s=>`<div class="list-item"><div class="list-item-main"><h4>${escapeHtml(s.title)}</h4><p>${escapeHtml([s.narrative_time,s.weather].filter(Boolean).join(" • "))}</p></div><div class="list-actions">${s.is_current?`<span class="tag success">Atual</span>`:`<button class="button-ghost activate-scene" data-id="${s.id}">Iniciar</button>`}<button class="button-danger delete-scene" data-id="${s.id}">Excluir</button></div></div>`).join("")||`<div class="empty">Nenhuma cena preparada.</div>`;
    const directorList=$("#scene-list"); if(directorList) directorList.innerHTML=listHtml;
    const roomList=$("#room-scene-list"); if(roomList) roomList.innerHTML=listHtml;
    const strip=$("#room-scene-strip");
    if(strip){
        if(state.canManage){
            strip.innerHTML=state.scenes.map(s=>`<button type="button" class="room-scene-chip ${s.is_current?'current':''} ${s.is_current?'':'activate-scene'}" data-id="${s.id}" ${s.is_current?'disabled':''} style="${s.image_url?`background-image:url('${escapeHtml(s.image_url)}')`:''}"><strong>${escapeHtml(s.title)}</strong><small>${escapeHtml([s.narrative_time,s.weather].filter(Boolean).join(" • ")||"Cena preparada")}</small></button>`).join("")||`<span class="help">Nenhuma cena preparada — crie a primeira cena.</span>`;
        } else {
            const current=state.scenes.find(s=>s.is_current)||state.live?.scene;
            strip.innerHTML=current?`<button type="button" class="room-scene-chip current" disabled style="${current.image_url?`background-image:url('${escapeHtml(current.image_url)}')`:''}"><strong>${escapeHtml(current.title)}</strong><small>Cena atual</small></button>`:`<span class="help">Aguardando o Mestre iniciar uma cena.</span>`;
        }
    }
    $$(".activate-scene").forEach(b=>b.addEventListener("click",async()=>{await request(`/api/scenes/${b.dataset.id}/activate`,{method:"POST"});await loadScenes();await loadLive();toast("Cena iniciada para a mesa.");}));
    $$(".delete-scene").forEach(b=>b.addEventListener("click",async()=>{if(!confirm("Excluir esta cena?"))return;await request(`/api/scenes/${b.dataset.id}`,{method:"DELETE"});await loadScenes();await loadLive();}));
}
$("#scene-form").addEventListener("submit",async(event)=>{event.preventDefault();const submittedForm=event.currentTarget;const file=$("#scene-image")?.files?.[0];const imageUrl=file?(await uploadLocalFile(file,"image")).url:"";await request(`/api/chronicles/${chronicleId}/scenes`,{method:"POST",body:JSON.stringify({title:val("#scene-title"),narrativeTime:val("#scene-time"),weather:val("#scene-weather"),imageUrl,description:val("#scene-description")})});submittedForm.reset();await loadScenes();toast("Cena preparada.");});
$("#room-scene-form").addEventListener("submit",async(event)=>{event.preventDefault();const submittedForm=event.currentTarget;const file=$("#room-scene-image")?.files?.[0];const imageUrl=file?(await uploadLocalFile(file,"image")).url:"";await request(`/api/chronicles/${chronicleId}/scenes`,{method:"POST",body:JSON.stringify({title:val("#room-new-scene-title"),narrativeTime:val("#room-scene-time"),weather:val("#room-scene-weather"),imageUrl,description:val("#room-new-scene-description")})});submittedForm.reset();$("#room-scene-creator").open=false;await loadScenes();toast("Cena preparada.");});
function renderDirectorMembers(){
    $("#director-members").innerHTML=state.members.map(m=>`<div class="list-item"><div class="list-item-main"><h4>${escapeHtml(m.name)}</h4><p>${escapeHtml(m.email)}</p></div>${m.role==='owner'?`<span class="tag wine">Dono</span>`:`<div class="list-actions"><select class="member-role" data-id="${m.id}"><option value="master" ${m.role==='master'?'selected':''}>Mestre</option><option value="co-master" ${m.role==='co-master'?'selected':''}>Co-Mestre</option><option value="player" ${m.role==='player'?'selected':''}>Jogador</option><option value="spectator" ${m.role==='spectator'?'selected':''}>Espectador</option></select><button class="button-danger remove-member" data-id="${m.id}">Remover</button></div>`}</div>`).join("");
    $$(".member-role").forEach(s=>s.addEventListener("change",async()=>{await request(`/api/chronicles/${chronicleId}/members/${s.dataset.id}`,{method:"PATCH",body:JSON.stringify({role:s.value})});toast("Permissão alterada.");await loadMembers();}));
    $$(".remove-member").forEach(b=>b.addEventListener("click",async()=>{if(!confirm("Remover este participante da Crônica?"))return;await request(`/api/chronicles/${chronicleId}/members/${b.dataset.id}`,{method:"DELETE"});await loadMembers();}));
}
$("#event-form").addEventListener("submit",async(event)=>{event.preventDefault();const submittedForm=event.currentTarget;await request(`/api/chronicles/${chronicleId}/events`,{method:"POST",body:JSON.stringify({eventType:val("#event-type"),title:val("#event-title"),content:val("#event-content")})});submittedForm.reset();await loadEvents();toast("Evento preparado.");});
function renderEvents(items){$("#event-list").innerHTML=items.map(i=>`<div class="list-item"><div class="list-item-main"><h4>${escapeHtml(i.title)}</h4><p>${escapeHtml(i.event_type)} • ${escapeHtml(i.content)}</p></div><div class="list-actions">${i.is_active?`<button class="button-danger stop-event" data-id="${i.id}">Encerrar</button>`:`<button class="button-ghost activate-event" data-id="${i.id}">Disparar</button>`}</div></div>`).join("")||`<div class="empty">Nenhum evento preparado.</div>`; $$(".activate-event").forEach(b=>b.addEventListener("click",async()=>{await request(`/api/events/${b.dataset.id}/activate`,{method:"POST"});await loadEvents();await loadLive();toast("Evento disparado.");}));$$(".stop-event").forEach(b=>b.addEventListener("click",async()=>{await request(`/api/events/${b.dataset.id}/deactivate`,{method:"POST"});await loadEvents();await loadLive();}));}

// ---------- NOTAS ----------
function renderNotes(){
    $("#note-list").innerHTML=state.notes.map(n=>`<div class="list-item"><div class="list-item-main"><h4>${escapeHtml(n.title)}</h4><p>${escapeHtml(n.content)}</p><p>${escapeHtml(n.author_name)} • ${escapeHtml(n.visibility)} • ${n.is_revealed?'revelada':'oculta'}</p></div><div class="list-actions">${state.canManage&&!n.is_revealed&&n.visibility!=="master"?`<button class="button-ghost reveal-note" data-id="${n.id}">Revelar</button>`:""}<button class="button-danger delete-note" data-id="${n.id}">Excluir</button></div></div>`).join("")||`<div class="empty">Nenhuma nota disponível.</div>`;
    $$(".reveal-note").forEach(b=>b.addEventListener("click",async()=>{await request(`/api/notes/${b.dataset.id}/reveal`,{method:"POST"});await loadNotes();toast("Nota revelada.");}));$$(".delete-note").forEach(b=>b.addEventListener("click",async()=>{if(!confirm("Excluir esta nota?"))return;await request(`/api/notes/${b.dataset.id}`,{method:"DELETE"});await loadNotes();}));
}
$("#note-visibility").addEventListener("change",()=>$("#note-recipient-group").hidden=val("#note-visibility")!=="selected");
$("#note-form").addEventListener("submit",async(event)=>{event.preventDefault();const submittedForm=event.currentTarget;const selected=$$("#note-recipients option:checked").map(o=>Number(o.value));await request(`/api/chronicles/${chronicleId}/notes`,{method:"POST",body:JSON.stringify({title:val("#note-title"),content:val("#note-content"),visibility:state.canManage?val("#note-visibility"):"master",recipientIds:selected,isRevealed:false})});submittedForm.reset();await loadNotes();toast(state.canManage?"Nota salva.":"Nota privada enviada ao Mestre.");});

// ---------- GENERIC RENDERERS / FORMS ----------
function simpleList(selector, items, line1, line2, resource=null){$(selector).innerHTML=items.map(item=>`<div class="list-item"><div class="list-item-main"><h4>${escapeHtml(line1(item))}</h4><p>${escapeHtml(line2(item))}</p></div>${resource&&state.canManage?`<button class="button-danger generic-delete" data-resource="${resource}" data-id="${item.id}">Excluir</button>`:''}</div>`).join("")||`<div class="empty">Nenhum registro.</div>`;if(resource&&state.canManage){$$('.generic-delete',$(selector)).forEach(b=>b.addEventListener('click',async()=>{if(!confirm('Excluir este registro?'))return;await request(`/api/${b.dataset.resource}/${b.dataset.id}`,{method:'DELETE'});await reloadResource(resource);}));}}
async function reloadResource(resource){const map={npcs:loadNpcs,diary:loadDiary,story:loadStory,timeline:loadTimeline,media:loadMedia,cutscenes:loadCutscenes,events:loadEvents,maps:loadMaps,clocks:loadClocks};if(map[resource])await map[resource]();}
$("#diary-form").addEventListener("submit",async(e)=>{e.preventDefault();const submittedForm=e.currentTarget;await request(`/api/chronicles/${chronicleId}/diary`,{method:"POST",body:JSON.stringify({entryType:val("#diary-type"),title:val("#diary-title"),content:val("#diary-content"),visibility:val("#diary-visibility"),occurredAt:val("#diary-date")})});submittedForm.reset();await loadDiary();});
$("#npc-form").addEventListener("submit",async(e)=>{e.preventDefault();const submittedForm=e.currentTarget;await request(`/api/chronicles/${chronicleId}/npcs`,{method:"POST",body:JSON.stringify({name:val("#npc-name"),type:val("#npc-type"),importance:val("#npc-importance"),defense:numberVal("#npc-defense"),health:numberVal("#npc-health",3),damage:numberVal("#npc-damage",1),description:val("#npc-description")})});submittedForm.reset();await loadNpcs();});
$("#media-form").addEventListener("submit",async(e)=>{e.preventDefault();const submittedForm=e.currentTarget;await request(`/api/chronicles/${chronicleId}/media`,{method:"POST",body:JSON.stringify({title:val("#media-title"),category:val("#media-category"),url:val("#media-url"),mediaType:"youtube"})});submittedForm.reset();await loadMedia();});
$("#room-media-form").addEventListener("submit",async(e)=>{e.preventDefault();const submittedForm=e.currentTarget;await request(`/api/chronicles/${chronicleId}/media`,{method:"POST",body:JSON.stringify({title:val("#room-media-title"),category:val("#room-media-category"),url:val("#room-media-url"),mediaType:"youtube"})});submittedForm.reset();$("#room-audio-creator").open=false;await loadMedia();toast("Mídia adicionada à biblioteca.");});
$("#youtube-search-form").addEventListener("submit",(e)=>{e.preventDefault();const q=val("#youtube-query").trim();if(q)window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`,"_blank","noopener");});
$("#room-youtube-search-form").addEventListener("submit",e=>{e.preventDefault();const q=val("#room-youtube-query").trim();if(q)window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`,"_blank","noopener");});
$("#cutscene-form").addEventListener("submit",async(e)=>{e.preventDefault();const submittedForm=e.currentTarget;const file=$("#cutscene-video")?.files?.[0];if(!file)return toast("Escolha um vídeo MP4 ou WebM do seu PC.");const videoUrl=(await uploadLocalFile(file,"video")).url;await request(`/api/chronicles/${chronicleId}/cutscenes`,{method:"POST",body:JSON.stringify({title:val("#cutscene-title"),steps:[],videoUrl})});submittedForm.reset();await loadCutscenes();toast("Cutscene adicionada.");});
$("#story-form").addEventListener("submit",async(e)=>{e.preventDefault();const submittedForm=e.currentTarget;await request(`/api/chronicles/${chronicleId}/story`,{method:"POST",body:JSON.stringify({nodeType:val("#story-type"),title:val("#story-title"),description:val("#story-description")})});submittedForm.reset();await loadStory();});
$("#timeline-form").addEventListener("submit",async(e)=>{e.preventDefault();const submittedForm=e.currentTarget;await request(`/api/chronicles/${chronicleId}/timeline`,{method:"POST",body:JSON.stringify({title:val("#timeline-title"),eventDate:val("#timeline-date"),visibility:val("#timeline-visibility"),content:val("#timeline-content")})});submittedForm.reset();await loadTimeline();});
$("#map-form").addEventListener("submit",async(e)=>{e.preventDefault();const submittedForm=e.currentTarget;const file=$("#map-url")?.files?.[0];if(!file)return toast("Escolha a imagem do mapa no seu PC.");const imageUrl=(await uploadLocalFile(file,"image")).url;await request(`/api/chronicles/${chronicleId}/maps`,{method:"POST",body:JSON.stringify({title:val("#map-title"),mapType:val("#map-type"),imageUrl,gridEnabled:$("#map-grid").checked})});submittedForm.reset();await loadMaps();});
$("#clock-form").addEventListener("submit",async(e)=>{e.preventDefault();const submittedForm=e.currentTarget;await request(`/api/chronicles/${chronicleId}/clocks`,{method:"POST",body:JSON.stringify({title:val("#clock-title"),segments:numberVal("#clock-segments",4),consequence:val("#clock-consequence")})});submittedForm.reset();await loadClocks();});

function renderMedia(items){
    const html=items.map(i=>`<div class="list-item"><div class="list-item-main"><h4>${escapeHtml(i.title)}</h4><p>${escapeHtml(i.category)} • ${escapeHtml(i.url)}</p></div><div class="list-actions"><a class="button-ghost" target="_blank" href="${escapeHtml(i.url)}">Abrir</a>${i.is_active?`<button class="button-danger stop-media" data-id="${i.id}">Parar</button>`:`<button class="button-ghost activate-media" data-id="${i.id}">Tocar</button>`}</div></div>`).join("")||`<div class="empty">Nenhuma mídia salva.</div>`;
    const mediaList=$("#media-list");if(mediaList)mediaList.innerHTML=html;
    const roomMediaList=$("#room-media-list");if(roomMediaList)roomMediaList.innerHTML=html;
    $$('.activate-media').forEach(b=>b.addEventListener('click',async()=>{await request(`/api/media/${b.dataset.id}/activate`,{method:'POST'});await loadMedia();await loadLive();toast('Mídia definida como ambiente atual.');}));
    $$('.stop-media').forEach(b=>b.addEventListener('click',async()=>{await request(`/api/media/${b.dataset.id}/deactivate`,{method:'POST'});await loadMedia();await loadLive();toast('Mídia interrompida.');}));
}
function renderCutscenes(items){$("#cutscene-list").innerHTML=items.map(i=>{const stateLabel=i.playback_state==='playing'?'Em exibição':i.playback_state==='paused'?'Pausada':'Preparada';return `<div class="list-item"><div class="list-item-main"><h4>${escapeHtml(i.title)}</h4><p>${stateLabel} • vídeo local</p></div><div class="list-actions">${i.is_active&&i.playback_state==='playing'?`<button class="button-ghost pause-cutscene" data-id="${i.id}">Pausar Cutscene</button><button class="button-danger end-cutscene" data-id="${i.id}">Encerrar</button>`:i.is_active&&i.playback_state==='paused'?`<button class="button-ghost resume-cutscene" data-id="${i.id}">Retomar</button><button class="button-danger end-cutscene" data-id="${i.id}">Encerrar</button>`:`<button class="button-ghost launch-cutscene" data-id="${i.id}">Lançar Cutscene</button>`}</div></div>`}).join("")||`<div class="empty">Nenhuma cutscene preparada.</div>`;$$('.launch-cutscene').forEach(b=>b.addEventListener('click',async()=>{await request(`/api/cutscenes/${b.dataset.id}/launch`,{method:'POST'});await loadCutscenes();await loadLive();toast('Cutscene lançada para a mesa.');}));$$('.pause-cutscene').forEach(b=>b.addEventListener('click',async()=>{await request(`/api/cutscenes/${b.dataset.id}/pause`,{method:'POST'});await loadCutscenes();await loadLive();toast('Cutscene pausada. A cena voltou para a mesa.');}));$$('.resume-cutscene').forEach(b=>b.addEventListener('click',async()=>{await request(`/api/cutscenes/${b.dataset.id}/resume`,{method:'POST'});await loadCutscenes();await loadLive();}));$$('.end-cutscene').forEach(b=>b.addEventListener('click',async()=>{await request(`/api/cutscenes/${b.dataset.id}/end`,{method:'POST'});hideCutscene();await loadCutscenes();await loadLive();}));}
function parsedMarkers(item){try{return JSON.parse(item.markers_json||'[]')}catch{return []}}
function renderMaps(items){state.maps=items;$("#map-list").innerHTML=items.map(i=>{const markers=parsedMarkers(i);return `<div><div class="list-item"><div class="list-item-main"><h4>${escapeHtml(i.title)}</h4><p>${escapeHtml(i.map_type)}${i.grid_enabled?' • grid ativo':''}${state.canManage?' • clique no mapa para marcar':''}</p></div></div>${i.image_url?`<div class="map-preview ${i.grid_enabled?'grid-on':''}" data-map-id="${i.id}" style="background-image:url('${escapeHtml(i.image_url)}')">${markers.map((m,index)=>`<button type="button" class="map-marker" data-map-id="${i.id}" data-index="${index}" data-label="${escapeHtml(m.label||'Marcador')}" style="left:${Number(m.x)||0}%;top:${Number(m.y)||0}%" aria-label="${escapeHtml(m.label||'Marcador')}"></button>`).join('')}</div>`:''}</div>`}).join("")||`<div class="empty">Nenhum mapa registrado.</div>`;
    if(state.canManage){$$('.map-preview').forEach(preview=>preview.addEventListener('click',async event=>{if(event.target.classList.contains('map-marker'))return;const rect=preview.getBoundingClientRect();const x=((event.clientX-rect.left)/rect.width)*100;const y=((event.clientY-rect.top)/rect.height)*100;const label=prompt('Nome do marcador:');if(!label)return;const map=state.maps.find(m=>m.id===Number(preview.dataset.mapId));const markers=parsedMarkers(map);markers.push({label,x:Number(x.toFixed(2)),y:Number(y.toFixed(2)),type:'location'});await request(`/api/maps/${map.id}`,{method:'PATCH',body:JSON.stringify({markers})});await loadMaps();}));$$('.map-marker').forEach(marker=>marker.addEventListener('click',async event=>{event.stopPropagation();if(!confirm(`Remover o marcador "${marker.dataset.label}"?`))return;const map=state.maps.find(m=>m.id===Number(marker.dataset.mapId));const markers=parsedMarkers(map);markers.splice(Number(marker.dataset.index),1);await request(`/api/maps/${map.id}`,{method:'PATCH',body:JSON.stringify({markers})});await loadMaps();}));}
}
function renderClocks(items){$("#clock-list").innerHTML=items.map(i=>`<div class="clock"><div class="card-header"><div><h4>${escapeHtml(i.title)}</h4><p>${escapeHtml(i.consequence)}</p></div><span class="tag">${i.progress}/${i.segments}</span></div><div class="clock-segments">${Array.from({length:i.segments},(_,x)=>`<span class="clock-segment ${x<i.progress?'filled':''}"></span>`).join('')}</div>${state.canManage?`<div class="list-actions"><button class="button-ghost clock-change" data-id="${i.id}" data-progress="${Math.max(0,i.progress-1)}">−</button><button class="button-ghost clock-change" data-id="${i.id}" data-progress="${Math.min(i.segments,i.progress+1)}">+</button></div>`:''}</div>`).join("")||`<div class="empty">Nenhum relógio ativo.</div>`;$$('.clock-change').forEach(b=>b.addEventListener('click',async()=>{await request(`/api/clocks/${b.dataset.id}`,{method:'PATCH',body:JSON.stringify({progress:Number(b.dataset.progress)})});await loadClocks();}));}

// ---------- CONFLITOS ----------
$("#conflict-form").addEventListener("submit",async e=>{e.preventDefault();const submittedForm=e.currentTarget;const participants=val("#conflict-participants").split("\n").map(x=>x.trim()).filter(Boolean);await request(`/api/chronicles/${chronicleId}/conflicts`,{method:"POST",body:JSON.stringify({title:val("#conflict-title"),mode:val("#conflict-mode"),participants,notes:val("#conflict-notes")})});submittedForm.reset();await loadConflicts();});
function renderConflicts(items){$("#conflict-list").innerHTML=items.map(i=>`<div class="card"><div class="card-header"><div><h3>${escapeHtml(i.title)}</h3><p>${escapeHtml(i.mode)} • Rodada ${i.round} • ${escapeHtml(i.status)}</p></div>${i.status==='active'?'<span class="tag wine">Ativo</span>':'<span class="tag">Encerrado</span>'}</div><div class="list">${(i.participants||[]).map((p,x)=>{const name=typeof p==="string"?p:(p?.name||"Participante");const initiative=typeof p==="object"&&p?.initiative!=null?` · Iniciativa ${p.initiative}`:"";return `<div class="list-item"><span>${x+1}. ${escapeHtml(name)}${initiative}</span></div>`;}).join('')}</div>${i.notes?`<p style="margin-top:.6rem">${escapeHtml(i.notes)}</p>`:''}${state.canManage&&i.status==='active'?`<div class="list-actions" style="margin-top:.7rem"><button class="button-ghost next-round" data-id="${i.id}" data-round="${i.round+1}">Próxima rodada</button><button class="button-danger finish-conflict" data-id="${i.id}" data-round="${i.round}">Encerrar</button></div>`:''}</div>`).join('')||`<div class="empty">Nenhum conflito registrado.</div>`;$$('.next-round').forEach(b=>b.addEventListener('click',async()=>{await request(`/api/conflicts/${b.dataset.id}`,{method:'PATCH',body:JSON.stringify({round:Number(b.dataset.round)})});await loadConflicts();}));$$('.finish-conflict').forEach(b=>b.addEventListener('click',async()=>{await request(`/api/conflicts/${b.dataset.id}`,{method:'PATCH',body:JSON.stringify({round:Number(b.dataset.round),status:'finished'})});await loadConflicts();}));}

// ---------- CHAT ----------
$("#chat-channel").addEventListener("change",()=>$("#whisper-group").hidden=val("#chat-channel")!=="whisper");
$("#chat-form").addEventListener("submit",async(e)=>{e.preventDefault();const content=val("#chat-content").trim();if(!content)return;await request(`/api/chronicles/${chronicleId}/messages`,{method:"POST",body:JSON.stringify({channel:val("#chat-channel"),recipientId:val("#chat-channel")==="whisper"?Number(val("#chat-recipient")):null,content})});$("#chat-content").value="";await loadMessages();});
function buildMessageElement(m){const article=document.createElement("article");article.className=`message ${m.channel}`;article.innerHTML=`<header><strong>${escapeHtml(m.sender_name)}${m.recipient_name?` → ${escapeHtml(m.recipient_name)}`:""}</strong><span>${fmtDate(m.created_at)}</span></header><p>${escapeHtml(m.content)}</p>`;return article;}
async function loadMessages(){try{const data=await apiRequest(`/api/chronicles/${chronicleId}/messages?after=${state.lastMessageId}`);if(!data.messages.length)return;const boxes=[$("#chat-box"),$("#room-chat-box")].filter(Boolean);for(const m of data.messages){for(const box of boxes)box.append(buildMessageElement(m));state.lastMessageId=Math.max(state.lastMessageId,m.id);}for(const box of boxes)box.scrollTop=box.scrollHeight;}catch(error){handleAuth(error);}}

// ---------- CONTROLES DA SALA VTT ----------
function openRoomPane(name){
    $$("[data-room-pane]").forEach(el=>el.classList.toggle("active",el.dataset.roomPane===name));
    $$("[data-room-pane-content]").forEach(el=>el.classList.toggle("active",el.dataset.roomPaneContent===name));
}
$$("[data-room-pane]").forEach(el=>el.addEventListener("click",()=>openRoomPane(el.dataset.roomPane)));
$$("[data-room-open-tab]").forEach(el=>el.addEventListener("click",()=>activateTab(el.dataset.roomOpenTab)));
$("#room-exit").addEventListener("click",()=>activateTab("overview"));
$("#room-new-scene").addEventListener("click",()=>{openRoomPane("scenes");$("#room-scene-creator").open=true;$("#room-new-scene-title").focus();});
$("#room-new-audio").addEventListener("click",()=>{openRoomPane("audio");$("#room-audio-creator").open=true;$("#room-media-title").focus();});
$("#room-chat-channel").addEventListener("change",()=>{$("#room-chat-recipient").hidden=val("#room-chat-channel")!=="whisper";});
$("#room-player-toggle").addEventListener("click",()=>{const player=$("#live-media-player");if(!player.innerHTML)return toast("Nenhuma mídia ativa.");player.hidden=!player.hidden;});
$("#room-chat-form").addEventListener("submit",async(e)=>{e.preventDefault();const content=val("#room-chat-content").trim();if(!content)return;await request(`/api/chronicles/${chronicleId}/messages`,{method:"POST",body:JSON.stringify({channel:val("#room-chat-channel"),recipientId:val("#room-chat-channel")==="whisper"?Number(val("#room-chat-recipient")):null,content})});$("#room-chat-content").value="";await loadMessages();});

// ---------- LOADERS ----------
async function loadChronicle(){const [me,c]=await Promise.all([request('/api/me'),request(`/api/chronicles/${chronicleId}`)]);state.me=me.user;state.chronicle=c.chronicle;state.role=c.chronicle.role;state.canManage=c.canManage;masterOnlyVisibility();renderChronicle();}
async function loadMembers(){const d=await request(`/api/chronicles/${chronicleId}/members`);state.members=d.members;renderMembers();}
async function loadCharacters(){const d=await request(`/api/chronicles/${chronicleId}/characters`);state.characters=d.characters;renderCharacters();}
async function loadRolls(){const d=await request(`/api/chronicles/${chronicleId}/rolls`);renderRollHistory(d.rolls);}
async function loadRollRequests(){const d=await request(`/api/chronicles/${chronicleId}/roll-requests`);state.rollRequests=d.requests;renderRollRequests();}
async function loadConflicts(){const d=await request(`/api/chronicles/${chronicleId}/conflicts`);state.conflicts=d.conflicts;renderConflicts(d.conflicts);}
async function loadScenes(){const d=await request(`/api/chronicles/${chronicleId}/scenes`);state.scenes=d.scenes;renderScenes();}
async function loadNotes(){const d=await request(`/api/chronicles/${chronicleId}/notes`);state.notes=d.notes;renderNotes();}
async function genericLoad(resource){const d=await request(`/api/chronicles/${chronicleId}/${resource}`);return d.items;}
async function loadDiary(){simpleList('#diary-list',await genericLoad('diary'),i=>i.title,i=>`${i.entry_type} • ${i.occurred_at||fmtDate(i.created_at)} — ${i.content}`,'diary');}
async function loadNpcs(){if(!state.canManage)return;simpleList('#npc-list',await genericLoad('npcs'),i=>i.name,i=>`${i.type} • ${i.importance} • Defesa ${i.defense} • Vida ${i.health} — ${i.description}`,'npcs');}
async function loadMedia(){if(!state.canManage)return;renderMedia(await genericLoad('media'));}
async function loadCutscenes(){if(!state.canManage)return;renderCutscenes(await genericLoad('cutscenes'));}
async function loadEvents(){if(!state.canManage)return;renderEvents(await genericLoad('events'));}
async function loadStory(){simpleList('#story-list',await genericLoad('story'),i=>`${i.node_type.toUpperCase()} — ${i.title}`,i=>i.description,'story');}
async function loadTimeline(){simpleList('#timeline-list',await genericLoad('timeline'),i=>`${i.event_date||'Sem data'} — ${i.title}`,i=>`${i.visibility} • ${i.content}`,'timeline');}
async function loadMaps(){renderMaps(await genericLoad('maps'));}
async function loadClocks(){renderClocks(await genericLoad('clocks'));}
async function loadLive(){try{const d=await apiRequest(`/api/chronicles/${chronicleId}/live`);state.live=d;renderLive();}catch(error){handleAuth(error);}}

async function loadAll(showToast=false){
    try{
        await loadChronicle();
        await Promise.all([loadMembers(),loadCharacters(),loadRolls(),loadRollRequests(),loadScenes(),loadNotes(),loadDiary(),loadStory(),loadTimeline(),loadMaps(),loadConflicts(),loadClocks(),loadLive()]);
        if(state.canManage) await Promise.all([loadNpcs(),loadMedia(),loadCutscenes(),loadEvents()]);
        if(showToast) toast("Crônica atualizada.");
    }catch(error){if(!handleAuth(error))console.error(error);}
}

async function pingPresence(){try{await apiRequest(`/api/chronicles/${chronicleId}/presence`,{method:"POST"});}catch(error){handleAuth(error);}}
await pingPresence();
await loadAll();
await loadMessages();
setInterval(pingPresence, 15000);
setInterval(loadMembers, 15000);
setInterval(loadMessages, 2500);
setInterval(loadLive, 3000);
setInterval(loadRollRequests, 3500);
