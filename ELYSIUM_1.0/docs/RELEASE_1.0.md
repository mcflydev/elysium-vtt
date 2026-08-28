# ELYSIUM 1.0 — Verificação final de release

## Resultado

A build promovida para **1.0.0** foi verificada novamente a partir da v0.9.4 testada, sem reutilizar banco ou Crônica da campanha anterior.

### Baterias executadas

- Campanha automatizada de 10 sessões: **154/154**.
- Fog — geometria: **21/21**.
- Fog — sincronização/polling: **7/7**.
- Fog — auditoria estática da interface: **28/28**.
- Fog — API Mestre/Jogadores: **37/37**.
- Fog — cenário difícil: **48/48**.
- Total da regressão dedicada da Fog: **141/141**.
- `npm run check`: aprovado.
- Todos os arquivos JavaScript em `public/js` e `server`: `node --check` aprovado.
- Referências locais de `src`/`href` das páginas: **0 ausentes**.
- Auditoria de controles HTML com IDs: nenhum botão funcional órfão detectado; `dice-submit` é tratado pelo evento `submit` do formulário.
- SQLite após teste pesado: `PRAGMA integrity_check = ok`; `PRAGMA foreign_key_check` sem violações.

## Correção feita nesta promoção

Foi corrigido o caminho de importação do arquivo `tests/fog-hard.test.mjs`. O erro estava apenas na infraestrutura de testes e impedia executar essa suíte diretamente a partir da pasta `tests`; não afetava a aplicação em runtime.

## Estado da release

A release 1.0 é considerada funcionalmente jogável dentro do escopo automatizado coberto. A limitação do ambiente de testes permanece: o Chromium do sandbox bloqueia acesso automatizado a `127.0.0.1`, portanto interações puramente visuais continuam sendo cobertas por auditoria de handlers/estrutura e pelos testes de estado/API, e não por uma sessão E2E completa de navegador nesse ambiente.
