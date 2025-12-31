// src/ui/GraphView.jsx
import GraphCanvas from "./GraphCanvas";

/**
 * GraphView is a thin wrapper around GraphCanvas.
 * All rendering options (grid/view/edit/rule) should be controlled from Toolbar via Studio tab-state.
 */
export default function GraphView({
  points = [],
  updatePoint,
  commitRule,

  // ✅ 둘 다 지원: (신규) onPointAdd/onPointRemove, (기존) addPoint/removePoint
  onPointAdd,
  onPointRemove,
  addPoint,
  removePoint,

  xmin,
  xmax,
  ymin,
  ymax,

  // Grid (Curve3D-style)
  gridMode,
  setGridMode,
  gridStep,
  setGridStep,
  minorDiv,
  setMinorDiv,

  // View/Edit
  viewMode,
  setViewMode,
  editMode,
  setEditMode,

  // Curves
  fittedFn,
  typedFn,
  curveKey,
  markers = [],

  // Rule fitting
  ruleMode = "free",
  setRuleMode,
  rulePolyDegree = 3,
  setRulePolyDegree,
  ruleError,

  showControls = false,
}) {
  // ✅ 실제 추가 함수 우선순위: addPoint -> onPointAdd -> (마지막) updatePoint append 시도
  const handlePointAdd = (pt) => {
    const adder = typeof addPoint === "function" ? addPoint : onPointAdd;
    if (typeof adder === "function") return adder(pt);

    // fallback (부모가 append를 지원하는 경우에만 동작)
    const arr = Array.isArray(points) ? points : [];
    const idx = arr.length;
    if (typeof updatePoint === "function") updatePoint(idx, pt);
    if (typeof commitRule === "function") commitRule(idx);

    console.warn(
      "[GraphView] addPoint/onPointAdd not provided; used updatePoint append fallback."
    );
  };

  // ✅ 실제 삭제 함수 우선순위: removePoint -> onPointRemove -> (마지막) __delete 마킹 시도
  const handlePointRemove = (index, key) => {
    const remover = typeof removePoint === "function" ? removePoint : onPointRemove;

    if (typeof remover === "function") {
      // (index, key) 받는 구현 대응
      if (remover.length >= 2) return remover(index, key);

      // (id) 받는 구현 대응: key가 index와 다르면 key 전달
      const hasKey = key !== undefined && key !== null;
      if (hasKey && key !== index) return remover(key);

      // 기본: (index)
      return remover(index);
    }

    // fallback: 부모가 __delete를 필터링하는 구조라면 동작 가능
    try {
      console.info("[GraphView] remove point requested (fallback mark)", { index, key });
    } catch {}

    const p = Array.isArray(points) ? points[index] : null;
    if (typeof updatePoint === "function") {
      updatePoint(index, { ...(p ?? {}), __delete: true });
      if (typeof commitRule === "function") commitRule(index);
    } else {
      console.warn(
        "[GraphView] removePoint/onPointRemove not provided, and updatePoint is missing; cannot remove."
      );
    }
  };

  return (
    <div
      className="graph-view"
      style={{ width: "100%", height: "100%", minHeight: 0 }}
    >
      <GraphCanvas
        points={points}
        onPointChange={updatePoint}
        onPointCommit={commitRule}
        onPointAdd={handlePointAdd}
        onPointRemove={handlePointRemove}
        xmin={xmin}
        xmax={xmax}
        ymin={ymin}
        ymax={ymax}
        gridMode={gridMode}
        setGridMode={setGridMode}
        gridStep={gridStep}
        setGridStep={setGridStep}
        minorDiv={minorDiv}
        setMinorDiv={setMinorDiv}
        viewMode={viewMode}
        setViewMode={setViewMode}
        editMode={editMode}
        setEditMode={setEditMode}
        fn={fittedFn}
        typedFn={typedFn}
        curveKey={curveKey}
        markers={markers}
        ruleMode={ruleMode}
        setRuleMode={setRuleMode}
        rulePolyDegree={rulePolyDegree}
        setRulePolyDegree={setRulePolyDegree}
        ruleError={ruleError}
        showControls={showControls}
      />
    </div>
  );
}
