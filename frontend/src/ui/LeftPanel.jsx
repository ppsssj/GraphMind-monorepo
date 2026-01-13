// src/ui/LeftPanel.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { create, all } from "mathjs";
import "../styles/LeftPanel.css";

const math = create(all, {});

// ── helpers ───────────────────────────────────────────
function normalizeFormula(raw) {
  if (!raw) return "x";
  let s = String(raw).trim();
  s = s.replace(/^y\s*=\s*/i, "");
  s = s.replace(/e\s*\^\s*\{([^}]+)\}/gi, "exp($1)");
  s = s.replace(/(\d)(x)/gi, "$1*$2");
  return s;
}

function exprToFn(raw) {
  const expr = normalizeFormula(raw);
  try {
    const compiled = math.compile(expr);
    return (x) => {
      const y = Number(compiled.evaluate({ x }));
      return Number.isFinite(y) ? y : NaN;
    };
  } catch {
    return () => NaN;
  }
}

function array3dDims(content) {
  const Z = content?.length ?? 0;
  const Y = Z ? content[0]?.length ?? 0 : 0;
  const X = Y ? content[0][0]?.length ?? 0 : 0;
  return { X, Y, Z };
}

function array3dNonZero(content) {
  let cnt = 0;
  for (let z = 0; z < content.length; z++) {
    const yz = content[z] || [];
    for (let y = 0; y < yz.length; y++) {
      const row = yz[y] || [];
      for (let x = 0; x < row.length; x++) {
        if (row[x]) cnt++;
      }
    }
  }
  return cnt;
}

// ── Sparkline ─────────────────────────────────────────
function Sparkline({
  formula,
  width = 160,
  height = 40,
  xmin = -3,
  xmax = 3,
  samples = 100,
}) {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    ctx.fillStyle = "#0f1320";
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = "#263044";
    ctx.strokeRect(0.5, 0.5, width - 1, height - 1);

    const fn = exprToFn(formula);
    const xs = Array.from(
      { length: samples },
      (_, i) => xmin + (i * (xmax - xmin)) / (samples - 1)
    );
    const pts = xs
      .map((x) => ({ x, y: fn(x) }))
      .filter((p) => Number.isFinite(p.y));
    if (pts.length < 2) return;

    let ymin = Math.min(...pts.map((p) => p.y));
    let ymax = Math.max(...pts.map((p) => p.y));
    if (!Number.isFinite(ymin) || !Number.isFinite(ymax)) return;
    if (ymin === ymax) {
      ymin -= 1;
      ymax += 1;
    }
    const pad = (ymax - ymin) * 0.08;
    ymin -= pad;
    ymax += pad;

    const xToPx = (x) => ((x - xmin) / (xmax - xmin)) * (width - 8) + 4;
    const yToPx = (y) =>
      height - (((y - ymin) / (ymax - ymin)) * (height - 8) + 4);

    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "#9aa7c7";
    ctx.beginPath();
    pts.forEach((p, i) => {
      const px = xToPx(p.x);
      const py = yToPx(p.y);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.stroke();

    const last = pts[pts.length - 1];
    ctx.fillStyle = "#c6d0f5";
    ctx.beginPath();
    ctx.arc(xToPx(last.x), yToPx(last.y), 1.75, 0, Math.PI * 2);
    ctx.fill();
  }, [formula, width, height, xmin, xmax, samples]);

  return <canvas ref={ref} className="sparkline" aria-hidden="true" />;
}

// ── Curve / Array / Surface mini preview helpers ──────
function exprToFnT(raw) {
  if (!raw) return () => NaN;
  const expr = String(raw).includes("=") ? String(raw).split("=").pop() : raw;
  try {
    const compiled = math.compile(expr);
    return (t) => {
      const v = Number(compiled.evaluate({ t }));
      return Number.isFinite(v) ? v : NaN;
    };
  } catch {
    return () => NaN;
  }
}

