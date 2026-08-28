# ELYSIUM VTT v0.9

A Sala da Crônica foi reescrita como um VTT dedicado. A organização funcional toma Roll20 e Foundry VTT como referências, sem copiar código, assets ou identidade visual proprietária.

## Estrutura da interface

- **Scene Navigation (topo):** troca rápida entre cenas permitidas.
- **Tool Controls (esquerda):** seleção, câmera, medidas, pings e ferramentas do Mestre.
- **Canvas (centro):** mapa/cena com camadas.
- **Sidebar (direita):** Chat, Combate, Cenas, Actors, Items, Journal, Tabelas, Cards, Playlists, Compendium e Settings.
- **Macro Hotbar (rodapé):** slots 1–0.

## Canvas e cenas

- Background e Foreground.
- Grid quadrado, hexagonal e sem grid.
- Tiles abaixo/acima dos tokens e camada GM.
- Desenhos livres, retângulos, elipses e texto.
- Tokens com dono, personagem/NPC, imagem, rotação, barras, status, disposição e visão.
- Paredes que podem bloquear visão, movimento e som.
- Portas normais, trancadas e secretas.
- Restrição de movimento validada também pelo servidor para jogadores.
- Luzes, escuridão, visão baseada em token, Fog of War e Explorer Mode.
- Regiões com mensagens ao entrar.
- Notas fixadas no mapa.
- Sons posicionais com atenuação por distância.
- Clima (chuva, neve, cinzas).
- Pings, destaque/FX e cursores remotos.

## Ferramentas de jogo

- Régua linear, raio e cone de 60°.
- Chat geral, rolagens e sussurros.
- Exportação local do histórico de chat.
- Rolagens V5 com Dados de Fome e resultados especiais.
- Rolagens secretas do Mestre filtradas no servidor.
- Combat Tracker com iniciativa, rodada e encontros.
- Pausa global da mesa.
- Player View para a equipe de narração.

## Diretórios

- Scenes e pastas.
- Actors (personagens + NPCs).
- Items.
- Journal e Handouts.
- Rollable Tables, inclusive rolagem secreta.
- Cards/Decks com comprar, embaralhar e resetar.
- Playlists/Jukebox e mídia ativa.
- Compendium V5 básico.
- Macros privadas/compartilhadas com hotbar.

## Permissões

Dono/Mestre/Co-Mestre possuem ferramentas administrativas do VTT. Jogadores recebem somente cenas reveladas e objetos permitidos. Espectadores são limitados. Cenas GM-only, paredes secretas, notas master-only e rolagens secretas são filtradas pelo backend.

## Limitações atuais

Esta versão busca cobrir o núcleo funcional de um VTT moderno, mas não replica ecossistemas comerciais completos. Em especial:

- não há marketplace/ecossistema de módulos equivalente ao Foundry/Roll20;
- voz/vídeo P2P completo não é iniciado automaticamente; acesso por Radmin em HTTP pode bloquear câmera/microfone e WebRTC normalmente requer contexto seguro/HTTPS;
- iluminação e Fog são implementações próprias e mais simples que engines maduras;
- grid hexagonal é funcional visualmente, mas não possui todas as regras geométricas avançadas de um VTT especializado;
- não existe anti-cheat absoluto no cliente: usuários tecnicamente sofisticados ainda controlam o próprio navegador, embora segredos importantes sejam filtrados no servidor;
- assets visuais são enviados do PC e armazenados localmente em `public/uploads`; ainda não há um Asset Browser com tags/pastas;
- o Compendium é uma referência interna do Elysium, não um sistema de pacotes/licenças comerciais.

## Desenvolvimento

No Codespaces ou ambiente Node:

```bash
npm start
```

Abra a porta 3000. O VTT fica em:

```text
/pages/vtt.html?id=ID_DA_CRONICA
```


## Alterações específicas da v0.9

- Borracha individual com autoria: jogadores removem os próprios desenhos/pings; Mestre remove qualquer placeable.
- **Limpar marcações da cena** remove desenhos, paredes, notas, regiões e pings em transação, preservando mapa, tokens e tiles.
- Tutorial integrado, disponível no botão `?` e em Configurações.
- Upload local para imagens de cena/foreground, banners, avatares, tokens, tiles, mapas e itens/handouts.
- Cutscenes em MP4/WebM local com sincronização de posição e controles Lançar, Pausar, Retomar e Encerrar.
- Pausar Cutscene devolve imediatamente o mapa e guarda o ponto do vídeo.
- Fallback **Reproduzir Cutscene** para navegadores que bloqueiem autoplay.
- Rolagens V5 exibem d10 decagonais maiores em overlay central, mantendo o registro no chat.
- Inputs de arquivo, selects, checkboxes, ranges e campos gerais receberam tratamento visual próprio.

## Testes

Consulte `TESTE_ONE_SHOT_V09.md` e a pasta `test-results/`.


## Alterações específicas da v0.9.4

- Macro Hotbar corrigida para 5 páginas de 10 slots (50 slots).
- Botões anterior/próxima página agora funcionam.
- Teclas 1–0 executam macros da página atual.
- Backend aceita slots 0–49, mantendo compatibilidade com macros antigas nos slots 0–9.
- Build validada em simulação automatizada de campanha de 10 sessões: 154/154 verificações.
