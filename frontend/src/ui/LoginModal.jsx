import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { api, setToken } from "../api/apiClient";
import "./LoginModal.css";

export default function LoginModal({ open, onClose }) {
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!open) return;
    setDisplayName("");
    setErr("");
    setLoading(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose?.();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const onLogin = async () => {
    try {
      setLoading(true);
      setErr("");

      const name = displayName.trim() || "Guest";
      const res = await api.guestLogin(name);

      setToken(res.token);
      onClose?.(); // ✅ 이동은 Intro의 Start 버튼에서만
    } catch (e) {
      setErr(e?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const modal = (
    <div
      className="gm-login-overlay"
      role="dialog"
      aria-modal="true"
      onMouseDown={() => !loading && onClose?.()}
    >
      <div className="gm-login-panel" onMouseDown={(e) => e.stopPropagation()}>
        <div className="gm-login-header">
          <h3 className="gm-login-title">Login</h3>
          <button
            className="gm-login-x"
            onClick={() => !loading && onClose?.()}
            aria-label="Close"
            type="button"
          >
            ✕
          </button>
        </div>

        <label className="gm-login-label">Display name</label>
        <input
          className="gm-login-input"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="e.g. Sarah"
          disabled={loading}
          onKeyDown={(e) => {
            if (e.key === "Enter") onLogin();
          }}
          autoFocus
        />

        {err && <div className="gm-login-error">{err}</div>}

        <div className="gm-login-actions">
          <button className="gm-login-btn" onClick={onLogin} disabled={loading} type="button">
            {loading ? "Signing in..." : "Continue as Guest"}
          </button>
          <button
            className="gm-login-btn secondary"
            onClick={() => !loading && onClose?.()}
            disabled={loading}
            type="button"
          >
            Cancel
          </button>
        </div>

        <div className="gm-login-footnote">로컬 백엔드 게스트 세션으로 진행합니다.</div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
