# Arquitetura do Elysium

## Fluxo

```text
Navegador (HTML/CSS/JS)
        ↓ fetch /api/*
Servidor Node.js
        ↓
SQLite (data/elysium.db)
```

## Responsabilidades

### `public/`
Interface do usuário. Não contém senha, regra de autorização definitiva ou acesso direto ao banco.

### `server/server.js`
Rotas HTTP, validações de segurança, permissões, regras de rolagem V5 e acesso ao banco.

### `server/auth.js`
Hash de senha, sessões e cookies.

### `server/db.js`
Abre o SQLite, aplica o schema e pequenas migrações.

### `server/schema.sql`
Fonte da estrutura de dados.

## Regra importante

Validação de frontend existe para UX. **Permissão e validação de segurança são sempre repetidas no servidor.**

Exemplo: esconder o botão "Excluir Crônica" não é segurança. O endpoint DELETE também verifica se o usuário é o dono/Admin.

## Tempo real

A versão local usa polling:

- chat: ~2,5 s;
- estado da Sala: ~3 s;
- solicitações de rolagem: ~3,5 s.

Isso foi escolhido para manter o projeto simples e sem dependências. Uma evolução futura pode substituir polling por WebSocket sem reescrever o banco.

## Dados JSON no SQLite

Algumas estruturas variáveis ficam como JSON textual:

- atributos/perícias da ficha;
- Disciplinas e Vantagens;
- passos de cutscene;
- marcadores de mapa;
- participantes de conflito.

As entidades principais continuam relacionais: usuários, Crônicas, membros, personagens, rolagens, notas etc.

## Administração

Existem dois níveis:

1. **Admin global**: administra a instalação local inteira.
2. **Dono/Mestre/Co-Mestre**: administra apenas a Crônica em que possui essa função.

## Backup

Pare o Node e copie `data/elysium.db`.
