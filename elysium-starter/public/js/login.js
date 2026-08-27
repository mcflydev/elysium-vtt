import { apiRequest, ApiError } from "./api.js";

// =========================================================
// ELEMENTOS DA PÁGINA
// =========================================================

const loginForm = document.querySelector("#login-form");
const emailInput = document.querySelector("#email");
const passwordInput = document.querySelector("#password");
const emailError = document.querySelector("#email-error");
const passwordError = document.querySelector("#password-error");
const loginError = document.querySelector("#login-error");
const showPasswordButton = document.querySelector("#show-password");
const loginButton = document.querySelector("#login-button");

// =========================================================
// FUNÇÕES AUXILIARES
// =========================================================

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function setFieldError(input, errorElement, message) {
    input.classList.add("is-invalid");
    input.setAttribute("aria-invalid", "true");
    errorElement.textContent = message;
}

function clearFieldError(input, errorElement) {
    input.classList.remove("is-invalid");
    input.removeAttribute("aria-invalid");
    errorElement.textContent = "";
}

function setLoading(isLoading) {
    loginButton.disabled = isLoading;
    loginButton.textContent = isLoading ? "Entrando..." : "Entrar";
    loginForm.setAttribute("aria-busy", String(isLoading));
}

function hideGeneralError() {
    loginError.hidden = true;
    loginError.textContent = "";
}

// =========================================================
// MOSTRAR / OCULTAR SENHA
// =========================================================

showPasswordButton.addEventListener("click", () => {
    const passwordIsVisible = passwordInput.type === "text";
    const nextType = passwordIsVisible ? "password" : "text";

    passwordInput.type = nextType;
    showPasswordButton.textContent = passwordIsVisible ? "Mostrar" : "Ocultar";
    showPasswordButton.setAttribute("aria-pressed", String(!passwordIsVisible));
    showPasswordButton.setAttribute(
        "aria-label",
        passwordIsVisible ? "Mostrar senha" : "Ocultar senha"
    );
});

// =========================================================
// VALIDAÇÃO LOCAL
// =========================================================

function validateForm() {
    const email = emailInput.value.trim();
    const password = passwordInput.value;

    clearFieldError(emailInput, emailError);
    clearFieldError(passwordInput, passwordError);
    hideGeneralError();

    let firstInvalidField = null;

    if (email === "") {
        setFieldError(emailInput, emailError, "Informe seu e-mail.");
        firstInvalidField = emailInput;
    } else if (!isValidEmail(email)) {
        setFieldError(emailInput, emailError, "Informe um e-mail válido.");
        firstInvalidField = emailInput;
    }

    if (password === "") {
        setFieldError(passwordInput, passwordError, "Informe sua senha.");
        firstInvalidField ??= passwordInput;
    }

    if (firstInvalidField) {
        firstInvalidField.focus();
        return null;
    }

    return { email, password };
}

// =========================================================
// LOGIN
// =========================================================

loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const credentials = validateForm();

    if (!credentials) {
        return;
    }

    setLoading(true);

    try {
        await apiRequest("/api/login", {
            method: "POST",
            body: JSON.stringify(credentials)
        });

        window.location.href = "/pages/cronicas.html";
    } catch (error) {
        if (error instanceof ApiError) {
            loginError.textContent = error.message;
        } else {
            loginError.textContent = "Não foi possível conectar ao Elysium.";
        }

        loginError.hidden = false;
        passwordInput.focus();
    } finally {
        setLoading(false);
    }
});

// =========================================================
// LIMPEZA DOS ERROS AO DIGITAR
// =========================================================

emailInput.addEventListener("input", () => {
    clearFieldError(emailInput, emailError);
    hideGeneralError();
});

passwordInput.addEventListener("input", () => {
    clearFieldError(passwordInput, passwordError);
    hideGeneralError();
});
