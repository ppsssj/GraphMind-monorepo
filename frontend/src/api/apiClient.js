// src/api/apiClient.js
const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:8080";
const API_DEBUG = String(process.env.REACT_APP_API_DEBUG || "").toLowerCase() === "1";

export function getToken() {
  return localStorage.getItem("gm_token") || "";
}

export function setToken(token) {
  if (!token) localStorage.removeItem("gm_token");
  else localStorage.setItem("gm_token", token);
}

function safePreview(obj, max = 800) {
  try {
    const s = typeof obj === "string" ? obj : JSON.stringify(obj);
    return s.length > max ? s.slice(0, max) + "…(truncated)" : s;
  } catch {
    return String(obj);
  }
}

function logReq(phase, info) {
  if (!API_DEBUG) return;
  const { method, path, status, ms, bodyPreview, err } = info || {};
  if (phase === "request") {
    // eslint-disable-next-line no-console
    console.info("[api] ->", method, path, bodyPreview ? { body: bodyPreview } : "");
  } else if (phase === "response") {
    // eslint-disable-next-line no-console
    console.info("[api] <-", method, path, status, ms != null ? `${ms}ms` : "");
  } else if (phase === "error") {
    // eslint-disable-next-line no-console
    console.error("[api] !!", method, path, status, ms != null ? `${ms}ms` : "", err);
  }
}

async function requestOnce(path, { method = "GET", body, headers = {} } = {}) {
  const token = getToken();
  const t0 = performance?.now ? performance.now() : Date.now();

  logReq("request", {
    method,
    path,
    bodyPreview: body !== undefined ? safePreview(body) : null,
  });

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text || null;
  }

  const t1 = performance?.now ? performance.now() : Date.now();
  const ms = Math.round(t1 - t0);

  if (!res.ok) {
    const err = new Error("API_ERROR");
    err.status = res.status;
    err.data = data;
    err.method = method;
    err.path = path;

    logReq("error", { method, path, status: res.status, ms, err: { data } });
    throw err;
  }

  logReq("response", { method, path, status: res.status, ms });
  return data;
}

// PATCH 호환: 서버가 PATCH를 허용하지 않으면 PUT(또는 POST+X-HTTP-Method-Override)로 자동 재시도
async function request(path, opts = {}) {
  try {
    return await requestOnce(path, opts);
  } catch (err) {
    const method = String(opts?.method || "GET").toUpperCase();

    // ✅ 재시도 자체도 로그로 남김
    if (API_DEBUG) {
      // eslint-disable-next-line no-console
      console.warn("[api] retry check", { method, path, status: err?.status });
    }

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

  updateVaultItem: (id, payload) =>
    request(`/api/v1/vault/items/${id}`, { method: "PUT", body: payload }),

  // Vault (content / full item patch)
  patchVaultItem: (id, payload) =>
    request(`/api/v1/vault/items/${id}`, { method: "PATCH", body: payload }),

  // ✅ raw content를 받아서 { content }로 래핑
  patchVaultContent: (id, content) =>
    request(`/api/v1/vault/items/${id}/content`, {
      method: "PATCH",
      body: { content },
    }),

  deleteVaultItem: (id) =>
    request(`/api/v1/vault/items/${id}`, { method: "DELETE" }),

  logout: () => request("/api/v1/auth/logout", { method: "POST" }),
};
