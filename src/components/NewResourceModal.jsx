import React, { useMemo, useState } from "react";

/**
 * onCreate(payload) 형태 (타입별 payload 예시)
 *
 * 1) equation (2D 수식):      { type:"equation",      title, formula:"x^2 + 1", xRange:[-10,10], samples:200, tags:string[] }
 * 2) surface3d (3D 곡면):     { type:"surface3d",     title, formula:"sin(x)*cos(y)", xRange:[-10,10], yRange:[-10,10], samples:120, tags:string[] }
 * 3) curve3d (공간 곡선):     { type:"curve3d",       title, x:"cos(t)", y:"sin(t)", z:"t", tRange:[0,6.28], samples:400, tags:string[] }
 * 4) surfaceParam (매개 곡면): { type:"surfaceParam",  title, x:"(2+cos v)*cos u", y:"(2+cos v)*sin u", z:"sin v", ... , tags:string[] }
 * 5) vectorField (벡터장):    { type:"vectorField",   title, P:"-y", Q:"x", R:"0", ... , tags:string[] }
 * 6) array3d (3D 배열):       { type:"array3d",       title, content:number[][][], dims?:{x,y,z}, tags:string[] }
 */

const TYPE_META = [
  { key: "equation", label: "2D 수식 (y=f(x))" },
  { key: "surface3d", label: "3D 곡면 (z=f(x,y))" },
  { key: "curve3d", label: "3D 공간 곡선 (x(t), y(t), z(t))" },
  { key: "surfaceParam", label: "매개변수 곡면 (x(u,v), y(u,v), z(u,v))" },
  { key: "vectorField", label: "벡터장 F(x,y,z)" },
  { key: "array3d", label: "3차원 배열 (JSON)" },
];

