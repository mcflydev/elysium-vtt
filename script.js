// =========================================================
// VALORES DOS ATRIBUTOS
// =========================================================

const valores = {
    forca: 1,
    destreza: 1,
    vigor: 1,
    carisma: 1,
    manipulacao: 1,
    autocontrole: 1,
    inteligencia: 1,
    raciocinio: 1,
    determinacao: 1
};


// =========================================================
// BOLINHAS DOS ATRIBUTOS
// =========================================================

const grupos = document.querySelectorAll(".dots");

grupos.forEach((grupo) => {

    const botoes = grupo.querySelectorAll("button");
    const atributo = grupo.dataset.attribute;

    if (!atributo) {
        console.warn(
            "O grupo de bolinhas não possui data-attribute:",
            grupo
        );
        return;
    }


    // ---------------------------------------------------------
    // Estado inicial
    // ---------------------------------------------------------

    marcarBolinhas(
        botoes,
        valores[atributo]
    );


    // ---------------------------------------------------------
    // Eventos
    // ---------------------------------------------------------

    botoes.forEach((botao) => {

        botao.addEventListener("click", () => {

            const valorClicado =
                Number(botao.dataset.value);

            const valorAtual =
                valores[atributo];


            // =================================================
            // CLICOU NA PRIMEIRA BOLINHA
            // =================================================

            if (
                valorClicado === 1 &&
                valorAtual === 1
            ) {

                valores[atributo] = 0;

                marcarBolinhas(
                    botoes,
                    0
                );

                atualizarRecursos();

                return;
            }


            // =================================================
            // CLICOU NA ÚLTIMA BOLINHA PREENCHIDA
            // =================================================

            if (
                valorClicado === valorAtual
            ) {

                valores[atributo] =
                    valorAtual - 1;

                marcarBolinhas(
                    botoes,
                    valores[atributo]
                );

                atualizarRecursos();

                return;
            }


            // =================================================
            // CLICOU EM UMA BOLINHA MAIS ALTA
            // =================================================

            valores[atributo] =
                valorClicado;

            marcarBolinhas(
                botoes,
                valorClicado
            );

            atualizarRecursos();
        });
    });
});


// =========================================================
// MARCAR BOLINHAS
// =========================================================

function marcarBolinhas(botoes, valor) {

    botoes.forEach((botao) => {

        const numero =
            Number(botao.dataset.value);

        if (numero <= valor) {

            botao.classList.add("active");

        } else {

            botao.classList.remove("active");
        }
    });
}


// =========================================================
// CRIAR / ATUALIZAR TRILHA DE RECURSO
// =========================================================

function criarTrilha(id, quantidade) {

    const trilha =
        document.getElementById(id);


    // =====================================================
    // VERIFICA SE A TRILHA EXISTE
    // =====================================================

    if (!trilha) {

        console.error(
            `Trilha não encontrada: ${id}`
        );

        return;
    }


    // =====================================================
    // QUANTIDADE ATUAL
    // =====================================================

    const caixasAtuais =
        Array.from(
            trilha.querySelectorAll(".damage-box")
        );

    const quantidadeAtual =
        caixasAtuais.length;


    // =====================================================
    // SE A QUANTIDADE NÃO MUDOU
    // =====================================================

    if (
        quantidadeAtual === quantidade
    ) {
        return;
    }


    // =====================================================
    // REDUÇÃO DA TRILHA
    // =====================================================

    if (
        quantidade < quantidadeAtual
    ) {

        for (
            let i = quantidadeAtual - 1;
            i >= quantidade;
            i--
        ) {

            const caixa =
                caixasAtuais[i];

            if (!caixa) continue;

            caixa.remove();
        }

        return;
    }


    // =====================================================
    // AUMENTO DA TRILHA
    // =====================================================

    for (
        let i = quantidadeAtual;
        i < quantidade;
        i++
    ) {

        const caixa =
            document.createElement("button");


        // -------------------------------------------------
        // Configura botão
        // -------------------------------------------------

        caixa.type = "button";

        caixa.classList.add(
            "damage-box"
        );


        // -------------------------------------------------
        // Estado inicial
        // -------------------------------------------------

        caixa.dataset.estado =
            "vazio";


        // -------------------------------------------------
        // Visual inicial
        // -------------------------------------------------

        atualizarVisualDano(caixa);


        // -------------------------------------------------
        // Clique
        // -------------------------------------------------

        caixa.addEventListener(
            "click",
            () => {

                alternarDano(caixa);
            }
        );


        // -------------------------------------------------
        // Adiciona ao DOM
        // -------------------------------------------------

        trilha.appendChild(caixa);
    }
}


