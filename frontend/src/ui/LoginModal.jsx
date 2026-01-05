import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { api, setToken } from "../api/apiClient";
import { emitAuthed } from "../utils/authEvent";
import "./LoginModal.css";
export default function LoginModal({ open, onClose }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!open) return;
    setMode("login");
    setEmail("");
    setDisplayName("");
    setPassword("");
    setErr("");
    setLoading(false);
  }, [open]);

  const onSubmit = async () => {
    if (loading) return;

    try {
      setLoading(true);
      setErr("");

      const res =
        mode === "register"
          ? await api.register(email, password, displayName)
          : await api.login(email, password);

      setToken(res.token);

      // ✅ 로그인 성공 브로드캐스트 → 패널이 알아서 refreshMe()
      emitAuthed(res.user);

      onClose?.();
    } catch (e) {
      const status = e?.status;
      const code = e?.data?.error;

      if (status === 401) setErr("이메일 또는 비밀번호가 올바르지 않습니다.");
      else if (status === 409) setErr("이미 사용 중인 이메일입니다.");
      else if (code === "weak_password") setErr("비밀번호는 8자 이상이어야 합니다.");
      else if (code === "email_required") setErr("이메일을 입력하세요.");
      else setErr(e?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose?.();
      // 전역 Enter는 의도치 않은 제출이 될 수 있어서 제거 권장
      // if (e.key === "Enter") onSubmit();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const modal = (
    <div
      className="gm-login-overlay"
      role="dialog"
      aria-modal="true"
      onMouseDown={() => !loading && onClose?.()}
    >
      <div className="gm-login-panel" onMouseDown={(e) => e.stopPropagation()}>
        <div className="gm-login-header">
          <h3 className="gm-login-title">
            {mode === "register" ? "Register" : "Login"}
          </h3>

          <button
            className="gm-login-x"
            onClick={() => !loading && onClose?.()}
            aria-label="Close"
            type="button"
          >
            ✕
          </button>
        </div>

        {/* 모드 토글(기존 CSS 영향 최소화: 버튼 클래스만 secondary 활용) */}
        <div className="gm-login-actions" style={{ marginTop: 0 }}>
          <button
            className={`gm-login-btn ${mode === "login" ? "" : "secondary"}`}
            onClick={() => !loading && setMode("login")}
            disabled={loading}
            type="button"
          >
            Sign in
          </button>
          <button
            className={`gm-login-btn ${mode === "register" ? "" : "secondary"}`}
            onClick={() => !loading && setMode("register")}
            disabled={loading}
            type="button"
          >
            Register
          </button>
        </div>

        <label className="gm-login-label">Email</label>
        <input
          className="gm-login-input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          disabled={loading}
          autoFocus
          autoComplete="email"
        />

        {mode === "register" && (
          <>
            <label className="gm-login-label">Display name</label>
            <input
              className="gm-login-input"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. ADMIN"
              disabled={loading}
              autoComplete="nickname"
            />
          </>
        )}

        <label className="gm-login-label">Password</label>
        <input
          className="gm-login-input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          disabled={loading}
          type="password"
          autoComplete={
            mode === "register" ? "new-password" : "current-password"
          }
        />

        {err && <div className="gm-login-error">{err}</div>}

        <div className="gm-login-actions">
          <button
            className="gm-login-btn"
            onClick={onSubmit}
            disabled={loading}
            type="button"
          >
            {loading
              ? "Working..."
              : mode === "register"
              ? "Create account"
              : "Sign in"}
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

        <div className="gm-login-footnote">
          {mode === "register"
            ? "회원가입 후 자동 로그인됩니다."
            : "로그인 토큰은 로컬 스토리지(gm_token)에 저장됩니다."}
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