export default function NewResourceModal({ onClose, onCreate }) {
  const [type, setType] = useState("equation");
  const [title, setTitle] = useState("");
  const [tagInput, setTagInput] = useState("");

  // 공통 해상도/범위 기본값
  const [samples, setSamples] = useState(200);

  // 2D 수식
  const [formula2D, setFormula2D] = useState("x^2 + 1");
  const [xRange2D, setXRange2D] = useState({ min: -10, max: 10 });

  // 3D 곡면 z=f(x,y)
  const [formula3D, setFormula3D] = useState("sin(x) * cos(y)");
  const [xRange3D, setXRange3D] = useState({ min: -10, max: 10 });
  const [yRange3D, setYRange3D] = useState({ min: -10, max: 10 });
  const [samples3D, setSamples3D] = useState(120);

  // 3D 공간 곡선 x(t), y(t), z(t)
  const [curveX, setCurveX] = useState("cos(t)");
  const [curveY, setCurveY] = useState("sin(t)");
  const [curveZ, setCurveZ] = useState("t");
  const [tRange, setTRange] = useState({ min: 0, max: 2 * Math.PI });
  const [curveSamples, setCurveSamples] = useState(400);

  // 매개변수 곡면 x(u,v), y(u,v), z(u,v)
  const [surfX, setSurfX] = useState("(2 + cos(v)) * cos(u)");
  const [surfY, setSurfY] = useState("(2 + cos(v)) * sin(u)");
  const [surfZ, setSurfZ] = useState("sin(v)");
  const [uRange, setURange] = useState({ min: 0, max: 2 * Math.PI });
  const [vRange, setVRange] = useState({ min: 0, max: 2 * Math.PI });
  const [uSamples, setUSamples] = useState(80);
  const [vSamples, setVSamples] = useState(40);

  // 벡터장 F=(P,Q,R)
  const [P, setP] = useState("-y");
  const [Q, setQ] = useState("x");
  const [R, setR] = useState("0");
  const [xRangeVF, setXRangeVF] = useState({ min: -5, max: 5 });
  const [yRangeVF, setYRangeVF] = useState({ min: -5, max: 5 });
  const [zRangeVF, setZRangeVF] = useState({ min: -5, max: 5 });
  const [vfStep, setVfStep] = useState(2); // 격자 간격

  // 3D 배열(JSON)
  const [dims, setDims] = useState({ x: 8, y: 8, z: 8 });
  const [json, setJson] = useState("");

  const buildZeros = (x, y, z) =>
    Array.from({ length: z }, () =>
      Array.from({ length: y }, () => Array.from({ length: x }, () => 0))
    );

  const clampRange = (min, max, fallbackMin, fallbackMax) => {
    const lo = Number.isFinite(min) ? min : fallbackMin;
    const hi = Number.isFinite(max) ? max : fallbackMax;
    return lo < hi ? [lo, hi] : [fallbackMin, fallbackMax];
  };

  const submit = () => {
    if (!title.trim()) {
      alert("제목을 입력해 주세요.");
      return;
    }

    // ✅ 태그 문자열 => 배열로 변환 (모든 타입 공통)
    const tags = tagInput
      .split(/[\s,]+/)
      .map((t) => t.trim())
      .filter(Boolean);

    try {
      if (type === "equation") {
        const [xmin, xmax] = clampRange(+xRange2D.min, +xRange2D.max, -10, 10);
        onCreate({
          type,
          tags,
          title,
          formula: String(formula2D || "").trim(),
          xRange: [xmin, xmax],
          samples: Math.max(50, +samples || 200),
        });
      } else if (type === "surface3d") {
        const [xmin, xmax] = clampRange(+xRange3D.min, +xRange3D.max, -10, 10);
        const [ymin, ymax] = clampRange(+yRange3D.min, +yRange3D.max, -10, 10);
        onCreate({
          type,
          tags,
          title,
          formula: String(formula3D || "").trim(),
          xRange: [xmin, xmax],
          yRange: [ymin, ymax],
          samples: Math.max(30, +samples3D || 120),
        });
      } else if (type === "curve3d") {
        const [tmin, tmax] = clampRange(
          +tRange.min,
          +tRange.max,
          0,
          2 * Math.PI
        );
        onCreate({
          type,
          tags,
          title,
          x: String(curveX || "").trim(),
          y: String(curveY || "").trim(),
          z: String(curveZ || "").trim(),
          tRange: [tmin, tmax],
          samples: Math.max(100, +curveSamples || 400),
        });
      } else if (type === "surfaceParam") {
        const [umin, umax] = clampRange(
          +uRange.min,
          +uRange.max,
          0,
          2 * Math.PI
        );
        const [vmin, vmax] = clampRange(
          +vRange.min,
          +vRange.max,
          0,
          2 * Math.PI
        );
        onCreate({
          type,
          tags,
          title,
          x: String(surfX || "").trim(),
          y: String(surfY || "").trim(),
          z: String(surfZ || "").trim(),
          uRange: [umin, umax],
          vRange: [vmin, vmax],
          uSamples: Math.max(10, +uSamples || 80),
          vSamples: Math.max(10, +vSamples || 40),
        });
      } else if (type === "vectorField") {
        const [xmin, xmax] = clampRange(+xRangeVF.min, +xRangeVF.max, -5, 5);
        const [ymin, ymax] = clampRange(+yRangeVF.min, +yRangeVF.max, -5, 5);
        const [zmin, zmax] = clampRange(+zRangeVF.min, +zRangeVF.max, -5, 5);
        onCreate({
          type,
          tags,
          title,
          P: String(P || "").trim(),
          Q: String(Q || "").trim(),
          R: String(R || "").trim(),
          xRange: [xmin, xmax],
          yRange: [ymin, ymax],
          zRange: [zmin, zmax],
          step: Math.max(1, +vfStep || 2),
        });
      } else if (type === "array3d") {
        let content;
        if (json.trim()) {
          try {
            const parsed = JSON.parse(json);
            if (!Array.isArray(parsed)) {
              throw new Error("3차원 배열(JSON)이 아닙니다.");
            }
            content = parsed;
          } catch (e) {
            alert("JSON 파싱 실패: " + e.message);
            return;
          }
        } else {
          content = buildZeros(dims.x, dims.y, dims.z);
        }
        onCreate({ type, tags, title, content, dims });
      }
    } catch (err) {
      console.error(err);
      alert("생성 중 오류가 발생했습니다. 입력을 다시 확인해 주세요.");
    }
  };

  const TypeButtons = useMemo(
    () => (
      <div
        style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}
      >
        {TYPE_META.map((t) => (
          <button
            key={t.key}
            onClick={() => setType(t.key)}
            style={{
              padding: "6px 10px",
              borderRadius: 8,
              border: "1px solid #ccc",
              background: type === t.key ? "#111" : "#222",
              color: "#fff",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
    ),
    [type]
  );

  return (
    <div className="vault-modal">
      <div
        className="vault-modal-content"
        style={{ width: 560, maxWidth: "95vw" }}
      >
        <h3 style={{ marginTop: 0 }}>새로 만들기</h3>

        {TypeButtons}

        <div style={{ display: "grid", gap: 10 }}>
          <label>
            제목
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="새 리소스"
              style={{ width: "100%" }}
            />
          </label>

          {/* ✅ 태그 입력 */}
          <label>
            태그 (쉼표 또는 공백으로 구분)
            <input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              placeholder="예: 미적분, 예제, 3D"
              style={{ width: "100%" }}
            />
          </label>

          {/* === 타입별 입력 폼 === */}
          {type === "equation" && (
            <>
              <label>
                수식 (y = f(x))
                <input
                  value={formula2D}
                  onChange={(e) => setFormula2D(e.target.value)}
                  placeholder="x^2 + 1"
                  style={{ width: "100%" }}
                />
              </label>
              <div style={{ display: "flex", gap: 8 }}>
                <label>
                  X 최소
                  <input
                    type="number"
                    value={xRange2D.min}
                    onChange={(e) =>
                      setXRange2D((r) => ({ ...r, min: +e.target.value }))
                    }
                    style={{ width: 90 }}
                  />
                </label>
                <label>
                  X 최대
                  <input
                    type="number"
                    value={xRange2D.max}
                    onChange={(e) =>
                      setXRange2D((r) => ({ ...r, max: +e.target.value }))
                    }
                    style={{ width: 90 }}
                  />
                </label>
                <label>
                  샘플 수
                  <input
                    type="number"
                    min={50}
                    value={samples}
                    onChange={(e) => setSamples(+e.target.value)}
                    style={{ width: 110 }}
                  />
                </label>
              </div>
            </>
          )}

          {type === "surface3d" && (
            <>
              <label>
                수식 (z = f(x, y))
                <input
                  value={formula3D}
                  onChange={(e) => setFormula3D(e.target.value)}
                  placeholder="sin(x) * cos(y)"
                  style={{ width: "100%" }}
                />
              </label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <label>
                  X 최소
                  <input
                    type="number"
                    value={xRange3D.min}
                    onChange={(e) =>
                      setXRange3D((r) => ({ ...r, min: +e.target.value }))
                    }
                    style={{ width: 90 }}
                  />
                </label>
                <label>
                  X 최대
                  <input
                    type="number"
                    value={xRange3D.max}
                    onChange={(e) =>
                      setXRange3D((r) => ({ ...r, max: +e.target.value }))
                    }
                    style={{ width: 90 }}
                  />
                </label>
                <label>
                  Y 최소
                  <input
                    type="number"
                    value={yRange3D.min}
                    onChange={(e) =>
                      setYRange3D((r) => ({ ...r, min: +e.target.value }))
                    }
                    style={{ width: 90 }}
                  />
                </label>
                <label>
                  Y 최대
                  <input
                    type="number"
                    value={yRange3D.max}
                    onChange={(e) =>
                      setYRange3D((r) => ({ ...r, max: +e.target.value }))
                    }
                    style={{ width: 90 }}
                  />
                </label>
                <label>
                  그리드 샘플 수
                  <input
                    type="number"
                    min={30}
                    value={samples3D}
                    onChange={(e) => setSamples3D(+e.target.value)}
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
                    onChange={(e) => setCurveX(e.target.value)}
                    placeholder="cos(t)"
                    style={{ width: "100%" }}
                  />
                </label>
                <label>
                  y(t)
                  <input
                    value={curveY}
                    onChange={(e) => setCurveY(e.target.value)}
                    placeholder="sin(t)"
                    style={{ width: "100%" }}
                  />
                </label>
                <label>
                  z(t)
                  <input
                    value={curveZ}
                    onChange={(e) => setCurveZ(e.target.value)}
                    placeholder="t"
                    style={{ width: "100%" }}
                  />
                </label>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <label>
                  t 최소
                  <input
                    type="number"
                    value={tRange.min}
                    onChange={(e) =>
                      setTRange((r) => ({ ...r, min: +e.target.value }))
                    }
                    style={{ width: 110 }}
                  />
                </label>
                <label>
                  t 최대
                  <input
                    type="number"
                    value={tRange.max}
                    onChange={(e) =>
                      setTRange((r) => ({ ...r, max: +e.target.value }))
                    }
                    style={{ width: 110 }}
                  />
                </label>
                <label>
                  샘플 수
                  <input
                    type="number"
                    min={50}
                    value={curveSamples}
                    onChange={(e) => setCurveSamples(+e.target.value)}
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
                    onChange={(e) => setSurfX(e.target.value)}
                    placeholder="(2 + cos(v)) * cos(u)"
                    style={{ width: "100%" }}
                  />
                </label>
                <label>
                  y(u, v)
                  <input
                    value={surfY}
                    onChange={(e) => setSurfY(e.target.value)}
                    placeholder="(2 + cos(v)) * sin(u)"
                    style={{ width: "100%" }}
                  />
                </label>
                <label>
                  z(u, v)
                  <input
                    value={surfZ}
                    onChange={(e) => setSurfZ(e.target.value)}
                    placeholder="sin(v)"
                    style={{ width: "100%" }}
                  />
                </label>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <label>
                  u 최소
                  <input
                    type="number"
                    value={uRange.min}
                    onChange={(e) =>
                      setURange((r) => ({ ...r, min: +e.target.value }))
                    }
                    style={{ width: 110 }}
                  />
                </label>
                <label>
                  u 최대
                  <input
                    type="number"
                    value={uRange.max}
                    onChange={(e) =>
                      setURange((r) => ({ ...r, max: +e.target.value }))
                    }
                    style={{ width: 110 }}
                  />
                </label>
                <label>
                  v 최소
                  <input
                    type="number"
                    value={vRange.min}
                    onChange={(e) =>
                      setVRange((r) => ({ ...r, min: +e.target.value }))
                    }
                    style={{ width: 110 }}
                  />
                </label>
                <label>
                  v 최대
                  <input
                    type="number"
                    value={vRange.max}
                    onChange={(e) =>
                      setVRange((r) => ({ ...r, max: +e.target.value }))
                    }
                    style={{ width: 110 }}
                  />
                </label>
                <label>
                  u 샘플 수
                  <input
                    type="number"
                    min={10}
                    value={uSamples}
                    onChange={(e) => setUSamples(+e.target.value)}
                    style={{ width: 120 }}
                  />
                </label>
                <label>
                  v 샘플 수
                  <input
                    type="number"
                    min={10}
                    value={vSamples}
                    onChange={(e) => setVSamples(+e.target.value)}
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
                  P(x,y,z)
                  <input
                    value={P}
                    onChange={(e) => setP(e.target.value)}
                    placeholder="-y"
                    style={{ width: "100%" }}
                  />
                </label>
                <label>
                  Q(x,y,z)
                  <input
                    value={Q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="x"
                    style={{ width: "100%" }}
                  />
                </label>
                <label>
                  R(x,y,z)
                  <input
                    value={R}
                    onChange={(e) => setR(e.target.value)}
                    placeholder="0"
                    style={{ width: "100%" }}
                  />
                </label>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <label>
                  X 최소
                  <input
                    type="number"
                    value={xRangeVF.min}
                    onChange={(e) =>
                      setXRangeVF((r) => ({ ...r, min: +e.target.value }))
                    }
                    style={{ width: 90 }}
                  />
                </label>
                <label>
                  X 최대
                  <input
                    type="number"
                    value={xRangeVF.max}
                    onChange={(e) =>
                      setXRangeVF((r) => ({ ...r, max: +e.target.value }))
                    }
                    style={{ width: 90 }}
                  />
                </label>
                <label>
                  Y 최소
                  <input
                    type="number"
                    value={yRangeVF.min}
                    onChange={(e) =>
                      setYRangeVF((r) => ({ ...r, min: +e.target.value }))
                    }
                    style={{ width: 90 }}
                  />
                </label>
                <label>
                  Y 최대
                  <input
                    type="number"
                    value={yRangeVF.max}
                    onChange={(e) =>
                      setYRangeVF((r) => ({ ...r, max: +e.target.value }))
                    }
                    style={{ width: 90 }}
                  />
                </label>
                <label>
                  Z 최소
                  <input
                    type="number"
                    value={zRangeVF.min}
                    onChange={(e) =>
                      setZRangeVF((r) => ({ ...r, min: +e.target.value }))
                    }
                    style={{ width: 90 }}
                  />
                </label>
                <label>
                  Z 최대
                  <input
                    type="number"
                    value={zRangeVF.max}
                    onChange={(e) =>
                      setZRangeVF((r) => ({ ...r, max: +e.target.value }))
                    }
                    style={{ width: 90 }}
                  />
                </label>
                <label>
                  격자 간격(step)
                  <input
                    type="number"
                    min={1}
                    value={vfStep}
                    onChange={(e) => setVfStep(+e.target.value)}
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
                    onChange={(e) =>
                      setDims((d) => ({ ...d, x: +e.target.value || 1 }))
                    }
                    style={{ width: 80 }}
                  />
                </label>
                <label>
                  Y
                  <input
                    type="number"
                    min={1}
                    value={dims.y}
                    onChange={(e) =>
                      setDims((d) => ({ ...d, y: +e.target.value || 1 }))
                    }
                    style={{ width: 80 }}
                  />
                </label>
                <label>
                  Z
                  <input
                    type="number"
                    min={1}
                    value={dims.z}
                    onChange={(e) =>
                      setDims((d) => ({ ...d, z: +e.target.value || 1 }))
                    }
                    style={{ width: 80 }}
                  />
                </label>
              </div>
              <div style={{ fontSize: 12, opacity: 0.8 }}>
                ※ JSON 붙여넣기가 비어 있으면 위 크기로 0 배열을 생성합니다.
              </div>
              <textarea
                value={json}
                onChange={(e) => setJson(e.target.value)}
                rows={8}
                placeholder="예) [[[0,1],[1,0]],[[1,1],[0,0]]]"
                style={{ width: "100%", fontFamily: "monospace" }}
              />
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
          <button onClick={onClose} className="vault-btn">
            취소
          </button>
          <button onClick={submit} className="vault-btn">
            생성
          </button>
        </div>
      </div>
    </div>
  );
}
