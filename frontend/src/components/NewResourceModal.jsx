import React, { useEffect, useMemo, useState } from "react";
import { RESOURCE_TYPE_META } from "../utils/resourceDrafts";

const DEFAULT_ACTIONS = [{ key: "create", label: "Create", persist: true }];

function buildZeros(x, y, z) {
  return Array.from({ length: z }, () =>
    Array.from({ length: y }, () => Array.from({ length: x }, () => 0))
  );
}

function clampRange(min, max, fallbackMin, fallbackMax) {
  const lo = Number.isFinite(min) ? min : fallbackMin;
  const hi = Number.isFinite(max) ? max : fallbackMax;
  return lo < hi ? [lo, hi] : [fallbackMin, fallbackMax];
}

function clampDim(value, fallback = 1) {
  const next = Number(value);
  return Number.isFinite(next) && next > 0 ? Math.max(1, Math.floor(next)) : fallback;
}

function resizeArray3D(source, dims) {
  const next = buildZeros(dims.x, dims.y, dims.z);
  for (let z = 0; z < dims.z; z++) {
    for (let y = 0; y < dims.y; y++) {
      for (let x = 0; x < dims.x; x++) {
        next[z][y][x] = source?.[z]?.[y]?.[x] ?? 0;
      }
    }
  }
  return next;
}

function isValidArray3D(value) {
  return (
    Array.isArray(value) &&
    value.every(
      (layer) =>
        Array.isArray(layer) &&
        layer.every((row) => Array.isArray(row))
    )
  );
}

function inferDimsFromArray3D(value) {
  return {
    z: value?.length ?? 0,
    y: value?.[0]?.length ?? 0,
    x: value?.[0]?.[0]?.length ?? 0,
  };
}

function countFilledCells(value) {
  return (value || []).reduce(
    (sum, layer) =>
      sum +
      layer.reduce(
        (layerSum, row) =>
          layerSum + row.reduce((rowSum, cell) => rowSum + (Number(cell) ? 1 : 0), 0),
        0
      ),
    0
  );
}