// =========================================================
// ALTERNAR DANO
// =========================================================

function alternarDano(caixa) {

    const estado =
        caixa.dataset.estado;


    // =====================================================
    // VAZIO → SUPERFICIAL
    // =====================================================

    if (
        estado === "vazio"
    ) {

        caixa.dataset.estado =
            "superficial";
    }


    // =====================================================
    // SUPERFICIAL → AGRAVADO
    // =====================================================

    else if (
        estado === "superficial"
    ) {

        caixa.dataset.estado =
            "agravado";
    }


    // =====================================================
    // AGRAVADO → VAZIO
    // =====================================================

    else {

        caixa.dataset.estado =
            "vazio";
    }


    // =====================================================
    // ATUALIZA VISUAL
    // =====================================================

    atualizarVisualDano(caixa);
}


// =========================================================
// VISUAL DO DANO
// =========================================================

function atualizarVisualDano(caixa) {

    const estado =
        caixa.dataset.estado;


    // =====================================================
    // LIMPA CLASSES
    // =====================================================

    caixa.classList.remove(
        "superficial",
        "agravado"
    );


    // =====================================================
    // LIMPA TEXTO
    // =====================================================

    caixa.textContent = "";


    // =====================================================
    // VAZIO
    // =====================================================

    if (
        estado === "vazio"
    ) {

        caixa.textContent = "";
    }


    // =====================================================
    // SUPERFICIAL
    // =====================================================

    else if (
        estado === "superficial"
    ) {

        caixa.classList.add(
            "superficial"
        );

        caixa.textContent = "/";
    }


    // =====================================================
    // AGRAVADO
    // =====================================================

    else if (
        estado === "agravado"
    ) {

        caixa.classList.add(
            "agravado"
        );

        caixa.textContent = "X";
    }
}


// =========================================================
// ATUALIZAR RECURSOS
// =========================================================

function atualizarRecursos() {


    // =====================================================
    // VITALIDADE
    // =====================================================
    //
    // Vigor + 3
    //
    // =====================================================

    const vitalidade =
        valores.vigor + 3;


    // =====================================================
    // FORÇA DE VONTADE
    // =====================================================
    //
    // Autocontrole + Determinação
    //
    // =====================================================

    const forcaDeVontade =
        valores.autocontrole +
        valores.determinacao;


    // =====================================================
    // ATUALIZA VITALIDADE
    // =====================================================

    criarTrilha(
        "vitalidade-track",
        vitalidade
    );


    // =====================================================
    // ATUALIZA FORÇA DE VONTADE
    // =====================================================

    criarTrilha(
        "vontade-track",
        forcaDeVontade
    );
}


// =========================================================
// INICIALIZAÇÃO
// =========================================================

atualizarRecursos();

// =========================================================
// DISCIPLINAS
// =========================================================

const disciplinesGrid =
    document.getElementById(
        "disciplines-grid"
    );

const addDisciplineButton =
    document.getElementById(
        "add-discipline"
    );


// =========================================================
// DISCIPLINA QUE SERÁ EXCLUÍDA
// =========================================================

let disciplinaParaExcluir = null;


// =========================================================
// CONFIGURAR DISCIPLINA
// =========================================================

