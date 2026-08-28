# ELYSIUM v0.9.3 — Teste Difícil da Fog

## Motivo do hotfix

O teste difícil encontrou um vazamento de linha de visão que não apareceu nas baterias anteriores: quando uma parede ou porta encostava exatamente nas bordas do mapa, um token com alcance grande conseguia calcular raios por fora da cena e "dar a volta" na extremidade da parede.

## Correção

As quatro bordas da cena agora entram no cálculo de visão como bloqueadores virtuais. A correção foi aplicada nos dois lados:

- cálculo do Explorer no servidor;
- visão/Fog renderizada no navegador.

Isso impede a visão de sair do mapa para contornar uma parede, porta ou porta secreta que termina na borda da cena.

## Teste difícil

Cenário com 1 Mestre, 3 jogadores, 4 tokens, múltiplos tokens por jogador, barreira de ponta a ponta, porta normal, porta secreta, Fog global, Explorer, duas cenas, movimento de token, 25+ gravações concorrentes e polling concorrente.

Resultado após o hotfix: **48/48**.

## Regressão

Depois da correção foram repetidas as baterias anteriores:

- geometria: **21/21**;
- interface/estrutura: **28/28**;
- polling/sincronização: **7/7**;
- API Mestre/Jogadores: **37/37**.

Somando o cenário difícil e a regressão: **141/141 verificações aprovadas**.

## Observação

Uma falha inicialmente registrada no teste de recorte parcial era erro na expectativa matemática do próprio teste (a área restante correta era 25.000, não 20.000). O algoritmo de Ocultar estava correto e não precisou de alteração nesse ponto.
