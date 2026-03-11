// src/pages/Vault.jsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import EquationList from "../components/EquationList";
import ObsidianGraphView from "../components/ObsidianGraphView";
import NewResourceModal from "../components/NewResourceModal";
import "../styles/Vault.css";
import { api } from "../api/apiClient";

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function buildStudioState(note) {
  if (!note) return null;

  const content = note.type === "array3d" ? note.content : asObject(note.content);

  if (note.type === "equation") {
    return {
      type: "equation",
      id: note.id,
      title: note.title,
      formula: note.formula ?? note.expr ?? "x",
      from: "vault",
    };
  }

  if (note.type === "array3d") {
    return {
      type: "array3d",
      id: note.id,
      title: note.title,
      content: Array.isArray(content) ? content : [[[0]]],
      from: "vault",
    };
  }

  if (note.type === "curve3d") {
    const tRange = Array.isArray(content.tRange)
      ? content.tRange
      : Array.isArray(note.tRange)
      ? note.tRange
      : [];

    return {
      type: "curve3d",
      id: note.id,
      title: note.title,
      from: "vault",
      curve3d: {
        xExpr: content.xExpr ?? content.x ?? note.xExpr ?? note.x ?? "cos(t)",
        yExpr: content.yExpr ?? content.y ?? note.yExpr ?? note.y ?? "sin(t)",
        zExpr: content.zExpr ?? content.z ?? note.zExpr ?? note.z ?? "0",
        tMin: content.tMin ?? note.tMin ?? tRange[0] ?? 0,
        tMax: content.tMax ?? note.tMax ?? tRange[1] ?? 2 * Math.PI,
        samples: content.samples ?? note.samples ?? 400,
        markers: Array.isArray(content.markers) ? content.markers : undefined,
        editMode: content.editMode ?? note.editMode,
        baseXExpr: content.baseXExpr ?? note.baseXExpr,
        baseYExpr: content.baseYExpr ?? note.baseYExpr,
        baseZExpr: content.baseZExpr ?? note.baseZExpr,
      },
    };
  }

  if (note.type === "surface3d") {
    const xRange = Array.isArray(content.xRange)
      ? content.xRange
      : Array.isArray(note.xRange)
      ? note.xRange
      : [];
    const yRange = Array.isArray(content.yRange)
      ? content.yRange
      : Array.isArray(note.yRange)
      ? note.yRange
      : [];

    return {
      type: "surface3d",
      id: note.id,
      title: note.title,
      from: "vault",
      surface3d: {
        expr:
          content.expr ??
          content.zExpr ??
          content.formula ??
          note.expr ??
          note.zExpr ??
          note.formula ??
          "sin(x)*cos(y)",
        xMin: content.xMin ?? note.xMin ?? xRange[0] ?? -5,
        xMax: content.xMax ?? note.xMax ?? xRange[1] ?? 5,
        yMin: content.yMin ?? note.yMin ?? yRange[0] ?? -5,
        yMax: content.yMax ?? note.yMax ?? yRange[1] ?? 5,
        nx: content.nx ?? content.samples ?? note.samples ?? note.samplesX ?? 80,
        ny: content.ny ?? content.samples ?? note.samples ?? note.samplesY ?? 80,
        markers: Array.isArray(content.markers) ? content.markers : undefined,
        gridMode: content.gridMode ?? note.gridMode,
        gridStep: content.gridStep ?? note.gridStep,
        minorDiv: content.minorDiv ?? note.minorDiv,
      },
    };
  }

  return null;
}

