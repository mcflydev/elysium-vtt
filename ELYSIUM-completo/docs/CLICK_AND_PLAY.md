# Click & Play / Radmin

## Objetivo

Permitir que uma pessoa sem conhecimento de Node.js ou terminal hospede o Elysium no Windows com dois cliques.

## Fluxo

```text
Elysium.exe
   ↓
launcher.ps1
   ↓
runtime/node.exe (baixado automaticamente apenas na primeira execução)
   ↓
server/server.js
   ↓
http://127.0.0.1:3000
   ↓
Navegador
```

## Rede

O servidor escuta em `0.0.0.0`, portanto interfaces locais e virtuais podem alcançá-lo. A API `/api/system/network` lista os IPv4 disponíveis. A página inicial prioriza endereços `26.x.x.x` como provável interface do Radmin VPN.

## Encerramento

`Fechar Elysium.exe` executa `stop-elysium.ps1`, que usa o PID gravado em `data/elysium.pid` para encerrar apenas o servidor iniciado pelo launcher.

## Desenvolvimento

Os executáveis são apenas lançadores. O projeto permanece editável normalmente em `public/` e `server/`.
