# ELYSIUM v0.9.2 — Auditoria completa do Fog of War

## Resultado

**93/93 verificações aprovadas.**

- Geometria / Revelar-Ocultar / ray casting: **21/21**
- Servidor real, Mestre + 2 jogadores: **37/37**
- Interface e integração estrutural: **28/28**
- Concorrência e polling: **7/7**

## Problemas encontrados e corrigidos

1. O Explorer Mode gravava um retângulo ao redor do token e podia revelar permanentemente áreas através de paredes. Agora grava o polígono real de linha de visão calculado pelo servidor.
2. Um token com visão desativada ainda podia abrir Fog no renderizador. Agora somente tokens com `vision_enabled` participam da visão.
3. Portas secretas eram removidas do payload do jogador e, por isso, não bloqueavam o ray casting do Fog no cliente. Agora chegam como paredes comuns não interativas, sem expor o tipo secreto, e o servidor calcula o Explorer com a geometria real.
4. O endpoint de Explorer aceitava áreas enviadas pelo próprio jogador. Agora o jogador informa apenas o token controlado; o servidor valida propriedade, estado e calcula a área explorada.
5. Cada movimento devolvia todo o histórico do Explorer. Agora retorna apenas a nova área, reduzindo tráfego durante sessões longas.
6. Respostas de polling atrasadas podiam competir com uma edição local de Fog. Foram adicionadas gerações/locks de sincronização e testes específicos.
7. O botão Resetar era ambíguo quando Explorer Mode estava ativo. Agora existem **Resetar revelado** e **Limpar Explorer**.
8. O tutorial passou a explicar Revelar, Ocultar, Explorer e o efeito de paredes/portas sobre visão.

## Casos validados

- Revelar retangular.
- Ocultar parcial, total, lateral e com recortes repetidos.
- Persistência do Fog global.
- Limites da cena e shapes inválidos.
- Limite de fragmentação do Fog manual.
- Explorer individual por jogador.
- Explorer limitado a 100 snapshots.
- Jogador não altera Fog global.
- Jogador não usa token de outro usuário para explorar.
- Jogador não injeta manualmente uma área explorada.
- Token oculto ou com visão desativada não explora.
- Parede com `blocks_vision`.
- Parede sem `blocks_vision`.
- Porta normal aberta, fechada e trancada.
- Porta secreta aberta e fechada.
- Porta secreta não vira controle clicável para o jogador.
- Visão de múltiplos tokens controlados.
- Fog e iluminação usam os mesmos polígonos de visão.
- Reset do Fog global.
- Limpeza do Explorer de todos os jogadores pelo Mestre.
- Jogador não pode limpar Explorer da mesa.
- Polling não recria o seletor Fog.
- `Ocultar` permanece selecionado após ciclos de sincronização.
- Polling iniciado antes de uma edição não sobrescreve Fog/Explorer local recente.
- Compatibilidade com áreas retangulares antigas do Explorer.

## Limitação do ambiente de teste

Foi iniciado Chromium 144 via DevTools Protocol. O próprio Chromium do ambiente bloqueou o acesso ao servidor local com a página administrativa:

> `127.0.0.1 is blocked — Your organization doesn’t allow you to view this site`

Por isso, a automação browser→localhost não pôde ser contabilizada como teste aprovado. O comportamento que originou o hotfix (seletor Ocultar + polling) foi validado diretamente na lógica usada pelo frontend e em testes de sincronização, sem contabilizar o Chromium bloqueado.

Os JSONs completos dos testes estão em `docs/test-results/`.