function exprToFnXY(raw) {
  if (!raw) return () => 0;
  const rhs = String(raw).includes("=") ? String(raw).split("=").pop() : raw;
  const expr = String(rhs ?? "").trim();
  if (!expr) return () => 0;
  try {
    const compiled = math.compile(expr);
    return (x, y) => {
      try {
        const v = Number(compiled.evaluate({ x, y }));
        return Number.isFinite(v) ? v : 0;
      } catch {
        return 0;
      }
    };
  } catch {
    return () => 0;
  }
}

function MiniCurvePreview({ curve, width = 180, height = 72 }) {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !curve) return;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const xFn = exprToFnT(curve.xExpr ?? curve.x ?? "t");
    const yFn = exprToFnT(curve.yExpr ?? curve.y ?? "t");

    const tMin =
      curve.tMin ?? (Array.isArray(curve.tRange) ? curve.tRange[0] : 0);
    const tMax =
      curve.tMax ??
      (Array.isArray(curve.tRange) ? curve.tRange[1] : 2 * Math.PI);

    const samples = Math.min(
      120,
      Math.max(16, Math.floor((curve.samples ?? 200) / 4))
    );
    const ts = Array.from(
      { length: samples },
      (_, i) => tMin + (i * (tMax - tMin)) / (samples - 1)
    );

    const pts = ts
      .map((t) => ({ x: xFn(t), y: yFn(t) }))
      .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
    if (pts.length < 2) return;

    let xmin = Math.min(...pts.map((p) => p.x));
    let xmax = Math.max(...pts.map((p) => p.x));
    let ymin = Math.min(...pts.map((p) => p.y));
    let ymax = Math.max(...pts.map((p) => p.y));
    if (xmin === xmax) {
      xmin -= 1;
      xmax += 1;
    }
    if (ymin === ymax) {
      ymin -= 1;
      ymax += 1;
    }
    const padX = (xmax - xmin) * 0.08;
    const padY = (ymax - ymin) * 0.08;
    xmin -= padX;
    xmax += padX;
    ymin -= padY;
    ymax += padY;

    const mx = (x) => ((x - xmin) / (xmax - xmin)) * (width - 8) + 4;
    const my = (y) =>
      height - (((y - ymin) / (ymax - ymin)) * (height - 8) + 4);

    ctx.fillStyle = "#0f1320";
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = "#263044";
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, width - 1, height - 1);

    ctx.beginPath();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "#7fb0ff";
    pts.forEach((p, i) => {
      const px = mx(p.x);
      const py = my(p.y);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.stroke();

    const last = pts[pts.length - 1];
    ctx.fillStyle = "#c6d0f5";
    ctx.beginPath();
    ctx.arc(mx(last.x), my(last.y), 1.5, 0, Math.PI * 2);
    ctx.fill();
  }, [curve, width, height]);

  return <canvas ref={ref} className="mini-curve" aria-hidden="true" />;
}

function MiniArrayPreview({ content, width = 120, height = 72 }) {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !Array.isArray(content) || content.length === 0) return;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const Z = content.length;
    const midZ = Math.floor(Z / 2);
    const slice = content[midZ] || content[0] || [[0]];
    const rows = slice.length || 1;
    const cols = slice[0]?.length || 1;

    const cellW = width / cols;
    const cellH = height / rows;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const v = slice[r]?.[c] ?? 0;
        const alpha = Math.max(0, Math.min(1, Number(v) ? 0.9 : 0.06));
        ctx.fillStyle = `rgba(125,155,200,${alpha})`;
        ctx.fillRect(c * cellW, r * cellH, Math.ceil(cellW), Math.ceil(cellH));
      }
    }
    ctx.strokeStyle = "#263044";
    ctx.strokeRect(0.5, 0.5, width - 1, height - 1);
  }, [content, width, height]);

  return <canvas ref={ref} className="mini-array" aria-hidden="true" />;
}

