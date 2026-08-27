import { apiRequest, ApiError } from "./api.js";

const userName = document.querySelector("#user-name");
const logoutButton = document.querySelector("#logout-button");
const chroniclesContent = document.querySelector("#chronicles-content");

const newChronicleButton = document.querySelector("#new-chronicle-button");
const createPanel = document.querySelector("#create-panel");
const closePanelButton = document.querySelector("#close-panel-button");
const chronicleForm = document.querySelector("#chronicle-form");
const chronicleNameInput = document.querySelector("#chronicle-name");
const chronicleCityInput = document.querySelector("#chronicle-city");
const chronicleDescriptionInput = document.querySelector("#chronicle-description");
const chronicleNameError = document.querySelector("#chronicle-name-error");
const chronicleFormError = document.querySelector("#chronicle-form-error");
const createButton = document.querySelector("#create-button");

function redirectToLogin() {
    window.location.href = "/pages/login.html";
}

function setCreateLoading(isLoading) {
    createButton.disabled = isLoading;
    createButton.textContent = isLoading ? "Criando..." : "Criar Crônica";
    chronicleForm.setAttribute("aria-busy", String(isLoading));
}

function openCreatePanel() {
    createPanel.hidden = false;
    newChronicleButton.setAttribute("aria-expanded", "true");
    chronicleNameInput.focus();
}

function closeCreatePanel() {
    createPanel.hidden = true;
    newChronicleButton.setAttribute("aria-expanded", "false");
    chronicleNameError.textContent = "";
    chronicleNameInput.classList.remove("is-invalid");
    chronicleFormError.hidden = true;
}

function createTextElement(tagName, className, text) {
    const element = document.createElement(tagName);
    element.className = className;
    element.textContent = text;
    return element;
}

function roleLabel(role) {
    const labels = {
        owner: "Dono / Mestre",
        master: "Mestre",
        "co-master": "Co-Mestre",
        player: "Jogador"
    };

    return labels[role] ?? role;
}

function statusLabel(status) {
    const labels = {
        active: "Em andamento",
        paused: "Pausada",
        finished: "Encerrada"
    };

    return labels[status] ?? status;
}

function renderEmptyState() {
    chroniclesContent.replaceChildren();

    const empty = document.createElement("div");
    empty.className = "empty-state";

    empty.append(
        createTextElement("p", "eyebrow", "Primeira noite"),
        createTextElement("h2", "", "Você ainda não possui nenhuma Crônica."),
        createTextElement(
            "p",
            "empty-description",
            "Crie sua primeira Crônica e comece a reunir sua mesa no Elysium."
        )
    );

    const button = document.createElement("button");
    button.type = "button";
    button.className = "empty-action";
    button.textContent = "Criar primeira Crônica";
    button.addEventListener("click", openCreatePanel);

    empty.append(button);
    chroniclesContent.append(empty);
}

function renderChronicles(chronicles) {
    if (chronicles.length === 0) {
        renderEmptyState();
        return;
    }

    const grid = document.createElement("div");
    grid.className = "chronicles-grid";

    for (const chronicle of chronicles) {
        const article = document.createElement("article");
        article.className = "chronicle-card";

        const top = document.createElement("div");
        top.className = "chronicle-card-top";

        const status = createTextElement(
            "span",
            `status status-${chronicle.status}`,
            statusLabel(chronicle.status)
        );

        const role = createTextElement(
            "span",
            "chronicle-role",
            roleLabel(chronicle.role)
        );

        top.append(status, role);

        const title = createTextElement("h2", "chronicle-title", chronicle.name);
        const city = createTextElement(
            "p",
            "chronicle-city",
            chronicle.city || "Local ainda não definido"
        );
        const description = createTextElement(
            "p",
            "chronicle-description",
            chronicle.description || "Nenhuma descrição registrada."
        );

        const footer = document.createElement("div");
        footer.className = "chronicle-card-footer";

        const date = new Date(`${chronicle.created_at}Z`);
        const formattedDate = Number.isNaN(date.getTime())
            ? ""
            : new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(date);

        footer.append(
            createTextElement("span", "chronicle-date", formattedDate)
        );

        article.append(top, title, city, description, footer);
        grid.append(article);
    }

    chroniclesContent.replaceChildren(grid);
}

async function loadPage() {
    try {
        const [meData, chroniclesData] = await Promise.all([
            apiRequest("/api/me"),
            apiRequest("/api/chronicles")
        ]);

        userName.textContent = meData.user.name;
        renderChronicles(chroniclesData.chronicles);
    } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
            redirectToLogin();
            return;
        }

        chroniclesContent.textContent = "Não foi possível carregar suas Crônicas.";
    }
}

newChronicleButton.addEventListener("click", () => {
    if (createPanel.hidden) {
        openCreatePanel();
    } else {
        closeCreatePanel();
    }
});

closePanelButton.addEventListener("click", closeCreatePanel);

chronicleNameInput.addEventListener("input", () => {
    chronicleNameError.textContent = "";
    chronicleNameInput.classList.remove("is-invalid");
    chronicleFormError.hidden = true;
});

chronicleForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const name = chronicleNameInput.value.trim();
    const city = chronicleCityInput.value.trim();
    const description = chronicleDescriptionInput.value.trim();

    chronicleNameError.textContent = "";
    chronicleNameInput.classList.remove("is-invalid");
    chronicleFormError.hidden = true;

    if (name.length < 2) {
        chronicleNameError.textContent = "Informe um nome para a Crônica.";
        chronicleNameInput.classList.add("is-invalid");
        chronicleNameInput.focus();
        return;
    }

    setCreateLoading(true);

    try {
        await apiRequest("/api/chronicles", {
            method: "POST",
            body: JSON.stringify({ name, city, description })
        });

        chronicleForm.reset();
        closeCreatePanel();

        const data = await apiRequest("/api/chronicles");
        renderChronicles(data.chronicles);
    } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
            redirectToLogin();
            return;
        }

        chronicleFormError.textContent =
            error instanceof ApiError
                ? error.message
                : "Não foi possível criar a Crônica.";
        chronicleFormError.hidden = false;
    } finally {
        setCreateLoading(false);
    }
});

logoutButton.addEventListener("click", async () => {
    logoutButton.disabled = true;
    logoutButton.textContent = "Saindo...";

    try {
        await apiRequest("/api/logout", { method: "POST" });
    } finally {
        redirectToLogin();
    }
});

loadPage();
