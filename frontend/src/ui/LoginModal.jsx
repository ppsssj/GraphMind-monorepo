import React, { useEffect, useMemo, useRef, useState } from "react";
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

  const [showPw, setShowPw] = useState(false);
  const [closing, setClosing] = useState(false);
  const [shake, setShake] = useState(false);

  const overlayRef = useRef(null);
  const panelRef = useRef(null);
  const lastActiveElRef = useRef(null);

  const canSubmit = useMemo(() => {
    if (!email.trim() || !password) return false;
    if (mode === "register" && !displayName.trim()) return false;
    return true;
  }, [mode, email, password, displayName]);

  // open 시 초기화
  useEffect(() => {
    if (!open) return;
    setClosing(false);
    setMode("login");
    setEmail("");
    setDisplayName("");
    setPassword("");
    setErr("");
    setLoading(false);
    setShowPw(false);

    lastActiveElRef.current = document.activeElement;
    // 다음 tick에서 패널 포커스
    setTimeout(() => panelRef.current?.focus?.(), 0);
  }, [open]);

  // 닫기 애니메이션 포함 close
  const requestClose = () => {
    if (loading) return;
    setClosing(true);
    // CSS 애니메이션 시간과 맞추기 (LoginModal.css의 closing duration)
    window.setTimeout(() => {
      setClosing(false);
      onClose?.();
      // 포커스 복귀
      try {
        lastActiveElRef.current?.focus?.();
      } catch {}
    }, 170);
  };

  const onSubmit = async () => {
    if (loading || !canSubmit) return;

    try {
      setLoading(true);
      setErr("");

      const res =
        mode === "register"
          ? await api.register(email, password, displayName)
          : await api.login(email, password);

      setToken(res.token);
      emitAuthed(res.user);
      requestClose();
    } catch (e) {
      const status = e?.status;
      const code = e?.data?.error;

      if (status === 401) setErr("이메일 또는 비밀번호가 올바르지 않습니다.");
      else if (status === 409) setErr("이미 사용 중인 이메일입니다.");
      else if (code === "weak_password") setErr("비밀번호는 8자 이상이어야 합니다.");
      else if (code === "email_required") setErr("이메일을 입력하세요.");
      else setErr(e?.message || "Login failed");

      // 에러 쉐이크 트리거
      setShake(true);
      window.setTimeout(() => setShake(false), 380);
    } finally {
      setLoading(false);
    }
  };

  // ESC 닫기 + 포커스 트랩(Tab)
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e) => {
      if (e.key === "Escape") requestClose();

      if (e.key === "Tab") {
        const root = panelRef.current;
        if (!root) return;

        const focusables = root.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const list = Array.from(focusables).filter(
          (el) => !el.hasAttribute("disabled") && !el.getAttribute("aria-hidden")
        );

        if (list.length === 0) return;

        const first = list[0];
        const last = list[list.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, loading, canSubmit, mode]);

  // 패널 틸트(마우스 이동 기반)
  const onPanelMove = (e) => {
    const el = panelRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;  // 0..1
    const py = (e.clientY - r.top) / r.height;  // 0..1
    const rx = (0.5 - py) * 8; // up/down
    const ry = (px - 0.5) * 10; // left/right
    el.style.setProperty("--rx", `${rx.toFixed(2)}deg`);
    el.style.setProperty("--ry", `${ry.toFixed(2)}deg`);
    el.style.setProperty("--mx", `${(px * 100).toFixed(1)}%`);
    el.style.setProperty("--my", `${(py * 100).toFixed(1)}%`);
  };

  const onPanelLeave = () => {
    const el = panelRef.current;
    if (!el) return;
    el.style.setProperty("--rx", `0deg`);
    el.style.setProperty("--ry", `0deg`);
    el.style.setProperty("--mx", `50%`);
    el.style.setProperty("--my", `30%`);
  };

  // 인풋 내부에서 Enter 제출 (전역 Enter는 금지 유지)
  const onInputKeyDown = (e) => {
    if (e.key === "Enter") onSubmit();
  };

  if (!open) return null;

  const modal = (
    <div
      ref={overlayRef}
      className={`gm-login-overlay ${closing ? "closing" : ""}`}
      role="dialog"
      aria-modal="true"
      onMouseDown={() => requestClose()}
    >
      <div
        ref={panelRef}
        className={[
          "gm-login-panel",
          closing ? "closing" : "",
          shake ? "shake" : "",
        ].join(" ")}
        onMouseDown={(e) => e.stopPropagation()}
        onMouseMove={onPanelMove}
        onMouseLeave={onPanelLeave}
        tabIndex={-1}
      >
        <div className="gm-login-header">
          <div>
            <h3 className="gm-login-title">
              {mode === "register" ? "Create account" : "Sign in"}
            </h3>
            <div className="gm-login-subtitle">
              {mode === "register"
                ? "몇 가지 정보만 입력하면 바로 시작할 수 있습니다."
                : "토큰은 로컬 스토리지(gm_token)에 저장됩니다."}
            </div>
          </div>

          <button
            className="gm-login-x"
            onClick={requestClose}
            aria-label="Close"
            type="button"
            disabled={loading}
          >
            ✕
          </button>
        </div>

        {/* 모드 토글: 세그먼트 */}
        <div className="gm-login-seg" data-mode={mode} aria-label="Auth mode">
          <button
            className="gm-login-seg-btn"
            onClick={() => !loading && setMode("login")}
            disabled={loading}
            type="button"
          >
            Sign in
          </button>
          <button
            className="gm-login-seg-btn"
            onClick={() => !loading && setMode("register")}
            disabled={loading}
            type="button"
          >
            Register
          </button>
          <span className="gm-login-seg-indicator" aria-hidden="true" />
        </div>

        <div className="gm-login-field">
          <label className="gm-login-label">Email</label>
          <input
            className="gm-login-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder="you@example.com"
            disabled={loading}
            autoFocus
            autoComplete="email"
          />
        </div>

        {mode === "register" && (
          <div className="gm-login-field">
            <label className="gm-login-label">Display name</label>
            <input
              className="gm-login-input"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              onKeyDown={onInputKeyDown}
              placeholder="e.g. ADMIN"
              disabled={loading}
              autoComplete="nickname"
            />
          </div>
        )}

        <div className="gm-login-field">
          <div className="gm-login-label-row">
            <label className="gm-login-label">Password</label>
            <button
              className="gm-login-link"
              type="button"
              onClick={() => setShowPw((v) => !v)}
              disabled={loading}
            >
              {showPw ? "Hide" : "Show"}
            </button>
          </div>

          <input
            className="gm-login-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder="••••••••"
            disabled={loading}
            type={showPw ? "text" : "password"}
            autoComplete={mode === "register" ? "new-password" : "current-password"}
          />
        </div>

        {err && <div className="gm-login-error">{err}</div>}

        <div className="gm-login-actions">
          <button
            className="gm-login-btn primary"
            onClick={onSubmit}
            disabled={loading || !canSubmit}
            type="button"
          >
            {loading ? (
              <span className="gm-login-working">
                <span className="gm-login-spinner" aria-hidden="true" />
                Working...
              </span>
            ) : mode === "register" ? (
              "Create account"
            ) : (
              "Sign in"
            )}
          </button>

          <button
            className="gm-login-btn secondary"
            onClick={requestClose}
            disabled={loading}
            type="button"
          >
            Cancel
          </button>
        </div>

        <div className="gm-login-footnote">
          {mode === "register"
            ? "회원가입 후 자동 로그인됩니다."
            : "보안상 공용 PC에서는 로그인 해제 후 브라우저 데이터를 정리하세요."}
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
