// src/ui/Surface3DView.jsx
// Throttled fit (100ms preview) + final fit on drag end,
// with "stay close to original" constraint via delta-fitting + anchor regularization.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Surface3DCanvas from "./Surface3DCanvas";
import { create, all } from "mathjs";

const mathjs = create(all, {});

function stripEq(expr) {
  const s = String(expr ?? "");
  return s.includes("=") ? s.split("=").pop().trim() : s.trim();
}

function makeScalarFn(expr) {
  const rhs = stripEq(expr || "0") || "0";
  try {
    const compiled = mathjs.compile(rhs);
    return (x, y) => {
      try {
        const v = compiled.evaluate({ x, y });
        const num = Number(v);
        return Number.isFinite(num) ? num : 0;
      } catch {
        return 0;
      }
    };
  } catch {
    return () => 0;
  }
}

function fmtCoef(x) {
  if (!Number.isFinite(x)) return "0";
  const s = x.toFixed(6);
  return s.replace(/\.?0+$/, "");
}

function buildPolyExpr(terms) {
  const parts = [];
  for (const t of terms) {
    const c = t.coef;
    if (!Number.isFinite(c) || Math.abs(c) < 1e-10) continue;

    const sign = c >= 0 ? "+" : "-";
    const abs = Math.abs(c);
    const coefStr = fmtCoef(abs);

    const factors = [];
    if (!(abs === 1 && (t.i !== 0 || t.j !== 0))) factors.push(coefStr);
    if (t.i > 0) factors.push(t.i === 1 ? "x" : `x^${t.i}`);
    if (t.j > 0) factors.push(t.j === 1 ? "y" : `y^${t.j}`);

    const body = factors.length ? factors.join("*") : "0";
    parts.push({ sign, body });
  }

  if (!parts.length) return "0";
  let expr = `${parts[0].sign === "-" ? "-" : ""}${parts[0].body}`;
  for (let k = 1; k < parts.length; k++) expr += ` ${parts[k].sign} ${parts[k].body}`;
  return expr;
}

/**
 * "원래 수식에서 크게 벗어나는" 문제를 줄이기 위한 접근
 * - base(x,y) 위에 delta(x,y) (다항식)만 학습
 * - 앵커 포인트(도메인 그리드)에 delta=0을 약하게 걸어 전체 형태가 과도하게 휘는 것을 방지
 * - ridge(λ)로 계수 폭주 방지
 */
