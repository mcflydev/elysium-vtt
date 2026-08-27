# Status do escopo do Documento de Concepção

Esta versão implementa uma base funcional local para todos os grandes módulos definidos no documento original.

## Funcional agora

- Hub de Crônicas
- autenticação e sessões
- painel Admin global
- Dono / Mestre / Co-Mestre / Jogador / Espectador
- convites
- presença online
- fichas V5
- atributos / perícias / rastreadores
- Disciplinas / Vantagens / Defeitos / Convicções / Touchstones
- XP e histórico
- rolagens V5 e dados de Fome
- crítico / Crítico Bestial / Falha Bestial
- histórico/chat de rolagens
- solicitação de rolagem pelo Mestre
- animação/aviso de nova rolagem
- Sala da Crônica
- cenas e Cena Atual
- Diretor da Crônica
- notas privadas, seletivas e revelações
- chat e sussurros
- Diário
- NPC Engine
- temporadas / episódios / atos
- Timeline
- música e mídia ativa
- cutscenes
- eventos narrativos
- mapas narrativos/táticos
- grid e marcadores
- conflitos / rodadas
- relógios narrativos
- modo transmissão

## Implementação simplificada nesta versão

Alguns itens do documento estão presentes como uma primeira versão funcional, mas ainda não têm profundidade de um VTT comercial:

- **Tempo real:** polling, não WebSocket.
- **YouTube:** pesquisa abre o YouTube; sem YouTube Data API.
- **Sincronização musical:** estado ativo sincronizado; autoplay depende do navegador.
- **Mapa tático:** grid + marcadores; ainda sem fog of war avançado ou drag-and-drop de tokens.
- **Conflitos detalhados:** rastreador de rodada e participantes; não é um motor tático completo.
- **Cutscenes:** URLs e etapas; sem upload/streaming próprio.
- **OBS/Transmissão:** tela limpa funcional, ainda sem editor de overlay.
- **Recap:** registrado manualmente no Diário, sem geração automática.

Esses pontos foram mantidos separados para que o projeto continue compreensível e modificável por um desenvolvedor solo/júnior.
