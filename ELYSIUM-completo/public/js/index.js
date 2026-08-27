const addressElement = document.querySelector("#connection-url");
const statusElement = document.querySelector("#connection-status");
const copyButton = document.querySelector("#copy-address");
const card = document.querySelector("#connection-card");

let shareUrl = "";

async function loadNetworkInfo() {
    try {
        const response = await fetch("/api/system/network", { cache: "no-store" });
        if (!response.ok) throw new Error("NETWORK_INFO_FAILED");

        const data = await response.json();
        const preferred = data.radmin ?? data.addresses?.[0] ?? null;

        if (!preferred) {
            addressElement.textContent = `http://IP-DO-MESTRE:${data.port ?? 3000}`;
            statusElement.textContent = "Nenhum IP de rede foi detectado. Abra o Radmin VPN e recarregue esta página.";
            return;
        }

        shareUrl = preferred.url;
        addressElement.textContent = shareUrl;
        copyButton.disabled = false;

        if (preferred.likelyRadmin) {
            card.classList.add("detected");
            statusElement.textContent = `Radmin provavelmente detectado em ${preferred.interfaceName}. Este é o endereço recomendado para a mesa.`;
        } else {
            statusElement.textContent = `Rede detectada em ${preferred.interfaceName}. Se você usa Radmin, confira se este IP é o mesmo mostrado no aplicativo.`;
        }
    } catch {
        addressElement.textContent = "Abra o Elysium pelo servidor local";
        statusElement.textContent = "A detecção automática só funciona quando o Elysium está rodando pelo servidor/Executável.";
    }
}

copyButton.addEventListener("click", async () => {
    if (!shareUrl) return;

    try {
        await navigator.clipboard.writeText(shareUrl);
        const original = copyButton.textContent;
        copyButton.textContent = "Copiado!";
        setTimeout(() => { copyButton.textContent = original; }, 1400);
    } catch {
        window.prompt("Copie este endereço:", shareUrl);
    }
});

loadNetworkInfo();
