# ELYSIUM v0.9 — Relatório de teste da one-shot

Data da bateria: 28/08/2026.

## Resultado

**123/123 verificações aprovadas** nas três baterias executáveis:

- 49/49 — fluxo funcional Mestre + Jogadores e estado da sessão;
- 28/28 — regressão dos módulos/diretórios auxiliares;
- 46/46 — auditoria estática de interface, permissões, uploads e componentes.

Os JSONs completos estão em `docs/test-results/`.

## One-shot simulada

A simulação usou um Mestre e dois jogadores em sessões autenticadas independentes. O fluxo percorreu criação de Crônica e convite, ficha, cena VTT, token, tile, parede, colisão, pausa da mesa, desenhos, borracha por autoria, pings, Fog, rolagens V5 públicas e secretas, chat, Cutscene local e retorno ao cenário.

A Cutscene foi testada no ciclo **Lançar → posição avançando → Pausar → Retomar do ponto salvo → Encerrar**, além do endpoint usado pelo evento de fim natural do vídeo. A limpeza em lote removeu marcações sem apagar token ou tile preparados.

## Recursos adicionais verificados

Também foram percorridos XP, solicitações de rolagem, notas privadas/reveláveis, sussurros, NPC Engine, Diário, Atos/Timeline, mídia, eventos, mapas e marcadores, relógios, conflitos, pastas de cenas, itens/handouts, Rollable Tables, Cards/Decks, macros/hotbar, portas, luzes e sons posicionais.

## Problema encontrado durante os testes

A auditoria detectou que o botão **Lápis** existia no HTML e o código de desenho existia, mas `draw` não estava registrado em `toolConfig`. Isso impediria a ativação normal da ferramenta. O defeito foi corrigido antes do empacotamento e a auditoria foi repetida com 46/46 aprovações.

## Limitação do ambiente de teste visual

O servidor local respondeu normalmente por HTTP e todas as baterias funcionais foram executadas contra ele. Porém, o Chromium fornecido pelo ambiente de execução bloqueou tanto `http://127.0.0.1` quanto `file://` com `ERR_BLOCKED_BY_ADMINISTRATOR`. Portanto, **não foi possível contabilizar uma automação end-to-end com screenshot do navegador nesta execução**.

Essa limitação não foi convertida artificialmente em “teste aprovado”. Para compensar, foram executados testes de API com sessões independentes, `node --check` em todo JavaScript, busca global de campos URL de imagem e 46 verificações estruturais específicas do HTML/CSS/JS. A interface deve receber um smoke test manual no navegador do host após extrair o ZIP, especialmente autoplay de vídeo, que depende das políticas do navegador.
