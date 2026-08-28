# ELYSIUM v0.9.4 — Simulação de campanha de 10 sessões

## Veredito

A build v0.9.4 concluiu uma campanha automatizada de 10 sessões sem falhas bloqueadoras.

- Campanha completa: **154/154 verificações aprovadas**.
- Regressão dedicada da Fog: **141/141 verificações aprovadas**.
- Recursos/páginas estáticos servidos pelo Node: **14/14**.
- `npm run check` e `node --check` em todo o JS do frontend/backend/testes: aprovados.
- `PRAGMA integrity_check`: `ok`.
- `PRAGMA foreign_key_check`: 0 violações.
- Reinício real do servidor no meio do teste final: dados e uploads preservados.

## Bug encontrado durante a simulação

A auditoria de todos os controles encontrou um bug real na v0.9.3: os botões **anterior/próxima página da Macro Hotbar** existiam no HTML, mas não possuíam handler e `hotbarPage` não era usado.

Correção na v0.9.4:

- 5 páginas de hotbar;
- 10 slots por página (50 slots no total);
- setas anterior/próxima funcionais;
- teclas 1–0 executam os slots da página atual;
- macros antigas, nos slots 0–9, continuam na página 1;
- backend passa a aceitar slots 0–49.

Após a correção, a campanha inteira foi executada novamente do zero e passou 154/154.

## Participantes simulados

- Dono/Mestre e Administrador global.
- Co-Mestre.
- 3 Jogadores.
- 1 Espectador.
- 1 usuário externo sem acesso à Crônica.

Foram testadas permissões positivas e negativas entre esses papéis.

## Sessões

### Sessão 1 — Prólogo e preparação — 30/30

Contas, login, Admin, Crônica, edição de metadados, upload de banner, convites, papéis, presença, criação de fichas, avatar local, atributos, perícias, especialidades, Disciplinas, Vantagens, Defeitos, Convicções, Touchstones, Fome, Humanidade, Máculas, Saúde, Força de Vontade, Potência de Sangue, Ressonância e XP.

### Sessão 2 — Investigação — 22/22

Scene Directory, pasta de cenas, mapa local, foreground, grid quadrado, tokens, NPC, tiles under/over/GM, desenhos livre/retângulo/elipse/texto, luzes, som posicional, notas no mapa, regiões, pings, FX, cursores remotos, notas do Mestre, notas seletivas, nota privada do jogador, revelações, chat, canal de notas, sussurros, Diário, Story (Temporada/Episódio/Ato/Cena), Timeline, mapa narrativo e relógio narrativo.

### Sessão 3 — Conflito — 17/17

Paredes, porta normal, Fog global, Explorer, colisão/movimento, abrir/fechar/trancar porta, Combat Tracker, solicitação de rolagem, conclusão automática, rolagem V5, Fome, rolagem secreta filtrada, bloqueio de espectador, pausa global e borracha/autoria.

### Sessão 4 — Cinematografia — 10/10

Upload WAV e MP4 reais, Playlist/Mídia ativa, evento narrativo, Cutscene local, Lançar, Pausar, Retomar, Encerrar, estado Live e Modo Transmissão.

### Sessão 5 — Fog avançada — 12/12

Cena hex-row, escuridão, iluminação global desligada, cinzas, parede até a borda, porta secreta, mascaramento do segredo para jogadores, Explorer respeitando linha de visão, token sem visão, Explorer desativado, Reset global, Limpar Explorer e luz oculta.

### Sessão 6 — Diretórios — 13/13

Items públicos/privados, edição, Rollable Tables pública/secreta, Cards/Decks (draw, vazio, reset, shuffle), Macros privadas/compartilhadas, permissões e páginas 1–5 da Macro Hotbar.

### Sessão 7 — Mudança de atos — 8/8

Grid hex-column, gridless, cena GM-only, navegação, cena atual, edição de grid/escuridão/clima, pastas e cascade de cena temporária.

### Sessão 8 — Permissões — 10/10

Co-Mestre, restrições de jogador, restrições de Espectador, autoria de ping, Limpar marcações preservando token/tile, pausa por Co-Mestre, promoção/rebaixamento de papel e painel Admin.

### Sessão 9 — Sessão longa/carga — 8/8

50 mensagens concorrentes, 30 pings/FX, 25 rolagens concorrentes, Explorer simultâneo de jogadores diferentes, 100 heartbeats/cursores, bootstrap carregado e chat incremental.

### Sessão 10 — Finale — 13/13

Atualização de recursos, XP final, relógio concluído, conflito encerrado, recap, timeline, Cutscene final, status `finished`, logout/login, reinício real do Node, recuperação da campanha, uploads persistentes, integridade SQLite e cascade de uma Crônica descartável.

## Ferramentas do VTT verificadas

Barra esquerda: Selecionar, Mover câmera, Medir (Régua/Raio/Cone), Ping, Lápis, Borracha, Token, Tile, Parede/Porta/Porta secreta, Luz, Som, Nota, Região, Fog e FX.

Diretórios/controles: Chat & Dados, Combat Tracker, Scenes, Actors, Items, Journal, Rollable Tables, Cards/Decks, Playlists/Jukebox, Cutscenes, Compendium, Settings, Macro Hotbar, zoom, fit/centralizar, Player View, tutorial e exportação do chat.

## Fog regression

Depois da alteração da hotbar, toda a suíte de Fog foi repetida:

- Geometria: 21/21.
- Polling/concorrência: 7/7.
- Interface/estrutura: 28/28.
- API Mestre/Jogadores: 37/37.
- Cenário difícil: 48/48.

Total Fog: **141/141**.

## Limitação do ambiente de teste

O ambiente não permitiu completar um teste E2E real de clique em Chromium conectado ao servidor. Tentativas anteriores em `127.0.0.1` foram bloqueadas por política administrativa; uma tentativa pelo IP interno também não concluiu a navegação headless dentro do limite do sandbox.

Por isso, interações puramente client-side (pan, zoom, régua/raio/cone, Player View, exportação de chat, tutorial e hotbar) foram validadas pela estrutura e pelos handlers reais do frontend, enquanto seus estados persistentes/ações de servidor foram testados por HTTP.

Também não é possível certificar câmera/microfone/WebRTC em HTTP dentro deste ambiente; o próprio projeto informa que HTTPS é recomendado para isso.

## Conclusão

A v0.9.4 está **funcionalmente jogável para uma campanha completa** segundo a simulação automatizada, sem bloqueadores detectados no fluxo principal de Mestre/Jogadores.

Não é correto declarar uma garantia absoluta de “100% em qualquer navegador/rede/hardware” sem uma sessão manual multi-browser em máquinas reais. O que os testes permitem afirmar é: **nenhuma falha funcional foi encontrada nas 154 verificações da campanha final, e nenhuma regressão foi encontrada nas 141 verificações dedicadas da Fog.**