export default function NewResourceModal({
  onClose,
  onCreate,
  allowedTypes,
  title = "Create Resource",
  actions = DEFAULT_ACTIONS,
}) {
  const availableTypes = useMemo(() => {
    if (!Array.isArray(allowedTypes) || allowedTypes.length === 0) {
      return RESOURCE_TYPE_META;
    }
    return RESOURCE_TYPE_META.filter((entry) => allowedTypes.includes(entry.key));
  }, [allowedTypes]);

  const [type, setType] = useState(availableTypes[0]?.key ?? "equation");
  const [resourceTitle, setResourceTitle] = useState("");
  const [tagInput, setTagInput] = useState("");

  const [samples, setSamples] = useState(200);
  const [formula2D, setFormula2D] = useState("x^2 + 1");
  const [xRange2D, setXRange2D] = useState({ min: -10, max: 10 });

  const [formula3D, setFormula3D] = useState("sin(x) * cos(y)");
  const [xRange3D, setXRange3D] = useState({ min: -10, max: 10 });
  const [yRange3D, setYRange3D] = useState({ min: -10, max: 10 });
  const [samples3D, setSamples3D] = useState(120);

  const [curveX, setCurveX] = useState("cos(t)");
  const [curveY, setCurveY] = useState("sin(t)");
  const [curveZ, setCurveZ] = useState("t");
  const [tRange, setTRange] = useState({ min: 0, max: 2 * Math.PI });
  const [curveSamples, setCurveSamples] = useState(400);

  const [surfX, setSurfX] = useState("(2 + cos(v)) * cos(u)");
  const [surfY, setSurfY] = useState("(2 + cos(v)) * sin(u)");
  const [surfZ, setSurfZ] = useState("sin(v)");
  const [uRange, setURange] = useState({ min: 0, max: 2 * Math.PI });
  const [vRange, setVRange] = useState({ min: 0, max: 2 * Math.PI });
  const [uSamples, setUSamples] = useState(80);
  const [vSamples, setVSamples] = useState(40);

  const [pExpr, setPExpr] = useState("-y");
  const [qExpr, setQExpr] = useState("x");
  const [rExpr, setRExpr] = useState("0");
  const [xRangeVF, setXRangeVF] = useState({ min: -5, max: 5 });
  const [yRangeVF, setYRangeVF] = useState({ min: -5, max: 5 });
  const [zRangeVF, setZRangeVF] = useState({ min: -5, max: 5 });
  const [vfStep, setVfStep] = useState(2);

  const [dims, setDims] = useState({ x: 8, y: 8, z: 8 });
  const [arrayDraft, setArrayDraft] = useState(() => buildZeros(8, 8, 8));
  const [activeSlice, setActiveSlice] = useState(0);
  const [showJsonEditor, setShowJsonEditor] = useState(false);
  const [json, setJson] = useState("");

  useEffect(() => {
    setJson(JSON.stringify(arrayDraft, null, 2));
  }, [arrayDraft]);

  const applyDims = (partial) => {
    setDims((current) => {
      const nextDims = {
        x: clampDim(partial?.x ?? current.x, current.x),
        y: clampDim(partial?.y ?? current.y, current.y),
        z: clampDim(partial?.z ?? current.z, current.z),
      };
      setArrayDraft((prev) => resizeArray3D(prev, nextDims));
      setActiveSlice((prev) => Math.max(0, Math.min(prev, nextDims.z - 1)));
      return nextDims;
    });
  };

  const updateArrayCellValue = (x, y, nextValue) => {
    const numeric = Number(nextValue);
    const safeValue = Number.isFinite(numeric) ? numeric : 0;
    setArrayDraft((prev) =>
      prev.map((layer, zIndex) =>
        zIndex !== activeSlice
          ? layer
          : layer.map((row, yIndex) =>
              yIndex !== y
                ? row
                : row.map((cell, xIndex) => (xIndex === x ? safeValue : cell))
            )
      )
    );
  };

  const fillActiveSlice = (nextValue) => {
    const numeric = Number(nextValue);
    const safeValue = Number.isFinite(numeric) ? numeric : 0;
    setArrayDraft((prev) =>
      prev.map((layer, zIndex) =>
        zIndex !== activeSlice
          ? layer
          : layer.map((row) => row.map(() => safeValue))
      )
    );
  };

  const applyJsonToArray = () => {
    try {
      const parsed = JSON.parse(json);
      if (!isValidArray3D(parsed)) {
        throw new Error("Array payload must be a 3D JSON array.");
      }
      const nextDims = inferDimsFromArray3D(parsed);
      if (!nextDims.x || !nextDims.y || !nextDims.z) {
        throw new Error("Array payload must contain at least one cell.");
      }
      setDims(nextDims);
      setArrayDraft(parsed);
      setActiveSlice((prev) => Math.max(0, Math.min(prev, nextDims.z - 1)));
    } catch (error) {
      window.alert(`JSON parse failed: ${error.message}`);
    }
  };

  const filledCells = useMemo(() => countFilledCells(arrayDraft), [arrayDraft]);
  const activeLayer = arrayDraft[activeSlice] ?? [];

  const submit = (action) => {
    if (!resourceTitle.trim()) {
      window.alert("Please enter a title.");
      return;
    }

    const tags = tagInput
      .split(/[\s,]+/)
      .map((tag) => tag.trim())
      .filter(Boolean);

    try {
      let payload = null;

      if (type === "equation") {
        const [xmin, xmax] = clampRange(+xRange2D.min, +xRange2D.max, -10, 10);
        payload = {
          type,
          tags,
          title: resourceTitle.trim(),
          formula: String(formula2D || "").trim(),
          xRange: [xmin, xmax],
          samples: Math.max(50, +samples || 200),
        };
      } else if (type === "surface3d") {
        const [xmin, xmax] = clampRange(+xRange3D.min, +xRange3D.max, -10, 10);
        const [ymin, ymax] = clampRange(+yRange3D.min, +yRange3D.max, -10, 10);
        payload = {
          type,
          tags,
          title: resourceTitle.trim(),
          formula: String(formula3D || "").trim(),
          xRange: [xmin, xmax],
          yRange: [ymin, ymax],
          samples: Math.max(30, +samples3D || 120),
        };
      } else if (type === "curve3d") {
        const [tmin, tmax] = clampRange(+tRange.min, +tRange.max, 0, 2 * Math.PI);
        payload = {
          type,
          tags,
          title: resourceTitle.trim(),
          x: String(curveX || "").trim(),
          y: String(curveY || "").trim(),
          z: String(curveZ || "").trim(),
          tRange: [tmin, tmax],
          samples: Math.max(100, +curveSamples || 400),
        };
      } else if (type === "surfaceParam") {
        const [umin, umax] = clampRange(+uRange.min, +uRange.max, 0, 2 * Math.PI);
        const [vmin, vmax] = clampRange(+vRange.min, +vRange.max, 0, 2 * Math.PI);
        payload = {
          type,
          tags,
          title: resourceTitle.trim(),
          x: String(surfX || "").trim(),
          y: String(surfY || "").trim(),
          z: String(surfZ || "").trim(),
          uRange: [umin, umax],
          vRange: [vmin, vmax],
          uSamples: Math.max(10, +uSamples || 80),
          vSamples: Math.max(10, +vSamples || 40),
        };
      } else if (type === "vectorField") {
        const [xmin, xmax] = clampRange(+xRangeVF.min, +xRangeVF.max, -5, 5);
        const [ymin, ymax] = clampRange(+yRangeVF.min, +yRangeVF.max, -5, 5);
        const [zmin, zmax] = clampRange(+zRangeVF.min, +zRangeVF.max, -5, 5);
        payload = {
          type,
          tags,
          title: resourceTitle.trim(),
          P: String(pExpr || "").trim(),
          Q: String(qExpr || "").trim(),
          R: String(rExpr || "").trim(),
          xRange: [xmin, xmax],
          yRange: [ymin, ymax],
          zRange: [zmin, zmax],
          step: Math.max(1, +vfStep || 2),
        };
      } else if (type === "array3d") {
        payload = {
          type,
          tags,
          title: resourceTitle.trim(),
          content: arrayDraft,
          dims,
        };
      }

      if (payload) onCreate?.(payload, action);
    } catch (error) {
      console.error(error);
      window.alert("Failed to create resource. Please review the inputs.");
    }
  };

  return (
    <div className="vault-modal">
      <div
        className="vault-modal-content"
        style={{ width: 560, maxWidth: "95vw" }}
      >
        <h3 style={{ marginTop: 0 }}>{title}</h3>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
          {availableTypes.map((entry) => (
            <button
              key={entry.key}
              type="button"
              onClick={() => setType(entry.key)}
              style={{
                padding: "6px 10px",
                borderRadius: 8,
                border: "1px solid #ccc",
                background: type === entry.key ? "#111" : "#222",
                color: "#fff",
              }}
            >
              {entry.label}
            </button>
          ))}
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          <label>
            Title
            <input
              value={resourceTitle}
              onChange={(event) => setResourceTitle(event.target.value)}
              placeholder="Resource title"
              style={{ width: "100%" }}
            />
          </label>

          <label>
            Tags
            <input
              value={tagInput}
              onChange={(event) => setTagInput(event.target.value)}
              placeholder="calculus, example, 3d"
              style={{ width: "100%" }}
            />
          </label>

          {type === "equation" && (
            <>
              <label>
                Formula (y = f(x))
                <input
                  value={formula2D}
                  onChange={(event) => setFormula2D(event.target.value)}
                  placeholder="x^2 + 1"
                  style={{ width: "100%" }}
                />
              </label>
              <div style={{ display: "flex", gap: 8 }}>
                <label>
                  X Min
                  <input
                    type="number"
                    value={xRange2D.min}
                    onChange={(event) =>
                      setXRange2D((range) => ({ ...range, min: +event.target.value }))
                    }
                    style={{ width: 90 }}
                  />
                </label>
                <label>
                  X Max
                  <input
                    type="number"
                    value={xRange2D.max}
                    onChange={(event) =>
                      setXRange2D((range) => ({ ...range, max: +event.target.value }))
                    }
                    style={{ width: 90 }}
                  />
                </label>
                <label>
                  Samples
                  <input
                    type="number"
                    min={50}
                    value={samples}
                    onChange={(event) => setSamples(+event.target.value)}
                    style={{ width: 110 }}
                  />
                </label>
              </div>
            </>
          )}

          {type === "surface3d" && (
            <>
              <label>
                Formula (z = f(x, y))
                <input
                  value={formula3D}
                  onChange={(event) => setFormula3D(event.target.value)}
                  placeholder="sin(x) * cos(y)"
                  style={{ width: "100%" }}
                />
              </label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <label>
                  X Min
                  <input
                    type="number"
                    value={xRange3D.min}
                    onChange={(event) =>
                      setXRange3D((range) => ({ ...range, min: +event.target.value }))
                    }
                    style={{ width: 90 }}
                  />
                </label>
                <label>
                  X Max
                  <input
                    type="number"
                    value={xRange3D.max}
                    onChange={(event) =>
                      setXRange3D((range) => ({ ...range, max: +event.target.value }))
                    }
                    style={{ width: 90 }}
                  />
                </label>
                <label>
                  Y Min
                  <input
                    type="number"
                    value={yRange3D.min}
                    onChange={(event) =>
                      setYRange3D((range) => ({ ...range, min: +event.target.value }))
                    }
                    style={{ width: 90 }}
                  />
                </label>
                <label>
                  Y Max
                  <input
                    type="number"
                    value={yRange3D.max}
                    onChange={(event) =>
                      setYRange3D((range) => ({ ...range, max: +event.target.value }))
                    }
                    style={{ width: 90 }}
                  />
                </label>
                <label>
                  Grid Samples
                  <input
                    type="number"
                    min={30}
                    value={samples3D}
                    onChange={(event) => setSamples3D(+event.target.value)}
                    style={{ width: 130 }}
                  />
                </label>
              </div>
            </>
          )}

          {type === "curve3d" && (
            <>
              <div style={{ display: "grid", gap: 8 }}>
                <label>
                  x(t)
                  <input
                    value={curveX}
                    onChange={(event) => setCurveX(event.target.value)}
                    placeholder="cos(t)"
                    style={{ width: "100%" }}
                  />
                </label>
                <label>
                  y(t)
                  <input
                    value={curveY}
                    onChange={(event) => setCurveY(event.target.value)}
                    placeholder="sin(t)"
                    style={{ width: "100%" }}
                  />
                </label>
                <label>
                  z(t)
                  <input
                    value={curveZ}
                    onChange={(event) => setCurveZ(event.target.value)}
                    placeholder="t"
                    style={{ width: "100%" }}
                  />
                </label>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <label>
                  t Min
                  <input
                    type="number"
                    value={tRange.min}
                    onChange={(event) =>
                      setTRange((range) => ({ ...range, min: +event.target.value }))
                    }
                    style={{ width: 110 }}
                  />
                </label>
                <label>
                  t Max
                  <input
                    type="number"
                    value={tRange.max}
                    onChange={(event) =>
                      setTRange((range) => ({ ...range, max: +event.target.value }))
                    }
                    style={{ width: 110 }}
                  />
                </label>
                <label>
                  Samples
                  <input
                    type="number"
                    min={100}
                    value={curveSamples}
                    onChange={(event) => setCurveSamples(+event.target.value)}
                    style={{ width: 120 }}
                  />
                </label>
              </div>
            </>
          )}

          {type === "surfaceParam" && (
            <>
              <div style={{ display: "grid", gap: 8 }}>
                <label>
                  x(u, v)
                  <input
                    value={surfX}
                    onChange={(event) => setSurfX(event.target.value)}
                    style={{ width: "100%" }}
                  />
                </label>
                <label>
                  y(u, v)
                  <input
                    value={surfY}
                    onChange={(event) => setSurfY(event.target.value)}
                    style={{ width: "100%" }}
                  />
                </label>
                <label>
                  z(u, v)
                  <input
                    value={surfZ}
                    onChange={(event) => setSurfZ(event.target.value)}
                    style={{ width: "100%" }}
                  />
                </label>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <label>
                  u Min
                  <input
                    type="number"
                    value={uRange.min}
                    onChange={(event) =>
                      setURange((range) => ({ ...range, min: +event.target.value }))
                    }
                    style={{ width: 110 }}
                  />
                </label>
                <label>
                  u Max
                  <input
                    type="number"
                    value={uRange.max}
                    onChange={(event) =>
                      setURange((range) => ({ ...range, max: +event.target.value }))
                    }
                    style={{ width: 110 }}
                  />
                </label>
                <label>
                  v Min
                  <input
                    type="number"
                    value={vRange.min}
                    onChange={(event) =>
                      setVRange((range) => ({ ...range, min: +event.target.value }))
                    }
                    style={{ width: 110 }}
                  />
                </label>
                <label>
                  v Max
                  <input
                    type="number"
                    value={vRange.max}
                    onChange={(event) =>
                      setVRange((range) => ({ ...range, max: +event.target.value }))
                    }
                    style={{ width: 110 }}
                  />
                </label>
                <label>
                  u Samples
                  <input
                    type="number"
                    min={10}
                    value={uSamples}
                    onChange={(event) => setUSamples(+event.target.value)}
                    style={{ width: 120 }}
                  />
                </label>
                <label>
                  v Samples
                  <input
                    type="number"
                    min={10}
                    value={vSamples}
                    onChange={(event) => setVSamples(+event.target.value)}
                    style={{ width: 120 }}
                  />
                </label>
              </div>
            </>
          )}

          {type === "vectorField" && (
            <>
              <div style={{ display: "grid", gap: 8 }}>
                <label>
                  P(x, y, z)
                  <input
                    value={pExpr}
                    onChange={(event) => setPExpr(event.target.value)}
                    style={{ width: "100%" }}
                  />
                </label>
                <label>
                  Q(x, y, z)
                  <input
                    value={qExpr}
                    onChange={(event) => setQExpr(event.target.value)}
                    style={{ width: "100%" }}
                  />
                </label>
                <label>
                  R(x, y, z)
                  <input
                    value={rExpr}
                    onChange={(event) => setRExpr(event.target.value)}
                    style={{ width: "100%" }}
                  />
                </label>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <label>
                  X Min
                  <input
                    type="number"
                    value={xRangeVF.min}
                    onChange={(event) =>
                      setXRangeVF((range) => ({ ...range, min: +event.target.value }))
                    }
                    style={{ width: 90 }}
                  />
                </label>
                <label>
                  X Max
                  <input
                    type="number"
                    value={xRangeVF.max}
                    onChange={(event) =>
                      setXRangeVF((range) => ({ ...range, max: +event.target.value }))
                    }
                    style={{ width: 90 }}
                  />
                </label>
                <label>
                  Y Min
                  <input
                    type="number"
                    value={yRangeVF.min}
                    onChange={(event) =>
                      setYRangeVF((range) => ({ ...range, min: +event.target.value }))
                    }
                    style={{ width: 90 }}
                  />
                </label>
                <label>
                  Y Max
                  <input
                    type="number"
                    value={yRangeVF.max}
                    onChange={(event) =>
                      setYRangeVF((range) => ({ ...range, max: +event.target.value }))
                    }
                    style={{ width: 90 }}
                  />
                </label>
                <label>
                  Z Min
                  <input
                    type="number"
                    value={zRangeVF.min}
                    onChange={(event) =>
                      setZRangeVF((range) => ({ ...range, min: +event.target.value }))
                    }
                    style={{ width: 90 }}
                  />
                </label>
                <label>
                  Z Max
                  <input
                    type="number"
                    value={zRangeVF.max}
                    onChange={(event) =>
                      setZRangeVF((range) => ({ ...range, max: +event.target.value }))
                    }
                    style={{ width: 90 }}
                  />
                </label>
                <label>
                  Step
                  <input
                    type="number"
                    min={1}
                    value={vfStep}
                    onChange={(event) => setVfStep(+event.target.value)}
                    style={{ width: 120 }}
                  />
                </label>
              </div>
            </>
          )}

          {type === "array3d" && (
            <>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <label>
                  X
                  <input
                    type="number"
                    min={1}
                    value={dims.x}
                    onChange={(event) => applyDims({ x: event.target.value })}
                    style={{ width: 80 }}
                  />
                </label>
                <label>
                  Y
                  <input
                    type="number"
                    min={1}
                    value={dims.y}
                    onChange={(event) => applyDims({ y: event.target.value })}
                    style={{ width: 80 }}
                  />
                </label>
                <label>
                  Z
                  <input
                    type="number"
                    min={1}
                    value={dims.z}
                    onChange={(event) => applyDims({ z: event.target.value })}
                    style={{ width: 80 }}
                  />
                </label>
              </div>

              <div style={{ fontSize: 12, opacity: 0.8 }}>
                X, Y, Z 크기에 맞춰 입력 칸이 자동 생성됩니다. 현재 non-zero 셀 수: {filledCells}
              </div>

              <div
                style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "center",
                  flexWrap: "wrap",
                  padding: "10px 12px",
                  borderRadius: 10,
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <label>
                  Current Slice
                  <input
                    type="range"
                    min={0}
                    max={Math.max(0, dims.z - 1)}
                    value={activeSlice}
                    onChange={(event) => setActiveSlice(Number(event.target.value))}
                    style={{ display: "block", width: 180 }}
                  />
                </label>
                <div style={{ fontSize: 12, opacity: 0.8 }}>
                  Z = {activeSlice + 1} / {dims.z}
                </div>
                <button
                  type="button"
                  className="vault-btn"
                  onClick={() => fillActiveSlice(0)}
                >
                  Clear Slice
                </button>
              </div>

              <div
                style={{
                  padding: 12,
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 10,
                  background: "rgba(255,255,255,0.03)",
                  maxHeight: 360,
                  overflow: "auto",
                }}
              >
                <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <div style={{ fontSize: 12, opacity: 0.72, minWidth: 42, paddingTop: 30 }}>
                    Y axis
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: `44px repeat(${dims.x}, minmax(56px, 72px))`,
                      gap: 6,
                      alignItems: "center",
                    }}
                  >
                    <div />
                    {Array.from({ length: dims.x }, (_, xIndex) => (
                      <div
                        key={`x-head-${xIndex}`}
                        style={{
                          textAlign: "center",
                          fontSize: 11,
                          color: "#9aa4b2",
                          fontWeight: 600,
                        }}
                      >
                        X{xIndex}
                      </div>
                    ))}

                    {activeLayer.map((row, yIndex) => (
                      <React.Fragment key={`${activeSlice}-row-${yIndex}`}>
                        <div
                          style={{
                            fontSize: 11,
                            color: "#9aa4b2",
                            textAlign: "center",
                            fontWeight: 600,
                          }}
                        >
                          Y{yIndex}
                        </div>
                        {row.map((cell, xIndex) => (
                          <input
                            key={`${activeSlice}-${yIndex}-${xIndex}`}
                            type="number"
                            aria-label={`Cell x${xIndex} y${yIndex} z${activeSlice}`}
                            value={cell}
                            onChange={(event) =>
                              updateArrayCellValue(xIndex, yIndex, event.target.value)
                            }
                            style={{
                              width: "100%",
                              minHeight: 34,
                              textAlign: "center",
                              borderRadius: 8,
                              border: "1px solid rgba(255,255,255,0.12)",
                              background: "rgba(15,19,32,0.92)",
                              color: "#f3f6fb",
                              fontSize: 12,
                              padding: "0 6px",
                            }}
                          />
                        ))}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
                <div
                  style={{
                    marginTop: 10,
                    textAlign: "center",
                    fontSize: 11,
                    color: "#9aa4b2",
                    fontWeight: 600,
                  }}
                >
                  X axis
                </div>
              </div>

              <button
                type="button"
                className="vault-btn"
                onClick={() => setShowJsonEditor((prev) => !prev)}
              >
                {showJsonEditor ? "Hide Advanced JSON" : "Show Advanced JSON"}
              </button>

              {showJsonEditor && (
                <>
                  <div style={{ fontSize: 12, opacity: 0.8 }}>
                    Advanced mode for paste/import. Apply JSON to replace the current editor state.
                  </div>
                  <textarea
                    value={json}
                    onChange={(event) => setJson(event.target.value)}
                    rows={8}
                    placeholder="[[[0,1],[1,0]],[[1,1],[0,0]]]"
                    style={{ width: "100%", fontFamily: "monospace" }}
                  />
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <button type="button" className="vault-btn" onClick={applyJsonToArray}>
                      Apply JSON
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
            marginTop: 14,
          }}
        >
          <button type="button" onClick={onClose} className="vault-btn">
            Cancel
          </button>
          {actions.map((action) => (
            <button
              key={action.key}
              type="button"
              onClick={() => submit(action)}
              className="vault-btn"
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
