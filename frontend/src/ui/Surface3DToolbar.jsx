// src/ui/Surface3DToolbar.jsx
import { useEffect, useState } from "react";
import "./Toolbar.css";
import "./Curve3DToolbar.css";

function clampInt(v, lo, hi, fallback) {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return fallback;
  return Math.max(lo, Math.min(hi, n));
}

export default function Surface3DToolbar({ surface3d, onChange, onFit, onClearMarkers }) {
  const s = surface3d || {};

  const [expr, setExpr] = useState(s.expr ?? "sin(x) * cos(y)");
  const [xMin, setXMin] = useState(s.xMin ?? -5);
  const [xMax, setXMax] = useState(s.xMax ?? 5);
  const [yMin, setYMin] = useState(s.yMin ?? -5);
  const [yMax, setYMax] = useState(s.yMax ?? 5);
  const [nx, setNx] = useState(s.nx ?? 60);
  const [ny, setNy] = useState(s.ny ?? 60);

  const [gridMode, setGridMode] = useState(s.gridMode ?? "major");
  const [gridStep, setGridStep] = useState(s.gridStep ?? 1);
  const [minorDiv, setMinorDiv] = useState(s.minorDiv ?? 4);

  const [editMode, setEditMode] = useState(Boolean(s.editMode ?? true));
  const [degree, setDegree] = useState(s.degree ?? 2);

  useEffect(() => {
    setExpr(s.expr ?? "sin(x) * cos(y)");
    setXMin(s.xMin ?? -5);
    setXMax(s.xMax ?? 5);
    setYMin(s.yMin ?? -5);
    setYMax(s.yMax ?? 5);
    setNx(s.nx ?? 60);
    setNy(s.ny ?? 60);

    setGridMode(s.gridMode ?? "major");
    setGridStep(s.gridStep ?? 1);
    setMinorDiv(s.minorDiv ?? 4);

    setEditMode(Boolean(s.editMode ?? true));
    setDegree(s.degree ?? 2);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    s.expr,
    s.xMin,
    s.xMax,
    s.yMin,
    s.yMax,
    s.nx,
    s.ny,
    s.gridMode,
    s.gridStep,
    s.minorDiv,
    s.editMode,
    s.degree,
  ]);

  const commitGridMode = (value) => {
    const mode = String(value || "major");
    setGridMode(mode);
    onChange?.({ gridMode: mode });
  };

  const commitGridStep = (value) => {
    const step = Math.max(0.1, Number(value) || 1);
    setGridStep(step);
    onChange?.({ gridStep: step });
  };

  const commitMinorDiv = (value) => {
    const div = clampInt(value, 2, 16, 4);
    setMinorDiv(div);
    onChange?.({ minorDiv: div });
  };

  const commitEditMode = (value) => {
    const v = Boolean(value);
    setEditMode(v);
    onChange?.({ editMode: v });
  };

  const commitDegree = (value) => {
    const d = clampInt(value, 1, 4, 2);
    setDegree(d);
    onChange?.({ degree: d });
  };

  const apply = () => {
    const next = {
      expr: String(expr ?? "").trim() || "0",
      xMin: Number(xMin),
      xMax: Number(xMax),
      yMin: Number(yMin),
      yMax: Number(yMax),
      nx: Math.max(8, Number(nx) || 60),
      ny: Math.max(8, Number(ny) || 60),
      gridMode: String(gridMode || "major"),
      gridStep: Math.max(0.1, Number(gridStep) || 1),
      minorDiv: clampInt(minorDiv, 2, 16, 4),
      editMode: Boolean(editMode),
      degree: clampInt(degree, 1, 4, 2),
    };

    if (![next.xMin, next.xMax, next.yMin, next.yMax].every((v) => Number.isFinite(v))) return;
    onChange?.(next);
  };

  const resetGrid = () => {
    setGridMode("major");
    setGridStep(1);
    setMinorDiv(4);
    onChange?.({ gridMode: "major", gridStep: 1, minorDiv: 4 });
  };

  return (
    <div className="toolbar curve3d-toolbar">
      <div className="toolbar-section curve3d-toolbar-left">
        <div className="curve3d-toolbar-title">Surface3D</div>
      </div>

      <div className="toolbar-section curve3d-toolbar-fields">
        <div className="curve3d-field">
          <label className="toolbar-label">z = f(x,y)</label>
          <input
            className="toolbar-input"
            value={expr}
            onChange={(e) => setExpr(e.target.value)}
            placeholder="e.g. sin(x) * cos(y)"
          />
        </div>

        <div className="curve3d-field curve3d-field-small">
          <label className="toolbar-label">xMin</label>
          <input className="toolbar-input" value={xMin} onChange={(e) => setXMin(e.target.value)} />
        </div>
        <div className="curve3d-field curve3d-field-small">
          <label className="toolbar-label">xMax</label>
          <input className="toolbar-input" value={xMax} onChange={(e) => setXMax(e.target.value)} />
        </div>
        <div className="curve3d-field curve3d-field-small">
          <label className="toolbar-label">yMin</label>
          <input className="toolbar-input" value={yMin} onChange={(e) => setYMin(e.target.value)} />
        </div>
        <div className="curve3d-field curve3d-field-small">
          <label className="toolbar-label">yMax</label>
          <input className="toolbar-input" value={yMax} onChange={(e) => setYMax(e.target.value)} />
        </div>

        <div className="curve3d-field curve3d-field-small">
          <label className="toolbar-label">nx</label>
          <input className="toolbar-input" value={nx} onChange={(e) => setNx(e.target.value)} />
        </div>
        <div className="curve3d-field curve3d-field-small">
          <label className="toolbar-label">ny</label>
          <input className="toolbar-input" value={ny} onChange={(e) => setNy(e.target.value)} />
        </div>

        <div className="curve3d-field curve3d-field-small">
          <label className="toolbar-label">Edit</label>
          <select className="toolbar-input" value={editMode ? "on" : "off"} onChange={(e) => commitEditMode(e.target.value === "on")}>
            <option value="on">On</option>
            <option value="off">Off</option>
          </select>
        </div>

        <div className="curve3d-field curve3d-field-small">
          <label className="toolbar-label">Degree</label>
          <select className="toolbar-input" value={degree} onChange={(e) => commitDegree(e.target.value)}>
            <option value={1}>1</option>
            <option value={2}>2</option>
            <option value={3}>3</option>
            <option value={4}>4</option>
          </select>
        </div>

        <div className="curve3d-field curve3d-field-small">
          <label className="toolbar-label">Grid</label>
          <select className="toolbar-input" value={gridMode} onChange={(e) => commitGridMode(e.target.value)}>
            <option value="off">Off</option>
            <option value="box">Box</option>
            <option value="major">Major</option>
            <option value="full">Full</option>
          </select>
        </div>

        <div className="curve3d-field curve3d-field-small">
          <label className="toolbar-label">Step</label>
          <input
            className="toolbar-input"
            type="number"
            min={0.1}
            step={0.1}
            value={gridStep}
            disabled={gridMode === "off" || gridMode === "box"}
            onChange={(e) => setGridStep(e.target.value)}
            onBlur={() => commitGridStep(gridStep)}
          />
        </div>

        <div className="curve3d-field curve3d-field-small">
          <label className="toolbar-label">Minor</label>
          <input
            className="toolbar-input"
            type="number"
            min={2}
            step={1}
            value={minorDiv}
            disabled={gridMode !== "full"}
            onChange={(e) => setMinorDiv(e.target.value)}
            onBlur={() => commitMinorDiv(minorDiv)}
          />
        </div>

        <div className="curve3d-toolbar-actions">
          <button className="toolbar-btn" onClick={apply}>
            Apply
          </button>
          <button className="toolbar-btn" onClick={resetGrid}>
            Reset Grid
          </button>
          <button className="toolbar-btn" onClick={onFit}>
            Fit (Nodes → Expr)
          </button>
          <button className="toolbar-btn" onClick={onClearMarkers}>
            Clear Nodes
          </button>
        </div>
      </div>
    </div>
  );
}
