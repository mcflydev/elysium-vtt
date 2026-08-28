# ELYSIUM v0.9 — VTT narrativo + Cutscenes locais + Click & Play

Plataforma local para gerenciamento e realização de Crônicas de **Vampiro: A Máscara V5**.

> O jogador joga uma Crônica. O Mestre dirige uma Crônica.


## Sala da Crônica — VTT v0.9

A Sala agora é uma aplicação de mesa dedicada em `public/pages/vtt.html`, separada do dashboard de preparação da Crônica.

Principais recursos:

- Scene Navigation e Scene Directory com pastas;
- canvas com pan, zoom e grid quadrado/hexagonal/gridless;
- background, foreground, tiles inferiores/superiores e camada do Mestre;
- tokens vinculáveis a personagens/NPCs, barras, status, visão e proprietário;
- paredes, portas, portas secretas e bloqueio de visão/movimento/som;
- Fog of War, Explorer Mode, iluminação, escuridão global e Player View;
- régua, raio, cone, ping, FX, desenhos livres/retângulos/elipses/texto;
- Lápis e Borracha para jogadores; Mestre pode apagar qualquer objeto e limpar marcações em lote;
- tutorial integrado da interface e atalhos;
- imagens de cena, banner, avatar, token, tile, mapa e handout por upload do PC;
- Cutscenes MP4/WebM locais com Lançar, Pausar, Retomar e Encerrar sincronizados;
- resultados V5 em overlay cinematográfico com dados visuais em formato d10;
- regiões interativas, notas no mapa, sons posicionais e clima;
- Combat Tracker, encontros, rodadas e iniciativa;
- Chat, sussurros, rolagens V5 e rolagens secretas do Mestre;
- Actors, Items, Journal/Handouts, Rollable Tables, Cards/Decks;
- Playlists/Jukebox, mídia ativa e volumes locais;
- Compendium V5, macros e hotbar 1–0;
- pausa da mesa, presença online e cursores remotos.

O VTT usa Roll20 e Foundry como **referências de fluxo e categorias de ferramenta**, mas a implementação, interface e código são próprios do Elysium. Consulte `docs/VTT_V09.md` para detalhes, testes e limitações.

## Windows — modo recomendado

1. Extraia a pasta inteira do Elysium.
2. Dê dois cliques em **`Elysium.exe`**.
3. Na primeira execução, o Elysium baixa automaticamente o runtime **Node.js LTS oficial** para `runtime/node.exe`. Esse passo acontece apenas uma vez e precisa de internet.
4. O servidor inicia escondido e o navegador abre automaticamente.
5. Para encerrar o servidor, dê dois cliques em **`Fechar Elysium.exe`**.

Não é necessário instalar Node.js manualmente.

### Arquivos de fallback

Caso uma política local do Windows bloqueie executáveis não assinados, os mesmos lançadores também existem em formato legível:

- `Abrir Elysium.cmd`
- `Fechar Elysium.cmd`

Os scripts usados pelos executáveis estão visíveis em `launcher.ps1` e `stop-elysium.ps1`.

## Jogar usando Radmin VPN

### Mestre / host

1. Abra o Radmin VPN.
2. Crie uma rede ou entre em uma já existente.
3. Abra `Elysium.exe`.
4. A página inicial tenta detectar automaticamente o IP do Radmin. Endereços do Radmin normalmente aparecem como `26.x.x.x`.
5. Copie o endereço exibido na seção **Jogar com amigos via Radmin**.
6. Envie o endereço aos jogadores.
7. Se o Firewall do Windows solicitar acesso, permita o Elysium/Node em **redes privadas**.

Exemplo:

```text
http://26.123.45.67:3000
```

### Jogador

1. Abra o Radmin VPN.
2. Entre na mesma rede do Mestre.
3. Cole no navegador o endereço enviado pelo Mestre.
4. Faça login/cadastro no Elysium.
5. Entre na Crônica usando o código de convite.

O jogador **não** usa `localhost`. `localhost` aponta para o próprio computador e só deve ser usado pelo host.

## Sem executável / desenvolvimento

Requer Node.js 22.13+.

```bash
npm start
```

Abra:

```text
http://localhost:3000
```

No GitHub Codespaces, abra a porta exibida pelo servidor na aba **PORTS**.

## Banco de dados

O banco é criado automaticamente em:

```text
data/elysium.db
```

O banco, personagens, Crônicas e usuários ficam na máquina que hospeda o Elysium. O Radmin apenas fornece a rede privada usada pelos jogadores para alcançar o servidor.

## Segurança

- Senhas usam `scrypt` com salt e não são armazenadas em texto puro.
- Sessões usam cookie HttpOnly.
- Permissões são verificadas no servidor.
- O primeiro usuário cadastrado é o administrador global da instalação local.

## Principais módulos

- autenticação e painel administrativo;
- Crônicas e convites;
- permissões Dono / Mestre / Co-Mestre / Jogador / Espectador;
- personagens e ficha V5;
- Fome, Humanidade, Máculas, Saúde, Força de Vontade e Potência de Sangue;
- rolagens V5 com dados de Fome e resultados especiais;
- solicitações de teste;
- Sala da Crônica e Diretor da Crônica;
- cenas, chat, sussurros e notas privadas;
- NPCs e Diário;
- temporadas, episódios, atos e timeline;
- mídia, cutscenes e eventos;
- mapas e marcadores;
- conflitos e relógios narrativos;
- modo transmissão.

## Estrutura resumida

```text
ELYSIUM-completo/
├── Elysium.exe
├── Fechar Elysium.exe
├── launcher.ps1
├── stop-elysium.ps1
├── runtime/
├── public/
├── server/
├── data/
├── docs/
├── package.json
└── README.md
```

## Observação sobre o executável

Os executáveis incluídos são lançadores Windows x64 sem assinatura digital. O código-fonte do lançador fica em `launcher-source/elysium-launcher.c` e os scripts PowerShell permanecem legíveis para auditoria. O runtime baixado na primeira execução vem diretamente do repositório oficial de releases do Node.js.

## Histórico da Sala da Crônica — base anterior (v0.7)

A Sala da Crônica foi reorganizada para funcionar como uma mesa virtual centralizada:

- cena atual ocupa a área principal da tela;
- cenas preparadas ficam em uma barra superior para a equipe de narração;
- toolbox lateral dá acesso rápido a ficha, rolagens, notas e mapas;
- sidebar da Sala reúne Chat, Cenas, Áudio e Diretor;
- novas cenas podem ser criadas e ativadas sem sair da Sala;
- músicas/ambientes podem ser pesquisados, adicionados à biblioteca e enviados à mesa sem sair da Sala;
- o player de mídia fica disponível em um controle compacto no rodapé da mesa;
- presença online é exibida diretamente no painel do Diretor;
- jogadores comuns recebem apenas a cena atualmente revelada, evitando exposição de cenas preparadas.

A organização se inspira no fluxo tradicional de VTTs (tabletop + toolbox + páginas/cenas + sidebar), mas o visual e os recursos continuam voltados ao Elysium e a Vampiro V5.
