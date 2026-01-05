import React, { useEffect, useState } from "react";
import { api, getToken, setToken } from "../api/apiClient";
import { onAuthed } from "../utils/authEvent"; // ✅ 추가
import "./AuthStatePanel.css";

export default function AuthStatusPanel({ onLoginClick }) {
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(false);
  const [hasToken, setHasToken] = useState(!!getToken());

  const refreshMe = async () => {
    const token = getToken();
    setHasToken(!!token);

    if (!token) {
      setMe(null);
      return;
    }

    try {
      setLoading(true);
      const res = await api.me();
      setMe(res?.user ?? res);
    } catch (e) {
      if (e?.status === 401) {
        setToken("");
        setHasToken(false);
        setMe(null);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshMe();

    // ✅ 로그인/회원가입 성공 시 자동 갱신
    const off = onAuthed(() => refreshMe());

    // ✅ (선택) 다른 탭에서 로그아웃/로그인 시 동기화
    const onStorage = (e) => {
      if (e.key === "gm_token") refreshMe();
    };
    window.addEventListener("storage", onStorage);

    return () => {
      off?.();
      window.removeEventListener("storage", onStorage);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onLogout = async () => {
    try {
      await api.logout();
    } catch {}

    // 서버 revoke까지 붙였으면 여기서 호출 권장
    // try { await api.logout(); } catch {}
    setToken(null);
    setHasToken(false);
    setMe(null);
  };

  if (!hasToken) {
    return (
      <div className="auth-status">
        <div className="auth-status-title">Not signed in</div>
        <button
          className="auth-status-btn"
          onClick={onLoginClick}
          type="button"
        >
          Login
        </button>
      </div>
    );
  }

  return (
    <div className="auth-status">
      <div className="auth-status-title">
        {loading
          ? "Checking session..."
          : me
          ? `Signed in as ${me.displayName}`
          : "Signed in"}
      </div>
      <div className="auth-status-actions">
        <button
          className="auth-status-btn secondary"
          onClick={refreshMe}
          type="button"
        >
          Refresh
        </button>
        <button className="auth-status-btn" onClick={onLogout} type="button">
          Logout
        </button>
      </div>
    </div>
  );
}
