# Elysium — Starter Local

Base inicial do **Elysium**, um gerenciador open-source de Crônicas de Vampiro: A Máscara V5.

Esta versão foi pensada para um projeto solo e usa uma stack pequena:

- HTML
- CSS
- JavaScript no navegador
- Node.js no servidor
- SQLite local através do módulo `node:sqlite`

Não há React, TypeScript, Express ou ORM.

## O que já funciona

- Landing page
- Cadastro de usuário
- Validação local no navegador
- Validação novamente no servidor
- Senhas protegidas com `scrypt` + salt
- Login
- Sessão por cookie HttpOnly
- Logout
- Banco SQLite criado automaticamente
- Tela "Minhas Crônicas"
- Criação e listagem de Crônicas
- Servidor ouvindo a rede local / Radmin através de `0.0.0.0`

## Requisito

Use **Node.js 22.13 ou superior**.

Em algumas versões do Node 22, o terminal pode mostrar um aviso dizendo que SQLite ainda é experimental. Para este protótipo local isso não impede o funcionamento.

## Como executar

Abra o terminal na pasta do projeto e rode:

```bash
npm start
```

Depois acesse:

```text
http://localhost:3000
```

Para reinício automático durante desenvolvimento:

```bash
npm run dev
```

## Banco de dados

Na primeira execução, o Elysium cria automaticamente:

```text
data/elysium.db
```

O arquivo não deve ser commitado no Git. O `.gitignore` já está configurado.

Se você quiser apagar todos os dados de desenvolvimento e começar do zero, encerre o servidor e remova:

```text
data/elysium.db
data/elysium.db-shm
data/elysium.db-wal
```

Depois execute o servidor novamente.

## Acesso por outra máquina / Radmin VPN

Quando o servidor inicia, ele mostra endereços parecidos com:

```text
Local: http://localhost:3000
Rede:  http://192.168.0.10:3000
Rede:  http://26.x.x.x:3000
```

Se o Radmin VPN estiver ativo, procure o endereço correspondente à interface dele, normalmente na faixa mostrada pelo próprio Radmin.

Na outra máquina, abra no navegador:

```text
http://IP_DO_PC_QUE_HOSPEDA:3000
```

Exemplo:

```text
http://26.10.20.30:3000
```

Talvez seja necessário permitir o Node.js na Firewall do Windows para redes privadas.

## Importante sobre segurança

Esta arquitetura foi feita para **desenvolvimento, LAN e VPN privada**.

Não exponha a porta `3000` diretamente para a internet. Antes de transformar o Elysium em um serviço público, será necessário adicionar HTTPS, políticas de segurança, proteção adicional de sessão, recuperação de senha e outras medidas.

## Estrutura

```text
elysium-starter/
│
├── package.json
├── README.md
├── .gitignore
│
├── data/
│   └── elysium.db                 # criado automaticamente
│
├── public/
│   ├── index.html
│   │
│   ├── pages/
│   │   ├── login.html
│   │   ├── cadastro.html
│   │   └── cronicas.html
│   │
│   ├── css/
│   │   ├── index.css
│   │   ├── login.css
│   │   ├── cadastro.css
│   │   └── cronicas.css
│   │
│   └── js/
│       ├── api.js
│       ├── login.js
│       ├── cadastro.js
│       └── cronicas.js
│
└── server/
    ├── server.js
    ├── db.js
    ├── auth.js
    └── schema.sql
```

## Fluxo atual

```text
Landing
   ↓
Cadastro ─────┐
   ↓          │
SQLite        │
   ↓          │
Sessão        │
   ↓          │
Minhas Crônicas

Login ────────┘
```

## Próxima etapa recomendada

A próxima etapa do projeto é criar a página individual de uma Crônica e, depois, o fluxo de criação de personagem.
