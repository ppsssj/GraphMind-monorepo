
// src/components/EquationList.jsx
import React, { useMemo, useRef, useState } from "react";
import "../styles/EquationList.css";

function Curve3DIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <g
        stroke="currentColor"
        strokeWidth="1.6"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="4,19 4,6 18,6" opacity="0.7" />
        <path d="M5 16 C8 10 12 13 17 7" />
        <path d="M7 18 L11 22 L20 13" opacity="0.5" />
      </g>
    </svg>
  );
}

function Surface3DIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <g
        stroke="currentColor"
        strokeWidth="1.4"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M3 16 L9 20 L21 14 L15 10 Z" opacity="0.55" />
        <path d="M9 20 L9 13 L3 9" opacity="0.4" />
        <path d="M15 10 L15 17 L21 14" opacity="0.4" />
        <path d="M4 13 C8 9 12 11 16 8 C18 7 20 7.5 21 9" />
      </g>
    </svg>
  );
}

export default function EquationList({
  items,
  activeId,
  query,
  setQuery,
  onSelect,
  onUpdate,
  onDelete,
}) {
  // ---- helpers -------------------------------------------------
  // ✅ 백엔드가 summary로 줄 때 content가 없을 수 있으므로 dims는 안전 처리
  const dimsOf = (note) => {
    // 서버가 dims/shape를 주는 케이스 대비
    if (typeof note?.dims === "string" && note.dims.trim()) return note.dims.trim();
    if (typeof note?.shape === "string" && note.shape.trim()) return note.shape.trim();

    if (note?.type !== "array3d" || !Array.isArray(note?.content)) return "";
    const Z = note.content.length;
    const Y = note.content[0]?.length || 0;
    const X = note.content[0]?.[0]?.length || 0;
    return `${X}×${Y}×${Z}`;
  };

  const iconOf = (type) => {
    if (type === "array3d") return "⬢";
    if (type === "curve3d") return "";
    if (type === "surface3d") return "";
    return "ƒx";
  };

  // ✅ 날짜 포맷 안전 처리
  const whenOf = (note) => {
    const raw = note?.updatedAt || note?.createdAt;
    if (!raw) return "";
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleString();
  };

  // ✅ equation은 formula 또는 expr 둘 중 하나로 올 수 있음
  const eqTextOf = (note) => (note?.formula || note?.expr || "").toString();

  // ✅ curve3d는 xExpr/yExpr/zExpr (혹은 x/y/z) 로 올 수 있음
  const curveTextOf = (note) => {
    const x = note?.xExpr ?? note?.x ?? "";
    const y = note?.yExpr ?? note?.y ?? "";
    const z = note?.zExpr ?? note?.z ?? "";
    // 너무 길면 검색용으로만 쓰고 subtitle은 samples 위주로
    return `${x} ${y} ${z}`.trim();
  };

  // ---- filtering ----------------------------------------------
  const filtered = useMemo(() => {
    const q = (query || "").trim().toLowerCase();
    if (!q) return items;

    return items.filter((n) => {
      const title = (n.title || "").toLowerCase();
      const type = (n.type || "").toLowerCase();
      const tags = (n.tags || []).join(" ").toLowerCase();

      const formula = (n.formula || "").toLowerCase();
      const expr = (n.expr || "").toLowerCase();

      const curveExpr = curveTextOf(n).toLowerCase();
      const dims = n.type === "array3d" ? dimsOf(n).toLowerCase() : "";

      return [title, type, tags, formula, expr, curveExpr, dims].some((s) =>
        s.includes(q)
      );
    });
  }, [items, query]);

  // ---- 검색 UI 상태 ---------------------------------------------
  const [searchMode, setSearchMode] = useState(false);
  const inputRef = useRef(null);

  const handleSearchClick = () => {
    setSearchMode(true);
    setTimeout(() => inputRef.current?.focus(), 100);
  };
  const handleBlur = () => {
    if (!query) setSearchMode(false);
  };
  const handleCancel = () => {
    setQuery("");
    setSearchMode(false);
  };

  // ---- 인라인 편집 상태 ----------------------------------------
  const [editing, setEditing] = useState(null); // { id, title, formula, tags }

  const startEdit = (note) => {
    setEditing({
      id: note.id,
      title: note.title || "",
      // ✅ equation만 formula 편집 허용(요구사항 반영)
      formula: note.type === "equation" ? eqTextOf(note) : "",
      tags: (note.tags || []).join(", "),
    });
  };

  const cancelEdit = () => setEditing(null);

  const saveEdit = () => {
    if (!editing || typeof onUpdate !== "function") return;

    const note = items.find((n) => n.id === editing.id);
    if (!note) return;

    const tags =
      editing.tags
        .split(/[\s,]+/)
        .map((t) => t.trim())
        .filter(Boolean) || [];

    const patch = {
      title: editing.title.trim() || note.title,
      tags,
    };

    // ✅ equation이면 formula도 함께 patch (백엔드 meta patch가 지원하는 형태로)
    if (note.type === "equation") {
      patch.formula = (editing.formula || "").trim() || eqTextOf(note);
    }

    onUpdate(editing.id, patch);
    setEditing(null);
  };

  // ---- render ---------------------------------------------------
  return (
    <div className="vault-left">
      {/* 상단 로고/검색 */}
      <div
        className="vault-left-header"
        style={{
          display: "flex",
          alignItems: "center",
          height: 56,
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* 로고 */}
        <div
          className={
            !searchMode
              ? "logo-fade logo-container fade-in-left"
              : "logo-fade logo-container fade-out-right"
          }
          style={{
            flex: 1,
            display: !searchMode ? "flex" : "none",
            alignItems: "center",
            cursor: "pointer",
            position: "absolute",
            left: 0,
            top: 0,
            width: "100%",
            height: "100%",
            transition: "all 0.4s",
          }}
          onClick={() => (window.location.href = "/")}
        >
          <div className="brand">
            <img className="brand-logo" src="/Logo.png" alt="GraphMind logo" />
            <div className="brand-text">
              <div className="brand-name">GraphMind</div>
              <div className="brand-sub">Math. Graph. AI</div>
            </div>
          </div>
        </div>

        {/* 검색 아이콘 */}
        <button
          className={
            !searchMode
              ? "search-icon-btn fade-in-right"
              : "search-icon-btn fade-out-left"
          }
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 8,
            position: "absolute",
            right: 0,
            top: "12px",
            transition: "all 0.4s",
          }}
          onClick={handleSearchClick}
          aria-label="검색"
          tabIndex={!searchMode ? 0 : -1}
        >
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
            <circle cx="9" cy="9" r="7" stroke="#603ABD" strokeWidth="2" />
            <line
              x1="15.2"
              y1="15.2"
              x2="19"
              y2="19"
              stroke="#603ABD"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>

        {/* 검색 입력 */}
        <div
          className={
            searchMode
              ? "search-fade fade-in-right"
              : "search-fade fade-out-left"
          }
          style={{
            flex: 1,
            display: searchMode ? "flex" : "none",
            alignItems: "center",
            position: "absolute",
            left: 0,
            top: 0,
            width: "100%",
            height: "100%",
            transition: "all 0.4s",
          }}
        >
          <input
            ref={inputRef}
            className="vault-search"
            placeholder="Search title, expr/formula, tags..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onBlur={handleBlur}
            style={{ flex: 1, fontSize: 16, paddingLeft: 12 }}
          />
          <button
            className="search-cancel-btn"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 8,
              marginLeft: 4,
            }}
            onMouseDown={handleCancel}
            aria-label="검색 취소"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <line
                x1="5"
                y1="5"
                x2="15"
                y2="15"
                stroke="#9aa4b2"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <line
                x1="15"
                y1="5"
                x2="5"
                y2="15"
                stroke="#9aa4b2"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* 리스트 */}
      <div className="vault-list">
        {filtered.map((note) => {
          const isArr = note.type === "array3d";
          const isCurve = note.type === "curve3d";
          const isSurface = note.type === "surface3d";
          const dims = isArr ? dimsOf(note) : null;

          // ✅ 서브타이틀: 백엔드 요약/전체 어느 쪽이 와도 안전
          let subtitle = "";
          if (isArr) {
            subtitle = `Size: ${dims || "-"}`;
          } else if (isCurve) {
            subtitle = `samples: ${note.samples ?? "-"}`;
          } else if (isSurface) {
            const expr = (note.expr || note.formula || "").toString();
            subtitle = expr ? `z = ${expr}` : "z = f(x, y)";
          } else {
            subtitle = eqTextOf(note);
          }

          const when = whenOf(note);
          const isActive = note.id === activeId;
          const isEditing = editing && editing.id === note.id;
          const canEdit = typeof onUpdate === "function";
          const canDelete = typeof onDelete === "function";

          return (
            <div
              key={note.id}
              className={"vault-item" + (isActive ? " active" : "")}
              onClick={() => onSelect(note.id)}
            >
              <div className="item-head">
                <div
                  className={`item-icon ${
                    isArr ? "arr" : isCurve ? "curve" : isSurface ? "surface" : "eq"
                  }`}
                >
                  {isCurve ? (
                    <Curve3DIcon />
                  ) : isSurface ? (
                    <Surface3DIcon />
                  ) : (
                    iconOf(note.type)
                  )}
                </div>

                <div className="item-title-wrap">
                  <div className="title-row">
                    <div className="title">
                      {note.title ||
                        (isArr
                          ? "3D Array"
                          : isCurve
                          ? "3D Curve"
                          : isSurface
                          ? "3D Surface"
                          : "Equation")}
                    </div>

                    <span
                      className={`type-pill ${
                        isArr ? "pill-arr" : isCurve ? "pill-curve" : isSurface ? "pill-surface" : "pill-eq"
                      }`}
                    >
                      {note.type || "equation"}
                    </span>
                  </div>

                  <div className={isArr ? "dims" : "formula"}>{subtitle}</div>
                </div>
              </div>

              <div className="meta">{when ? <span>{when}</span> : null}</div>

              <div className="vault-tags" style={{ marginTop: 6 }}>
                {(note.tags || []).map((t) => (
                  <span className="vault-tag" key={t}>
                    #{t}
                  </span>
                ))}
              </div>

              {(canEdit || canDelete) && (
                <div
                  style={{
                    display: "flex",
                    gap: 6,
                    marginTop: 6,
                    justifyContent: "flex-end",
                  }}
                >
                  {canEdit && (
                    <button
                      style={{
                        fontSize: 11,
                        padding: "2px 8px",
                        borderRadius: 999,
                        border: "1px solid rgba(255,255,255,0.18)",
                        background: "rgba(15,23,42,0.6)",
                        color: "#e5e7eb",
                        cursor: "pointer",
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        startEdit(note);
                      }}
                    >
                      편집
                    </button>
                  )}
                  {canDelete && (
                    <button
                      style={{
                        fontSize: 11,
                        padding: "2px 8px",
                        borderRadius: 999,
                        border: "1px solid rgba(239,68,68,0.7)",
                        background: "rgba(239,68,68,0.15)",
                        color: "#fecaca",
                        cursor: "pointer",
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete?.(note.id);
                      }}
                    >
                      삭제
                    </button>
                  )}
                </div>
              )}

              {canEdit && isEditing && (
                <div
                  style={{
                    marginTop: 8,
                    padding: 8,
                    borderRadius: 10,
                    border: "1px solid rgba(148,163,184,0.4)",
                    background: "rgba(15,23,42,0.9)",
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <label style={{ fontSize: 11, color: "#9aa4b2" }}>
                      제목
                      <input
                        value={editing.title}
                        onChange={(e) =>
                          setEditing((prev) => ({ ...prev, title: e.target.value }))
                        }
                        style={{
                          marginTop: 2,
                          width: "100%",
                          fontSize: 12,
                          padding: "4px 6px",
                          borderRadius: 6,
                          border: "1px solid rgba(148,163,184,0.7)",
                          background: "#020617",
                          color: "#e5e7eb",
                          outline: "none",
                        }}
                      />
                    </label>

                    {note.type === "equation" && (
                      <label style={{ fontSize: 11, color: "#9aa4b2" }}>
                        수식
                        <input
                          value={editing.formula}
                          onChange={(e) =>
                            setEditing((prev) => ({ ...prev, formula: e.target.value }))
                          }
                          style={{
                            marginTop: 2,
                            width: "100%",
                            fontSize: 12,
                            padding: "4px 6px",
                            borderRadius: 6,
                            border: "1px solid rgba(148,163,184,0.7)",
                            background: "#020617",
                            color: "#e5e7eb",
                            outline: "none",
                            fontFamily:
                              'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',
                          }}
                        />
                      </label>
                    )}

                    <label style={{ fontSize: 11, color: "#9aa4b2" }}>
                      태그 (쉼표/공백 구분)
                      <input
                        value={editing.tags}
                        onChange={(e) =>
                          setEditing((prev) => ({ ...prev, tags: e.target.value }))
                        }
                        style={{
                          marginTop: 2,
                          width: "100%",
                          fontSize: 12,
                          padding: "4px 6px",
                          borderRadius: 6,
                          border: "1px solid rgba(148,163,184,0.7)",
                          background: "#020617",
                          color: "#e5e7eb",
                          outline: "none",
                        }}
                      />
                    </label>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "flex-end",
                      gap: 6,
                      marginTop: 8,
                    }}
                  >
                    <button
                      style={{
                        fontSize: 11,
                        padding: "3px 10px",
                        borderRadius: 999,
                        border: "1px solid rgba(148,163,184,0.7)",
                        background: "transparent",
                        color: "#e5e7eb",
                        cursor: "pointer",
                      }}
                      onClick={cancelEdit}
                    >
                      취소
                    </button>
                    <button
                      style={{
                        fontSize: 11,
                        padding: "3px 10px",
                        borderRadius: 999,
                        border: "1px solid rgba(34,197,94,0.9)",
                        background: "rgba(34,197,94,0.85)",
                        color: "#022c22",
                        cursor: "pointer",
                      }}
                      onClick={saveEdit}
                    >
                      저장
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div style={{ opacity: 0.6, padding: 12, fontSize: 13 }}>No results</div>
        )}
      </div>
    </div>
  );
}