export default function Vault() {
  const navigate = useNavigate();

  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState(null);
  const [notes, setNotes] = useState([]);
  const [sidebarWidth, setSidebarWidth] = useState(320);
  const [dragging, setDragging] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [focusTick, setFocusTick] = useState(0);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchVault = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      // ✅ studio 이동에 필요한 필드까지 포함하려면 full 권장
      const items = await api.listVaultItems({ view: "full" });

      setNotes(Array.isArray(items) ? items : []);
      setActiveId(items?.[0]?.id ?? null);
      setFocusTick((t) => t + 1);
    } catch (e) {
      const msg = e?.message || String(e);
      setError(msg);

      if (msg === "UNAUTHORIZED") {
        // 토큰 없거나 만료 → intro로 보내거나 로그인 유도
        navigate("/", { replace: true });
      }
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    fetchVault();
  }, [fetchVault]);

  const activeNote = useMemo(
    () => notes.find((n) => n.id === activeId) || null,
    [notes, activeId]
  );

  const handleOpenStudio = useCallback(
    (target) => {
      const note =
        typeof target === "string"
          ? notes.find((item) => item.id === target)
          : target;
      const state = buildStudioState(note);
      if (!state) return;
      navigate("/studio", { state });
    },
    [navigate, notes]
  );

  // ✅ 생성: NewResourceModal → 서버에 POST → 목록 갱신
  const onCreateResource = async (payload) => {
    try {
      setLoading(true);
      setError("");

      // payload 구조는 기존 그대로 쓰되, 서버로 보낼 형태만 정리
      const {
        type,
        title,
        formula,
        tags,
        content,
        dims,
        x,
        y,
        z,
        tRange,
        samples,
        xRange,
        yRange,
        ...rest
      } = payload;

      const resolvedType = type === "equation3d" ? "surface3d" : type;

      let body = {
        type: resolvedType,
        title: title || "Untitled",
        tags: Array.isArray(tags) ? tags : [],
        ...rest,
      };

      if (resolvedType === "equation") {
        body.formula = formula || "x^2+1";
      } else if (resolvedType === "curve3d") {
        const safeTRange =
          Array.isArray(tRange) && tRange.length === 2 ? tRange : [0, 2 * Math.PI];
        body.content = {
          xExpr: x || "cos(t)",
          yExpr: y || "sin(t)",
          zExpr: z || "t",
          tMin: safeTRange[0],
          tMax: safeTRange[1],
          tRange: safeTRange,
          samples: samples ?? 400,
        };
        body.samples = samples ?? 400;
      } else if (resolvedType === "surface3d") {
        const xr =
          Array.isArray(xRange) && xRange.length === 2 ? xRange : [-5, 5];
        const yr =
          Array.isArray(yRange) && yRange.length === 2 ? yRange : [-5, 5];
        body.content = {
          expr: formula || "sin(x)*cos(y)",
          xMin: xr[0],
          xMax: xr[1],
          yMin: yr[0],
          yMax: yr[1],
          xRange: xr,
          yRange: yr,
          nx: samples ?? 80,
          ny: samples ?? 80,
          samples: samples ?? 80,
        };
        body.samples = samples ?? 80;
      } else if (resolvedType === "array3d") {
        body.content = content || [[[0]]];
        body.sizeX = dims?.x;
        body.sizeY = dims?.y;
        body.sizeZ = dims?.z;
      }

      const created = await api.createVaultItem(body);

      // 상태 업데이트: 서버가 생성된 item 반환한다는 가정 (현재 백엔드 구현 스타일상 그럴 확률 높음)
      setNotes((prev) => {
        const next = [...prev, created];
        return next;
      });
      setActiveId(created?.id ?? null);
      setShowNew(false);
      setFocusTick((t) => t + 1);

      // 생성 후 바로 Studio 이동(기존 UX 유지)
      if (created?.id) handleOpenStudio(created);
    } catch (e) {
      const msg = e?.message || String(e);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // ✅ 수정: 제목/태그(+equation이면 formula) → PATCH meta
  const handleUpdateNote = async (id, patch) => {
    try {
      setLoading(true);
      setError("");

      const updated = await api.patchVaultMeta(id, patch);

      setNotes((prev) =>
        prev.map((n) => (n.id === id ? { ...n, ...updated } : n))
      );
      setFocusTick((t) => t + 1);
    } catch (e) {
      const msg = e?.message || String(e);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // ✅ 삭제: DELETE
  const handleDeleteNote = async (id) => {
    const target = notes.find((n) => n.id === id);
    if (!target) return;

    if (
      !window.confirm(
        `"${target.title || "Untitled"}" 노트를 삭제하시겠습니까?`
      )
    )
      return;

    try {
      setLoading(true);
      setError("");

      await api.deleteVaultItem(id);

      setNotes((prev) => {
        const next = prev.filter((n) => n.id !== id);
        if (activeId === id) {
          setActiveId(next[0]?.id ?? null);
          setFocusTick((t) => t + 1);
        }
        return next;
      });
    } catch (e) {
      const msg = e?.message || String(e);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const exportJson = () => {
    try {
      const blob = new Blob([JSON.stringify(notes, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "vault.json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Export failed:", e);
    }
  };

  useEffect(() => {
    if (!dragging) return;
    const handleMouseMove = (e) => {
      const minW = 220,
        maxW = 600;
      const next = Math.max(minW, Math.min(maxW, e.clientX));
      setSidebarWidth(next);
    };
    const handleMouseUp = () => setDragging(false);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragging]);

  return (
    <div className="vault-root" style={{ display: "flex", height: "100%" }}>
      <div
        className="vault-left-resizable"
        style={{
          width: sidebarWidth,
          minWidth: 220,
          maxWidth: 600,
          position: "relative",
          height: "100%",
        }}
      >
        <EquationList
          items={notes}
          activeId={activeId}
          query={query}
          setQuery={setQuery}
          onSelect={(id) => {
            setActiveId(id);
            setFocusTick((t) => t + 1);
          }}
          onUpdate={handleUpdateNote}
          onDelete={handleDeleteNote}
        />

        <div
          className="vault-resizer"
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            width: 8,
            height: "100%",
            cursor: "ew-resize",
            zIndex: 10,
            background: dragging ? "#60a5fa22" : "transparent",
          }}
          onMouseDown={() => setDragging(true)}
        />
      </div>

      <div
        className="vault-right"
        style={{ flex: 1, minWidth: 0, height: "100%" }}
      >
        <div className="vault-topbar">
          <div>
            <div style={{ fontSize: 12, color: "#9aa4b2" }}>Vault</div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>
              {activeNote ? activeNote.title : "No selection"}
            </div>
            {error && (
              <div style={{ marginTop: 6, fontSize: 12, color: "#ff7676" }}>
                {error}
              </div>
            )}
          </div>

          <div className="vault-actions">
            <button
              className="vault-btn"
              onClick={() => setShowNew(true)}
              disabled={loading}
            >
              + New
            </button>

            <button
              className="vault-btn"
              onClick={() => activeId && handleOpenStudio(activeId)}
              disabled={!activeId}
            >
              Open in Studio
            </button>

            <button className="vault-btn" onClick={exportJson}>
              Export
            </button>
          </div>
        </div>

        <ObsidianGraphView
          notes={notes}
          activeId={activeId}
          onActivate={setActiveId}
          onOpenStudio={handleOpenStudio}
          focusTick={focusTick}
        />
      </div>

      {showNew && (
        <NewResourceModal
          onClose={() => setShowNew(false)}
          onCreate={onCreateResource}
        />
      )}
    </div>
  );
}
