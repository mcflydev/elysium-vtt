export class ApiError extends Error {
    constructor(message, status, data = null) {
        super(message);
        this.name = "ApiError";
        this.status = status;
        this.data = data;
    }
}

export async function apiRequest(path, options = {}) {
    const headers = new Headers(options.headers ?? {});

    if (options.body && !headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
    }

    const response = await fetch(path, {
        ...options,
        headers,
        credentials: "same-origin"
    });

    let data = null;

    try {
        data = await response.json();
    } catch {
        data = null;
    }

    if (!response.ok) {
        throw new ApiError(
            data?.message ?? "Não foi possível concluir a operação.",
            response.status,
            data
        );
    }

    return data;
}

export async function uploadLocalFile(file, kind = "image") {
    if (!(file instanceof File) || !file.size) return "";
    const response = await fetch("/api/upload", {
        method: "POST",
        credentials: "same-origin",
        body: file,
        headers: {
            "Content-Type": file.type,
            "X-Upload-Kind": kind,
            "X-File-Name": encodeURIComponent(file.name)
        }
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new ApiError(data?.message ?? "Falha no upload do arquivo.", response.status, data);
    return data.url;
}