function configurarDisciplina(
    disciplina
) {

    // =====================================================
    // BOLINHAS DE NÍVEL
    // =====================================================

    const dots =
        disciplina.querySelector(
            ".discipline-dots"
        );


    if (dots) {

        const botoes =
            dots.querySelectorAll(
                "button"
            );

        let nivel =
            Number(
                dots.dataset.level
            ) || 1;


        // -------------------------------------------------
        // Estado inicial
        // -------------------------------------------------

        atualizarNivel(
            dots,
            nivel
        );


        // -------------------------------------------------
        // Clique nas bolinhas
        // -------------------------------------------------

        botoes.forEach(
            (botao) => {

                botao.addEventListener(
                    "click",
                    () => {

                        const valor =
                            Number(
                                botao.dataset.value
                            );


                        // =================================
                        // CLICOU NA ÚLTIMA MARCADA
                        // =================================

                        if (
                            valor === nivel
                        ) {

                            nivel =
                                nivel - 1;

                        }

                        // =================================
                        // CLICOU EM OUTRA
                        // =================================

                        else {

                            nivel =
                                valor;

                        }


                        atualizarNivel(
                            dots,
                            nivel
                        );

                    }
                );

            }
        );

    }


    // =====================================================
    // EXPANDIR / RECOLHER HABILIDADES
    // =====================================================

    const habilidades =
        disciplina.querySelectorAll(
            ".discipline-power"
        );


    habilidades.forEach(
        (habilidade) => {

            const botao =
                habilidade.querySelector(
                    ".power-expand"
                );


            if (!botao) {
                return;
            }


            const descricao =
                habilidade.nextElementSibling;


            if (!descricao) {
                return;
            }


            botao.addEventListener(
                "click",
                () => {

                    descricao.classList.toggle(
                        "open"
                    );


                    if (
                        descricao.classList.contains(
                            "open"
                        )
                    ) {

                        botao.textContent =
                            "▴";

                    } else {

                        botao.textContent =
                            "▾";

                    }

                }
            );

        }
    );


    // =====================================================
    // DELETE
    // =====================================================

    const deleteButton =
        disciplina.querySelector(
            ".discipline-delete"
        );


    if (deleteButton) {

        deleteButton.addEventListener(
            "click",
            () => {

                abrirConfirmacao(
                    disciplina
                );

            }
        );

    }

}


// =========================================================
// ATUALIZAR NÍVEL
// =========================================================

function atualizarNivel(
    dots,
    nivel
) {

    dots.dataset.level =
        nivel;


    const botoes =
        dots.querySelectorAll(
            "button"
        );


    botoes.forEach(
        (botao) => {

            const valor =
                Number(
                    botao.dataset.value
                );


            if (
                valor <= nivel
            ) {

                botao.classList.add(
                    "active"
                );

            } else {

                botao.classList.remove(
                    "active"
                );

            }

        }
    );

}


// =========================================================
// CRIAR DISCIPLINA
// =========================================================

