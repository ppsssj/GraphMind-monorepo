// src/components/ObsidianGraphView.jsx
import React, {
  useEffect,
  useMemo,
  useRef,
  useLayoutEffect,
  useState,
} from "react";
import ForceGraph2D from "react-force-graph-2d";
import "../styles/ObsidianGraphView.css";

export default function ObsidianGraphView({
  notes = [],
  activeId,
  onActivate,
  onOpenStudio,
  focusTick = 0,
}) {
  const fgRef = useRef(null);
  const wrapRef = useRef(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  // ✅ tag↔note만 연결하려면 false
  const ENABLE_NOTE_NOTE_LINKS = false;

  // ✅ 태그는 "완전 동일 문자열"만 동일 취급(공백 제거)
  const normalizeTag = (t) => String(t ?? "").trim();

  // ✅ 타입별 노출 여부 토글 상태
  const [filters, setFilters] = useState({
    note: true, // equation / 일반 노트
    array: true, // Array (3D)
    curve: true, // Curve (3D · z-axis)
    surface: true, // Surface (3D · z=f(x,y))
    tag: true, // Tag
  });

  const toggleType = (type) => {
    setFilters((prev) => ({ ...prev, [type]: !prev[type] }));
  };

  // === 전체 그래프 (정적) - 수식 + 배열 + curve3d + surface3d 동시 처리 ===
  const fullGraph = useMemo(() => {
    const nodes = [];
    const links = [];
    const noteIds = new Set(notes.map((n) => n.id));

    // 노트(수식/배열/curve3d/surface3d) 노드
    notes.forEach((n) => {
      let type = "note";
      if (n.type === "array3d") type = "array";
      if (n.type === "curve3d") type = "curve";
      if (n.type === "surface3d" || n.type === "equation3d") type = "surface";

      nodes.push({
        id: n.id,
        label: n.title,
        type,
      });
    });

    // 태그 노드 + 노트↔태그 링크 (✅ 완전 동일 문자열만 동일 태그)
    const tagSet = new Set();
    notes.forEach((n) => {
      (n.tags || []).forEach((raw) => {
        const t = normalizeTag(raw);
        if (!t) return;

        const tagId = `tag:${t}`; // ✅ "abc" ≠ "abcd"
        if (!tagSet.has(tagId)) {
          tagSet.add(tagId);
          nodes.push({ id: tagId, label: `#${t}`, type: "tag" });
        }
        links.push({ source: n.id, target: tagId });
      });
    });

    // 노트↔노트 링크 (원하면 true로 켜기)
    if (ENABLE_NOTE_NOTE_LINKS) {
      notes.forEach((n) => {
        (n.links || []).forEach((lid) => {
          if (noteIds.has(lid)) links.push({ source: n.id, target: lid });
        });
      });
    }

    return { nodes, links };
  }, [notes]);

  // === 크기 추적 ===
  useLayoutEffect(() => {
    if (!wrapRef.current) return;

    const ro = new ResizeObserver(([entry]) => {
      const r = entry.contentRect;

      // 소수점 단위 흔들림 때문에 높이가 계속 미세하게 변하는 케이스 방지
      const w = Math.max(200, Math.round(r.width));
      const h = Math.max(200, Math.round(r.height));
      setSize({ w, h });
    });

    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  // === 타임랩스 전용 상태 ===
  const [graph, setGraph] = useState({ nodes: [], links: [] });
  const [isPlaying, setIsPlaying] = useState(false);
  const [cursor, setCursor] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [showControls, setShowControls] = useState(false);

  // notes.updatedAt 기반 타임라인 (배열, curve3d, surface3d 포함)
  const timeline = useMemo(() => {
    const steps = [];
    const safeTime = (t) => {
      const v = Number(new Date(t));
      return Number.isFinite(v) ? v : 0;
    };
    const sortedNotes = [...notes].sort(
      (a, b) => safeTime(a.updatedAt) - safeTime(b.updatedAt)
    );

    const seenTags = new Set();
    for (const n of sortedNotes) {
      const t = safeTime(n.updatedAt);
      let nodeType = "note";
      if (n.type === "array3d") nodeType = "array";
      if (n.type === "curve3d") nodeType = "curve";
      if (n.type === "surface3d" || n.type === "equation3d")
        nodeType = "surface";

      steps.push({
        t,
        type: "node",
        node: {
          id: n.id,
          label: n.title,
          type: nodeType,
        },
      });

      for (const raw of n.tags || []) {
        const tag = normalizeTag(raw);
        if (!tag) continue;

        const tagId = `tag:${tag}`; // ✅ 완전 동일만 동일 취급
        if (!seenTags.has(tagId)) {
          seenTags.add(tagId);
          steps.push({
            t,
            type: "node",
            node: { id: tagId, label: `#${tag}`, type: "tag" },
          });
        }
        steps.push({ t, type: "link", link: { source: n.id, target: tagId } });
      }
    }

    // const noteIds = new Set(notes.map((n) => n.id));
    // const idToTime = new Map(notes.map((n) => [n.id, safeTime(n.updatedAt)]));
    // const dedup = new Set();
    for (const n of notes) {
      if (ENABLE_NOTE_NOTE_LINKS) {
        const noteIds = new Set(notes.map((n) => n.id));
        const idToTime = new Map(
          notes.map((n) => [n.id, safeTime(n.updatedAt)])
        );
        const dedup = new Set();

        for (const n of notes) {
          for (const lid of n.links || []) {
            if (!noteIds.has(lid)) continue;
            const key = n.id < lid ? `${n.id}|${lid}` : `${lid}|${n.id}`;
            if (dedup.has(key)) continue;
            dedup.add(key);

            const t = Math.max(idToTime.get(n.id) || 0, idToTime.get(lid) || 0);
            steps.push({
              t,
              type: "link",
              link: { source: n.id, target: lid },
            });
          }
        }
      }
    }

    steps.sort((a, b) => a.t - b.t || (a.type === "node" ? -1 : 1));
    return steps;
  }, [notes]);

  const total = timeline.length;

  // 타임랩스 재생 루프
  useEffect(() => {
    if (!isPlaying) return;
    if (cursor >= total) {
      setIsPlaying(false);
      return;
    }

    const nextDelay = Math.max(50, 200 / speed);
    const to = setTimeout(() => {
      const step = timeline[cursor];
      setGraph((prev) => {
        if (step.type === "node") {
          if (prev.nodes.some((n) => String(n.id) === String(step.node.id)))
            return prev;
          return { nodes: [...prev.nodes, step.node], links: [...prev.links] };
        } else {
          const exists = prev.links.some(
            (l) =>
              String(l.source?.id || l.source) === String(step.link.source) &&
              String(l.target?.id || l.target) === String(step.link.target)
          );
          if (exists) return prev;
          return { nodes: [...prev.nodes], links: [...prev.links, step.link] };
        }
      });
      setCursor((c) => c + 1);
      fgRef.current?.d3ReheatSimulation?.();
    }, nextDelay);

    return () => clearTimeout(to);
  }, [isPlaying, cursor, speed, total, timeline]);

  // 타임랩스가 아닐 때 전체 그래프 표시
  useEffect(() => {
    if (!isPlaying && cursor === 0) setGraph(fullGraph);
  }, [fullGraph, isPlaying, cursor]);

  // ✅ 필터 적용된 그래프 (실제 렌더용)
  const displayGraph = useMemo(() => {
    const nodes = (graph.nodes || []).filter((n) => {
      const t = n.type || "note";
      return filters[t] !== false;
    });

    const visibleIds = new Set(nodes.map((n) => String(n.id)));

    const links = (graph.links || []).filter((l) => {
      const s = String(l.source?.id || l.source);
      const t = String(l.target?.id || l.target);
      return visibleIds.has(s) && visibleIds.has(t);
    });

    return { nodes, links };
  }, [graph, filters]);

  // 활성 노드로 카메라 이동 (✅ 필터 적용된 그래프 기준)
  useEffect(() => {
    if (!activeId || !fgRef.current) return;
    let tries = 0;
    const maxTries = 30;

    const tick = () => {
      if (!fgRef.current) return;
      const node =
        (displayGraph?.nodes || []).find(
          (n) => String(n.id) === String(activeId)
        ) || null;
      if (node && node.x != null && node.y != null) {
        fgRef.current.centerAt(node.x, node.y, 600);
        fgRef.current.zoom(2.3, 600);
      } else if (tries++ < maxTries) {
        requestAnimationFrame(tick);
      }
    };
    tick();
  }, [activeId, displayGraph, focusTick]);

  // 초기 줌 레벨 설정
  useEffect(() => {
    if (fgRef.current) {
      fgRef.current.zoom(0.5, 600);
    }
  }, []);

  // 타임랩스 컨트롤
  const startTimelapse = () => {
    setIsPlaying(true);
    setCursor(0);
    setGraph({ nodes: [], links: [] });
  };
  const pauseTimelapse = () => setIsPlaying(false);
  const resumeTimelapse = () => {
    if (cursor >= total) return;
    setIsPlaying(true);
  };
  const resetTimelapse = () => {
    setIsPlaying(false);
    setGraph({ nodes: [], links: [] });
    setCursor(0);
    fgRef.current?.d3ReheatSimulation?.();
  };
  const showAll = () => {
    setIsPlaying(false);
    setGraph(fullGraph);
    setCursor(total);
    fgRef.current?.d3ReheatSimulation?.();
  };

  const currentTs = timeline[Math.min(cursor - 1, total - 1)]?.t;
  const currentDateLabel = currentTs
    ? new Date(currentTs).toLocaleString()
    : "";

  return (
    <div className="graph-wrap" ref={wrapRef}>
      {size.w > 0 && size.h > 0 && (
        <ForceGraph2D
          ref={fgRef}
          width={size.w}
          height={size.h}
          graphData={displayGraph}
          d3VelocityDecay={0.35}
          linkColor={() => "rgba(255,255,255,0.18)"}
          linkDirectionalParticles={1}
          linkDirectionalParticleSpeed={0.006}
          nodeRelSize={6}
          nodeCanvasObject={(node, ctx, globalScale) => {
            const label = node.label;
            const isActive = String(node.id) === String(activeId);
            const isTag = node.type === "tag";

            // ✅ 크기 정책: note(및 array/curve/surface) > tag, active > normal
            const r = isTag
              ? isActive
                ? 4
                : 3 // tag는 작게
              : isActive
              ? 8
              : 5; // 노트류는 크게 + 활성 더 크게

            const fontBase = 4 / globalScale;
            const fontSize = Math.max(
              isTag ? 8 : 10, // 최소 폰트도 note가 더 큼
              fontBase + (isTag ? -0.5 : 1.5) + (isActive ? 3 : 0)
            );

            // 타입별 색상
            let color = "#6ee7b7"; // 기본 note
            if (node.type === "tag") color = "#60a5fa";
            else if (node.type === "array") color = "#f59e0b";
            else if (node.type === "curve") color = "#e54848";
            else if (node.type === "surface") color = "#a855f7";

            ctx.beginPath();
            ctx.arc(node.x, node.y, r, 0, Math.PI * 2, false);
            ctx.fillStyle = color;
            ctx.globalAlpha = isActive ? 1 : 0.9;
            ctx.fill();

            ctx.font = `${fontSize}px Inter, system-ui, -apple-system`;
            ctx.textAlign = "left";
            ctx.textBaseline = "middle";
            ctx.fillStyle = "#e5e7eb";
            ctx.globalAlpha = isActive ? 1 : 0.9;

            // 텍스트 시작 위치도 반지름 기준으로 밀기
            ctx.fillText(` ${label}`, node.x + (r + 2), node.y);
          }}
          onNodeClick={(node) => {
            const id = String(node.id);
            if (!id.startsWith("tag:")) onActivate(id);
          }}
          onNodeRightClick={(node) => {
            const id = String(node.id);
            if (!id.startsWith("tag:")) onOpenStudio(id);
          }}
          cooldownTime={8000}
          backgroundColor="#0f1115"
        />
      )}

      {/* 타임랩스 컨트롤 */}
      <div
        className="timelapse-controls"
        style={{
          position: "absolute",
          left: 20,
          bottom: 20,
          zIndex: 20,
          minWidth: 0,
        }}
      >
        {!showControls ? (
          <button
            className="tl-toggle-btn fade-in-right"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 8,
              fontSize: 22,
              color: "#60a5fa",
              transition: "all 0.4s",
            }}
            onClick={() => setShowControls(true)}
            aria-label="Show timelapse controls"
          >
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <circle cx="14" cy="14" r="12" stroke="#60a5fa" strokeWidth="2" />
              <rect x="13" y="7" width="2" height="8" rx="1" fill="#60a5fa" />
              <rect x="13" y="14" width="7" height="2" rx="1" fill="#60a5fa" />
            </svg>
          </button>
        ) : (
          <div
            className="tl-controls-panel fade-in-left"
            style={{
              minWidth: 340,
              maxWidth: 480,
              background: "#181a20ee",
              borderRadius: 12,
              boxShadow: "0 2px 16px #0006",
              padding: 18,
              transition: "all 0.4s",
              width: "100%",
            }}
          >
            <button
              className="tl-close-btn"
              style={{
                position: "absolute",
                top: 12,
                right: 12,
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: 18,
                color: "#9aa4b2",
              }}
              onClick={() => setShowControls(false)}
              aria-label="Close timelapse controls"
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
            <div className="tl-row">
              {!isPlaying && cursor === 0 && (
                <button className="tl-btn" onClick={startTimelapse}>
                  ▶ Play
                </button>
              )}
              {isPlaying && (
                <button className="tl-btn" onClick={pauseTimelapse}>
                  ⏸ Pause
                </button>
              )}
              {!isPlaying && cursor > 0 && cursor < total && (
                <button className="tl-btn" onClick={resumeTimelapse}>
                  ▶ Resume
                </button>
              )}
              <button className="tl-btn subtle" onClick={resetTimelapse}>
                ⟲ Reset
              </button>
              <button className="tl-btn subtle" onClick={showAll}>
                ▣ Show All
              </button>

              <div className="tl-sep" />
              <label className="tl-speed">
                Speed
                <input
                  type="range"
                  min="0.5"
                  max="4"
                  step="0.5"
                  value={speed}
                  onChange={(e) => setSpeed(Number(e.target.value))}
                />
                <span>{speed.toFixed(1)}x</span>
              </label>
            </div>

            <div className="tl-row">
              <div className="tl-progress">
                <div
                  className="tl-progress-fill"
                  style={{ width: `${(cursor / Math.max(1, total)) * 100}%` }}
                />
              </div>
              <div className="tl-stats">
                <span>
                  {cursor}/{total}
                </span>
                <span className="tl-date">{currentDateLabel}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 범례 + 타입 토글 */}
      <div className="legend">
        <div
          className={`row toggle ${filters.note ? "on" : "off"}`}
          onClick={() => toggleType("note")}
        >
          <span className="dot note" /> equation
        </div>
        <div
          className={`row toggle ${filters.array ? "on" : "off"}`}
          onClick={() => toggleType("array")}
        >
          <span className="dot" style={{ background: "#f59e0b" }} /> Array (3D)
        </div>
        <div
          className={`row toggle ${filters.curve ? "on" : "off"}`}
          onClick={() => toggleType("curve")}
        >
          <span className="dot curve" /> Curve (3D · z-axis)
        </div>
        <div
          className={`row toggle ${filters.surface ? "on" : "off"}`}
          onClick={() => toggleType("surface")}
        >
          <span
            className="dot"
            style={{ background: "#a855f7", boxShadow: "0 0 4px #a855f7aa" }}
          />{" "}
          Surface (3D · z=f(x,y))
        </div>
        <div
          className={`row toggle ${filters.tag ? "on" : "off"}`}
          onClick={() => toggleType("tag")}
        >
          <span className="dot tag" /> Tag
        </div>
        <div style={{ fontSize: 11, color: "#9aa4b2", marginTop: 6 }}>
          • Left-click: select · Right-click: open in Studio
        </div>
      </div>
    </div>
  );
}
