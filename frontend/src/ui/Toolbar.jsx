// src/ui/Toolbar.jsx
import "./Toolbar.css";

export default function Toolbar({
  equationExpr,
  setEquationExpr,
  onApply,
  degree,
  setDegree,
  xmin,
  xmax,
  setXmin,
  setXmax,
  onResampleDomain,

  // moved from GraphCanvas
  gridMode,
  setGridMode,
  gridStep,
  setGridStep,
  minorDiv,
  setMinorDiv,
  viewMode,
  setViewMode,
  editMode,
  setEditMode,
  ruleMode,
  setRuleMode,
  rulePolyDegree,
  setRulePolyDegree,
  ruleError,

  // left panel toggle
  showLeftPanel = true,
  onToggleLeftPanel = () => {},
}) {
  const disableGridStep = gridMode === "off" || gridMode === "box";

  return (
    <div className="toolbar">
      {/* Row 1 */}
      <div className="toolbar-row">
        <div className="toolbar-section">
          <label className="toolbar-label">Equation</label>
          <input
            className="toolbar-input"
            value={equationExpr}
            onChange={(e) => setEquationExpr(e.target.value)}
            placeholder="e.g. 0.5*x^3 - 2*x"
          />
          <button className="toolbar-btn" onClick={onApply} type="button">
            Apply
          </button>
        </div>

        <div className="toolbar-section">
          <label className="toolbar-label">Degree</label>
          <input
            className="toolbar-range"
            type="range"
            min={1}
            max={8}
            value={degree}
            onChange={(e) => setDegree(parseInt(e.target.value, 10))}
          />
          <span className="toolbar-kv">{degree}</span>
        </div>

        <div className="toolbar-section">
          <label className="toolbar-label">Domain</label>
          <input
            className="toolbar-num"
            type="number"
            step={0.5}
            value={xmin}
            onChange={(e) => setXmin(parseFloat(e.target.value))}
          />
          <span className="toolbar-dash">—</span>
          <input
            className="toolbar-num"
            type="number"
            step={0.5}
            value={xmax}
            onChange={(e) => setXmax(parseFloat(e.target.value))}
          />
          <button
            className="toolbar-btn ghost"
            onClick={onResampleDomain}
            title="도메인 변경 적용"
            type="button"
          >
            Resample
          </button>
        </div>
      </div>

      {/* Row 2 */}
      <div className="toolbar-row toolbar-row-secondary">
        <div className="toolbar-section">
          <label className="toolbar-label">Grid</label>
          <select
            className="toolbar-select"
            value={gridMode ?? "major"}
            onChange={(e) => setGridMode?.(e.target.value)}
          >
            <option value="off">Off</option>
            <option value="box">Box</option>
            <option value="major">Major</option>
            <option value="full">Full</option>
          </select>

          <input
            className="toolbar-num"
            type="number"
            step={0.5}
            min={0.1}
            value={gridStep ?? 1}
            onChange={(e) => setGridStep?.(Number(e.target.value))}
            disabled={gridMode === "off"}
            title={gridMode === "off" ? "Grid Off" : "Major 간격"}
          />

          <select
            className="toolbar-select"
            value={minorDiv ?? 4}
            onChange={(e) => setMinorDiv?.(Number(e.target.value))}
            title="Major 1칸을 몇 등분할지"
          >
            <option value={2}>×2</option>
            <option value={4}>×4</option>
            <option value={5}>×5</option>
            <option value={10}>×10</option>
          </select>

          <button
            className="toolbar-btn ghost"
            type="button"
            onClick={() => setGridStep?.(1)}
            disabled={disableGridStep}
          >
            1
          </button>
          <button
            className="toolbar-btn ghost"
            type="button"
            onClick={() => setGridStep?.(2)}
            disabled={disableGridStep}
          >
            2
          </button>
          <button
            className="toolbar-btn ghost"
            type="button"
            onClick={() => setGridStep?.(4)}
            disabled={disableGridStep}
          >
            4
          </button>
        </div>

        <div className="toolbar-section">
          <label className="toolbar-label">View</label>
          <div className="toolbar-btn-group">
            <button
              className={`toolbar-btn ${viewMode === "typed" ? "active" : ""}`}
              type="button"
              onClick={() => setViewMode?.("typed")}
              title="수식(빨강)만"
            >
              Typed
            </button>
            <button
              className={`toolbar-btn ${viewMode === "fit" ? "active" : ""}`}
              type="button"
              onClick={() => setViewMode?.("fit")}
              title="근사(파랑)만"
            >
              Fit
            </button>
            <button
              className={`toolbar-btn ${viewMode === "both" ? "active" : ""}`}
              type="button"
              onClick={() => setViewMode?.("both")}
              title="둘 다"
            >
              Both
            </button>
          </div>
        </div>

        <div className="toolbar-section">
          <label className="toolbar-label">Edit</label>
          <div className="toolbar-btn-group">
            <button
              className={`toolbar-btn ${editMode === "arrows" ? "active" : ""}`}
              type="button"
              onClick={() => setEditMode?.("arrows")}
              title="TransformControls(화살표)로 이동"
            >
              Arrows
            </button>
            <button
              className={`toolbar-btn ${editMode === "drag" ? "active" : ""}`}
              type="button"
              onClick={() => setEditMode?.("drag")}
              title="마우스로 드래그 이동"
            >
              Drag
            </button>
          </div>
        </div>

        <div className="toolbar-section">
          <label className="toolbar-label">Rule</label>
          <select
            className="toolbar-select"
            value={ruleMode ?? "free"}
            onChange={(e) => setRuleMode?.(e.target.value)}
            title="드래그 후 놓을 때, 선택한 함수 family 유지 + 파라미터만 갱신"
          >
            <option value="free">Free</option>
            <option value="linear">Linear</option>
            <option value="poly">Poly</option>
            <option value="sin">Sin</option>
            <option value="cos">Cos</option>
            <option value="tan">Tan</option>
            <option value="exp">Exp</option>
            <option value="log">Log</option>
            <option value="power">Power</option>
          </select>

          {ruleMode === "poly" ? (
            <input
              className="toolbar-num"
              type="number"
              min={0}
              step={1}
              value={rulePolyDegree ?? 3}
              onChange={(e) => setRulePolyDegree?.(Number(e.target.value))}
              title="다항 차수"
            />
          ) : null}

          {ruleError ? <span className="toolbar-warn">{ruleError}</span> : null}
        </div>
      </div>
    </div>
  );
}
