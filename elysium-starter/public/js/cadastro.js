import { apiRequest, ApiError } from "./api.js";

// =========================================================
// ELEMENTOS DA PÁGINA
// =========================================================

const registerForm = document.querySelector("#register-form");
const nameInput = document.querySelector("#name");
const emailInput = document.querySelector("#email");
const passwordInput = document.querySelector("#password");
const confirmPasswordInput = document.querySelector("#confirm-password");

const nameError = document.querySelector("#name-error");
const emailError = document.querySelector("#email-error");
const passwordError = document.querySelector("#password-error");
const confirmPasswordError = document.querySelector("#confirm-password-error");
const registerError = document.querySelector("#register-error");

const showPasswordButton = document.querySelector("#show-password");
const showConfirmPasswordButton = document.querySelector("#show-confirm-password");
const registerButton = document.querySelector("#register-button");

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

function hideGeneralError() {
    registerError.hidden = true;
    registerError.textContent = "";
}

function setLoading(isLoading) {
    registerButton.disabled = isLoading;
    registerButton.textContent = isLoading ? "Criando conta..." : "Criar conta";
    registerForm.setAttribute("aria-busy", String(isLoading));
}

function configurePasswordToggle(button, input, visibleLabel) {
    button.addEventListener("click", () => {
        const passwordIsVisible = input.type === "text";

        input.type = passwordIsVisible ? "password" : "text";
        button.textContent = passwordIsVisible ? "Mostrar" : "Ocultar";
        button.setAttribute("aria-pressed", String(!passwordIsVisible));
        button.setAttribute(
            "aria-label",
            passwordIsVisible ? `Mostrar ${visibleLabel}` : `Ocultar ${visibleLabel}`
        );
    });
}

configurePasswordToggle(showPasswordButton, passwordInput, "senha");
configurePasswordToggle(
    showConfirmPasswordButton,
    confirmPasswordInput,
    "confirmação da senha"
);

// =========================================================
// VALIDAÇÃO LOCAL
// =========================================================

function validateForm() {
    const name = nameInput.value.trim();
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const confirmPassword = confirmPasswordInput.value;

    clearFieldError(nameInput, nameError);
    clearFieldError(emailInput, emailError);
    clearFieldError(passwordInput, passwordError);
    clearFieldError(confirmPasswordInput, confirmPasswordError);
    hideGeneralError();

    let firstInvalidField = null;

    if (name.length < 2) {
        setFieldError(nameInput, nameError, "Informe seu nome.");
        firstInvalidField = nameInput;
    } else if (name.length > 80) {
        setFieldError(nameInput, nameError, "O nome deve ter no máximo 80 caracteres.");
        firstInvalidField = nameInput;
    }

    if (email === "") {
        setFieldError(emailInput, emailError, "Informe seu e-mail.");
        firstInvalidField ??= emailInput;
    } else if (!isValidEmail(email)) {
        setFieldError(emailInput, emailError, "Informe um e-mail válido.");
        firstInvalidField ??= emailInput;
    }

    if (password.length < 8) {
        setFieldError(passwordInput, passwordError, "Use pelo menos 8 caracteres.");
        firstInvalidField ??= passwordInput;
    } else if (password.length > 128) {
        setFieldError(passwordInput, passwordError, "Use no máximo 128 caracteres.");
        firstInvalidField ??= passwordInput;
    }

    if (confirmPassword === "") {
        setFieldError(
            confirmPasswordInput,
            confirmPasswordError,
            "Confirme sua senha."
        );
        firstInvalidField ??= confirmPasswordInput;
    } else if (confirmPassword !== password) {
        setFieldError(
            confirmPasswordInput,
            confirmPasswordError,
            "As senhas não coincidem."
        );
        firstInvalidField ??= confirmPasswordInput;
    }

    if (firstInvalidField) {
        firstInvalidField.focus();
        return null;
    }

    return { name, email, password };
}

// =========================================================
// CADASTRO
// =========================================================

registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const userData = validateForm();

    if (!userData) {
        return;
    }

    setLoading(true);

    try {
        await apiRequest("/api/register", {
            method: "POST",
            body: JSON.stringify(userData)
        });

        window.location.href = "/pages/cronicas.html";
    } catch (error) {
        if (error instanceof ApiError && error.status === 409) {
            setFieldError(emailInput, emailError, error.message);
            emailInput.focus();
            return;
        }

        registerError.textContent =
            error instanceof ApiError
                ? error.message
                : "Não foi possível conectar ao Elysium.";

        registerError.hidden = false;
    } finally {
        setLoading(false);
    }
});

// =========================================================
// LIMPEZA DOS ERROS AO DIGITAR
// =========================================================

nameInput.addEventListener("input", () => {
    clearFieldError(nameInput, nameError);
    hideGeneralError();
});

emailInput.addEventListener("input", () => {
    clearFieldError(emailInput, emailError);
    hideGeneralError();
});

passwordInput.addEventListener("input", () => {
    clearFieldError(passwordInput, passwordError);
    clearFieldError(confirmPasswordInput, confirmPasswordError);
    hideGeneralError();
});

confirmPasswordInput.addEventListener("input", () => {
    clearFieldError(confirmPasswordInput, confirmPasswordError);
    hideGeneralError();
});
