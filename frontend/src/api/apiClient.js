const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:8080";

export function getToken() {
  return localStorage.getItem("gm_token") || "";
}

export function setToken(token) {
  localStorage.setItem("gm_token", token);
}

async function request(path, { method = "GET", body, headers = {} } = {}) {
  const token = getToken();

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) throw new Error("UNAUTHORIZED");

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const msg = data?.message || data?.error || `HTTP_${res.status}`;
    throw new Error(msg);
  }
  return data;
}

export const api = {
  // Auth
  guestLogin: (displayName = "Guest") =>
    request("/api/v1/auth/guest", { method: "POST", body: { displayName } }),

  // Vault (list)
  listVaultItems: ({ tag, q } = {}) => {
    const sp = new URLSearchParams();
    if (tag) sp.set("tag", tag);
    if (q) sp.set("q", q);
    const qs = sp.toString();
    return request(`/api/v1/vault/items${qs ? `?${qs}` : ""}`);
  },

  // Vault (create)
  createVaultItem: (payload) =>
    request(`/api/v1/vault/items`, { method: "POST", body: payload }),

  // Vault (meta patch)
  patchVaultMeta: (id, { title, tags, formula }) =>
    request(`/api/v1/vault/items/${id}/meta`, {
      method: "PATCH",
      body: { title, tags, formula },
    }),

  // Vault (delete)
  deleteVaultItem: (id) =>
    request(`/api/v1/vault/items/${id}`, { method: "DELETE" }),
};
