// src/pages/Vault.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import EquationList from "../components/EquationList";
import ObsidianGraphView from "../components/ObsidianGraphView";
import { dummyResources } from "../data/dummyEquations";
import NewResourceModal from "../components/NewResourceModal";
import "../styles/Vault.css";

const LS_KEY_NEW = "vaultResources";
const LS_KEY_OLD = "equationVault";

function migrateEquationsToResources(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map((n) =>
    n.type
      ? n
      : {
          id: n.id,
          type: "equation",
          title: n.title || "Untitled",
          formula: n.formula || "x",
          tags: n.tags || [],
          links: n.links || [],
          updatedAt: n.updatedAt || new Date().toISOString(),
          createdAt: n.createdAt || new Date().toISOString(),
        }
  );
}

// ✅ 타입 정규화 (옛날 equation3d → surface3d)
function normalizeResourceType(n) {
  if (!n) return n;
  if (n.type === "equation3d") {
    return { ...n, type: "surface3d" };
  }
  return n;
}

export default function Vault() {
  const navigate = useNavigate();
  const location = useLocation();
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState(null);
  const [notes, setNotes] = useState([]);
  const [sidebarWidth, setSidebarWidth] = useState(320);
  const [dragging, setDragging] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [focusTick, setFocusTick] = useState(0);

  useEffect(() => {
    // auto-clear when visiting /vault?clearVault=1
    try {
      const params = new URLSearchParams(location.search);
      const shouldClear = params.get("clearVault");
      if (shouldClear) {
        if (
          !window.confirm(
            "Clear vault cache (localStorage) and reload demo data?"
          )
        ) {
          navigate("/vault", { replace: true });
          return;
        }
        try {
          localStorage.removeItem(LS_KEY_NEW);
          localStorage.removeItem(LS_KEY_OLD);
        } catch (e) {
          console.error("Failed to clear localStorage keys:", e);
        }
        const seeded = dummyResources.map(normalizeResourceType);
        localStorage.setItem(LS_KEY_NEW, JSON.stringify(seeded));
        setNotes(seeded);
        setActiveId(seeded[0]?.id || null);
        setFocusTick((t) => t + 1);
        navigate("/vault", { replace: true });
        return;
      }
    } catch (e) {
      // ignore URL parse errors
    }

    // 1) 새 저장 키 우선
    const newStr = localStorage.getItem(LS_KEY_NEW);
    if (newStr) {
      try {
        const parsed = JSON.parse(newStr);
        if (Array.isArray(parsed) && parsed.length) {
          const normalized = parsed.map(normalizeResourceType);
          setNotes(normalized);
          setActiveId(normalized[0].id);
          return;
        }
      } catch {}
    }
    // 2) 구 키가 있으면 마이그레이션
    const oldStr = localStorage.getItem(LS_KEY_OLD);
    if (oldStr) {
      try {
        const parsedOld = JSON.parse(oldStr);
        const migrated = migrateEquationsToResources(parsedOld).map(
          normalizeResourceType
        );
        localStorage.setItem(LS_KEY_NEW, JSON.stringify(migrated));
        setNotes(migrated);
        setActiveId(migrated[0]?.id || null);
        return;
      } catch {}
    }
    // 3) 아무 것도 없으면 데모(수식+배열) 시드
    const seeded = dummyResources.map(normalizeResourceType);
    localStorage.setItem(LS_KEY_NEW, JSON.stringify(seeded));
    setNotes(seeded);
    setActiveId(seeded[0]?.id || null);
  }, [location.search, navigate]);

  const activeNote = useMemo(
    () => notes.find((n) => n.id === activeId) || null,
    [notes, activeId]
  );

  const save = (next) => {
    setNotes(next);
    localStorage.setItem(LS_KEY_NEW, JSON.stringify(next));
  };

  const handleOpenStudio = (id) => {
    const note = notes.find((n) => n.id === id);
    if (!note) return;

    if (note.type === "equation") {
      navigate("/studio", {
        state: {
          type: "equation",
          formula: note.formula,
          from: "vault",
          id: note.id,
        },
      });
    } else if (note.type === "array3d") {
      navigate("/studio", {
        state: {
          type: "array3d",
          content: note.content,
          from: "vault",
          id: note.id,
        },
      });
    } else if (note.type === "curve3d") {
      navigate("/studio", {
        state: {
          type: "curve3d",
          id: note.id,
          title: note.title,
          from: "vault",
          curve3d: {
            xExpr: note.xExpr ?? note.x,
            yExpr: note.yExpr ?? note.y,
            zExpr: note.zExpr ?? note.z,
            tMin: note.tMin ?? (note.tRange ? note.tRange[0] : undefined),
            tMax: note.tMax ?? (note.tRange ? note.tRange[1] : undefined),
            samples: note.samples,
          },
        },
      });
    } else if (note.type === "surface3d" || note.type === "equation3d") {
      const xRange = note.xRange || [];
      const yRange = note.yRange || [];
      const xMin = note.xMin ?? xRange[0] ?? -5;
      const xMax = note.xMax ?? xRange[1] ?? 5;
      const yMin = note.yMin ?? yRange[0] ?? -5;
      const yMax = note.yMax ?? yRange[1] ?? 5;

      navigate("/studio", {
        state: {
          type: "surface3d",
          id: note.id,
          title: note.title,
          from: "vault",
          surface3d: {
            expr: note.expr ?? note.zExpr ?? note.formula ?? "sin(x)*cos(y)",
            xMin,
            xMax,
            yMin,
            yMax,
            nx: note.samples ?? note.samplesX ?? 80,
            ny: note.samples ?? note.samplesY ?? 80,
          },
        },
      });
    }
  };

  const importDummy = () => {
    const seeded = dummyResources.map(normalizeResourceType);
    localStorage.setItem(LS_KEY_NEW, JSON.stringify(seeded));
    setNotes(seeded);
    setActiveId(seeded[0]?.id || null);
    setFocusTick((t) => t + 1);
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

  // NewResourceModal → Vault 저장
  const onCreateResource = (payload) => {
    const {
      type,
      title,
      formula,
      content,
      tags,
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
    const id = Date.now().toString(36);

    const base = {
      id,
      type: resolvedType,
      title:
        title ||
        (resolvedType === "equation"
          ? "New Equation"
          : resolvedType === "surface3d"
          ? "New 3D Surface"
          : resolvedType === "curve3d"
          ? "New 3D Curve"
          : resolvedType === "array3d"
          ? "New 3D Array"
          : "New Resource"),
      tags: Array.isArray(tags) ? tags : [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...rest,
    };

    let item;

    if (resolvedType === "equation") {
      item = {
        ...base,
        formula: formula || "x^2+1",
      };
    } else if (resolvedType === "curve3d") {
      item = {
        ...base,
        x: x || "cos(t)",
        y: y || "sin(t)",
        z: z || "t",
        tRange: Array.isArray(tRange) ? tRange : [0, 2 * Math.PI],
        samples: samples ?? 400,
      };
    } else if (resolvedType === "surface3d") {
      const xr = Array.isArray(xRange) && xRange.length === 2 ? xRange : [-5, 5];
      const yr = Array.isArray(yRange) && yRange.length === 2 ? yRange : [-5, 5];
      item = {
        ...base,
        expr: formula || "sin(x)*cos(y)",
        xRange: xr,
        yRange: yr,
        samples: samples ?? 80,
      };
    } else if (resolvedType === "array3d") {
      item = {
        ...base,
        content: content || [[[0]]],
      };
    } else {
      // surfaceParam / vectorField 등은 우선 메타만 저장
      item = {
        ...base,
        formula: formula || "",
        content: content,
      };
    }

    const next = [...notes, item];
    save(next);
    setActiveId(id);
    setShowNew(false);

    // 생성 후 바로 Studio 이동
    if (resolvedType === "equation") {
      navigate("/studio", {
        state: {
          type: "equation",
          formula: item.formula,
          from: "vault",
          id,
        },
      });
    } else if (resolvedType === "curve3d") {
      navigate("/studio", {
        state: {
          type: "curve3d",
          id,
          title: item.title,
          from: "vault",
          curve3d: {
            xExpr: item.x,
            yExpr: item.y,
            zExpr: item.z,
            tMin: item.tRange?.[0],
            tMax: item.tRange?.[1],
            samples: item.samples,
          },
        },
      });
    } else if (resolvedType === "surface3d") {
      const [xMin, xMax] = item.xRange || [-5, 5];
      const [yMin, yMax] = item.yRange || [-5, 5];
      navigate("/studio", {
        state: {
          type: "surface3d",
          id,
          title: item.title,
          from: "vault",
          surface3d: {
            expr: item.expr,
            xMin,
            xMax,
            yMin,
            yMax,
            nx: item.samples ?? 80,
            ny: item.samples ?? 80,
          },
        },
      });
    } else if (resolvedType === "array3d") {
      navigate("/studio", {
        state: {
          type: "array3d",
          content: item.content,
          from: "vault",
          id,
        },
      });
    }
  };

  // ✅ 노트 업데이트 (제목 / 수식 / 태그)
  const handleUpdateNote = (id, patch) => {
    setNotes((prev) => {
      const next = prev.map((n) =>
        n.id === id
          ? {
              ...n,
              ...patch,
              updatedAt: new Date().toISOString(),
            }
          : n
      );
      localStorage.setItem(LS_KEY_NEW, JSON.stringify(next));
      return next;
    });
    setFocusTick((t) => t + 1);
  };

  // ✅ 노트 삭제
  const handleDeleteNote = (id) => {
    const target = notes.find((n) => n.id === id);
    if (!target) return;
    if (
      !window.confirm(
        `"${target.title || "Untitled"}" 노트를 삭제하시겠습니까?`
      )
    )
      return;

    setNotes((prev) => {
      const next = prev.filter((n) => n.id !== id);
      localStorage.setItem(LS_KEY_NEW, JSON.stringify(next));
      if (activeId === id) {
        setActiveId(next[0]?.id ?? null);
        setFocusTick((t) => t + 1);
      }
      return next;
    });
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
          </div>
          <div className="vault-actions">
            <button className="vault-btn" onClick={() => setShowNew(true)}>
              + New
            </button>
            <button
              className="vault-btn"
              onClick={() => activeId && handleOpenStudio(activeId)}
            >
              Open in Studio
            </button>
            <button className="vault-btn" onClick={exportJson}>
              Export
            </button>
            <button className="vault-btn" onClick={importDummy}>
              Reset demo
            </button>
            <button
              className="vault-btn"
              onClick={() => {
                if (
                  !window.confirm(
                    "Clear vault cache (localStorage) and reload demo data?"
                  )
                )
                  return;
                try {
                  localStorage.removeItem(LS_KEY_NEW);
                  localStorage.removeItem(LS_KEY_OLD);
                } catch (e) {
                  console.error("Failed to clear localStorage keys:", e);
                }
                const seeded = dummyResources.map(normalizeResourceType);
                localStorage.setItem(LS_KEY_NEW, JSON.stringify(seeded));
                setNotes(seeded);
                setActiveId(seeded[0]?.id || null);
                setFocusTick((t) => t + 1);
              }}
            >
              Clear Cache
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