function fitSurfaceDeltaPolynomial(markers, degree, baseFn, domain, opts = {}) {
  const d = Math.max(1, Math.min(6, Math.floor(Number(degree) || 2)));
  const base = typeof baseFn === "function" ? baseFn : (() => 0);

  const markerWeight = Number.isFinite(opts.markerWeight) ? opts.markerWeight : 1.0;
  const anchorWeight = Number.isFinite(opts.anchorWeight) ? opts.anchorWeight : 0.25; // ↑ 더 크면 더 "원본 고정"
  const lambda = Number.isFinite(opts.lambda) ? opts.lambda : 1e-4; // ↑ 더 크면 더 "강성"
  const anchorGrid = Math.max(3, Math.min(20, Math.floor(opts.anchorGrid ?? 10)));

  const pts = (Array.isArray(markers) ? markers : [])
    .map((m) => ({ x: Number(m?.x), y: Number(m?.y), z: Number(m?.z) }))
    .filter((p) => [p.x, p.y].every(Number.isFinite) && Number.isFinite(p.z));

  if (pts.length < 1) return { ok: false, reason: "points 부족" };

  const basis = [];
  for (let i = 0; i <= d; i++) {
    for (let j = 0; j <= d - i; j++) basis.push({ i, j });
  }
  const M = basis.length;

  // rows = marker rows + anchor rows
  const rows = [];
  for (const p of pts) {
    const r = p.z - base(p.x, p.y);
    rows.push({ x: p.x, y: p.y, r, w: markerWeight });
  }

  // anchors: delta ≈ 0
  if (domain && Number.isFinite(domain.xMin) && Number.isFinite(domain.xMax) && Number.isFinite(domain.yMin) && Number.isFinite(domain.yMax)) {
    const xmin = domain.xMin;
    const xmax = domain.xMax;
    const ymin = domain.yMin;
    const ymax = domain.yMax;
    for (let iy = 0; iy < anchorGrid; iy++) {
      const ty = anchorGrid === 1 ? 0.5 : iy / (anchorGrid - 1);
      const y = ymin + (ymax - ymin) * ty;
      for (let ix = 0; ix < anchorGrid; ix++) {
        const tx = anchorGrid === 1 ? 0.5 : ix / (anchorGrid - 1);
        const x = xmin + (xmax - xmin) * tx;
        rows.push({ x, y, r: 0, w: anchorWeight });
      }
    }
  }

  const N = rows.length;
  const A = mathjs.zeros(N, M);
  const R = mathjs.zeros(N, 1);
  const W = mathjs.zeros(N, N);

  for (let r = 0; r < N; r++) {
    const { x, y, r: rr, w } = rows[r];
    R.set([r, 0], rr);
    W.set([r, r], Math.max(1e-8, w));
    for (let c = 0; c < M; c++) {
      const { i, j } = basis[c];
      A.set([r, c], Math.pow(x, i) * Math.pow(y, j));
    }
  }

  // Weighted normal equations: (A^T W A + λI) w = A^T W R
  const AT = mathjs.transpose(A);
  const ATW = mathjs.multiply(AT, W);
  const ATWA = mathjs.multiply(ATW, A);
  const ATWR = mathjs.multiply(ATW, R);
  const I = mathjs.identity(M);
  const ATWAreg = mathjs.add(ATWA, mathjs.multiply(lambda, I));

  let wSol;
  try {
    wSol = mathjs.lusolve(ATWAreg, ATWR);
  } catch {
    return { ok: false, reason: "solve 실패" };
  }

  const terms = basis.map((b, idx) => ({ i: b.i, j: b.j, coef: Number(wSol.get([idx, 0])) }));
  const deltaExpr = buildPolyExpr(terms);
  return { ok: true, deltaExpr, degree: d };
}