function criarDisciplina() {

    const disciplina =
        document.createElement(
            "article"
        );


    disciplina.classList.add(
        "discipline-card"
    );


    disciplina.innerHTML = `

        <!-- =================================================
             CABEÇALHO
             ================================================= -->

        <div class="discipline-header">

            <input
                type="text"
                class="discipline-name"
                placeholder="Nome da Disciplina"
            >

            <div
                class="discipline-dots"
                data-level="1"
            >

                <button
                    type="button"
                    data-value="1"
                ></button>

                <button
                    type="button"
                    data-value="2"
                ></button>

                <button
                    type="button"
                    data-value="3"
                ></button>

                <button
                    type="button"
                    data-value="4"
                ></button>

                <button
                    type="button"
                    data-value="5"
                ></button>

            </div>

            <button
                type="button"
                class="discipline-delete"
                title="Excluir disciplina"
            >
                ×
            </button>

        </div>


        <!-- =================================================
             HABILIDADES
             ================================================= -->

        <div class="discipline-powers">

            <!-- Habilidade 1 -->

            <div class="discipline-power">

                <input
                    type="text"
                    class="power-name"
                    placeholder="Habilidade"
                >

                <button
                    type="button"
                    class="power-expand"
                >
                    ▾
                </button>

            </div>

            <div class="power-description">

                <textarea
                    placeholder="Descrição da habilidade..."
                ></textarea>

            </div>


            <!-- Habilidade 2 -->

            <div class="discipline-power">

                <input
                    type="text"
                    class="power-name"
                    placeholder="Habilidade"
                >

                <button
                    type="button"
                    class="power-expand"
                >
                    ▾
                </button>

            </div>

            <div class="power-description">

                <textarea
                    placeholder="Descrição da habilidade..."
                ></textarea>

            </div>


            <!-- Habilidade 3 -->

            <div class="discipline-power">

                <input
                    type="text"
                    class="power-name"
                    placeholder="Habilidade"
                >

                <button
                    type="button"
                    class="power-expand"
                >
                    ▾
                </button>

            </div>

            <div class="power-description">

                <textarea
                    placeholder="Descrição da habilidade..."
                ></textarea>

            </div>


            <!-- Habilidade 4 -->

            <div class="discipline-power">

                <input
                    type="text"
                    class="power-name"
                    placeholder="Habilidade"
                >

                <button
                    type="button"
                    class="power-expand"
                >
                    ▾
                </button>

            </div>

            <div class="power-description">

                <textarea
                    placeholder="Descrição da habilidade..."
                ></textarea>

            </div>


            <!-- Habilidade 5 -->

            <div class="discipline-power">

                <input
                    type="text"
                    class="power-name"
                    placeholder="Habilidade"
                >

                <button
                    type="button"
                    class="power-expand"
                >
                    ▾
                </button>

            </div>

            <div class="power-description">

                <textarea
                    placeholder="Descrição da habilidade..."
                ></textarea>

            </div>

        </div>

    `;


    // =====================================================
    // COLOCA ANTES DO +
    // =====================================================

    disciplinesGrid.insertBefore(
        disciplina,
        addDisciplineButton
    );


    // =====================================================
    // CONFIGURA EVENTOS
    // =====================================================

    configurarDisciplina(
        disciplina
    );


    // =====================================================
    // FOCA NO NOME
    // =====================================================

    const nome =
        disciplina.querySelector(
            ".discipline-name"
        );


    if (nome) {

        nome.focus();

    }

}


// =========================================================
// BOTÃO +
// =========================================================

addDisciplineButton.addEventListener(
    "click",
    () => {

        criarDisciplina();

    }
);


// =========================================================
// MODAL DE EXCLUSÃO
// =========================================================

const deleteModal =
    document.getElementById(
        "delete-discipline-modal"
    );


const confirmDelete =
    document.getElementById(
        "confirm-delete"
    );


const cancelDelete =
    document.getElementById(
        "cancel-delete"
    );


// =========================================================
// ABRIR MODAL
// =========================================================

function abrirConfirmacao(
    disciplina
) {

    disciplinaParaExcluir =
        disciplina;

    deleteModal.classList.add(
        "open"
    );

}


// =========================================================
// CANCELAR
// =========================================================

cancelDelete.addEventListener(
    "click",
    () => {

        disciplinaParaExcluir =
            null;

        deleteModal.classList.remove(
            "open"
        );

    }
);


// =========================================================
// CONFIRMAR DELETE
// =========================================================

confirmDelete.addEventListener(
    "click",
    () => {

        if (
            disciplinaParaExcluir
        ) {

            disciplinaParaExcluir.remove();

        }


        disciplinaParaExcluir =
            null;

        deleteModal.classList.remove(
            "open"
        );

    }
);


// =========================================================
// CLICAR FORA DO MODAL
// =========================================================

deleteModal.addEventListener(
    "click",
    (evento) => {

        if (
            evento.target ===
            deleteModal
        ) {

            disciplinaParaExcluir =
                null;

            deleteModal.classList.remove(
                "open"
            );

        }

    }
);


// =========================================================
// CONFIGURAR DISCIPLINA INICIAL
// =========================================================

document
    .querySelectorAll(
        ".discipline-card"
    )
    .forEach(
        (disciplina) => {

            configurarDisciplina(
                disciplina
            );

        }
    );

    // =========================================================
// RECURSOS — FOME / HUMANIDADE / RESSONÂNCIA
// =========================================================

const recursos = {
    fome: 0,
    humanidade: 7,
    maculas: 0,
    ressonancia: ""
};

