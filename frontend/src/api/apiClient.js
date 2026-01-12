const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:8080";

export function getToken() {
  return localStorage.getItem("gm_token") || "";
}

export function setToken(token) {
  if (!token) localStorage.removeItem("gm_token");
  else localStorage.setItem("gm_token", token);
}

async function requestOnce(path, { method = "GET", body, headers = {} } = {}) {
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

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text || null;
  }

  if (!res.ok) {
    const err = new Error("API_ERROR");
    err.status = res.status;
    err.data = data;
    err.method = method;
    err.path = path;
    throw err;
  }

  return data;
}

// PATCH 호환: 서버가 PATCH를 허용하지 않으면 PUT(또는 POST+X-HTTP-Method-Override)로 자동 재시도
async function request(path, opts = {}) {
  try {
    return await requestOnce(path, opts);
  } catch (err) {
    const method = String(opts?.method || "GET").toUpperCase();
    if (Number(err?.status) === 405) {
      if (method === "PATCH") {
        try {
          return await requestOnce(path, { ...opts, method: "PUT" });
        } catch (err2) {
          if (Number(err2?.status) === 405) {
            return await requestOnce(path, {
              ...opts,
              method: "POST",
              headers: {
                ...(opts?.headers || {}),
                "X-HTTP-Method-Override": "PATCH",
              },
            });
          }
          throw err2;
        }
      }
      if (method === "PUT") {
        return await requestOnce(path, {
          ...opts,
          method: "POST",
          headers: {
            ...(opts?.headers || {}),
            "X-HTTP-Method-Override": "PUT",
          },
        });
      }
    }
    throw err;
  }
}

export const api = {
  // ✅ auth
  register: (email, password, displayName) =>
    request("/api/v1/auth/register", {
      method: "POST",
      body: { email, password, displayName },
    }),

  login: (email, password) =>
    request("/api/v1/auth/login", {
      method: "POST",
      body: { email, password },
    }),

  // health / me
  health: () => request("/health"),
  me: () => request("/api/v1/me"),

  // Vault
  listVaultItems: ({ tag, q, view = "summary" } = {}) => {
    const sp = new URLSearchParams();
    if (tag) sp.set("tag", tag);
    if (q) sp.set("q", q);
    if (view) sp.set("view", view);
    const qs = sp.toString();
    return request(`/api/v1/vault/items${qs ? `?${qs}` : ""}`);
  },

  createVaultItem: (payload) =>
    request(`/api/v1/vault/items`, { method: "POST", body: payload }),

  patchVaultMeta: (id, { title, tags, formula }) =>
    request(`/api/v1/vault/items/${id}/meta`, {
      method: "PATCH",
      body: { title, tags, formula },
    }),
  // apiClient.js
  updateVaultItem: (id, payload) =>
    request(`/api/v1/vault/items/${id}`, { method: "PUT", body: payload }),

  // Vault (content / full item patch)
  patchVaultItem: (id, payload) =>
    request(`/api/v1/vault/items/${id}`, { method: "PATCH", body: payload }),

  patchVaultContent: (id, content) =>
    request(`/api/v1/vault/items/${id}/content`, {
      method: "PATCH",
      body: { content },
    }),

  deleteVaultItem: (id) =>
    request(`/api/v1/vault/items/${id}`, { method: "DELETE" }),

  logout: () => request("/api/v1/auth/logout", { method: "POST" }),
};