export default function Surface3DView({
  surface3d,
  onChange,
  onPointAdd,
  onPointRemove,
}) {
  const merged = useMemo(() => {
    const s = surface3d ?? {};
    return {
      expr: s.expr ?? "sin(x) * cos(y)",
      baseExpr: s.baseExpr ?? null,

      xMin: Number.isFinite(Number(s.xMin)) ? Number(s.xMin) : -5,
      xMax: Number.isFinite(Number(s.xMax)) ? Number(s.xMax) : 5,
      yMin: Number.isFinite(Number(s.yMin)) ? Number(s.yMin) : -5,
      yMax: Number.isFinite(Number(s.yMax)) ? Number(s.yMax) : 5,
      nx: Number.isFinite(Number(s.nx)) ? Number(s.nx) : 60,
      ny: Number.isFinite(Number(s.ny)) ? Number(s.ny) : 60,

      gridMode: s.gridMode ?? "major",
      gridStep: Number.isFinite(Number(s.gridStep)) ? Number(s.gridStep) : 1,
      minorDiv: Number.isFinite(Number(s.minorDiv)) ? Number(s.minorDiv) : 4,

      editMode: Boolean(s.editMode ?? true),
      degree: Number.isFinite(Number(s.degree)) ? Number(s.degree) : 2,

      markers: Array.isArray(s.markers) ? s.markers : [],
    };
  }, [surface3d]);

  const commit = useCallback((patch) => onChange?.(patch), [onChange]);

  // ✅ 드래그 중 100ms throttled fit (preview), 드래그 끝에서 1회 final fit
  // - previewExpr는 로컬 상태로만 유지하여 Undo/Redo 히스토리 오염을 방지합니다.
  const [previewExpr, setPreviewExpr] = useState(null);
  const lastFitTsRef = useRef(0);
  const pendingTimerRef = useRef(null);
  const lastMarkersRef = useRef(null);

  const clearPending = useCallback(() => {
    if (pendingTimerRef.current) {
      clearTimeout(pendingTimerRef.current);
      pendingTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    setPreviewExpr(null);
    clearPending();
    lastFitTsRef.current = 0;
    lastMarkersRef.current = null;
  }, [merged.expr, merged.degree, clearPending]);

  useEffect(() => () => clearPending(), [clearPending]);

  const handleMarkersChange = useCallback(
    (nextMarkers, { fit = false } = {}) => {
      commit({ markers: nextMarkers });
      lastMarkersRef.current = nextMarkers;

      if (!merged.editMode) return;

      const baseRhs = stripEq(merged.expr || "0") || "0";
      const baseFn = makeScalarFn(baseRhs);
      const domain = { xMin: merged.xMin, xMax: merged.xMax, yMin: merged.yMin, yMax: merged.yMax };

      const composeExpr = (deltaExpr) => {
        if (!deltaExpr || deltaExpr === "0") return baseRhs;
        return `(${baseRhs}) + (${deltaExpr})`;
      };

      const doFit = (ms, { final } = { final: false }) => {
        const res = fitSurfaceDeltaPolynomial(ms, merged.degree, baseFn, domain, {
          markerWeight: 1.0,
          anchorWeight: 0.25,
          anchorGrid: 10,
          lambda: 1e-4,
        });
        if (res.ok) {
          const composed = composeExpr(res.deltaExpr);
          if (final) {
            commit({ expr: composed });
            setPreviewExpr(null);
          } else {
            setPreviewExpr(composed);
          }
        } else if (final) {
          console.warn("[Surface3DView] surface fit failed:", res.reason);
          setPreviewExpr(null);
        }
      };

      // ✅ 드래그 끝: 최종 1회 fit + state 반영
      if (fit) {
        clearPending();
        doFit(nextMarkers, { final: true });
        return;
      }

      // ✅ 드래그 중: 100ms마다 preview fit
      const now = typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
      const interval = 100;
      const elapsed = now - (lastFitTsRef.current || 0);

      if (elapsed >= interval) {
        lastFitTsRef.current = now;
        doFit(nextMarkers, { final: false });
        return;
      }

      if (!pendingTimerRef.current) {
        pendingTimerRef.current = setTimeout(() => {
          pendingTimerRef.current = null;
          const latest = lastMarkersRef.current;
          if (!latest) return;
          const t = typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
          lastFitTsRef.current = t;
          doFit(latest, { final: false });
        }, Math.max(0, interval - elapsed));
      }
    },
    [commit, merged.editMode, merged.expr, merged.degree, merged.xMin, merged.xMax, merged.yMin, merged.yMax, clearPending]
  );

  const handlePointAdd = useCallback(
    (pt) => {
      if (typeof onPointAdd === "function") return onPointAdd(pt);
      commit({ markers: [...(merged.markers || []), pt] });
    },
    [onPointAdd, merged.markers, commit]
  );

  const handlePointRemove = useCallback(
    ({ id, index } = {}) => {
      if (typeof onPointRemove === "function") return onPointRemove({ id, index });
      const arr = Array.isArray(merged.markers) ? [...merged.markers] : [];
      if (id != null) {
        const k = arr.findIndex((m) => (m?.id ?? null) === id);
        if (k >= 0) arr.splice(k, 1);
      } else if (Number.isFinite(Number(index))) {
        const i = Number(index);
        if (i >= 0 && i < arr.length) arr.splice(i, 1);
      }
      commit({ markers: arr });
    },
    [onPointRemove, merged.markers, commit]
  );

  if (!surface3d) return <div className="empty-hint">3D 곡면 정보가 없습니다.</div>;

  return (
    <div className="graph-view">
      <Surface3DCanvas
        expr={previewExpr ?? merged.expr}
        baseExpr={merged.baseExpr}
        xMin={merged.xMin}
        xMax={merged.xMax}
        yMin={merged.yMin}
        yMax={merged.yMax}
        nx={merged.nx}
        ny={merged.ny}
        markers={merged.markers}
        editMode={merged.editMode}
        degree={merged.degree}
        onPointAdd={handlePointAdd}
        onPointRemove={handlePointRemove}
        onMarkersChange={handleMarkersChange}
        gridMode={merged.gridMode}
        gridStep={merged.gridStep}
        minorDiv={merged.minorDiv}
      />
    </div>
  );
}
