const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

/** An error mirroring the backend's structured `{error: {...}}` body. */
export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

let authToken = null;

export function setToken(token) {
  authToken = token;
}

async function request(path, options = {}) {
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
  const headers = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...options.headers,
  };
  if (authToken) {
    headers["Authorization"] = `Token ${authToken}`;
  }

  let response;
  try {
    response = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  } catch {
    throw new ApiError(0, "network_error", "Could not reach the server. Is the backend running?");
  }

  const isJson = response.headers.get("content-type")?.includes("application/json");
  const body = isJson ? await response.json() : null;

  if (!response.ok) {
    const err = body?.error;
    throw new ApiError(
      response.status,
      err?.code ?? "error",
      err?.message ?? response.statusText,
      err?.details,
    );
  }
  return body;
}

function applicationPayload(payload) {
  if (!payload?.attachment) {
    return JSON.stringify(payload);
  }

  const form = new FormData();
  Object.entries(payload).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    form.append(key, value);
  });
  return form;
}

export const api = {
  login: (email, password) =>
    request("/api/auth/login/", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  me: () => request("/api/me/"),

  listApplications: (status) =>
    request(`/api/applications/${status ? `?status=${encodeURIComponent(status)}` : ""}`),

  getApplication: (id) => request(`/api/applications/${id}/`),

  createApplication: (payload) =>
    request("/api/applications/", {
      method: "POST",
      body: applicationPayload(payload),
    }),

  updateApplication: (id, payload) =>
    request(`/api/applications/${id}/`, {
      method: "PATCH",
      body: applicationPayload(payload),
    }),

  /** action: "submit" | "start-review" | "approve" | "reject" | "return" */
  transition: (id, action, comment) =>
    request(`/api/applications/${id}/${action}/`, {
      method: "POST",
      body: JSON.stringify(comment !== undefined ? { comment } : {}),
    }),

  auditLogs: (id) => request(`/api/applications/${id}/audit-logs/`),
};