function MiniSurfacePreview({ surface, width = 140, height = 72 }) {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !surface) return;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const exprRaw =
      surface.expr ??
      surface.zExpr ??
      surface.formula ??
      surface.surface3d?.expr ??
      surface.surface3d?.zExpr ??
      surface.surface3d?.formula ??
      "sin(x) * cos(y)";

    const xMin =
      surface.xMin ??
      surface.surface3d?.xMin ??
      (Array.isArray(surface.xRange)
        ? surface.xRange[0]
        : surface.surface3d?.xRange?.[0]) ??
      -3;
    const xMax =
      surface.xMax ??
      surface.surface3d?.xMax ??
      (Array.isArray(surface.xRange)
        ? surface.xRange[1]
        : surface.surface3d?.xRange?.[1]) ??
      3;
    const yMin =
      surface.yMin ??
      surface.surface3d?.yMin ??
      (Array.isArray(surface.yRange)
        ? surface.yRange[0]
        : surface.surface3d?.yRange?.[0]) ??
      -3;
    const yMax =
      surface.yMax ??
      surface.surface3d?.yMax ??
      (Array.isArray(surface.yRange)
        ? surface.yRange[1]
        : surface.surface3d?.yRange?.[1]) ??
      3;

    const fn = exprToFnXY(exprRaw);
    const gx = 40;
    const gy = 24;

    const zVals = [];
    let zMin = Infinity;
    let zMax = -Infinity;

    for (let j = 0; j < gy; j++) {
      const ty = j / (gy - 1 || 1);
      const y = yMin + (yMax - yMin) * ty;
      for (let i = 0; i < gx; i++) {
        const tx = i / (gx - 1 || 1);
        const x = xMin + (xMax - xMin) * tx;
        const z = fn(x, y);
        zVals.push(z);
        if (z < zMin) zMin = z;
        if (z > zMax) zMax = z;
      }
    }

    if (!Number.isFinite(zMin) || !Number.isFinite(zMax)) {
      zMin = -1;
      zMax = 1;
    }
    const span = zMax - zMin || 1;

    const cellW = width / gx;
    const cellH = height / gy;

    ctx.fillStyle = "#0f1320";
    ctx.fillRect(0, 0, width, height);

    let idx = 0;
    for (let j = 0; j < gy; j++) {
      for (let i = 0; i < gx; i++) {
        const z = zVals[idx++];
        const t = Math.max(0, Math.min(1, (z - zMin) / span));
        const h = 220 - 80 * t;
        const s = 60 + 20 * t;
        const l = 35 + 15 * t;
        ctx.fillStyle = `hsl(${h}, ${s}%, ${l}%)`;
        ctx.fillRect(i * cellW, j * cellH, Math.ceil(cellW), Math.ceil(cellH));
      }
    }

    ctx.strokeStyle = "#263044";
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, width - 1, height - 1);
  }, [surface, width, height]);

  return <canvas ref={ref} className="mini-surface" aria-hidden="true" />;
}

