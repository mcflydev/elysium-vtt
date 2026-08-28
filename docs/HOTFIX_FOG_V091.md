# ELYSIUM v0.9.1 — Hotfix Fog

## Problema corrigido

Na v0.9.0, o painel da ferramenta era reconstruído pelo polling da cena a cada ~2,2 s. Isso recriava o seletor de Fog com **Revelar** como valor padrão e fazia **Ocultar** voltar sozinho para Revelar.

## Correções

- O polling atualiza a cena sem reconstruir os controles da ferramenta.
- O modo do Fog é armazenado no estado da Sala (`reveal` / `hide`).
- A ação final do Fog usa o estado persistente, não o valor de um `<select>` recém-renderizado.
- **Ocultar** agora recorta somente a área selecionada de uma região revelada, em vez de remover todo o retângulo revelado que tenha interseção.

## Testes do hotfix

- `npm run check`: aprovado.
- `node --check` em todos os JS de `public/js` e `server`: aprovado.
- Geometria do recorte de Fog: 4/4 casos aprovados (sem sobreposição, corte total, corte central e ausência de sobreposição residual).
- Verificação estrutural: `renderScene()` não recria mais `renderToolOptions()` durante o polling; `openScene()` e `setTool()` continuam atualizando os controles quando necessário.
- Smoke test do servidor: inicialização e carregamento das páginas principais aprovados.