const fomeTrack = document.getElementById("fome-track");
const humanidadeTrack = document.getElementById("humanidade-track");
const maculaValor = document.getElementById("macula-valor");
const adicionarMacula = document.getElementById("adicionar-macula");
const removerMacula = document.getElementById("remover-macula");
const ressonanciaInput = document.getElementById("ressonancia-input");


// =========================================================
// FOME
// =========================================================

function criarFome() {
    fomeTrack.innerHTML = "";

    for (let i = 1; i <= 5; i++) {
        const quadrado = document.createElement("button");
        quadrado.type = "button";
        quadrado.classList.add("recurso-quadrado");
        quadrado.dataset.valor = i;

        quadrado.addEventListener("click", () => {
            recursos.fome = (recursos.fome === i) ? i - 1 : i;
            atualizarFome();
        });

        fomeTrack.appendChild(quadrado);
    }

    atualizarFome();
}

function atualizarFome() {
    const quadrados = fomeTrack.querySelectorAll(".recurso-quadrado");
    quadrados.forEach((quadrado) => {
        const valor = Number(quadrado.dataset.valor);
        quadrado.classList.toggle("active", valor <= recursos.fome);
    });
}


// =========================================================
// HUMANIDADE
// =========================================================

function criarHumanidade() {
    humanidadeTrack.innerHTML = "";

    for (let i = 1; i <= 10; i++) {
        const quadrado = document.createElement("button");
        quadrado.type = "button";
        quadrado.classList.add("recurso-quadrado");
        quadrado.dataset.valor = i;

        quadrado.addEventListener("click", () => clicarHumanidade(i));

        humanidadeTrack.appendChild(quadrado);
    }

    atualizarHumanidade();
}

function clicarHumanidade(valor) {
    const inicioMacula = recursos.humanidade + 1;
    const fimMacula = recursos.humanidade + recursos.maculas;

    if (recursos.maculas > 0 && valor >= inicioMacula && valor <= fimMacula) {
        recursos.maculas = (valor === fimMacula)
            ? Math.max(0, recursos.maculas - 1)
            : valor - recursos.humanidade;

        atualizarHumanidade();
        return;
    }

    if (valor === recursos.humanidade) {
        recursos.humanidade = Math.max(0, recursos.humanidade - 1);
        limitarMaculas();
        atualizarHumanidade();
        return;
    }

    recursos.humanidade = valor;
    limitarMaculas();
    atualizarHumanidade();
}

function limitarMaculas() {
    const maximo = 10 - recursos.humanidade;
    recursos.maculas = Math.min(recursos.maculas, maximo);
}

function atualizarHumanidade() {

    const quadrados =
        humanidadeTrack.querySelectorAll(".recurso-quadrado");

    quadrados.forEach((quadrado) => {

        const valor =
            Number(quadrado.dataset.valor);

        quadrado.classList.remove(
            "active",
            "macula"
        );

        // =================================================
        // HUMANIDADE
        // =================================================

        if (valor <= recursos.humanidade) {

            quadrado.classList.add("active");

        }

        // =================================================
        // MÁCULAS
        // Começam no quadrado 10 e vão para trás
        // =================================================

        const inicioMacula =
            11 - recursos.maculas;

        if (
            recursos.maculas > 0 &&
            valor >= inicioMacula
        ) {

            quadrado.classList.remove("active");

            quadrado.classList.add("macula");

        }

    });

    humanidadeValor.textContent =
        recursos.humanidade;

    maculaValor.textContent =
        recursos.maculas;
}


// =========================================================
// RESSONÂNCIA
// =========================================================

ressonanciaInput.addEventListener("input", () => {
    recursos.ressonancia = ressonanciaInput.value;
});


// =========================================================
// MÁCULAS — botões
// =========================================================

adicionarMacula.addEventListener("click", () => {
    if (recursos.maculas >= 10 - recursos.humanidade) return;
    recursos.maculas++;
    atualizarHumanidade();
});

removerMacula.addEventListener("click", () => {
    if (recursos.maculas <= 0) return;
    recursos.maculas--;
    atualizarHumanidade();
});


// =========================================================
// INICIALIZAÇÃO
// =========================================================

criarFome();
criarHumanidade();