// ── LeftPanel ─────────────────────────────────────────
export default function LeftPanel({
  equations = [],
  resources,
  onOpenQuick,
  onPreview,
  onOpenArray,
  onOpenResource,
  onNew,
}) {
  const [q, setQ] = useState("");
  const [tag, setTag] = useState("all");
  const [showQuick, setShowQuick] = useState(false);

  // drag-to-resize state
  const [panelWidth, setPanelWidth] = useState(() => {
    try {
      const v = parseInt(localStorage.getItem("gm_leftPanelWidth"), 10);
      return Number.isFinite(v) && v > 0 ? v : 280;
    } catch {
      return 280;
    }
  });
  const [collapsed, setCollapsed] = useState(false);
  const draggingRef = useRef(false);
  const startXRef = useRef(0);
  const startWRef = useRef(panelWidth);
  const widthRef = useRef(panelWidth);

  useEffect(() => {
    widthRef.current = panelWidth;
    if (!draggingRef.current) {
      try {
        localStorage.setItem("gm_leftPanelWidth", String(panelWidth));
      } catch {}
    }
  }, [panelWidth]);

  useEffect(() => {
    function onMove(e) {
      if (!draggingRef.current) return;
      const dx = e.clientX - startXRef.current;
      const newW = Math.max(36, startWRef.current + dx);
      setPanelWidth(newW);
      setCollapsed(newW < 60);
    }
    function onUp() {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      try {
        localStorage.setItem("gm_leftPanelWidth", String(widthRef.current));
      } catch {}
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, []);

  function handleResizerPointerDown(e) {
    draggingRef.current = true;
    startXRef.current = e.clientX;
    startWRef.current = widthRef.current;
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }

  const items = useMemo(() => {
    if (Array.isArray(resources) && resources.length) return resources;
    return equations.map((e) => ({ ...e, type: "equation" }));
  }, [resources, equations]);

  const eqs = useMemo(
    () => items.filter((r) => r.type === "equation"),
    [items]
  );
  const arrs = useMemo(
    () => items.filter((r) => r.type === "array3d"),
    [items]
  );
  const curves = useMemo(
    () => items.filter((r) => r.type === "curve3d"),
    [items]
  );
  const surfaces = useMemo(
    () => items.filter((r) => r.type === "surface3d"),
    [items]
  );

  const tags = useMemo(() => {
    const tset = new Set();
    items.forEach((e) => (e.tags || []).forEach((t) => tset.add(t)));
    return ["all", ...Array.from(tset)];
  }, [items]);

  const filteredEqs = useMemo(() => {
    const kw = q.trim().toLowerCase();
    return eqs.filter((e) => {
      const byTag = tag === "all" || (e.tags || []).includes(tag);
      const byKw =
        !kw ||
        (e.title || "").toLowerCase().includes(kw) ||
        (e.formula || "").toLowerCase().includes(kw);
      return byTag && byKw;
    });
  }, [eqs, q, tag]);

  const filteredArrs = useMemo(() => {
    const kw = q.trim().toLowerCase();
    return arrs.filter((a) => {
      const byTag = tag === "all" || (a.tags || []).includes(tag);
      const byKw = !kw || (a.title || "").toLowerCase().includes(kw);
      return byTag && byKw;
    });
  }, [arrs, q, tag]);

  const filteredCurves = useMemo(() => {
    const kw = q.trim().toLowerCase();
    return curves.filter((c) => {
      const byTag = tag === "all" || (c.tags || []).includes(tag);
      const byKw =
        !kw ||
        (c.title || "").toLowerCase().includes(kw) ||
        (c.x || "").toLowerCase().includes(kw) ||
        (c.y || "").toLowerCase().includes(kw) ||
        (c.z || "").toLowerCase().includes(kw);
      return byTag && byKw;
    });
  }, [curves, q, tag]);

  const filteredSurfaces = useMemo(() => {
    const kw = q.trim().toLowerCase();
    return surfaces.filter((s) => {
      const byTag = tag === "all" || (s.tags || []).includes(tag);
      const expr =
        s.expr ??
        s.zExpr ??
        s.formula ??
        s.surface3d?.expr ??
        s.surface3d?.zExpr ??
        s.surface3d?.formula ??
        "";
      const byKw =
        !kw ||
        (s.title || "").toLowerCase().includes(kw) ||
        String(expr).toLowerCase().includes(kw);
      return byTag && byKw;
    });
  }, [surfaces, q, tag]);

  const QUICK = [
    "x",
    "x^2",
    "x^3 - 2*x",
    "sin(x)",
    "cos(x)",
    "exp(x)-1",
    "log(x+1)",
  ];

  const openArray = (res) => {
    if (onOpenArray) return onOpenArray(res);
    if (onOpenResource) return onOpenResource(res);
    console.warn("[LeftPanel] onOpenArray/onOpenResource 콜백이 없습니다.");
  };

  const widthStyle = { width: collapsed ? 36 : panelWidth };
  const cls = [
    "left-panel",
    "explorer",
    collapsed ? "collapsed" : "",
    draggingRef.current ? "resizing" : "",
  ].join(" ");

  return (
    <aside className={cls} style={widthStyle}>
      {/* ✅ resizer는 스크롤 영역 밖(aside 직속) */}
      <div
        className="lp-resizer"
        onPointerDown={handleResizerPointerDown}
        aria-hidden="true"
      >
        <div className="lp-grip" aria-hidden="true">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </div>

      {collapsed && (
        <div
          className="lp-collapsed-handle"
          onPointerDown={handleResizerPointerDown}
          title="Drag to open"
        >
          <span className="lp-arrow">◀</span>
        </div>
      )}

      {/* ✅ 여기만 스크롤 */}
      <div className="lp-scroll">
        {/* Open / New */}
        <div className="section">
          <div className="label">Open Graph</div>
          <button
            className="btn solid"
            onClick={() => setShowQuick((prev) => !prev)}
          >
            + New Graph
          </button>

          <div className={`fade-down ${showQuick ? "open" : ""}`}>
            <div className="label" style={{ marginTop: 10 }}>
              Quick Picks
            </div>
            <ul className="quick-list">
              {QUICK.map((f) => (
                <li key={f}>
                  <button
                    className="btn ghost"
                    onClick={() => onOpenQuick?.(f)}
                  >
                    {f}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* 검색/태그 */}
        <div className="section">
          <div className="label">Resources</div>
          <div className="row" style={{ gap: 8, marginBottom: 8 }}>
            <input
              className="btn"
              style={{ padding: 6 }}
              placeholder="Search…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <select
              className="btn"
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              style={{ width: 120, padding: 6 }}
            >
              {tags.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Equations */}
        <div className="section">
          <div className="label">Equations</div>
          <ul className="eq-list">
            {filteredEqs.map((e) => (
              <li key={e.id} className="eq-item">
                <div className="eq-head">
                  <div className="eq-title">{e.title}</div>
                  {e.updatedAt && (
                    <div className="eq-updated">
                      {new Date(e.updatedAt).toLocaleDateString()}
                    </div>
                  )}
                </div>

                <div className="eq-formula">{e.formula}</div>
                <Sparkline formula={e.formula} />

                {e.tags?.length ? (
                  <div className="eq-tags">
                    {e.tags.map((t) => (
                      <span key={t} className="chip">
                        {t}
                      </span>
                    ))}
                  </div>
                ) : null}

                <div className="eq-actions">
                  <button
                    className="btn solid"
                    onClick={() =>
                      onOpenResource
                        ? onOpenResource(e)
                        : onOpenQuick?.(e.formula)
                    }
                    title="Open"
                  >
                    Open
                  </button>
                </div>
              </li>
            ))}
            {filteredEqs.length === 0 && (
              <li className="eq-empty">No matches.</li>
            )}
          </ul>
        </div>

        {/* 3D Arrays */}
        {arrs.length > 0 && (
          <div className="section">
            <div className="label">3D Arrays</div>
            <ul className="eq-list">
              {filteredArrs.map((a) => {
                const dims = array3dDims(a.content);
                const nnz = array3dNonZero(a.content);
                return (
                  <li key={a.id} className="eq-item">
                    <div className="eq-head">
                      <div className="eq-title">{a.title}</div>
                      {a.updatedAt && (
                        <div className="eq-updated">
                          {new Date(a.updatedAt).toLocaleDateString()}
                        </div>
                      )}
                    </div>

                    <MiniArrayPreview
                      content={a.content}
                      width={120}
                      height={60}
                    />
                    <div className="eq-formula">
                      Size: {dims.X}×{dims.Y}×{dims.Z} &nbsp; | &nbsp; Non-zero:{" "}
                      {nnz}
                    </div>

                    {a.tags?.length ? (
                      <div className="eq-tags">
                        {a.tags.map((t) => (
                          <span key={t} className="chip">
                            {t}
                          </span>
                        ))}
                      </div>
                    ) : null}

                    <div className="eq-actions">
                      <button
                        className="btn solid"
                        onClick={() => openArray(a)}
                        title="Open 3D Array"
                      >
                        Open
                      </button>
                    </div>
                  </li>
                );
              })}
              {filteredArrs.length === 0 && (
                <li className="eq-empty">No matches.</li>
              )}
            </ul>
          </div>
        )}

        {/* 3D Surfaces */}
        {surfaces.length > 0 && (
          <div className="section">
            <div className="label">3D Surfaces</div>
            <ul className="eq-list">
              {filteredSurfaces.map((s) => {
                const expr =
                  s.expr ??
                  s.zExpr ??
                  s.formula ??
                  s.content?.expr ??
                  s.content?.zExpr ??
                  s.content?.formula ??
                  s.surface3d?.expr ??
                  s.surface3d?.zExpr ??
                  s.surface3d?.formula ??
                  "";
                const xRange = s.xRange ??
                  s.surface3d?.xRange ?? [s.xMin, s.xMax];
                const yRange = s.yRange ??
                  s.surface3d?.yRange ?? [s.yMin, s.yMax];
                const xMin = xRange?.[0] ?? s.xMin ?? s.surface3d?.xMin ?? -3;
                const xMax = xRange?.[1] ?? s.xMax ?? s.surface3d?.xMax ?? 3;
                const yMin = yRange?.[0] ?? s.yMin ?? s.surface3d?.yMin ?? -3;
                const yMax = yRange?.[1] ?? s.yMax ?? s.surface3d?.yMax ?? 3;

                return (
                  <li key={s.id} className="eq-item">
                    <div className="eq-head">
                      <div className="eq-title">{s.title}</div>
                      {s.updatedAt && (
                        <div className="eq-updated">
                          {new Date(s.updatedAt).toLocaleDateString()}
                        </div>
                      )}
                    </div>

                    <MiniSurfacePreview surface={s} width={140} height={64} />
                    <div
                      className="eq-formula"
                      style={{ fontFamily: "monospace", fontSize: 11 }}
                    >
                      z = {String(expr || "").slice(0, 80)}
                      {String(expr || "").length > 80 ? "…" : ""}
                      <br />x ∈ [{xMin}, {xMax}], y ∈ [{yMin}, {yMax}]
                    </div>

                    {s.tags?.length ? (
                      <div className="eq-tags">
                        {s.tags.map((t) => (
                          <span key={t} className="chip">
                            {t}
                          </span>
                        ))}
                      </div>
                    ) : null}

                    <div className="eq-actions">
                      <button
                        className="btn solid"
                        onClick={() => onOpenResource?.(s)}
                        title="Open 3D Surface"
                      >
                        Open
                      </button>
                    </div>
                  </li>
                );
              })}
              {filteredSurfaces.length === 0 && (
                <li className="eq-empty">No matches.</li>
              )}
            </ul>
          </div>
        )}

        {/* 3D Curves */}
        {/* 3D Curves */}
        {curves.length > 0 && (
          <div className="section">
            <div className="label">3D Curves</div>
            <ul className="eq-list">
              {filteredCurves.map((c) => {
                // ✅ 여기(중괄호 블록)에서 선언해야 함
                const cx =
                  c.x ?? c.xExpr ?? c.content?.xExpr ?? c.content?.x ?? "";
                const cy =
                  c.y ?? c.yExpr ?? c.content?.yExpr ?? c.content?.y ?? "";
                const cz =
                  c.z ?? c.zExpr ?? c.content?.zExpr ?? c.content?.z ?? "";

                return (
                  <li key={c.id} className="eq-item">
                    <div className="eq-head">
                      <div className="eq-title">{c.title}</div>
                      {c.updatedAt && (
                        <div className="eq-updated">
                          {new Date(c.updatedAt).toLocaleDateString()}
                        </div>
                      )}
                    </div>

                    <MiniCurvePreview curve={c} width={160} height={64} />
                    <div
                      className="eq-formula"
                      style={{ fontFamily: "monospace", fontSize: 11 }}
                    >
                      x(t): {cx}
                      <br />
                      y(t): {cy}
                      <br />
                      z(t): {cz}
                      <br />
                      {Array.isArray(c.tRange) && c.tRange.length === 2 && (
                        <>
                          t ∈ [{c.tRange[0]}, {c.tRange[1]}]
                        </>
                      )}
                    </div>

                    {c.tags?.length ? (
                      <div className="eq-tags">
                        {c.tags.map((t) => (
                          <span key={t} className="chip">
                            {t}
                          </span>
                        ))}
                      </div>
                    ) : null}

                    <div className="eq-actions">
                      <button
                        className="btn solid"
                        onClick={() => onOpenResource?.(c)}
                        title="Open 3D Curve"
                      >
                        Open
                      </button>
                    </div>
                  </li>
                );
              })}
              {filteredCurves.length === 0 && (
                <li className="eq-empty">No matches.</li>
              )}
            </ul>
          </div>
        )}

        <div className="note">
          Tip: 상단 탭을 드래그해 오른쪽으로 떼면 VSCode처럼 화면이 분할돼요.
        </div>
      </div>
    </aside>
  );
}
