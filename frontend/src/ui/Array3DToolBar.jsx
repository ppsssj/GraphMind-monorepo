// src/ui/Array3DToolBar.jsx
import { useMemo } from "react";
import "./Array3DToolBar.css";

function normalizeOrder(order) {
  const ord = String(order || "zyx").toLowerCase();
  return /^[xyz]{3}$/.test(ord) ? ord : "zyx";
}

function getDimsByOrder(data, order = "zyx") {
  const a0 = Array.isArray(data) ? data.length : 0;
  const a1 = Array.isArray(data?.[0]) ? data[0].length : 0;
  const a2 = Array.isArray(data?.[0]?.[0]) ? data[0][0].length : 0;

  const ord = normalizeOrder(order);

  // order[0]축 길이=a0, order[1]=a1, order[2]=a2
  const dims = { x: 0, y: 0, z: 0 };
  dims[ord[0]] = a0;
  dims[ord[1]] = a1;
  dims[ord[2]] = a2;

  return { X: dims.x, Y: dims.y, Z: dims.z, ord, a0, a1, a2 };
}

function buildGetter(data, ord) {
  const idxOf = { x: -1, y: -1, z: -1 };
  idxOf[ord[0]] = 0;
  idxOf[ord[1]] = 1;
  idxOf[ord[2]] = 2;

  return (x, y, z) => {
    const a = [0, 0, 0];
    a[idxOf.x] = x;
    a[idxOf.y] = y;
    a[idxOf.z] = z;

    const v = data?.[a[0]]?.[a[1]]?.[a[2]];
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };
}

function axisSchemaLabel(axisOrder) {
  const ord = normalizeOrder(axisOrder);
  // a0=a[ord0], a1=a[ord1], a2=a[ord2]
  // data[a0][a1][a2] → data[ord0][ord1][ord2] 느낌으로 표시
  return `data[${ord[0]}][${ord[1]}][${ord[2]}]`;
}

function formatNumber(n, digits = 3) {
  if (!Number.isFinite(n)) return "-";
  // 너무 긴 소수 방지
  const s = n.toFixed(digits);
  // 1.000 -> 1
  return String(Number(s));
}

export default function Array3DToolBar({
  title = "3D Array Viewer",
  data,
  isSplit,
  setIsSplit,
  threshold,
  setThreshold,
  axisOrder,
  setAxisOrder,
}) {
  const dims = useMemo(
    () => getDimsByOrder(data, axisOrder),
    [data, axisOrder]
  );
  const { X, Y, Z, ord } = dims;

  const stats = useMemo(() => {
    const total = X * Y * Z;
    if (!Array.isArray(data) || total <= 0) {
      return {
        total: 0,
        scanned: 0,
        sampled: false,
        min: 0,
        max: 0,
        mean: 0,
        active: 0,
      };
    }

    // 성능 보호: 너무 크면 샘플링(근사)로 계산
    // 필요시 상향 가능
    const MAX_SCAN = 600_000;
    const sampled = total > MAX_SCAN;

    // stride로 대략 MAX_SCAN 근처를 스캔
    const stride = sampled ? Math.ceil(total / MAX_SCAN) : 1;

    const getV = buildGetter(data, ord);

    let min = Infinity;
    let max = -Infinity;
    let sum = 0;
    let scanned = 0;
    let active = 0;

    // stride 적용: (z,y,x) 순으로 돌면서 scanned 카운트 기반 skip
    // 정확 count가 중요한 케이스면 MAX_SCAN 올리면 됨
    let k = 0;
    for (let z = 0; z < Z; z++) {
      for (let y = 0; y < Y; y++) {
        for (let x = 0; x < X; x++) {
          k++;
          if (stride > 1 && k % stride !== 0) continue;

          const v = getV(x, y, z);

          if (v < min) min = v;
          if (v > max) max = v;
          sum += v;
          scanned++;

          if (v > threshold) active++;
        }
      }
    }

    const mean = scanned > 0 ? sum / scanned : 0;

    // sampled일 때는 active를 근사로 확장(대략치)해서 보여줌
    const activeEst =
      sampled && scanned > 0 ? Math.round((active / scanned) * total) : active;

    return {
      total,
      scanned,
      sampled,
      min: Number.isFinite(min) ? min : 0,
      max: Number.isFinite(max) ? max : 0,
      mean,
      active: activeEst,
    };
  }, [data, X, Y, Z, ord, threshold]);

  const onChangeThreshold = (e) => {
    const v = Number(e.target.value);
    setThreshold(Number.isFinite(v) ? v : 0);
  };

  const schema = axisSchemaLabel(axisOrder);
  const ratio = stats.total > 0 ? (stats.active / stats.total) * 100 : 0;

  return (
    <div className="toolbar array-toolbar">
      <div className="array-toolbar-left">
        <div className="array-toolbar-title">{title}</div>

        <div className="array-toolbar-meta">
          <div>
            Size: <span className="array-toolbar-dim">{X}</span> ×{" "}
            <span className="array-toolbar-dim">{Y}</span> ×{" "}
            <span className="array-toolbar-dim">{Z}</span>
            <span className="array-toolbar-submeta">
              {" "}
              (cells: {stats.total.toLocaleString()})
            </span>
          </div>

          <div className="array-toolbar-submeta">
            Schema: <span className="array-toolbar-mono">{schema}</span>
          </div>

          <div className="array-toolbar-submeta">
            Stats: min{" "}
            <span className="array-toolbar-mono">
              {formatNumber(stats.min, 4)}
            </span>{" "}
            / max{" "}
            <span className="array-toolbar-mono">
              {formatNumber(stats.max, 4)}
            </span>{" "}
            / mean{" "}
            <span className="array-toolbar-mono">
              {formatNumber(stats.mean, 4)}
            </span>
          </div>

          <div className="array-toolbar-submeta">
            Active( &gt; {threshold} ):{" "}
            <span className="array-toolbar-mono">
              {stats.active.toLocaleString()}
            </span>{" "}
            <span className="array-toolbar-submeta">
              ({formatNumber(ratio, 2)}%)
            </span>
            {stats.sampled ? (
              <span className="array-toolbar-warn">
                {" "}
                • sampled ({stats.scanned.toLocaleString()} scanned)
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="array-toolbar-right">
        <div className="array-toolbar-field">
          <label className="array-toolbar-label">Axis</label>
          <select
            className="array-toolbar-select"
            value={axisOrder}
            onChange={(e) => setAxisOrder(e.target.value)}
          >
            <option value="zyx">zyx (data[z][y][x])</option>
            <option value="xyz">xyz (data[x][y][z])</option>
            <option value="xzy">xzy</option>
            <option value="yxz">yxz</option>
            <option value="yzx">yzx</option>
            <option value="zxy">zxy</option>
          </select>
        </div>

        <div className="array-toolbar-field">
          <label className="array-toolbar-label">Threshold</label>
          <input
            className="array-toolbar-input"
            type="number"
            step="1"
            value={threshold}
            onChange={onChangeThreshold}
          />
        </div>

        <button
          className="btn array-toolbar-btn"
          onClick={() => setIsSplit((v) => !v)}
        >
          {isSplit ? "Merge View" : "Split View"}
        </button>
      </div>
    </div>
  );
}
