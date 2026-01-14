import { useEffect, useState } from "react";
import "./Toolbar.css";
import "./Curve3DToolbar.css";

export default function Curve3DToolbar({ curve3d, onChange, onApply }) {
  const c = curve3d || {};

  const [x, setX] = useState(c.xExpr ?? "");
  const [y, setY] = useState(c.yExpr ?? "");
  const [z, setZ] = useState(c.zExpr ?? "");
  const [tMin, setTMin] = useState(c.tMin ?? 0);
  const [tMax, setTMax] = useState(c.tMax ?? 2 * Math.PI);
  const [samples, setSamples] = useState(c.samples ?? 400);

  // Grid UI
  const [gridMode, setGridMode] = useState(c.gridMode ?? "major");
  const [gridStep, setGridStep] = useState(c.gridStep ?? 1);
  const [minorDiv] = useState(c.minorDiv ?? 4); // UI 노출 X

  // Deform constraint UI
  const [deformSigma, setDeformSigma] = useState(c.deformSigma ?? 0.6);
  const [maxDelta, setMaxDelta] = useState(c.maxDelta ?? 1.5);

  useEffect(() => {
    setX(c.xExpr ?? "");
    setY(c.yExpr ?? "");
    setZ(c.zExpr ?? "");
    setTMin(c.tMin ?? 0);
    setTMax(c.tMax ?? 2 * Math.PI);
    setSamples(c.samples ?? 400);
    setGridStep(c.gridStep ?? 1);

    setDeformSigma(c.deformSigma ?? 0.6);
    setMaxDelta(c.maxDelta ?? 1.5);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c.xExpr, c.yExpr, c.zExpr, c.tMin, c.tMax, c.samples, c.gridStep, c.deformSigma, c.maxDelta]);

  useEffect(() => {
    setGridMode(c.gridMode ?? "major");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c.gridMode]);

  const commitGridStep = (value) => {
    const step = Math.max(0.1, Number(value) || 1);
    setGridStep(step);
    onChange?.({ gridStep: step });
  };

  const commitGridMode = (value) => {
    const mode = String(value || "major");
    setGridMode(mode);
    onChange?.({ gridMode: mode });
  };

  const commitDeformSigma = (value) => {
    const v = Math.max(1e-6, Number(value) || 0.6);
    setDeformSigma(v);
    onChange?.({ deformSigma: v });
  };

  const commitMaxDelta = (value) => {
    const v = Math.max(0, Number(value) || 0);
    setMaxDelta(v);
    onChange?.({ maxDelta: v });
  };

  const apply = () => {
    const nextTMin = Number(tMin);
    const nextTMax = Number(tMax);
    const nextSamples = Number(samples);

    if (!Number.isFinite(nextTMin) || !Number.isFinite(nextTMax)) return;
    if (!Number.isFinite(nextSamples) || nextSamples <= 10) return;

    const nextSigma = Math.max(1e-6, Number(deformSigma) || 0.6);
    const nextMaxDelta = Math.max(0, Number(maxDelta) || 0);

    const patch = {
      baseXExpr: x,
      baseYExpr: y,
      baseZExpr: z,
      xExpr: x,
      yExpr: y,
      zExpr: z,
      tMin: nextTMin,
      tMax: nextTMax,
      samples: nextSamples,

      gridMode: String(gridMode || "major"),
      gridStep: Math.max(0.1, Number(gridStep) || 1),
      minorDiv: Number(minorDiv) || 4,

      deformSigma: nextSigma,
      maxDelta: nextMaxDelta,

      // 기본 마커 3개
      markers: [
        { id: 0, t: nextTMin },
        { id: 1, t: (nextTMin + nextTMax) / 2 },
        { id: 2, t: nextTMax },
      ],
    };

    (onApply || onChange)?.(patch);
  };

  const resetEditToBase = () => {
    onChange?.({
      xExpr: c.baseXExpr ?? c.xExpr ?? "",
      yExpr: c.baseYExpr ?? c.yExpr ?? "",
      zExpr: c.baseZExpr ?? c.zExpr ?? "",
      markers: (c.markers || []).map((m) => {
        const { x, y, z, ...rest } = m || {};
        return rest;
      }),
    });
  };

  const toggleMode = () => {
    const next = (c.editMode ?? "drag") === "drag" ? "arrows" : "drag";
    onChange?.({ editMode: next });
  };

  // ✅ 노드 추가: 가장 큰 t 간격의 중간에 추가
  const addNode = () => {
    const ms = Array.isArray(c.markers) ? [...c.markers] : [];
    const pts = ms
      .filter((m) => typeof m?.t === "number")
      .slice()
      .sort((a, b) => a.t - b.t);

    const nextTMin = Number(c.tMin ?? tMin ?? 0);
    const nextTMax = Number(c.tMax ?? tMax ?? 2 * Math.PI);

    let tMid = (nextTMin + nextTMax) / 2;

    if (pts.length >= 2) {
      let bestI = 0;
      let bestGap = -Infinity;
      for (let i = 0; i < pts.length - 1; i++) {
        const gap = pts[i + 1].t - pts[i].t;
        if (gap > bestGap) {
          bestGap = gap;
          bestI = i;
        }
      }
      tMid = (pts[bestI].t + pts[bestI + 1].t) / 2;
    }

    // id는 유니크하게
    const id = Date.now();

    const next = [...ms, { id, t: tMid }];
    onChange?.({ markers: next });
  };

  // ✅ 노드 삭제: 마지막 노드 제거(최소 2개 유지)
  const removeNode = () => {
    const ms = Array.isArray(c.markers) ? [...c.markers] : [];
    if (ms.length <= 2) return;
    ms.pop();
    onChange?.({ markers: ms });
  };

  return (
    <div className="toolbar curve3d-toolbar">
      <div className="toolbar-section curve3d-toolbar-left">
        <div className="curve3d-toolbar-title">Curve3D</div>
      </div>

      <div className="toolbar-section curve3d-toolbar-fields">
        <div className="curve3d-field">
          <label className="toolbar-label">x(t)</label>
          <input className="toolbar-input" value={x} onChange={(e) => setX(e.target.value)} placeholder="e.g. cos(t)" />
        </div>

        <div className="curve3d-field">
          <label className="toolbar-label">y(t)</label>
          <input className="toolbar-input" value={y} onChange={(e) => setY(e.target.value)} placeholder="e.g. sin(t)" />
        </div>

        <div className="curve3d-field">
          <label className="toolbar-label">z(t)</label>
          <input className="toolbar-input" value={z} onChange={(e) => setZ(e.target.value)} placeholder="e.g. 0.2*t" />
        </div>

        <div className="curve3d-field curve3d-field-small">
          <label className="toolbar-label">tMin</label>
          <input className="toolbar-input" value={tMin} onChange={(e) => setTMin(e.target.value)} />
        </div>

        <div className="curve3d-field curve3d-field-small">
          <label className="toolbar-label">tMax</label>
          <input className="toolbar-input" value={tMax} onChange={(e) => setTMax(e.target.value)} />
        </div>

        <div className="curve3d-field curve3d-field-small">
          <label className="toolbar-label">samples</label>
          <input className="toolbar-input" value={samples} onChange={(e) => setSamples(e.target.value)} />
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
          <label className="toolbar-label">Sigma</label>
          <input
            className="toolbar-input"
            type="number"
            min={0.01}
            step={0.05}
            value={deformSigma}
            onChange={(e) => setDeformSigma(e.target.value)}
            onBlur={() => commitDeformSigma(deformSigma)}
          />
        </div>

        <div className="curve3d-field curve3d-field-small">
          <label className="toolbar-label">Max Δ</label>
          <input
            className="toolbar-input"
            type="number"
            min={0}
            step={0.1}
            value={maxDelta}
            onChange={(e) => setMaxDelta(e.target.value)}
            onBlur={() => commitMaxDelta(maxDelta)}
          />
        </div>

        <div className="curve3d-toolbar-actions">
          <button className="toolbar-btn" onClick={apply}>Apply</button>
          <button className="toolbar-btn" onClick={resetEditToBase}>Reset Edit</button>
          <button className="toolbar-btn" onClick={toggleMode}>
            Mode: {(c.editMode ?? "drag") === "drag" ? "Drag" : "Arrows"}
          </button>

          {/* ✅ 노드 추가/삭제 */}
          <button className="toolbar-btn" onClick={addNode}>Add Node</button>
          <button className="toolbar-btn" onClick={removeNode}>Remove Node</button>
          
        </div>
      </div>
    </div>
  );
}
